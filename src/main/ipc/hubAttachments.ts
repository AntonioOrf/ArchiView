const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { state, finestraPrincipale, loadHubConfig } = require('../workspaceManager');
const { splitFileIntoChunks } = require('../chunkingLogic');
const { loadSavedTokens } = require('./drive/auth');
const { getOrCreateFolder, uploadFileReturningId, makeFilePublic, asyncPool } = require('./drive/fileOps');
const { GOOGLE_API_KEY } = require('./cloudCredentials');
const { safeAttachmentPathOrNull } = require('./pathSafety');
const { fetchChunkGuardata, leggiConTetto } = require('./hubUrlChunk');

// Sincronizzazione allegati per vault Hub.
// Modello: i chunk (5MB, content-addressable) vivono sul Drive PERSONALE di ogni utente con
// permesso `anyone reader`; l'hub conserva solo l'indice hash→URL. Chi non ha Google può
// comunque SCARICARE via HTTPS puro. Privacy: ogni chunk è cifrato AES-256-GCM con la encKey
// per-repo (mai sull'hub); il nonce è derivato deterministicamente per preservare la dedup.

const HTML_RE = /^\s*<(!doctype|html)/i;

function encKeyBuffer(encKey: string | null): Buffer | null {
  if (!encKey) return null;
  try {
    const b = Buffer.from(encKey, 'base64url');
    return b.length === 32 ? b : null;
  } catch { return null; }
}

// Nonce deterministico = HMAC-SHA256(encKey, plaintextHash)[:12].
// Stesso plaintext → stesso nonce → stesso ciphertext → dedup preservata sull'indice.
function deriveNonce(key: Buffer, plaintextHash: string): Buffer {
  return crypto.createHmac('sha256', key).update(plaintextHash).digest().subarray(0, 12);
}

// Blob salvato/pubblicato = nonce(12) || ciphertext || authTag(16). Self-contained: il downloader
// non deve conoscere il plaintextHash per decifrare.
function encryptChunk(key: Buffer | null, plaintext: Buffer, plaintextHash: string): Buffer {
  if (!key) return plaintext;
  const nonce = deriveNonce(key, plaintextHash);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([nonce, ct, cipher.getAuthTag()]);
}

