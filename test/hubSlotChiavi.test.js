const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'av-hubslot-'));
const stato = { workspacePath: '' };

function stub(id, exports) {
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub(require.resolve('electron'), {
  app: { getPath: () => userData },
  safeStorage: { isEncryptionAvailable: () => false }
});
stub(require.resolve(path.join(OUT, 'workspaceManager.js')), {
  state: stato, getActiveVaultFlags: () => ({}), getAllSettings: () => ({})
});
const store = require(path.join(OUT, 'cloudTokenStore.js'));
const slotDir = path.join(userData, 'cloud-tokens');

const nuovoArchivio = (nome) => {
  const p = path.join(userData, 'archivi', nome);
  fs.mkdirSync(p, { recursive: true });
  return p;
};
const apri = (p) => { stato.workspacePath = p; };
const slotVecchio = (repo, p, segreti) => {
  fs.mkdirSync(slotDir, { recursive: true });
  const h = crypto.createHash('sha256').update(p).digest('hex').slice(0, 12);
  fs.writeFileSync(path.join(slotDir, `hub-${repo}-${h}.json`), JSON.stringify(segreti));
};

try {
  console.log('Running hubSlotChiavi tests...');

  let a = nuovoArchivio('Notarile');
  apri(a);
  assert.ok(store.saveHubSecrets('repo1', { repoKey: 'K1', encKey: 'E1' }));
  const spostato = path.join(userData, 'archivi', 'Notarile spostato');
  fs.renameSync(a, spostato);
  apri(spostato);
  assert.deepStrictEqual(store.loadHubSecrets('repo1'), { repoKey: 'K1', encKey: 'E1' }, 'archivio spostato');
  console.log('✅ Test 1: chiavi ritrovate dopo lo spostamento della cartella.');

  let b = nuovoArchivio('Catasto');
  slotVecchio('repo2', b, { repoKey: 'K2' });
  const rinominato = path.join(userData, 'archivi', 'Catasto 1427');
  fs.renameSync(b, rinominato);
  apri(rinominato);
  assert.deepStrictEqual(store.loadHubSecrets('repo2'), { repoKey: 'K2' }, 'migrazione dallo slot unico');
  apri(rinominato);
  assert.deepStrictEqual(store.loadHubSecrets('repo2'), { repoKey: 'K2' }, 'seconda lettura dallo slot nuovo');
  console.log('✅ Test 2: slot per percorso unico migrato dopo una rinomina.');

  const owner = nuovoArchivio('Owner'), membro = nuovoArchivio('Membro');
  apri(owner); store.saveHubSecrets('repo3', { repoKey: 'OWNER' });
  apri(membro); store.saveHubSecrets('repo3', { repoKey: 'MEMBRO' });
  apri(owner); assert.strictEqual(store.loadHubSecrets('repo3').repoKey, 'OWNER');
  apri(membro); assert.strictEqual(store.loadHubSecrets('repo3').repoKey, 'MEMBRO');
  console.log('✅ Test 3: owner e membro sullo stesso PC restano separati.');

  const x = nuovoArchivio('X'), y = nuovoArchivio('Y');
  slotVecchio('repo4', x, { repoKey: 'X' });
  slotVecchio('repo4', y, { repoKey: 'Y' });
  apri(nuovoArchivio('Z'));
  assert.strictEqual(store.loadHubSecrets('repo4'), null, 'più candidati: nessuna scelta');
  apri(x);
  assert.strictEqual(store.loadHubSecrets('repo4').repoKey, 'X');
  console.log('✅ Test 4: con più slot candidati non si indovina; al posto giusto sì.');

  apri(owner);
  const clone = nuovoArchivio('Clone');
  store.saveHubSecrets('repo5', { repoKey: 'C' }, clone);
  apri(clone);
  assert.strictEqual(store.loadHubSecrets('repo5').repoKey, 'C');
  console.log('✅ Test 5: i segreti del clone si ritrovano aprendolo.');

  console.log('Tutti i test hubSlotChiavi passati con successo!');
} finally {
  fs.rmSync(userData, { recursive: true, force: true });
}
