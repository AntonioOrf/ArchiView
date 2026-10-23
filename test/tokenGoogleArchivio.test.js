const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'av-tokgoogle-'));
const stato = { workspacePath: '' };
let flags = {};

function stub(id, exports) {
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub(require.resolve('electron'), {
  app: { getPath: () => userData },
  safeStorage: { isEncryptionAvailable: () => false }
});
stub(require.resolve(path.join(OUT, 'workspaceManager.js')), {
  state: stato, getActiveVaultFlags: () => flags, getAllSettings: () => ({})
});
const store = require(path.join(OUT, 'cloudTokenStore.js'));

const nuovoArchivio = (nome) => {
  const p = path.join(userData, 'archivi', nome);
  fs.mkdirSync(p, { recursive: true });
  return p;
};

try {
  console.log('Running tokenGoogleArchivio tests...');

  stato.workspacePath = nuovoArchivio('Notarile');
  flags = { isPersonalCloud: true, sharedVaultId: 'cartellaAccountUno' };
  const chiave = store.activeVaultKey();
  fs.mkdirSync(path.dirname(store.tokenPathFor('google', chiave)), { recursive: true });
  fs.writeFileSync(store.tokenPathFor('google', chiave), 'SECONDO_ACCOUNT');

  flags = { isPersonalCloud: true, sharedVaultId: 'cartellaAccountDue' };
  assert.strictEqual(store.activeVaultKey(), chiave, 'la chiave non dipende dalla cartella Drive');
  flags = { isPersonalCloud: true, sharedVaultId: null };
  assert.strictEqual(store.activeVaultKey(), chiave, 'backup in attesa di cartella: stessa chiave, non global');
  console.log('✅ Test 1: l\'account scelto resta all\'archivio anche se cambia la cartella Drive.');

  const vecchio = store.tokenPathFor('google', 'cartellaStorica');
  fs.writeFileSync(vecchio, 'TOKEN_STORICO');
  stato.workspacePath = nuovoArchivio('Catasto');
  flags = { isSharedVault: true, sharedVaultId: 'cartellaStorica' };
  const k2 = store.activeVaultKey();
  assert.notStrictEqual(k2, chiave);
  assert.strictEqual(fs.readFileSync(store.tokenPathFor('google', k2), 'utf8'), 'TOKEN_STORICO', 'token per cartella migrato');
  console.log('✅ Test 2: il token salvato per cartella Drive passa alla chiave dell\'archivio.');

  flags = {};
  assert.strictEqual(store.activeVaultKey(), 'global');
  console.log('✅ Test 3: archivio locale usa il token globale.');
  console.log('Tutti i test tokenGoogleArchivio passati con successo!');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  fs.rmSync(userData, { recursive: true, force: true });
}
