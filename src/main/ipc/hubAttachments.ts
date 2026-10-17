import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { state, finestraPrincipale, loadHubConfig } from '../workspaceManager';
import { splitFileIntoChunks, leggiMappaChunk, scriviMappaChunk, conMappaChunk } from '../chunkingLogic';
import { loadSavedTokens } from './drive/auth';
const { getOrCreateFolder, uploadFileReturningId, makeFilePublic, asyncPool } = require('./drive/fileOps');
const { GOOGLE_API_KEY } = require('./cloudCredentials');
import { safeAttachmentPathOrNull } from './pathSafety';
import { fetchChunkGuardata, leggiConTetto } from './hubUrlChunk';
import { chiamataHub } from './hubClient';

const HTML_RE = /^\s*<(!doctype|html)/i;

function encKeyBuffer(encKey: string | null): Buffer | null {
  if (!encKey) return null;
  try {
    const b = Buffer.from(encKey, 'base64url');
    return b.length === 32 ? b : null;
  } catch { return null; }
}

function deriveNonce(key: Buffer, plaintextHash: string): Buffer {
  return crypto.createHmac('sha256', key).update(plaintextHash).digest().subarray(0, 12);
}

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

const MAX_BYTE_CHUNK = 5 * 1024 * 1024 + 12 + 16;

async function fetchVerifiedChunk(urls: string[], expectedHash: string): Promise<Buffer | null> {
  for (const url of urls) {
    try {
      const res = await fetchChunkGuardata(url);
      if (!res.ok) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} status=${res.status} url=${url.slice(0, 60)}`); continue; }
      const ct = res.headers.get('content-type') || '';
      const buf = await leggiConTetto(res, MAX_BYTE_CHUNK);
      if (!buf) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} oltre ${MAX_BYTE_CHUNK}B: scartato`); continue; }
      if (ct.includes('text/html') || HTML_RE.test(buf.subarray(0, 64).toString('utf8'))) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} html/interstitial ct=${ct}`); continue; }
      if (sha256hex(buf) !== expectedHash) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} sha256 mismatch (${buf.length}B)`); continue; }
      return buf;
    } catch (e: any) { console.warn(`[hub-att]   chunk ${expectedHash.slice(0, 8)} fetch error: ${e?.message || e}`); }
  }
  return null;
}

async function collectUsedAttachments(dbPath: string, dir: string): Promise<Map<string, number>> {
  const used = new Map<string, number>();
  let testo: string;
  try { testo = await fs.promises.readFile(dbPath, 'utf8'); } catch (e: any) {
    if (e && e.code === 'ENOENT') return used;
    throw e;
  }
  const db = JSON.parse(testo);
  for (const m of db.manoscritti || []) {
    for (const a of m.allegati || []) {
      if (!a.nome) continue;
      const p = safeAttachmentPathOrNull(dir, a.nome);
      if (!p) { console.warn(`[hub-att] nome allegato non sicuro ignorato: ${a.nome}`); continue; }
      let mtime = m.lastModified || 0;
      try { mtime = Math.max(mtime, (await fs.promises.stat(p)).mtimeMs); } catch {}
      used.set(a.nome, mtime);
    }
  }
  return used;
}

