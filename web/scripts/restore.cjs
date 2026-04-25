const fs = require('fs');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const files = [
  'src/components/auth/TwoFAVerification.jsx',
  'src/components/common/markdown/MarkdownRenderer.jsx',
  'src/components/layout/headerbar/LanguageSelector.jsx',
  'src/components/playground/DebugPanel.jsx',
  'src/components/playground/MessageContent.jsx',
  'src/components/playground/ThinkingContent.jsx',
  'src/components/settings/DashboardSetting.jsx',
  'src/components/settings/SystemSetting.jsx',
  'src/components/table/model-deployments/DeploymentsColumnDefs.jsx',
  'src/pages/Chat2Link/index.jsx',
  'src/pages/Setting/Model/SettingGlobalModel.jsx',
  'src/pages/Setting/Operation/SettingsChannelAffinity.jsx',
  'src/pages/Setting/Payment/SettingsPaymentGatewayStripe.jsx',
];

for (const rel of files) {
  const fp = `/workspace/DazeAPI/web/${rel}`;
  const code = fs.readFileSync(fp, 'utf8');
  let ast;
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    console.warn('Parse error', rel, e.message);
    continue;
  }

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === 'react-i18next') {
        path.remove();
      }
    },
  });

  traverse(ast, {
    VariableDeclarator(path) {
      if (
        t.isCallExpression(path.node.init) &&
        t.isIdentifier(path.node.init.callee) &&
        path.node.init.callee.name === 'useTranslation'
      ) {
        if (t.isObjectPattern(path.node.id)) {
          const parent = path.parentPath;
          if (t.isVariableDeclaration(parent.node)) {
            parent.remove();
          }
        }
      }
    },
  });

  traverse(ast, {
    CallExpression(path) {
      const { node } = path;
      if (
        t.isIdentifier(node.callee) &&
        node.callee.name === 't' &&
        node.arguments.length === 1 &&
        t.isStringLiteral(node.arguments[0])
      ) {
        path.replaceWith(t.stringLiteral(node.arguments[0].value));
      }
    },
  });

  const out = generate(ast, { jsescOption: { minimal: true } }).code;
  fs.writeFileSync(fp, out);
  console.log('Restored', rel);
}
console.log('Done');
