const fs = require('fs');
const fp = '/workspace/DazeAPI/web/src/components/settings/DashboardSetting.jsx';
let code = fs.readFileSync(fp, 'utf8');

const replacements = [
  // import
  ["import { API, showError, showSuccess, toBoolean } from '../../helpers';",
   "import { API, showError, showSuccess, toBoolean } from '../../helpers';\nimport { useTranslation } from 'react-i18next';"],
  // hook
  ['const DashboardSetting = () => {',
   'const DashboardSetting = () => {\n  const { t } = useTranslation();'],
  // showError / showSuccess / showError
  ["showError('刷新失败');",
   "showError(t('刷新失败'));"],
  ["showSuccess('旧配置迁移完成');",
   "showSuccess(t('旧配置迁移完成'));"],
  // 迁移失败包含拼接，用模板字符串
  ["showError('迁移失败: ' + (err.message || '未知错误'));",
   "showError(`${t('迁移失败')}: ${err.message || t('未知错误')}`);"],
  // Modal props
  ['title={"配置迁移确认"}',
   "title={t('配置迁移确认')}"],
  ['okText={"确认迁移"}',
   "okText={t('确认迁移')}"],
  ['cancelText={"取消"}',
   "cancelText={t('取消')}"],
  // Modal content
  ['<p>{"检测到旧版本的配置数据，是否要迁移到新的配置格式？"}</p>',
   "<p>{t('检测到旧版本的配置数据，是否要迁移到新的配置格式？')}</p>"],
  // 注意 + 正文（注意这里有两段 JSX expression 紧紧相邻）
  ['<strong>{"注意："}</strong>{"\\n            迁移过程中会自动处理数据格式转换，迁移完成后旧配置将被清除，请在迁移前在数据库中备份好旧配置。\\n          "}',
   "<strong>{t('注意：')}</strong>{t('迁移过程中会自动处理数据格式转换，迁移完成后旧配置将被清除，请在迁移前在数据库中备份好旧配置。')}"],
];

let changes = 0;
for (const [oldStr, newStr] of replacements) {
  const before = code;
  code = code.replaceAll(oldStr, newStr);
  if (code !== before) {
    changes++;
    console.log(`  ✓ replaced: ${oldStr.slice(0, 70).replace(/\\n/g, '\\\\n')}...`);
  } else {
    console.warn(`  ⚠ not found: ${oldStr.slice(0, 70).replace(/\\n/g, '\\\\n')}...`);
  }
}

fs.writeFileSync(fp, code);
console.log(`Done. ${changes} replacement groups applied.`);
