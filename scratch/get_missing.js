const fs = require('fs');
const lines = fs.readFileSync('src/renderer/locales/en/messages.po', 'utf8').split(/\r?\n/);
const missing = [];
for (let i=0; i<lines.length; i++) {
    if (lines[i] === 'msgstr ""') {
        const match = lines[i-1].match(/msgid "(.*)"/);
        if (match) missing.push(match[1]);
    }
}
console.log('MISSING:', missing);