async function hubApi(cfg: any, method: string, pathSuffix: string, body?: any): Promise<any> {
  const r = await chiamataHub(cfg, method, pathSuffix, { body });
  if (!r.ok) throw new Error(`Hub ${method} ${pathSuffix} → ${r.status}${r.error ? ` (${r.error})` : ''}`);
  return r.data;
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
  const dbPath = state.dataFilePath || path.join(state.workspacePath, 'database_manoscritti.json');
  const attDir = state.attachmentsDirPath || path.join(state.workspacePath, 'allegati_manoscritti');
  const plainCache = path.join(state.workspacePath, '.archiview-hubchunks-plain');
  const encCache = path.join(state.workspacePath, '.archiview-hubchunks-enc');

  if (!fs.existsSync(attDir)) fs.mkdirSync(attDir, { recursive: true });
  fs.mkdirSync(plainCache, { recursive: true });
  fs.mkdirSync(encCache, { recursive: true });

  const used = await collectUsedAttachments(dbPath, attDir);
  let hasLocalAttachments = false;
  for (const fileName of used.keys()) {
    try { if ((await fs.promises.stat(path.join(attDir, fileName))).isFile()) { hasLocalAttachments = true; break; } } catch {}
  }
  let uploaded = 0, downloaded = 0, unavailable = 0, skippedUpload = false, notPublished = 0, decryptFailed = 0;
  const errors: string[] = [];

  console.log(`[hub-att] start repo=${cfg.repoId} attDir=${attDir} used=${used.size} encKey=${key ? 'set' : 'null'}`);

  try {
    const remote = await hubApi(cfg, 'GET', '/attachments/index');
    const remoteChunks: Map<string, any> = new Map((remote.chunks || []).map((c: any) => [c.hash, c]));
    const remoteFiles: Map<string, any> = new Map((remote.files || []).map((f: any) => [f.fileName, f]));
    const selfMemberId: string | null = remote.selfMemberId ?? null;

    const hasGoogle = loadSavedTokens();
    console.log(`[hub-att] index remoteFiles=${remoteFiles.size} remoteChunks=${remoteChunks.size} selfMemberId=${selfMemberId} hasGoogle=${!!hasGoogle}`);
    if (hasGoogle) {
      const chunkFolderId = await getHubChunkFolder(cfg.repoId);
      const mappa = leggiMappaChunk(state.workspacePath);
      const newChunks: any[] = [];
      const newFiles: any[] = [];

      for (const [fileName, mtime] of used) {
        const localPath = safeAttachmentPathOrNull(attDir, fileName);
        if (!localPath || !fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) continue;

        const cifra = async (): Promise<string[]> => {
          const plainHashes: string[] = await splitFileIntoChunks(localPath, plainCache);
          const out: string[] = [];
          for (const ph of plainHashes) {
            const blob = encryptChunk(key, await fs.promises.readFile(path.join(plainCache, ph)), ph);
            const ctHash = sha256hex(blob);
            out.push(ctHash);
            try { await fs.promises.writeFile(path.join(encCache, ctHash), blob, { flag: 'wx' }); }
            catch (e: any) { if (!e || e.code !== 'EEXIST') throw e; }
          }
          return out;
        };
        const { valore: ctHashes, ricalcolato } = await conMappaChunk(mappa, `hub:${cfg.repoId}:${fileName}`, localPath, cifra);

        const existing = remoteFiles.get(fileName);
        const changed = !existing || existing.deleted || JSON.stringify(existing.hashes) !== JSON.stringify(ctHashes);
        if (changed && (!existing || mtime >= (existing.lastModified || 0))) {
          newFiles.push({ fileName, hashes: ctHashes, lastModified: mtime });
        }

        const missing: string[] = ctHashes.filter((h: string) => !remoteChunks.has(h) && !newChunks.find(c => c.hash === h));
        if (missing.length && !ricalcolato) await cifra();
        console.log(`[hub-att] upload file="${fileName}" chunks=${ctHashes.length} changed=${changed} missing=${missing.length}`);
        await asyncPool(5, missing, async (ctHash: string) => {
          try {
            const id = await uploadFileReturningId(path.join(encCache, ctHash), ctHash, chunkFolderId);
            await makeFilePublic(id);
            const entry = { hash: ctHash, url: primaryUrl(id), driveFileId: id, sizeBytes: (await fs.promises.stat(path.join(encCache, ctHash))).size };
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

        const publishedOk = ctHashes.every(h => remoteChunks.has(h));
        if (!publishedOk) {
          const idx = newFiles.findIndex(f => f.fileName === fileName);
          if (idx !== -1) newFiles.splice(idx, 1);
          console.warn(`[hub-att] file="${fileName}" non pubblicato: chunk mancanti dopo upload`);
        }
      }

      await scriviMappaChunk(state.workspacePath, mappa);

      const deletedFileNames = new Set<string>();
      for (const [fileName, entry] of remoteFiles) {
        if (entry.deleted || used.has(fileName)) continue;
        const hashes: string[] = Array.isArray(entry.hashes) ? entry.hashes : [];
        if (hashes.length === 0) continue;
        const ownedByUs = hashes.every(h => remoteChunks.get(h)?.uploaderMemberId === selfMemberId);
        if (!ownedByUs) continue;
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
          try { await hubApi(cfg, 'DELETE', `/attachments/chunks/${hash}`); } catch {}
        });
      }
    } else {
      skippedUpload = true;
    }

    const FILE_PARALLELI = 3;
    const CHUNK_PARALLELI = 3;
    try {
      for (const f of await fs.promises.readdir(attDir)) {
        if (/^\.archiview-scarico-[0-9a-f]{16}\.part$/.test(f)) await fs.promises.rm(path.join(attDir, f), { force: true });
      }
    } catch {}
    const daScaricare: string[] = [];
    for (const [fileName] of used) {
      const localPath = safeAttachmentPathOrNull(attDir, fileName);
      if (!localPath) { console.warn(`[hub-att] download saltato, nome non sicuro: ${fileName}`); continue; }
      if (fs.existsSync(localPath)) continue;
      const entry = remoteFiles.get(fileName);
      if (!entry || entry.deleted || !Array.isArray(entry.hashes)) {
        console.warn(`[hub-att] download file="${fileName}" NON pubblicato (entry=${!!entry} deleted=${entry?.deleted})`);
        notPublished++; continue;
      }
      daScaricare.push(fileName);
    }

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
        console.error(`[hub-att]   chunk ${ctHash.slice(0, 8)} decrypt fallito (tag GCM non valido → encKey diversa)`);
        throw new Error('decrypt');
      }
    };

    await asyncPool(FILE_PARALLELI, daScaricare, async (fileName: string) => {
      const localPath = safeAttachmentPathOrNull(attDir, fileName) as string;
      const entry = remoteFiles.get(fileName);
      const hashes: string[] = entry.hashes;
      console.log(`[hub-att] download file="${fileName}" chunks=${hashes.length}`);
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
        try { await fs.promises.rm(parziale, { force: true }); } catch {}
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
      try { if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true }); } catch {}
    }
  }
}

let runInCorso: Promise<SyncAttachmentsResult> | null = null;
let runAccodato: Promise<SyncAttachmentsResult> | null = null;

function syncHubAttachments(): Promise<SyncAttachmentsResult> {
  if (!runInCorso) {
    runInCorso = syncHubAttachmentsImpl().finally(() => { runInCorso = null; });
    return runInCorso;
  }
  if (!runAccodato) {
    runAccodato = runInCorso.catch(() => undefined).then(() => {
      runAccodato = null;
      return syncHubAttachments();
    });
  }
  return runAccodato;
}

async function getHubChunkFolder(repoId: string): Promise<string> {
  const root = await getOrCreateFolder('ArchiView', null);
  const chunks = await getOrCreateFolder('_hubchunks', root);
  return getOrCreateFolder(repoId, chunks);
}

export { syncHubAttachments };
