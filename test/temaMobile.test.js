const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { genera } = require('../scripts/tema-mobile');

console.log('Running temaMobile tests...');

const file = path.join(__dirname, '..', 'mobile', 'src', 'theme', 'colori.ts');
assert.strictEqual(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), genera(),
  'mobile/src/theme/colori.ts non è allineato a style.css: esegui `npm run tema-mobile`');
assert.ok(!/var\(/.test(genera()));

console.log('✓ temaMobile: colori del telefono allineati a style.css');
