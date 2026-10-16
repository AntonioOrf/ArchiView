const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');

function stub(rel, exports) {
  const id = require.resolve(path.join(OUT, rel));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

(async () => {
  console.log('Running hubAttachmentsIndice tests...');
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'av-hubatt-'));
  const attDir = path.join(ws, 'allegati_manoscritti');
  fs.mkdirSync(attDir);
  fs.writeFileSync(path.join(attDir, 'a.jpg'), 'contenuto allegato');
  const dbPath = path.join(ws, 'database_manoscritti.json');
  fs.writeFileSync(dbPath, JSON.stringify({ manoscritti: [{ id: 'm1', lastModified: Date.now(), allegati: [{ nome: 'a.jpg' }] }] }));

  const { splitFileIntoChunks } = require(path.join(OUT, 'chunkingLogic.js'));
  const hashes = await splitFileIntoChunks(path.join(attDir, 'a.jpg'), path.join(ws, 'tmp-chunks'));

  const chiamate = [];
  stub('workspaceManager.js', {
    state: { workspacePath: ws, dataFilePath: dbPath, attachmentsDirPath: attDir },
    finestraPrincipale: () => null,
    loadHubConfig: () => ({ hubUrl: 'https://hub.example', repoId: 'r1', repoKey: 'k', encKey: null })
  });
  stub('ipc/drive/auth.js', { loadSavedTokens: () => true });
  stub('ipc/drive/fileOps.js', {
    getOrCreateFolder: async () => 'cartella',
    uploadFileReturningId: async () => { throw new Error('nessun upload atteso'); },
    makeFilePublic: async () => {},
    asyncPool: (_n, arr, fn) => Promise.all(arr.map(fn))
  });
  stub('ipc/cloudCredentials.js', { GOOGLE_API_KEY: '' });
  stub('ipc/hubClient.js', {
    chiamataHub: async (_cfg, method, suffisso, opzioni = {}) => {
      chiamate.push({ method, suffisso, body: opzioni.body });
      if (method === 'GET') return { ok: true, status: 200, data: {
        selfMemberId: 'io',
        chunks: hashes.map(h => ({ hash: h, url: 'https://x/' + h, uploaderMemberId: 'io' })),
        files: [{ fileName: 'a.jpg', hashes, lastModified: 1000, deleted: true }]
      } };
      return { ok: true, status: 200, data: {} };
    }
  });

  const { syncHubAttachments } = require(path.join(OUT, 'ipc', 'hubAttachments.js'));
  const origLog = console.log;
  console.log = () => {};
  let esito;
  try { esito = await syncHubAttachments(); } finally { console.log = origLog; }
  fs.rmSync(ws, { recursive: true, force: true });

  assert.deepStrictEqual(esito.errors, []);
  const post = chiamate.find(c => c.method === 'POST' && c.suffisso === '/attachments/index');
  assert.ok(post, 'l\'indice va ripubblicato');
  const voce = post.body.files.find(f => f.fileName === 'a.jpg');
  assert.ok(voce && !voce.deleted, 'la voce ripubblicata non è più deleted');
  assert.deepStrictEqual(voce.hashes, hashes);
  console.log('✅ Test 1: un allegato ripristinato torna nell\'indice condiviso, via chiamataHub.');
  console.log('Tutti i test hubAttachmentsIndice passati con successo!');
})().catch((e) => { console.error(e); process.exit(1); });
