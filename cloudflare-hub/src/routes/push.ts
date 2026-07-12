import type { Env } from '../types';
import { bearer, resolveAuth } from '../auth';
import { pruneVersions, writeVersion } from '../db';
import { err, json } from '../http';

// POST /api/repos/:id/push  body: { parentVersion, database }
export async function handlePush(req: Request, env: Env, repoId: string): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return err(401, 'Chiave di accesso non valida per questo repository.');

  const maxMb = Number(env.MAX_PUSH_MB || '20');
  const clen = Number(req.headers.get('Content-Length') || '0');
  if (clen && clen > maxMb * 1024 * 1024) {
    return err(413, `Payload troppo grande (max ${maxMb}MB).`);
  }

  let body: { parentVersion?: unknown; database?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > maxMb * 1024 * 1024) return err(413, `Payload troppo grande (max ${maxMb}MB).`);
    body = JSON.parse(raw);
  } catch {
    return err(400, 'Body JSON non valido.');
  }

  const parentVersion = body.parentVersion;
  if (typeof parentVersion !== 'number' || !Number.isInteger(parentVersion) || parentVersion < 0) {
    return err(400, 'parentVersion mancante o non valido.');
  }
  if (body.database == null || typeof body.database !== 'object') {
    return err(400, 'database mancante o non valido.');
  }

  // Guardia di concorrenza atomica: solo un push con parentVersion corretto vince.
  const upd = await env.DB.prepare(
    'UPDATE repos SET current_version = current_version + 1, updated_at = ? WHERE repo_id = ? AND current_version = ?'
  ).bind(Date.now(), repoId, parentVersion).run();

  if (upd.meta.changes === 0) {
    // O repo inesistente, o versione superata da un altro client.
    const exists = await env.DB.prepare('SELECT 1 FROM repos WHERE repo_id = ?').bind(repoId).first();
    if (!exists) return err(404, 'Repository inesistente.');
    return err(409, 'Il server contiene una versione più recente. Esegui prima il pull.');
  }

  const newVersion = parentVersion + 1;
  try {
    await writeVersion(env, repoId, newVersion, body.database, auth.memberId);
  } catch (e: any) {
    // Compensazione: annulla l'incremento per non lasciare current_version orfana.
    await env.DB.prepare(
      'UPDATE repos SET current_version = current_version - 1 WHERE repo_id = ? AND current_version = ?'
    ).bind(repoId, newVersion).run();
    return err(500, 'Errore nel salvataggio della versione: ' + (e?.message || 'sconosciuto'));
  }

  // Retention: prune best-effort, non deve far fallire il push.
  try {
    await pruneVersions(env, repoId, Number(env.MAX_VERSIONS || '20'));
  } catch { /* ignore */ }

  return json({ version: newVersion });
}
