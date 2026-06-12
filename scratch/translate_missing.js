const fs = require('fs');
const path = require('path');

const poPath = path.join(__dirname, '../src/renderer/locales/en/messages.po');
let poContent = fs.readFileSync(poPath, 'utf8');

const translations = {
    'upload_in_progress': 'Uploading...',
    'title_source_control': 'Version Control',
    'download_in_progress': 'Downloading...',
    'sync_in_progress': 'Syncing...'
};

for (const [key, value] of Object.entries(translations)) {
    const regex = new RegExp(`msgid "${key}"\\r?\\nmsgstr ""`, 'g');
    poContent = poContent.replace(regex, `msgid "${key}"\nmsgstr "${value}"`);
}

fs.writeFileSync(poPath, poContent, 'utf8');
console.log('Translations applied successfully!');
