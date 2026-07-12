import type { Env } from '../types';
import { bearer, resolveAuth } from '../auth';
import { currentVersion, readLatest } from '../db';
import { err, json } from '../http';

// GET /api/repos/:id/pull[?ifVersionNot=N]
export async function handlePull(req: Request, env: Env, repoId: string): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return err(401, 'Chiave di accesso non valida per questo repository.');

  const url = new URL(req.url);
  const ifNot = url.searchParams.get('ifVersionNot');

  // Fast-path autofetch: se il client è già alla versione corrente evitiamo
  // di leggere e decomprimere i blob (letture D1 quasi gratis).
  if (ifNot != null && /^\d+$/.test(ifNot)) {
    const v = await currentVersion(env, repoId);
    if (v == null) return err(404, 'Repository inesistente.');
    if (v === Number(ifNot)) return json({ version: v, unchanged: true });
  }

  const latest = await readLatest(env, repoId);
  if (!latest) return err(404, 'Repository inesistente.');
  return json({ version: latest.version, database: latest.database });
}
