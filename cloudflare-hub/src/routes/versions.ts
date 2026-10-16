import type { Env } from '../types';
import { bearer, resolveAuth, rispostaNegata } from '../auth';
import { currentVersion, listVersions, readVersion } from '../db';
import { err, json } from '../http';

export async function handleListVersions(req: Request, env: Env, repoId: string): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return rispostaNegata(env, repoId, bearer(req));

  const [cur, versions] = await Promise.all([
    currentVersion(env, repoId),
    listVersions(env, repoId),
  ]);
  if (cur == null || versions == null) return err(404, 'Repository inesistente.');

  return json({ currentVersion: cur, versions });
}

export async function handleGetVersion(
  req: Request,
  env: Env,
  repoId: string,
  nRaw: string
): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return rispostaNegata(env, repoId, bearer(req));

  if (!/^\d+$/.test(nRaw) || Number(nRaw) <= 0) {
    return err(400, 'Numero di versione non valido.');
  }
  const n = Number(nRaw);

  const result = await readVersion(env, repoId, n);
  if (!result) return err(404, 'Versione non disponibile (eliminata dalla retention o inesistente).');

  return json({ version: result.version, database: result.database });
}
