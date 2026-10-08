// Audit A2: join Hub e ripristino Drive non devono sovrascrivere un archivio esistente con lo
// stesso nome di cartella: il database del server finisce in una cartella nuova.
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');

function stub(id, exports) {
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const aperti = [];
stub(require.resolve('electron'), { ipcMain: { handle() {} }, dialog: {}, app: { getPath: () => os.tmpdir() } });
stub(require.resolve(path.join(OUT, 'workspaceManager.js')), {
  state: { workspacePath: '', mainWindow: null },
  initWorkspace: (p) => aperti.push(p),
  getAllSettings: () => ({})
});
stub(require.resolve(path.join(OUT, 'vaultConfig.js')), { readVaultConfig: () => ({}), syncUnifiedFromLegacy: () => {} });

const { clonaWorkspace } = require(path.join(OUT, 'ipc', 'workspaceIpc.js'));

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'av-clona-'));
try {
  console.log('Running clonaWorkspace tests...');
  const esistente = path.join(base, 'Archivio');
  fs.mkdirSync(esistente);
  fs.writeFileSync(path.join(esistente, 'database_manoscritti.json'), 'LOCALE');

  const remoto = { manoscritti: [{ id: 'r1' }], cartelle: [] };
  assert.strictEqual(clonaWorkspace(base, 'Archivio', null, remoto), true);
  assert.strictEqual(fs.readFileSync(path.join(esistente, 'database_manoscritti.json'), 'utf8'), 'LOCALE',
    'il database dell\'archivio esistente resta intatto');
  const nuova = path.join(base, 'Archivio (2)');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(nuova, 'database_manoscritti.json'), 'utf8')).manoscritti, remoto.manoscritti);
  assert.deepStrictEqual(aperti, [nuova]);
  console.log('✅ Test 1: cartella con un database → si usa "Nome (2)".');

  // Una cartella vuota con quel nome (creata a mano) si usa così com'è.
  fs.mkdirSync(path.join(base, 'Vuota'));
  assert.strictEqual(clonaWorkspace(base, 'Vuota', null, remoto), true);
  assert.strictEqual(aperti[1], path.join(base, 'Vuota'));
  console.log('✅ Test 2: cartella senza database → riusata.');
  console.log('Tutti i test clonaWorkspace passati con successo!');
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}