function decryptChunk(key: Buffer | null, blob: Buffer): Buffer {
  if (!key) return blob;
  const nonce = blob.subarray(0, 12);
  const tag = blob.subarray(blob.length - 16);
  const ct = blob.subarray(12, blob.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

const sha256hex = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');

const primaryUrl = (id: string) => `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${GOOGLE_API_KEY}`;
const fallbackUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;

function progress(percent: number, message: string): void {
  const win = finestraPrincipale();
  if (win) win.webContents.send('sync-progress', { percent, message });
}

// Un blob è nonce(12) + al più 5 MB cifrati + tag(16): oltre, non è un nostro chunk. L'URL
// arriva dall'indice Hub (terzi) e può puntare a qualunque file pubblico su Drive; senza tetto
// `arrayBuffer()` lo terrebbe tutto in memoria, e il download ne legge fino a 9 insieme.
const MAX_BYTE_CHUNK = 5 * 1024 * 1024 + 12 + 16;

// Scarica un singolo blob verificandone l'integrità. Ritorna il Buffer del ciphertext o null
// (link morto/interstitial/chunk corrotto → allegato "non disponibile", nessun crash).
async function fetchVerifiedChunk(urls: string[], expectedHash: string): Promise<Buffer | null> {
  for (const url of urls) {
    try {
      // URL dall'indice Hub (terzi): solo host Google, redirect compresi.
      const res = await fetchChunkGuardata(url);
      if (!res.ok) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} status=${res.status} url=${url.slice(0, 60)}`); continue; }
      const ct = res.headers.get('content-type') || '';
      const buf = await leggiConTetto(res, MAX_BYTE_CHUNK);
      if (!buf) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} oltre ${MAX_BYTE_CHUNK}B: scartato`); continue; }
      if (ct.includes('text/html') || HTML_RE.test(buf.subarray(0, 64).toString('utf8'))) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} html/interstitial ct=${ct}`); continue; } // interstitial/errore
      if (sha256hex(buf) !== expectedHash) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} sha256 mismatch (${buf.length}B)`); continue; } // corrotto
      return buf;
    } catch (e: any) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} fetch error: ${e?.message || e}`); }
  }
  return null;
}

// Raccoglie i nomi degli allegati referenziati dal DB + il loro mtime locale (per last-writer-wins).
function collectUsedAttachments(dbPath: string, dir: string): Map<string, number> {
  const used = new Map<string, number>();
  if (!fs.existsSync(dbPath)) return used;
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  for (const m of db.manoscritti || []) {
    for (const a of m.allegati || []) {
      if (!a.nome) continue;
      // Scarta nomi non fidati (path traversal): il DB può arrivare da un membro malevolo.
      const p = safeAttachmentPathOrNull(dir, a.nome);
      if (!p) { console.warn(`[hub-att] nome allegato non sicuro ignorato: ${a.nome}`); continue; }
      let mtime = m.lastModified || 0;
      try { if (fs.existsSync(p)) mtime = Math.max(mtime, fs.statSync(p).mtimeMs); } catch { /* ignore */ }
      used.set(a.nome, mtime);
    }
  }
  return used;
}

async function hubApi(cfg: any, method: string, pathSuffix: string, body?: any): Promise<any> {
  const res = await fetch(`${cfg.hubUrl}/api/repos/${cfg.repoId}${pathSuffix}`, {
    method,
    headers: {
      'Authorization': `Bearer ${cfg.repoKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Hub ${method} ${pathSuffix} → ${res.status}`);
  return res.json();
}

type SyncAttachmentsResult = {
  uploaded: number; downloaded: number; unavailable: number; skippedUpload: boolean;
  hasLocalAttachments: boolean; notPublished: number; decryptFailed: number; errors: string[];
};

async function syncHubAttachmentsImpl(): Promise<SyncAttachmentsResult> {
  if (!state.workspacePath) throw new Error("Nessun workspace aperto");
  const cfg = loadHubConfig();
  if (!cfg || !cfg.hubUrl || !cfg.repoId || !cfg.repoKey) throw new Error("Configurazione Hub assente o incompleta.");
  if (cfg.attachmentsMode === 'off') return { uploaded: 0, downloaded: 0, unavailable: 0, skippedUpload: true, hasLocalAttachments: false, notPublished: 0, decryptFailed: 0, errors: [] };

  const key = encKeyBuffer(cfg.encKey);
  // Path canonici dello state: coerenti con UI, `local-asset://` e `verifica-hash-allegato`
  // (rispettano un'eventuale cartella allegati personalizzata). Path cablati romperebbero
  // il download in quelle configurazioni.
  const dbPath = state.dataFilePath || path.join(state.workspacePath, 'database_manoscritti.json');
  const attDir = state.attachmentsDirPath || path.join(state.workspacePath, 'allegati_manoscritti');
  const plainCache = path.join(state.workspacePath, '.archiview-hubchunks-plain');
  const encCache = path.join(state.workspacePath, '.archiview-hubchunks-enc');

  if (!fs.existsSync(attDir)) fs.mkdirSync(attDir, { recursive: true });
  fs.mkdirSync(plainCache, { recursive: true });
  fs.mkdirSync(encCache, { recursive: true });

  const used = collectUsedAttachments(dbPath, attDir);
  const hasLocalAttachments = Array.from(used.keys()).some(fileName => {
    try { return fs.statSync(path.join(attDir, fileName)).isFile(); } catch { return false; }
  });
  let uploaded = 0, downloaded = 0, unavailable = 0, skippedUpload = false, notPublished = 0, decryptFailed = 0;
  const errors: string[] = [];

  console.log(`[hub-att] start repo=${cfg.repoId} attDir=${attDir} used=${used.size} encKey=${key ? 'set' : 'null'}`);

  try {
    // Indice remoto attuale
    const remote = await hubApi(cfg, 'GET', '/attachments/index');
    const remoteChunks: Map<string, any> = new Map((remote.chunks || []).map((c: any) => [c.hash, c]));
    const remoteFiles: Map<string, any> = new Map((remote.files || []).map((f: any) => [f.fileName, f]));
    const selfMemberId: string | null = remote.selfMemberId ?? null;

    // ---------- UPLOAD (solo chi ha Google auth) ----------
    const hasGoogle = loadSavedTokens();
    console.log(`[hub-att] index remoteFiles=${remoteFiles.size} remoteChunks=${remoteChunks.size} selfMemberId=${selfMemberId} hasGoogle=${!!hasGoogle}`);
    if (hasGoogle) {
      const chunkFolderId = await getHubChunkFolder(cfg.repoId);
      const newChunks: any[] = [];
      const newFiles: any[] = [];

      for (const [fileName, mtime] of used) {
        const localPath = safeAttachmentPathOrNull(attDir, fileName);
        if (!localPath || !fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) continue;

        // 1. split plaintext → 2. cifra ogni chunk → ctHash
        const plainHashes: string[] = await splitFileIntoChunks(localPath, plainCache);
        const ctHashes: string[] = [];
        for (const ph of plainHashes) {
          const blob = encryptChunk(key, fs.readFileSync(path.join(plainCache, ph)), ph);
          const ctHash = sha256hex(blob);
          ctHashes.push(ctHash);
          const encPath = path.join(encCache, ctHash);
          if (!fs.existsSync(encPath)) fs.writeFileSync(encPath, blob);
        }

        // last-writer-wins: ripubblica il file solo se cambiato o più recente del remoto
        const existing = remoteFiles.get(fileName);
        const changed = !existing || JSON.stringify(existing.hashes) !== JSON.stringify(ctHashes);
        if (changed && (!existing || mtime >= (existing.lastModified || 0))) {
          newFiles.push({ fileName, hashes: ctHashes, lastModified: mtime });
        }

        // upload dei soli blob mancanti sull'hub
        const missing = ctHashes.filter(h => !remoteChunks.has(h) && !newChunks.find(c => c.hash === h));
        console.log(`[hub-att] upload file="${fileName}" chunks=${ctHashes.length} changed=${changed} missing=${missing.length}`);
        // Un errore su un chunk (es. makeFilePublic bloccato da policy account) NON deve abortire
        // l'intera sync: lo registriamo e proseguiamo con gli altri file.
        await asyncPool(5, missing, async (ctHash: string) => {
          try {
            const id = await uploadFileReturningId(path.join(encCache, ctHash), ctHash, chunkFolderId);
            await makeFilePublic(id);
            const entry = { hash: ctHash, url: primaryUrl(id), driveFileId: id, sizeBytes: fs.statSync(path.join(encCache, ctHash)).size };
            newChunks.push(entry);
            remoteChunks.set(ctHash, entry);
            uploaded++;
            progress((uploaded), `Caricamento allegato ${uploaded}`);
          } catch (e: any) {
            const msg = `Upload chunk fallito per "${fileName}": ${e?.message || e}`;
            console.error(`[hub-att] ${msg}`);
            errors.push(msg);
          }
        });

        // Se un chunk del file non è stato caricato, NON pubblicare l'entry file (indice
        // incoerente → gli altri scaricherebbero un file monco). Rimuovila dai newFiles.
        const publishedOk = ctHashes.every(h => remoteChunks.has(h));
        if (!publishedOk) {
          const idx = newFiles.findIndex(f => f.fileName === fileName);
          if (idx !== -1) newFiles.splice(idx, 1);
          console.warn(`[hub-att] file="${fileName}" non pubblicato: chunk mancanti dopo upload`);
        }
      }

      // Propagazione cancellazioni: file pubblicati da NOI (ogni hash risale a un nostro chunk)
      // che non compaiono più tra gli allegati referenziati dal DB locale → segnati deleted
      // nell'indice, così gli altri membri smettono di provare a scaricarli.
      const deletedFileNames = new Set<string>();
      for (const [fileName, entry] of remoteFiles) {
        if (entry.deleted || used.has(fileName)) continue;
        const hashes: string[] = Array.isArray(entry.hashes) ? entry.hashes : [];
        if (hashes.length === 0) continue;
        const ownedByUs = hashes.every(h => remoteChunks.get(h)?.uploaderMemberId === selfMemberId);
        if (!ownedByUs) continue; // non verificabile o di un altro membro: non tocchiamo
        newFiles.push({ fileName, hashes, lastModified: Date.now(), deleted: true });
        deletedFileNames.add(fileName);
      }

      if (newChunks.length || newFiles.length) {
        try {
          await hubApi(cfg, 'POST', '/attachments/index', { chunks: newChunks, files: newFiles });
          newFiles.forEach(f => remoteFiles.set(f.fileName, f));
          console.log(`[hub-att] indice pubblicato: +${newChunks.length} chunk, +${newFiles.length} file`);
        } catch (e: any) {
          const msg = `Pubblicazione indice allegati fallita: ${e?.message || e}`;
          console.error(`[hub-att] ${msg}`);
          errors.push(msg);
        }
      }

      // Pulizia best-effort dei chunk nostri rimasti orfani (nessun file non cancellato li
      // referenzia più). Non blocca la sync in caso di errore.
      if (deletedFileNames.size > 0) {
        const stillReferenced = new Set<string>();
        for (const [fileName, entry] of remoteFiles) {
          if (entry.deleted) continue;
          (Array.isArray(entry.hashes) ? entry.hashes : []).forEach((h: string) => stillReferenced.add(h));
        }
        const ownOrphanHashes = Array.from(remoteChunks.values())
          .filter((c: any) => c.uploaderMemberId === selfMemberId && !stillReferenced.has(c.hash))
          .map((c: any) => c.hash);
        await asyncPool(5, ownOrphanHashes, async (hash: string) => {
          try { await hubApi(cfg, 'DELETE', `/attachments/chunks/${hash}`); } catch { /* best-effort */ }
        });
      }
    } else {
      skippedUpload = true;
    }

    // ---------- DOWNLOAD (qualsiasi membro, zero Google) ----------
    // O7: più file in parallelo e, per ciascuno, i chunk a gruppi scaricati insieme e scritti
    // in ordine su un file temporaneo, poi rinominato. In memoria restano al più FILE_PARALLELI ×
    // CHUNK_PARALLELI chunk (5 MB l'uno) invece dell'intero file; e un'interruzione non lascia
    // più un file troncato che `existsSync` farebbe passare per già scaricato.
    const FILE_PARALLELI = 3;
    const CHUNK_PARALLELI = 3;
    // Temporanei di un run interrotto (chiusura dell'app, crash): i run sono serializzati,
    // quindi nessuno di questi file è in scrittura adesso.
    try {
      for (const f of await fs.promises.readdir(attDir)) {
        if (/^\.archiview-scarico-[0-9a-f]{16}\.part$/.test(f)) await fs.promises.rm(path.join(attDir, f), { force: true });
      }
    } catch { /* best-effort */ }
    const daScaricare: string[] = [];
    for (const [fileName] of used) {
      const localPath = safeAttachmentPathOrNull(attDir, fileName);
      if (!localPath) { console.warn(`[hub-att] download saltato, nome non sicuro: ${fileName}`); continue; }
      if (fs.existsSync(localPath)) continue; // già presente
      const entry = remoteFiles.get(fileName);
      if (!entry || entry.deleted || !Array.isArray(entry.hashes)) {
        console.warn(`[hub-att] download file="${fileName}" NON pubblicato (entry=${!!entry} deleted=${entry?.deleted})`);
        notPublished++; continue;
      }
      daScaricare.push(fileName);
    }

    // Un chunk: scaricato, verificato (sha256 del ciphertext) e decifrato. Errore tipizzato
    // per distinguere la chiave sbagliata dal link morto nel messaggio all'utente.
    const scaricaChunk = async (ctHash: string): Promise<Buffer> => {
      const chunk = remoteChunks.get(ctHash);
      const urls = chunk
        ? [chunk.url, chunk.driveFileId ? fallbackUrl(chunk.driveFileId) : null].filter(Boolean) as string[]
        : [];
      if (!urls.length) console.warn(`[hub-att]   chunk ${ctHash.slice(0, 8)} assente dall'indice remoto`);
      const blob = urls.length ? await fetchVerifiedChunk(urls, ctHash) : null;
      if (!blob) throw new Error('chunk-non-scaricabile');
      try { return decryptChunk(key, blob); }
      catch {
        // tag GCM non valido → encKey diversa da quella dell'uploader
        console.error(`[hub-att]   chunk ${ctHash.slice(0, 8)} decrypt fallito (tag GCM non valido → encKey diversa)`);
        throw new Error('decrypt');
      }
    };

    await asyncPool(FILE_PARALLELI, daScaricare, async (fileName: string) => {
      const localPath = safeAttachmentPathOrNull(attDir, fileName) as string;
      const entry = remoteFiles.get(fileName);
      const hashes: string[] = entry.hashes;
      console.log(`[hub-att] download file="${fileName}" chunks=${hashes.length}`);
      // Nome temporaneo casuale, non `<nome>.part`: il nome dell'allegato viene dal vault, e
      // un collaboratore potrebbe sceglierlo per far sovrascrivere un file locale `x.part`.
      const parziale = path.join(attDir, `.archiview-scarico-${crypto.randomBytes(8).toString('hex')}.part`);
      let scritti = 0;
      try {
        const fh = await fs.promises.open(parziale, 'w');
        try {
          for (let i = 0; i < hashes.length; i += CHUNK_PARALLELI) {
            const gruppo = await Promise.all(hashes.slice(i, i + CHUNK_PARALLELI).map(scaricaChunk));
            for (const parte of gruppo) {
              await fh.write(parte);
              scritti += parte.length;
            }
          }
        } finally {
          await fh.close();
        }
        await fs.promises.rename(parziale, localPath);
        downloaded++;
        console.log(`[hub-att] download file="${fileName}" OK (${scritti}B)`);
        const win = finestraPrincipale();
        if (win) win.webContents.send('allegato-scaricato', fileName);
      } catch (e: any) {
        try { await fs.promises.rm(parziale, { force: true }); } catch { /* best-effort */ }
        unavailable++;
        if (e?.message === 'decrypt') { decryptFailed++; errors.push(`Allegato "${fileName}": chiave di cifratura non corrispondente.`); }
        else if (e?.message === 'chunk-non-scaricabile') errors.push(`Allegato "${fileName}": chunk non scaricabile (link scaduto o non pubblicato).`);
        else errors.push(`Allegato "${fileName}": scrittura su disco non riuscita (${e?.message || e}).`);
      }
    });

    console.log(`[hub-att] done uploaded=${uploaded} downloaded=${downloaded} unavailable=${unavailable} notPublished=${notPublished} decryptFailed=${decryptFailed} errors=${errors.length}`);
    return { uploaded, downloaded, unavailable, skippedUpload, hasLocalAttachments, notPublished, decryptFailed, errors };
  } finally {
    for (const d of [plainCache, encCache]) {
      try { if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
  }
}

// --- Serializzazione dei run ------------------------------------------------
// Il `finally` di syncHubAttachmentsImpl cancella plainCache/encCache, che sono condivise
// da tutto il workspace. I trigger sono sei e tutti fire-and-forget (avvio, dopo pull ×2,
// dopo push, dopo creazione repo, click manuale): due run sovrapposti significano che il
// cleanup del primo cancella i chunk cifrati che il secondo sta ancora caricando, e
// l'upload fallisce con `ENOENT ... .archiview-hubchunks-enc\<hash>`. L'errore finiva in
// `errors` e veniva mostrato all'utente mentre il download — che non tocca la cache —
// riusciva regolarmente: il sintomo era "errore che appare benché l'allegato arrivi".
//
// Un run alla volta, con al più uno accodato: i trigger ravvicinati non devono
// moltiplicare il lavoro, ma nemmeno perdere l'ultima richiesta (che può riguardare
// allegati arrivati dopo l'inizio del run in corso).
let runInCorso: Promise<SyncAttachmentsResult> | null = null;
let runAccodato: Promise<SyncAttachmentsResult> | null = null;

function syncHubAttachments(): Promise<SyncAttachmentsResult> {
  if (!runInCorso) {
    runInCorso = syncHubAttachmentsImpl().finally(() => { runInCorso = null; });
    return runInCorso;
  }
  if (!runAccodato) {
    // `catch` vuoto: il fallimento del run in corso non deve impedire quello accodato.
    runAccodato = runInCorso.catch(() => undefined).then(() => {
      runAccodato = null;
      return syncHubAttachments();
    });
  }
  return runAccodato;
}

// ArchiView/_hubchunks/{repoId}/ sul Drive personale dell'uploader.
async function getHubChunkFolder(repoId: string): Promise<string> {
  const root = await getOrCreateFolder('ArchiView', null);
  const chunks = await getOrCreateFolder('_hubchunks', root);
  return getOrCreateFolder(repoId, chunks);
}

module.exports = { syncHubAttachments };
export {};
