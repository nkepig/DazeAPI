const fs = require('fs');
const path = require('path');
const localeDir = '/workspace/DazeAPI/web/src/i18n/locales';
const locales = ['zh-CN', 'zh-TW', 'en', 'fr', 'ru', 'ja', 'vi'];
const badKeys = ['/api/option/', '/api/option/migrate_console_setting'];

for (const locale of locales) {
  const fp = path.join(localeDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const tr = data.translation || {};
  let removed = 0;
  for (const key of badKeys) {
    if (key in tr) {
      delete tr[key];
      removed++;
    }
  }
  if (removed > 0) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
    console.log(`✅ ${locale}.json: removed ${removed} bad keys`);
  } else {
    console.log(`➡️  ${locale}.json: no bad keys`);
  }
}
