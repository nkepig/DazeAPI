const fs = require('fs');
const fp = '/workspace/DazeAPI/web/src/components/auth/TwoFAVerification.jsx';
let code = fs.readFileSync(fp, 'utf8');

// 1. 添加 import
const importIdx = code.indexOf("import { API, showError, showSuccess } from '../../helpers';");
if (importIdx !== -1) {
  const end = code.indexOf(';', importIdx) + 1;
  code = code.slice(0, end) + "\nimport { useTranslation } from 'react-i18next';" + code.slice(end);
}

// 2. 添加 hook
const hookIdx = code.indexOf('const TwoFAVerification = ({');
if (hookIdx !== -1) {
  const openBrace = code.indexOf('=> {', hookIdx);
  if (openBrace !== -1) {
    const afterBrace = openBrace + 4;
    code = code.slice(0, afterBrace) + "\n  const { t } = useTranslation();" + code.slice(afterBrace);
  }
}

// 3. showError / showSuccess 中文参数
const replacements = [
  // handleSubmit 中
  ["showError('请输入验证码');", "showError(t('请输入验证码'));"],
  ["showError('备用码必须是8位');", "showError(t('备用码必须是8位'));"],
  ["showError('验证码必须是6位数字');", "showError(t('验证码必须是6位数字'));"],
  ["showSuccess('登录成功');", "showSuccess(t('登录成功'));"],
  ["showError('验证失败，请重试');", "showError(t('验证失败，请重试'));"],

  // JSX modal text
  ['{"\\n          请输入认证器应用显示的验证码完成登录\\n        "}', "{t('请输入认证器应用显示的验证码完成登录')}"],

  // label & placeholder (same in modal and non-modal)
  ["label={useBackupCode ? '备用码' : '验证码'}", "label={useBackupCode ? t('备用码') : t('验证码')}"],
  ["placeholder={useBackupCode ? '请输入8位备用码' : '请输入6位验证码'}", "placeholder={useBackupCode ? t('请输入8位备用码') : t('请输入6位验证码')}"],

  // 主要按钮
  ['>{"\\n            验证并登录\\n          "}', ">{t('验证并登录')}"],

  // 返回登录按钮
  ['>{"\\n              返回登录\\n            "}', ">{t('返回登录')}"],

  // 切换验证码/备用码按钮
  ["{useBackupCode ? '使用认证器验证码' : '使用备用码'}", "{useBackupCode ? t('使用认证器验证码') : t('使用备用码')}"],

  // Title
  ['{"两步验证"}', "{t('两步验证')}"],

  // 提示
  ['{"提示："}', "{t('提示：')}"],

  // 提示bullet 1（modal和non-modal相同）
  ['<br />{"\\n            • 验证码每30秒更新一次\\n            "}', "<br />{`• ${t('验证码每30秒更新一次')}`}"],

  // 提示bullet 2
  ['<br />{"\\n            • 如果无法获取验证码，请使用备用码\\n            "}', "<br />{`• ${t('如果无法获取验证码，请使用备用码')}`}"],

  // 提示bullet 3（注意这一行开头没有换行，直接是 •）
  ['<br />{"• 每个备用码只能使用一次\\n          "}', "<br />{`• ${t('每个备用码只能使用一次')}`}"],
];

let changes = 0;
for (const [oldStr, newStr] of replacements) {
  const before = code;
  code = code.replaceAll(oldStr, newStr);
  if (code !== before) {
    changes++;
    console.log(`  ✓ replaced: ${oldStr.slice(0, 60).replace(/\\n/g, '\\\\n')}...`);
  } else {
    console.warn(`  ⚠ not found: ${oldStr.slice(0, 60).replace(/\\n/g, '\\\\n')}...`);
  }
}

fs.writeFileSync(fp, code);
console.log(`Done. ${changes} replacement groups applied.`);
