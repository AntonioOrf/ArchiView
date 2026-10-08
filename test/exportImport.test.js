// Audit A3/A7: export ZIP e duplicazione leggono gli allegati come oggetti `{ nome, … }`.
// Prima leggevano `name`: l'export di una scheda con allegati lanciava, la duplicazione
// toglieva tutti gli allegati (e le loro trascrizioni).
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');

function stub(id, exports) {
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'av-expimp-'));
const zipPath = path.join(ws, 'export.zip');
let destinazione = zipPath;
const handlers = {};
stub(require.resolve('electron'), {
  ipcMain: { handle: (canale, fn) => { handlers[canale] = fn; } },
  dialog: {
    showSaveDialog: async () => ({ canceled: false, filePath: destinazione }),
    showOpenDialog: async () => ({ canceled: false, filePaths: [zipPath] })
  },
  app: { getPath: () => os.tmpdir() }
});
const state = { workspacePath: ws, dataFilePath: path.join(ws, 'database_manoscritti.json'),
  // Audit A4: cartella allegati personalizzata, fuori dall'archivio (es. NAS).
  attachmentsDirPath: fs.mkdtempSync(path.join(os.tmpdir(), 'av-allegati-')) };
stub(require.resolve(path.join(OUT, 'workspaceManager.js')), { state, getAllSettings: () => ({}) });

const { setupExportImportIpc } = require(path.join(OUT, 'ipc', 'exportImportIpc.js'));
setupExportImportIpc();

function elencoZip(file) {
  const yauzl = require('yauzl');
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      const nomi = [];
      zip.on('entry', (e) => { nomi.push(e.fileName); zip.readEntry(); });
      zip.on('end', () => resolve(nomi.sort()));
      zip.readEntry();
    });
  });
}

(async () => {
  console.log('Running exportImport tests...');
  fs.writeFileSync(path.join(state.attachmentsDirPath, 'carta1.jpg'), 'immagine');
  fs.writeFileSync(state.dataFilePath, JSON.stringify({
    manoscritti: [{ id: 'm1', segnatura: 'MS 1', cartella: 'A',
      allegati: [{ nome: 'carta1.jpg', tipo: 'image/jpeg', trascrizione: '<p>incipit</p>' }] }],
    cartelle: ['A', 'B']
  }));

  const esito = await handlers['export-zip']({}, ['m1']);
  assert.strictEqual(esito.success, true, 'export riuscito: ' + esito.error);
  assert.deepStrictEqual(await elencoZip(zipPath), ['allegati/carta1.jpg', 'schedatura.json']);
  console.log('✅ Test 1: l\'export ZIP include gli allegati.');

  fs.rmSync(path.join(state.attachmentsDirPath, 'carta1.jpg'));
  const imp = await handlers['import-zip']({});
  assert.strictEqual(imp.success, true, 'import riuscito: ' + imp.error);
  assert.ok(fs.existsSync(path.join(state.attachmentsDirPath, 'carta1.jpg')), 'l\'import scrive nella cartella allegati attiva');
  console.log('✅ Test 1-bis: l\'import ZIP scrive nella cartella allegati attiva.');

  const dup = await handlers['duplicate-records']({}, ['m1'], 'B');
  assert.strictEqual(dup.success, true);
  const db = JSON.parse(fs.readFileSync(state.dataFilePath, 'utf8'));
  const copia = db.manoscritti.find(m => m.id !== 'm1');
  assert.strictEqual(copia.cartella, 'B');
  assert.strictEqual(copia.allegati.length, 1, 'la copia conserva l\'allegato');
  const a = copia.allegati[0];
  assert.notStrictEqual(a.nome, 'carta1.jpg', 'la copia ha un file proprio');
  assert.strictEqual(a.trascrizione, '<p>incipit</p>', 'la trascrizione resta');
  assert.strictEqual(a.tipo, 'image/jpeg');
  assert.strictEqual(fs.readFileSync(path.join(state.attachmentsDirPath, a.nome), 'utf8'), 'immagine');
  assert.strictEqual(db.manoscritti.find(m => m.id === 'm1').allegati[0].nome, 'carta1.jpg', 'l\'originale non cambia');
  console.log('✅ Test 2: la duplicazione copia allegati e trascrizioni.');
  // Audit A9: destinazione non scrivibile (qui una cartella) → esito d'errore, non eccezione né attesa infinita.
  destinazione = ws;
  const errore = await handlers['export-zip']({}, ['m1']);
  assert.strictEqual(errore.success, false);
  console.log('✅ Test 3: destinazione non scrivibile → errore restituito.');
  console.log('Tutti i test exportImport passati con successo!');
})().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => { for (const d of [ws, state.attachmentsDirPath]) fs.rmSync(d, { recursive: true, force: true }); });
