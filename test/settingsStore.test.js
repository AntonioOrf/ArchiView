const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { configuraStore, leggiStore, scriviStore, migraPerfConfig } = require('../out/main/settingsStore');

console.log('Running settingsStore tests...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-settings-'));
const file = path.join(dir, 'settings.json');
const perf = path.join(dir, 'perf-config.json');
const origErr = console.error, origWarn = console.warn;
console.error = console.warn = () => {};

try {
  configuraStore(file);
  assert.deepStrictEqual(leggiStore(), {});
  scriviStore({ lang: 'it', workspacePath: 'D:\\A' });
  scriviStore({ lang: 'en', workspacePath: 'D:\\A' });
  assert.strictEqual(JSON.parse(fs.readFileSync(file + '.bak', 'utf8')).lang, 'it');
  const s = leggiStore(); s.lang = 'xx';
  assert.strictEqual(leggiStore().lang, 'en');

  fs.writeFileSync(file, '{"lang": "en", "workspa');
  configuraStore(file);
  assert.deepStrictEqual(leggiStore(), { lang: 'it', workspacePath: 'D:\\A' });

  fs.writeFileSync(file, '[');
  fs.writeFileSync(file + '.bak', 'null');
  fs.writeFileSync(perf, JSON.stringify({ lowPerf: true }));
  configuraStore(file);
  assert.deepStrictEqual(leggiStore(), {});
  migraPerfConfig(perf);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '[');
  assert.ok(fs.existsSync(perf), 'perf-config.json resta finché la migrazione non riesce');

  fs.writeFileSync(file, JSON.stringify({ lang: 'it' }));
  configuraStore(file);
  migraPerfConfig(perf);
  assert.deepStrictEqual(leggiStore(), { lang: 'it', lowPerf: true });
  assert.ok(!fs.existsSync(perf));
  migraPerfConfig(perf);
  assert.deepStrictEqual(leggiStore(), { lang: 'it', lowPerf: true });

  fs.writeFileSync(perf, JSON.stringify({ lowPerf: false }));
  migraPerfConfig(perf);
  assert.strictEqual(leggiStore().lowPerf, true);
  assert.ok(!fs.existsSync(perf));
} finally {
  console.error = origErr; console.warn = origWarn;
  fs.rmSync(dir, { recursive: true, force: true });
}

const residui = [];
(function visita(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) visita(p);
    else if (/\.ts$/.test(e.name) && /apiSettings\.save\(/.test(fs.readFileSync(p, 'utf8'))) residui.push(p);
  }
})(path.join(__dirname, '..', 'src'));
assert.deepStrictEqual(residui, [], 'usare apiSettings.patch({ chiave: valore })');

console.log('settingsStore tests OK');
