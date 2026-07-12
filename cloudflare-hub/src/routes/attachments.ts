import type { Env } from '../types';
import { bearer, resolveAuth } from '../auth';
import { err, json } from '../http';

const HASH_RE = /^[a-f0-9]{64}$/;
const URL_HOST_ALLOW = ['drive.google.com', 'googleapis.com', 'usercontent.google.com'];

function urlAllowed(u: string): boolean {
  let parsed: URL;
  try { parsed = new URL(u); } catch { return false; }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return URL_HOST_ALLOW.some((d) => host === d || host.endsWith('.' + d));
}

// GET /api/repos/:id/attachments/index  (membro) -> { files, chunks }
export async function handleGetIndex(req: Request, env: Env, repoId: string): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return err(401, 'Chiave di accesso non valida per questo repository.');

  const [filesRes, chunksRes] = await Promise.all([
    env.DB.prepare(
      'SELECT file_name, hashes, last_modified, deleted FROM attachment_files WHERE repo_id = ?'
    ).bind(repoId).all<{ file_name: string; hashes: string; last_modified: number; deleted: number }>(),
    env.DB.prepare(
      'SELECT hash, url, drive_file_id, size_bytes, uploader_member_id FROM attachment_chunks WHERE repo_id = ?'
    ).bind(repoId).all<{ hash: string; url: string; drive_file_id: string | null; size_bytes: number | null; uploader_member_id: string | null }>(),
  ]);

  const files = (filesRes.results ?? []).map((f) => ({
    fileName: f.file_name,
    hashes: JSON.parse(f.hashes),
    lastModified: f.last_modified,
    deleted: !!f.deleted,
  }));
  const chunks = (chunksRes.results ?? []).map((c) => ({
    hash: c.hash,
    url: c.url,
    driveFileId: c.drive_file_id,
    sizeBytes: c.size_bytes,
    uploaderMemberId: c.uploader_member_id,
  }));
  // selfMemberId: identifica quali chunk/file appartengono al chiamante (per la pulizia
  // lato client di allegati rimossi in locale, senza toccare quelli di altri membri).
  return json({ files, chunks, selfMemberId: auth.memberId });
}

// POST /api/repos/:id/attachments/index  (membro)
// body: { files?: [{fileName,hashes,lastModified,deleted?}], chunks?: [{hash,url,driveFileId?,sizeBytes?}] }
export async function handlePutIndex(req: Request, env: Env, repoId: string): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return err(401, 'Chiave di accesso non valida per questo repository.');

  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > 20 * 1024 * 1024) return err(413, 'Indice troppo grande.');
    body = JSON.parse(raw);
  } catch {
    return err(400, 'Body JSON non valido.');
  }

  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];

  for (const c of (Array.isArray(body.chunks) ? body.chunks : [])) {
    if (!c || typeof c.hash !== 'string' || !HASH_RE.test(c.hash)) return err(400, 'Hash chunk non valido.');
    if (typeof c.url !== 'string' || !urlAllowed(c.url)) return err(400, 'URL chunk non consentito: ' + (c?.url || ''));
    // Last-writer-wins sul link (il file può essere ri-pubblicato da un altro membro).
    stmts.push(
      env.DB.prepare(
        `INSERT INTO attachment_chunks(repo_id,hash,url,drive_file_id,uploader_member_id,size_bytes,created_at)
         VALUES(?,?,?,?,?,?,?)
         ON CONFLICT(repo_id,hash) DO UPDATE SET
           url=excluded.url, drive_file_id=excluded.drive_file_id,
           uploader_member_id=excluded.uploader_member_id, size_bytes=excluded.size_bytes`
      ).bind(repoId, c.hash, c.url, c.driveFileId ?? null, auth.memberId, c.sizeBytes ?? null, now)
    );
  }

  for (const f of (Array.isArray(body.files) ? body.files : [])) {
    if (!f || typeof f.fileName !== 'string' || !f.fileName) return err(400, 'fileName mancante.');
    if (!Array.isArray(f.hashes) || !f.hashes.every((h: unknown) => typeof h === 'string' && HASH_RE.test(h))) {
      return err(400, 'Lista hashes non valida per ' + f.fileName);
    }
    const lastModified = typeof f.lastModified === 'number' ? f.lastModified : now;
    const deleted = f.deleted ? 1 : 0;
    // Last-writer-wins per fileName (solo se il timestamp in arrivo è più recente).
    stmts.push(
      env.DB.prepare(
        `INSERT INTO attachment_files(repo_id,file_name,hashes,last_modified,deleted)
         VALUES(?,?,?,?,?)
         ON CONFLICT(repo_id,file_name) DO UPDATE SET
           hashes=excluded.hashes, last_modified=excluded.last_modified, deleted=excluded.deleted
         WHERE excluded.last_modified >= attachment_files.last_modified`
      ).bind(repoId, f.fileName, JSON.stringify(f.hashes), lastModified, deleted)
    );
  }

  if (stmts.length === 0) return json({ ok: true, applied: 0 });
  await env.DB.batch(stmts);
  return json({ ok: true, applied: stmts.length });
}

// DELETE /api/repos/:id/attachments/chunks/:hash  (uploader o owner)
export async function handleDeleteChunk(
  req: Request, env: Env, repoId: string, hash: string
): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return err(401, 'Chiave di accesso non valida per questo repository.');
  if (!HASH_RE.test(hash)) return err(400, 'Hash non valido.');

  const chunk = await env.DB.prepare(
    'SELECT uploader_member_id FROM attachment_chunks WHERE repo_id = ? AND hash = ?'
  ).bind(repoId, hash).first<{ uploader_member_id: string | null }>();
  if (!chunk) return err(404, 'Chunk inesistente.');

  const isOwner = auth.role === 'owner';
  const isUploader = auth.memberId != null && auth.memberId === chunk.uploader_member_id;
  if (!isOwner && !isUploader) return err(403, 'Solo owner o autore del chunk possono rimuoverlo.');

  await env.DB.prepare('DELETE FROM attachment_chunks WHERE repo_id = ? AND hash = ?')
    .bind(repoId, hash).run();
  return json({ ok: true, hash });
}
