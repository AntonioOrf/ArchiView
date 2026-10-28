const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'av-logout-'));
const stato = { workspacePath: '' };
let flags = {};

function stub(id, exports) {
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub(require.resolve('electron'), {
  app: { getPath: () => userData },
  shell: { openExternal: () => {} },
  safeStorage: { isEncryptionAvailable: () => false }
});
stub(require.resolve(path.join(OUT, 'workspaceManager.js')), {
  state: stato, getActiveVaultFlags: () => flags, getAllSettings: () => ({}), finestraPrincipale: () => null
});
stub(require.resolve(path.join(OUT, 'logAuth.js')), { scriviLogAuth: async () => {}, rimuoviLogVecchi: async () => {} });
stub(path.join(OUT, 'ipc', 'cloudCredentials.js'), { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
const store = require(path.join(OUT, 'cloudTokenStore.js'));
const auth = require(path.join(OUT, 'ipc', 'drive', 'auth.js'));

(async () => {
  try {
    console.log('Running logoutDrive tests...');
    stato.workspacePath = path.join(userData, 'archivi', 'Notarile');
    fs.mkdirSync(stato.workspacePath, { recursive: true });
    flags = { isPersonalCloud: true, sharedVaultId: 'cartellaVecchia' };
    fs.mkdirSync(store.tokensDir(), { recursive: true });
    fs.writeFileSync(store.tokenPathFor('google', 'cartellaVecchia'), '{"refresh_token":"r"}');

    const chiave = store.activeVaultKey();
    assert.ok(fs.existsSync(store.tokenPathFor('google', chiave)), 'token per cartella migrato sulla chiave archivio');

    await auth.logoutDrive();
    store.activeVaultKey();
    assert.ok(!fs.existsSync(store.tokenPathFor('google', chiave)), 'dopo il logout il token non deve ricomparire');
    console.log('✅ Test 1: il logout non lascia token per cartella che resuscitano la sessione.');
    console.log('Tutti i test logoutDrive passati con successo!');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
})();
