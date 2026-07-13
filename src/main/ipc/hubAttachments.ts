const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { state, loadHubConfig } = require('../workspaceManager');
const { splitFileIntoChunks } = require('../chunkingLogic');
const { loadSavedTokens } = require('./drive/auth');
const { getOrCreateFolder, uploadFileReturningId, makeFilePublic, asyncPool } = require('./drive/fileOps');
const { GOOGLE_API_KEY } = require('./cloudCredentials');
const { safeAttachmentPathOrNull } = require('./pathSafety');

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
  const win = require('electron').BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('sync-progress', { percent, message });
}

// Scarica un singolo blob verificandone l'integrità. Ritorna il Buffer del ciphertext o null
// (link morto/interstitial/chunk corrotto → allegato "non disponibile", nessun crash).
async function fetchVerifiedChunk(urls: string[], expectedHash: string): Promise<Buffer | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} status=${res.status} url=${url.slice(0, 60)}`); continue; }
      const ct = res.headers.get('content-type') || '';
      const buf = Buffer.from(await res.arrayBuffer());
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

async function syncHubAttachments(): Promise<{
  uploaded: number; downloaded: number; unavailable: number; skippedUpload: boolean;
  hasLocalAttachments: boolean; notPublished: number; decryptFailed: number; errors: string[];
}> {
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
    for (const [fileName] of used) {
      const localPath = safeAttachmentPathOrNull(attDir, fileName);
      if (!localPath) { console.warn(`[hub-att] download saltato, nome non sicuro: ${fileName}`); continue; }
      if (fs.existsSync(localPath)) continue; // già presente
      const entry = remoteFiles.get(fileName);
      if (!entry || entry.deleted || !Array.isArray(entry.hashes)) {
        console.warn(`[hub-att] download file="${fileName}" NON pubblicato (entry=${!!entry} deleted=${entry?.deleted})`);
        notPublished++; continue;
      }
      console.log(`[hub-att] download file="${fileName}" chunks=${entry.hashes.length}`);

      const plaintextParts: Buffer[] = [];
      let ok = true;
      let decryptError = false;
      for (const ctHash of entry.hashes) {
        const chunk = remoteChunks.get(ctHash);
        const urls = chunk
          ? [chunk.url, chunk.driveFileId ? fallbackUrl(chunk.driveFileId) : null].filter(Boolean) as string[]
          : [];
        if (!urls.length) console.warn(`[hub-att]   chunk ${ctHash.slice(0, 8)} assente dall'indice remoto`);
        const blob = urls.length ? await fetchVerifiedChunk(urls, ctHash) : null;
        if (!blob) { ok = false; break; }
        try { plaintextParts.push(decryptChunk(key, blob)); }
        catch { ok = false; decryptError = true; console.error(`[hub-att]   chunk ${ctHash.slice(0, 8)} decrypt fallito (tag GCM non valido → encKey diversa)`); break; } // tag GCM non valido → encKey diversa da quella dell'uploader
      }

      if (ok) {
        fs.writeFileSync(localPath, Buffer.concat(plaintextParts));
        downloaded++;
        console.log(`[hub-att] download file="${fileName}" OK (${Buffer.concat(plaintextParts).length}B)`);
        const win = require('electron').BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send('allegato-scaricato', fileName);
      } else {
        unavailable++;
        if (decryptError) { decryptFailed++; errors.push(`Allegato "${fileName}": chiave di cifratura non corrispondente.`); }
        else errors.push(`Allegato "${fileName}": chunk non scaricabile (link scaduto o non pubblicato).`);
      }
    }

    console.log(`[hub-att] done uploaded=${uploaded} downloaded=${downloaded} unavailable=${unavailable} notPublished=${notPublished} decryptFailed=${decryptFailed} errors=${errors.length}`);
    return { uploaded, downloaded, unavailable, skippedUpload, hasLocalAttachments, notPublished, decryptFailed, errors };
  } finally {
    for (const d of [plainCache, encCache]) {
      try { if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
  }
}

// ArchiView/_hubchunks/{repoId}/ sul Drive personale dell'uploader.
async function getHubChunkFolder(repoId: string): Promise<string> {
  const root = await getOrCreateFolder('ArchiView', null);
  const chunks = await getOrCreateFolder('_hubchunks', root);
  return getOrCreateFolder(repoId, chunks);
}

module.exports = { syncHubAttachments };
export {};
