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
const nomiProposti = [];
const handlers = {};
stub(require.resolve('electron'), {
  ipcMain: { handle: (canale, fn) => { handlers[canale] = fn; } },
  dialog: {
    showSaveDialog: async (o) => { nomiProposti.push(o && o.defaultPath); return { canceled: false, filePath: destinazione }; },
    showOpenDialog: async () => ({ canceled: false, filePaths: [zipPath] })
  },
  app: { getPath: () => os.tmpdir() }
});
const state = { workspacePath: ws, dataFilePath: path.join(ws, 'database_manoscritti.json'),
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

  const prima = fs.readFileSync(state.dataFilePath, 'utf8');
  const dup = await handlers['duplica-allegati']({}, [
    { nome: 'carta1.jpg', prefisso: 'nuovo-id' }, { nome: 'carta1.jpg', prefisso: 'nuovo-id' },
    { nome: 'manca.jpg', prefisso: 'x' }, { nome: '../fuori.jpg', prefisso: 'x' }]);
  assert.strictEqual(dup.success, true, dup.error);
  assert.deepStrictEqual(dup.nomi, ['nuovo-id_carta1.jpg', 'nuovo-id_carta1_2.jpg', null, null]);
  assert.strictEqual(fs.readFileSync(path.join(state.attachmentsDirPath, dup.nomi[1]), 'utf8'), 'immagine');
  assert.strictEqual(fs.readFileSync(state.dataFilePath, 'utf8'), prima, 'il main non tocca il DB');
  console.log('✅ Test 2: la duplicazione copia i file con nomi liberi e non tocca il DB.');
  fs.writeFileSync(state.dataFilePath, JSON.stringify({ manoscritti: [
    { id: 'm2', segnatura: 'MS 2', allegati: [{ nome: '..' }, { nome: 'carta1.jpg' }] }] }));
  const ostile = await handlers['export-zip']({}, ['m2']);
  assert.strictEqual(ostile.success, true, 'export riuscito: ' + ostile.error);
  assert.deepStrictEqual(await elencoZip(zipPath), ['allegati/carta1.jpg', 'schedatura.json']);
  console.log('✅ Test 2-bis: un nome di allegato ostile non entra nello ZIP.');

  fs.writeFileSync(state.dataFilePath, JSON.stringify({ manoscritti: [{ id: 'm3', segnatura: 'Busta 3/fasc. 2: atti', allegati: [] }] }));
  nomiProposti.length = 0;
  await handlers['export-zip']({}, ['m3']);
  assert.ok(nomiProposti[0] && !/[\\/:*?"<>|]/.test(nomiProposti[0]), 'nome proposto senza caratteri vietati: ' + nomiProposti[0]);
  console.log('✅ Test 2-ter: nome proposto dell\'export ripulito (R4).');
  destinazione = ws;
  const errore = await handlers['export-zip']({}, ['m1']);
  assert.strictEqual(errore.success, false);
  console.log('✅ Test 3: destinazione non scrivibile → errore restituito.');
  console.log('Tutti i test exportImport passati con successo!');
})().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => { for (const d of [ws, state.attachmentsDirPath]) fs.rmSync(d, { recursive: true, force: true }); });
