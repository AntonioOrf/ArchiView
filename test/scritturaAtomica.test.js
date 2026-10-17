const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scriviAtomico, scriviAtomicoSync } = require('../out/main/scritturaAtomica');

console.log('Running scritturaAtomica tests...');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-atomico-'));
  try {
    const file = path.join(dir, 'database_manoscritti.json');

    const payload = [];
    for (let i = 0; i < 12; i++) {
      payload.push(JSON.stringify({ n: i, manoscritti: [], cartelle: [], pad: String(i).repeat(200_000 + (i % 3) * 300_000) }));
    }
    const esiti = await Promise.allSettled(payload.map(p => scriviAtomico(file, p)));
    const falliti = esiti.filter(e => e.status === 'rejected');
    assert.deepStrictEqual(falliti.map(e => String(e.reason && e.reason.code || e.reason)), [], 'nessun salvataggio deve fallire');

    const finale = fs.readFileSync(file, 'utf8');
    assert.strictEqual(finale, payload[payload.length - 1], 'il file deve essere esattamente l\'ultimo payload');

    const avanzi = fs.readdirSync(dir).filter(n => n !== 'database_manoscritti.json');
    assert.deepStrictEqual(avanzi, [], 'nessun .tmp residuo');

    await assert.rejects(scriviAtomico(path.join(dir, 'manca', 'x.json'), '{}'));
    assert.deepStrictEqual(fs.readdirSync(dir), ['database_manoscritti.json']);

    await scriviAtomico(file, '{"ok":1}');
    assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"ok":1}');

    const impostazioni = path.join(dir, 'settings.json');
    scriviAtomicoSync(impostazioni, '{"a":1}');
    scriviAtomicoSync(impostazioni, '{"b":2}');
    assert.strictEqual(fs.readFileSync(impostazioni, 'utf8'), '{"b":2}');
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['database_manoscritti.json', 'settings.json']);

    const veroRename = fs.renameSync;
    let rifiuti = 2;
    fs.renameSync = (da, a) => {
      if (rifiuti-- > 0) throw Object.assign(new Error('occupato'), { code: rifiuti ? 'EPERM' : 'EBUSY' });
      return veroRename(da, a);
    };
    try { scriviAtomicoSync(impostazioni, '{"c":3}'); } finally { fs.renameSync = veroRename; }
    assert.strictEqual(fs.readFileSync(impostazioni, 'utf8'), '{"c":3}');

    console.log('scritturaAtomica tests passed.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
