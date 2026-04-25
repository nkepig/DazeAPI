const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const ROOT_DIR = path.join(__dirname, '..', 'src');

// 只替换这些 JSX 属性中的中文字符串
const TARGET_ATTRS = new Set([
  'label',
  'placeholder',
  'title',
  'okText',
  'cancelText',
  'description',
  'text',
  'heading',
  'subTitle',
  'content',
  'header',
  'footer',
  'empty',
  'tooltip',
  'tip',
  'message',
  'fieldLabel',
  'addonBefore',
  'addonAfter',
]);

// 只替换这些函数调用参数中的中文字符串
const TARGET_CALLEES = new Set([
  'showError',
  'showSuccess',
  'showInfo',
  'showWarning',
  'showNotice',
  'Toast.error',
  'Toast.success',
  'Toast.info',
  'Toast.warning',
]);

const CHINESE_RE = /[\u4e00-\u9fff]/;

function hasChinese(str) {
  return CHINESE_RE.test(str);
}

function collectFiles(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('i18n')) {
      collectFiles(full, list);
    } else if (entry.isFile() && /\.(jsx?)$/.test(entry.name)) {
      list.push(full);
    }
  }
  return list;
}

function containsJSXReturn(funcPath) {
  let found = false;
  funcPath.traverse({
    ReturnStatement(p) {
      const arg = p.node.argument;
      if (
        t.isJSXElement(arg) ||
        t.isJSXFragment(arg) ||
        (t.isCallExpression(arg) && /^[A-Z]/.test(arg.callee?.name || ''))
      ) {
        found = true;
        p.skip();
      }
    }
  });
  return found;
}

function isReactComponentFunc(funcPath) {
  // 函数声明且名字首字母大写
  if (funcPath.isFunctionDeclaration()) {
    const name = funcPath.node.id?.name || '';
    if (/^[A-Z]/.test(name)) return true;
  }

  // 箭头/函数表达式
  if (funcPath.isFunctionExpression() || funcPath.isArrowFunctionExpression()) {
    const parent = funcPath.parent;
    // const Comp = () => ...
    if (t.isVariableDeclarator(parent) && /^[A-Z]/.test(parent.id?.name || '')) return true;
    // export default () => ...
    if (t.isExportDefaultDeclaration(parent)) return true;
    // React.memo(...) / forwardRef(...)
    if (t.isCallExpression(parent)) {
      const callee = parent.callee;
      if (t.isIdentifier(callee)) {
        if (callee.name === 'memo' || callee.name === 'forwardRef' || /^[A-Z]/.test(callee.name)) return true;
      }
      if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
        if (callee.property.name === 'memo' || callee.property.name === 'forwardRef') return true;
      }
    }
  }

  // fallback：任何函数体里 return 了 JSX 的都算组件
  return containsJSXReturn(funcPath);
}

function findComponentFunction(path) {
  let funcPath = path.getFunctionParent();
  while (funcPath) {
    if (isReactComponentFunc(funcPath)) return funcPath;
    funcPath = funcPath.getFunctionParent();
  }
  return null;
}

function getCalleeName(callExprNode) {
  if (!callExprNode || !callExprNode.callee) return '';
  const callee = callExprNode.callee;
  if (t.isIdentifier(callee)) return callee.name;
  if (t.isMemberExpression(callee) && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
    return `${callee.object.name}.${callee.property.name}`;
  }
  return '';
}

function processFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx'],
      allowReturnOutsideFunction: true
    });
  } catch (e) {
    console.warn(`⚠️ Parse error in ${path.relative(ROOT_DIR, filePath)}: ${e.message}`);
    return false;
  }

  let hasUseTranslationImport = false;
  let hasTVariable = false;
  const modifiedFuncs = new Set();

  // 第一轮：扫描文件的 i18n 现状
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === 'react-i18next') {
        for (const spec of path.node.specifiers) {
          if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported) && spec.imported.name === 'useTranslation') {
            hasUseTranslationImport = true;
          }
        }
      }
    },
    VariableDeclarator(path) {
      const { node } = path;
      if (
        t.isCallExpression(node.init) &&
        t.isIdentifier(node.init.callee) &&
        node.init.callee.name === 'useTranslation'
      ) {
        if (t.isObjectPattern(node.id)) {
          const hasT = node.id.properties.some((p) => {
            if (t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 't') return true;
            if (t.isObjectProperty(p) && t.isIdentifier(p.value) && p.value.name === 't') return true;
            return false;
          });
          if (hasT) hasTVariable = true;
        }
      }
    }
  });

  let modified = false;

  // 第二轮：执行替换
  traverse(ast, {
    // JSX 文本节点：如 <div>中文</div>
    JSXText(path) {
      const raw = path.node.value;
      if (!hasChinese(raw)) return;

      path.replaceWith(
        t.jsxExpressionContainer(
          t.callExpression(t.identifier('t'), [t.stringLiteral(raw)])
        )
      );
      modified = true;
      const compFunc = findComponentFunction(path);
      if (compFunc) modifiedFuncs.add(compFunc);
    },

    // JSX 属性值：如 label="中文"
    JSXAttribute(path) {
      const { node } = path;
      if (!t.isJSXIdentifier(node.name)) return;
      const attrName = node.name.name;
      if (!TARGET_ATTRS.has(attrName)) return;
      if (!t.isStringLiteral(node.value)) return;
      if (!hasChinese(node.value.value)) return;

      node.value = t.jsxExpressionContainer(
        t.callExpression(t.identifier('t'), [t.stringLiteral(node.value.value)])
      );
      modified = true;
      const compFunc = findComponentFunction(path);
      if (compFunc) modifiedFuncs.add(compFunc);
    },

    // 字符串字面量：只替换特定函数参数
    StringLiteral(path) {
      const raw = path.node.value;
      if (!hasChinese(raw)) return;

      // 已经在 t(...) 里
      if (
        t.isCallExpression(path.parent.node) &&
        t.isIdentifier(path.parent.node.callee) &&
        path.parent.node.callee.name === 't'
      ) return;

      // import 语句中的源路径不处理
      if (t.isImportDeclaration(path.parent.node) || t.isImportSpecifier(path.parent.node)) return;
      // JSX 属性名本身
      if (t.isJSXAttribute(path.parent.node) && path.parent.node.name === path.node) return;

      if (!t.isCallExpression(path.parent.node)) return;

      const calleeName = getCalleeName(path.parent.node);
      if (!TARGET_CALLEES.has(calleeName)) return;

      // 找到外层组件函数；找不到则跳过（避免在非 React 文件注入 hook）
      const compFunc = findComponentFunction(path);
      if (!compFunc) return;

      path.replaceWith(
        t.callExpression(t.identifier('t'), [t.stringLiteral(raw)])
      );
      modified = true;
      modifiedFuncs.add(compFunc);
    }
  });

  if (!modified) return false;

  // 注入 import { useTranslation } from 'react-i18next'
  if (!hasUseTranslationImport) {
    const decl = t.importDeclaration(
      [t.importSpecifier(t.identifier('useTranslation'), t.identifier('useTranslation'))],
      t.stringLiteral('react-i18next')
    );
    ast.program.body.unshift(decl);
    hasUseTranslationImport = true;
  }

  // 在每个有替换的组件函数顶部注入 const { t } = useTranslation();
  for (const funcPath of modifiedFuncs) {
    const body = funcPath.node.body;
    if (!t.isBlockStatement(body)) continue;

    // 检查该函数是否已有 const { t } = useTranslation()
    const alreadyHasT = body.body.some((stmt) => {
      if (!t.isVariableDeclaration(stmt)) return false;
      return stmt.declarations.some((decl) => {
        if (!t.isCallExpression(decl.init)) return false;
        if (!t.isIdentifier(decl.init.callee) || decl.init.callee.name !== 'useTranslation') return false;
        if (!t.isObjectPattern(decl.id)) return false;
        return decl.id.properties.some((p) => {
          if (t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 't') return true;
          if (t.isObjectProperty(p) && t.isIdentifier(p.value) && p.value.name === 't') return true;
          return false;
        });
      });
    });

    if (!alreadyHasT) {
      const hookCode = parse(`const { t } = useTranslation();`, {
        sourceType: 'module',
        plugins: ['jsx']
      });
      const stmt = hookCode.program.body[0];
      body.body.unshift(stmt);
    }
  }

  try {
    const output = generate(ast, { retainLines: true }).code;
    fs.writeFileSync(filePath, output);
    console.log(`✅ ${path.relative(ROOT_DIR, filePath)}`);
    return true;
  } catch (e) {
    console.warn(`⚠️ Generate error in ${path.relative(ROOT_DIR, filePath)}: ${e.message}`);
    return false;
  }
}

const files = collectFiles(ROOT_DIR);
console.log(`🔎 Found ${files.length} JS/JSX files to scan...`);
let modifiedCount = 0;
for (const fp of files) {
  if (processFile(fp)) modifiedCount++;
}
console.log(`🏁 Done. Modified ${modifiedCount} files.`);
