const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'out', 'main');
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'av-storia-'));
const id = require.resolve(path.join(OUT, 'workspaceManager.js'));
require.cache[id] = { id, filename: id, loaded: true, exports: { state: { workspacePath: ws }, getAllSettings: () => ({}) } };
const snapshots = require(path.join(OUT, 'snapshots.js'));

const testo = 'item die predicto in civitate coram domino potestate comparuit '.repeat(40);
function db(versione) {
  const manoscritti = [];
  for (let i = 0; i < 5000; i++) manoscritti.push({ id: 's' + i, segnatura: 'Busta ' + i, trascrizione: testo, note: i === 7 ? 'v' + versione : '' });
  return { manoscritti, cartelle: [] };
}

(async () => {
  console.log('Running storiaRecord tests...');
  try {
    const dir = path.join(ws, '.archiview', 'snapshots');
    fs.mkdirSync(dir, { recursive: true });
    const inizio = new Date(2026, 9, 1, 10, 0, 0).getTime();
    for (let n = 0; n < 12; n++) {
      const nome = snapshots.nomeSnapshot(inizio + n * 3600 * 1000, 'auto');
      fs.writeFileSync(path.join(dir, nome), zlib.gzipSync(JSON.stringify(db(Math.floor(n / 3)))));
    }

    let ultimo = Date.now();
    let attesaMax = 0;
    const sonda = setInterval(() => { const ora = Date.now(); attesaMax = Math.max(attesaMax, ora - ultimo); ultimo = ora; }, 5);
    const t0 = Date.now();
    const tappe = await snapshots.storiaRecord('s7');
    clearInterval(sonda);
    console.log(`  storiaRecord: ${Date.now() - t0} ms, attesa massima dell'event loop ${attesaMax} ms`);

    assert.deepStrictEqual(tappe.map(t => t.record.note), ['v3', 'v2', 'v1', 'v0'], 'una tappa per ogni versione, dalla più recente');
    assert.ok(attesaMax < 150,`il main non resta bloccato: attesa massima ${attesaMax} ms`);
    console.log('✅ Test 1: cronologia corretta senza bloccare il main.');
    console.log('Tutti i test storiaRecord passati con successo!');
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
