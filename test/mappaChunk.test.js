const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const { leggiMappaChunk, scriviMappaChunk, conMappaChunk, percorsoMappaChunk } = require('../out/main/chunkingLogic');

(async () => {
  console.log('Running mappaChunk tests...');
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'av-chunkmap-'));
  const file = path.join(ws, 'a.jpg');
  fs.writeFileSync(file, 'uno');
  let calcoli = 0;
  const H = (n) => String(n).repeat(64).slice(0, 64);
  const calcola = async () => { calcoli++; return [H(calcoli)]; };

  try {
    let mappa = leggiMappaChunk(ws);
    assert.deepStrictEqual(mappa, {}, 'mappa assente → vuota');
    let r = await conMappaChunk(mappa, 'drive:a.jpg', file, calcola);
    assert.deepStrictEqual(r, { valore: [H(1)], ricalcolato: true });
    await scriviMappaChunk(ws, mappa);

    mappa = leggiMappaChunk(ws);
    r = await conMappaChunk(mappa, 'drive:a.jpg', file, calcola);
    assert.deepStrictEqual(r, { valore: [H(1)], ricalcolato: false });
    assert.strictEqual(calcoli, 1, 'file invariato: nessun ricalcolo dopo la rilettura della mappa');
    console.log('✅ Test 1: file invariato → valore dalla mappa, nessuna lettura.');

    const dopo = new Date(Date.now() + 5000);
    fs.utimesSync(file, dopo, dopo);
    r = await conMappaChunk(mappa, 'drive:a.jpg', file, calcola);
    assert.deepStrictEqual(r, { valore: [H(2)], ricalcolato: true }, 'mtime cambiato → ricalcolo');
    fs.writeFileSync(file, 'più lungo');
    fs.utimesSync(file, dopo, dopo);
    r = await conMappaChunk(mappa, 'drive:a.jpg', file, calcola);
    assert.strictEqual(r.ricalcolato, true, 'dimensione cambiata → ricalcolo');
    r = await conMappaChunk(mappa, 'hub:r1:a.jpg', file, calcola);
    assert.strictEqual(r.ricalcolato, true, 'chiavi diverse non si confondono');
    console.log('✅ Test 2: mtime, dimensione o chiave diversi → ricalcolo.');

    fs.writeFileSync(percorsoMappaChunk(ws), JSON.stringify({ x: { mtimeMs: 1, size: 1, valore: ['../../segreto'] } }));
    assert.deepStrictEqual(leggiMappaChunk(ws), {}, 'voce ostile (hash non valido) scartata');
    fs.writeFileSync(percorsoMappaChunk(ws), '{rotto');
    assert.deepStrictEqual(leggiMappaChunk(ws), {}, 'mappa corrotta → vuota');
    console.log('✅ Test 3: mappa corrotta o con hash non validi → si ricalcola.');
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
  console.log('Tutti i test mappaChunk passati con successo!');
})().catch((e) => { console.error(e); process.exit(1); });
