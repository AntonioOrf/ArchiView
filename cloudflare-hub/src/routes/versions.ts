import type { Env } from '../types';
import { bearer, resolveAuth } from '../auth';
import { currentVersion, listVersions, readVersion } from '../db';
import { err, json } from '../http';

// GET /api/repos/:id/versions -> lista metadata-only (nessuna lettura di blob), autore risolto
// da members.label (revoca soft -> la label resta disponibile anche dopo la revoca).
export async function handleListVersions(req: Request, env: Env, repoId: string): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return err(401, 'Chiave di accesso non valida per questo repository.');

  const [cur, versions] = await Promise.all([
    currentVersion(env, repoId),
    listVersions(env, repoId),
  ]);
  if (cur == null || versions == null) return err(404, 'Repository inesistente.');

  return json({ currentVersion: cur, versions });
}

// GET /api/repos/:id/versions/:n -> snapshot completo di una versione specifica (per diff/restore).
export async function handleGetVersion(
  req: Request,
  env: Env,
  repoId: string,
  nRaw: string
): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return err(401, 'Chiave di accesso non valida per questo repository.');

  if (!/^\d+$/.test(nRaw) || Number(nRaw) <= 0) {
    return err(400, 'Numero di versione non valido.');
  }
  const n = Number(nRaw);

  const result = await readVersion(env, repoId, n);
  if (!result) return err(404, 'Versione non disponibile (eliminata dalla retention o inesistente).');

  return json({ version: result.version, database: result.database });
}
