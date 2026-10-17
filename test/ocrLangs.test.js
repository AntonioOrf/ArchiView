// S6/P4: i pacchetti lingua OCR si scaricavano senza timeout e senza tetto, e il `.gz` si
// decomprimeva con `gunzipSync` sul thread del main (decine di MB, un archivio-bomba senza fine).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'av-ocrlangs-'));
let risposte = {};
const chiamate = [];
const idE = require.resolve('electron');
require.cache[idE] = { id: idE, filename: idE, loaded: true, exports: {
  app: { getPath: () => userData },
  net: { fetch: async (url, opzioni) => {
    chiamate.push({ url, opzioni });
    const corpo = risposte[url.split('/').pop()];
    return corpo ? { ok: true, headers: { get: () => String(corpo.length) }, arrayBuffer: async () => corpo } : { ok: false };
  } }
} };
const L = require('../out/main/ocr/ocrLangs');

(async () => {
  console.log('Running ocrLangs tests...');
  try {
    const buono = Buffer.alloc(4096, 7);
    risposte = { 'ita.traineddata.gz': zlib.gzipSync(buono) };
    const ok = await L.installaLingua('ita');
    assert.strictEqual(ok.ok, true, JSON.stringify(ok));
    assert.ok(fs.readFileSync(L.percorsoLingua('ita')).equals(buono));
    assert.ok(chiamate[0].opzioni && chiamate[0].opzioni.signal, 'il download ha un timeout');
    console.log('✅ Test 1: installazione con timeout.');

    // Bomba: pochi KB compressi, oltre il tetto decompressi.
    risposte = { 'lat.traineddata.gz': zlib.gzipSync(Buffer.alloc(L.MAX_LINGUA_BYTES + 1)) };
    const bomba = await L.installaLingua('lat');
    assert.strictEqual(bomba.ok, false);
    assert.strictEqual(bomba.errore, 'troppo_grande');
    assert.ok(!fs.existsSync(L.percorsoLingua('lat')), 'nessun file installato');
    assert.deepStrictEqual(fs.readdirSync(L.cartellaLingue()).filter(f => f.endsWith('.part')), []);
    console.log('✅ Test 2: oltre il tetto la lingua non si installa.');
    console.log('Tutti i test ocrLangs passati con successo!');
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
