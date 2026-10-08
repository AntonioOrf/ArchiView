import type { Env } from '../types';
import { bearer, resolveAuth } from '../auth';
import { pruneVersions, writeVersion } from '../db';
import { err, json } from '../http';
import { EVENTO_AGGIORNATO, canaleRepo, pubblica } from '../pusher';

// POST /api/repos/:id/push  body: { parentVersion, database }
export async function handlePush(req: Request, env: Env, repoId: string, ctx?: ExecutionContext): Promise<Response> {
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

  // Guardia di concorrenza atomica: solo un push con parentVersion corretto vince. Dati e
  // avanzamento di current_version vanno nello stesso batch (vedi writeVersion).
  const conflitto = () => err(409, 'Il server contiene una versione più recente. Esegui prima il pull.');
  let vinto: boolean;
  try {
    vinto = await writeVersion(env, repoId, parentVersion, body.database, auth.memberId);
  } catch (e: any) {
    // Chiave duplicata: un altro push ha già scritto parentVersion+1.
    if (/UNIQUE|constraint/i.test(String(e?.message))) return conflitto();
    return err(500, 'Errore nel salvataggio della versione: ' + (e?.message || 'sconosciuto'));
  }
  if (!vinto) {
    const exists = await env.DB.prepare('SELECT 1 FROM repos WHERE repo_id = ?').bind(repoId).first();
    return exists ? conflitto() : err(404, 'Repository inesistente.');
  }
  const newVersion = parentVersion + 1;

  // Retention: prune best-effort, non deve far fallire il push.
  try {
    await pruneVersions(env, repoId, Number(env.MAX_VERSIONS || '20'));
  } catch { /* ignore */ }

  // Notifica ai membri connessi (S6): dopo la risposta, senza farla attendere né fallire.
  const notifica = pubblica(env, canaleRepo(repoId), EVENTO_AGGIORNATO, { version: newVersion });
  if (ctx) ctx.waitUntil(notifica);

  return json({ version: newVersion });
}
