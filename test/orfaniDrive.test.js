// Audit sync S3: la pulizia degli allegati orfani su Drive deve considerare anche il DB remoto,
// o cestina i chunk degli allegati dei colleghi non ancora ricevuti in locale.
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');
const H_MIO = 'a'.repeat(64);
const H_COLLEGA = 'b'.repeat(64);
const H_ORFANO = 'c'.repeat(64);

function stub(rel, exports) {
  const id = require.resolve(path.join(OUT, rel));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

function preparaWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'av-orfani-'));
  fs.writeFileSync(path.join(ws, 'database_manoscritti.json'),
    JSON.stringify({ manoscritti: [{ id: 'm1', allegati: [{ nome: 'mio.jpg' }] }] }));
  return ws;
}

/** Drive finto: `remoto` è il DB su Drive (o una funzione che lancia). Registra i cestinati. */
function driveFinto(remoto) {
  const cestinati = [];
  const indice = { 'mio.jpg': [H_MIO], 'collega.jpg': [H_COLLEGA], 'vecchio.jpg': [H_ORFANO] };
  const files = {
    list: async ({ q }) => {
      if (q.startsWith("name='index.json'")) return { data: { files: [{ id: 'idx' }] } };
      if (q.startsWith("name='data'")) return { data: { files: [{ id: 'data' }] } };
      if (q.startsWith("name='database_manoscritti.json'")) return { data: { files: [{ id: 'db', modifiedTime: new Date().toISOString() }] } };
      if (q.startsWith("'data' in parents")) return { data: { files: [H_MIO, H_COLLEGA, H_ORFANO].map(h => ({ id: 'f-' + h, name: h })) } };
      throw new Error('query inattesa: ' + q);
    },
    get: async ({ fileId }) => {
      if (fileId === 'idx') return { data: JSON.stringify(indice) };
      if (fileId === 'db') { if (typeof remoto === 'function') return remoto(); return { data: remoto }; }
      return { data: { id: fileId } }; // probe della cartella vault
    },
    update: async ({ fileId }) => { cestinati.push(fileId.slice(2)); return {}; }
  };
  return { drive: { files }, cestinati };
}

async function pulisci(remoto) {
  for (const k of Object.keys(require.cache)) if (k.startsWith(OUT)) delete require.cache[k];
  const ws = preparaWorkspace();
  const finto = driveFinto(remoto);
  stub('workspaceManager.js', {
    state: { workspacePath: ws },
    getAllSettings: () => ({}), saveAllSettings: () => {},
    getActiveVaultFlags: () => ({ isSharedVault: true, sharedVaultId: 'vault' })
  });
  stub('ipc/drive/auth.js', {
    driveState: finto.drive ? { drive: finto.drive } : null,
    loadSavedTokens: () => true, authenticateDrive: async () => {},
    classifyDriveFolderError: () => null
  });
  stub('ipc/drive/fileOps.js', {
    getOrCreateFolder: async () => 'vault', withDriveRetry: (fn) => fn(),
    uploadFile: async () => Date.now()
  });
  const { cleanOrphanedAttachments } = require(path.join(OUT, 'ipc', 'drive', 'vaultOps.js'));
  const esito = await cleanOrphanedAttachments();
  fs.rmSync(ws, { recursive: true, force: true });
  return { esito, cestinati: finto.cestinati.sort() };
}

(async () => {
  console.log('Running orfaniDrive tests...');
  const origErr = console.error;
  console.error = () => {};
  try {
    const remoto = { manoscritti: [{ id: 'm2', allegati: [{ nome: 'collega.jpg' }] }] };
    const r1 = await pulisci(remoto);
    assert.deepStrictEqual(r1.cestinati, [H_ORFANO], 'solo il chunk non usato né in locale né sul remoto va cestinato');
    console.log('✅ Test 1: gli allegati del DB remoto non vengono cestinati.');

    const r2 = await pulisci(() => { throw new Error('rete giù'); });
    assert.deepStrictEqual(r2.cestinati, [], 'DB remoto illeggibile: nessuna cestinazione');
    const r3 = await pulisci('{non è json');
    assert.deepStrictEqual(r3.cestinati, [], 'DB remoto corrotto: nessuna cestinazione');
    console.log('✅ Test 2: DB remoto illeggibile o corrotto → nessuna pulizia su Drive.');
  } finally {
    console.error = origErr;
  }
  console.log('Tutti i test orfaniDrive passati con successo!');
})().catch((e) => { console.error(e); process.exit(1); });
