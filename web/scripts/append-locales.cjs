const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/Chat2Link/index.jsx',
  'src/components/auth/TwoFAVerification.jsx',
  'src/components/settings/DashboardSetting.jsx',
];

// 正则提取 t('...') 或 t("...")
const tRegex = /t\(['"]([^'"]+)['"]\)/g;
const keys = new Set();

for (const rel of files) {
  const fp = path.join('/workspace/DazeAPI/web', rel);
  const code = fs.readFileSync(fp, 'utf8');
  let m;
  while ((m = tRegex.exec(code)) !== null) {
    keys.add(m[1]);
  }
}

const localeDir = '/workspace/DazeAPI/web/src/i18n/locales';
const locales = ['zh-CN', 'zh-TW', 'en', 'fr', 'ru', 'ja', 'vi'];

for (const locale of locales) {
  const fp = path.join(localeDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const tr = data.translation || {};
  let added = 0;

  for (const key of keys) {
    if (!(key in tr)) {
      added++;
      if (locale === 'zh-CN') {
        tr[key] = key;
      } else if (locale === 'zh-TW' && key !== '日本語') {
        // zh-TW 和 zh-CN 对于大多数字符相同，先设为空
        tr[key] = '';
      } else {
        tr[key] = '';
      }
    }
  }

  if (added > 0) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
    console.log(`✅ ${locale}.json: added ${added} new keys`);
  } else {
    console.log(`➡️  ${locale}.json: no new keys`);
  }
}

console.log(`\nTotal unique keys extracted: ${keys.size}`);
for (const k of Array.from(keys).sort()) {
  console.log(`  - ${k}`);
}
