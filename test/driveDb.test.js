// Audit A13: una sola ricerca del database su Drive per pull e controllo aggiornamenti.
// Con un archivio aperto non si ripiega mai sul database di un altro vault: prima
// checkUpdatesFromDrive, con la cartella del vault vuota, prendeva il più recente dell'account.
const path = require('path');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');
function stub(rel, exports) {
  const id = require.resolve(path.join(OUT, rel));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const ALTRO = { id: 'altro', modifiedTime: '2026-10-01T00:00:00Z', parents: ['vault-altrui'] };
let nellaCartella = [];
const files = {
  list: async ({ q }) => ({ data: { files: q.includes("in parents") ? nellaCartella : [ALTRO] } }),
  get: async ({ fileId }) => ({ data: fileId === 'mio' ? { manoscritti: [] } : { id: fileId } })
};
const state = { workspacePath: 'C:/ws' };
stub('workspaceManager.js', { state, getAllSettings: () => ({}), saveAllSettings: () => {},
  getActiveVaultFlags: () => ({ isSharedVault: true, sharedVaultId: 'vault' }) });
stub('ipc/drive/auth.js', { driveState: { drive: { files } }, loadSavedTokens: () => true,
  authenticateDrive: async () => {}, classifyDriveFolderError: () => null });
stub('ipc/drive/fileOps.js', { getOrCreateFolder: async () => 'vault', uploadFile: async () => 0, withDriveRetry: (fn) => fn() });
const { checkUpdatesFromDrive, pullFromDrive } = require(path.join(OUT, 'ipc', 'drive', 'vaultOps.js'));

(async () => {
  console.log('Running driveDb tests...');
  assert.strictEqual(await checkUpdatesFromDrive(), null, 'cartella vuota: nessun aggiornamento, non il DB di un altro vault');
  assert.strictEqual(await pullFromDrive(), null);
  console.log('✅ Test 1: archivio aperto, cartella vuota → null in entrambi.');

  nellaCartella = [{ id: 'mio', modifiedTime: '2026-10-05T00:00:00Z' }];
  assert.strictEqual(await checkUpdatesFromDrive(), Date.parse('2026-10-05T00:00:00Z'));
  assert.deepStrictEqual((await pullFromDrive()).database, { manoscritti: [] });
  console.log('✅ Test 2: il DB della cartella del vault.');

  state.workspacePath = '';
  nellaCartella = [];
  assert.strictEqual(await checkUpdatesFromDrive(), Date.parse(ALTRO.modifiedTime));
  console.log('✅ Test 3: senza archivio aperto (primo ingresso) si cerca in tutto l\'account.');
  console.log('Tutti i test driveDb passati con successo!');
})().catch((e) => { console.error(e); process.exitCode = 1; });
