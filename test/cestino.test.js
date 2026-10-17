const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'av-cestino-'));
const id = require.resolve(path.join(OUT, 'workspaceManager.js'));
require.cache[id] = { id, filename: id, loaded: true,
  exports: { state: { workspacePath: ws }, getAllSettings: () => ({}) } };

const trash = require(path.join(OUT, 'trash.js'));
const scheda = (n) => ({ id: 'm' + n, cartella: '', segnatura: 'MS ' + n });

(async () => {
  console.log('Running cestino tests...');
  await Promise.all([1, 2, 3, 4, 5].map(n => trash.aggiungiAlCestino([scheda(n)])));
  const ids = (await trash.elencaCestino()).map(v => v.record.id).sort();
  assert.deepStrictEqual(ids, ['m1', 'm2', 'm3', 'm4', 'm5'], 'nessuna eliminazione concorrente va persa');
  console.log('✅ Test 1: cinque eliminazioni sovrapposte restano tutte nel cestino.');

  const [presi] = await Promise.all([trash.prendiDalCestino(['m1']), trash.aggiungiAlCestino([scheda(6)])]);
  assert.deepStrictEqual(presi.map(r => r.id), ['m1']);
  const dopo = (await trash.elencaCestino()).map(v => v.record.id).sort();
  assert.deepStrictEqual(dopo, ['m2', 'm3', 'm4', 'm5', 'm6']);
  console.log('✅ Test 2: ripristino ed eliminazione sovrapposti non si annullano.');

  const file = trash.percorsoCestino();
  fs.writeFileSync(file, '[{"record": tronc');
  await trash.aggiungiAlCestino([scheda(7)]);
  const conservati = fs.readdirSync(path.dirname(file)).filter(f => /^cestino\.corrotto-.*\.json$/.test(f));
  assert.strictEqual(conservati.length, 1, 'il file illeggibile si conserva con un altro nome');
  assert.strictEqual(fs.readFileSync(path.join(path.dirname(file), conservati[0]), 'utf8'), '[{"record": tronc');
  assert.deepStrictEqual((await trash.elencaCestino()).map(v => v.record.id), ['m7']);
  console.log('✅ Test 3: cestino corrotto conservato prima di riscrivere.');
  console.log('Tutti i test cestino passati con successo!');
})().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => fs.rmSync(ws, { recursive: true, force: true }));
