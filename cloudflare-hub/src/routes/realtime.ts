import type { Env } from '../types';
import { bearer, resolveAuth, rispostaNegata } from '../auth';
import { err, json } from '../http';
import { canaleRepo, firmaIscrizione, pusherConfigurato } from '../pusher';

export async function handleRealtimeAuth(req: Request, env: Env, repoId: string): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return rispostaNegata(env, repoId, bearer(req));
  if (!pusherConfigurato(env)) return err(503, 'Realtime non configurato sul server.');

  let body: { socketId?: unknown; channel?: unknown };
  try {
    body = await req.json();
  } catch {
    return err(400, 'Body JSON non valido.');
  }
  if (typeof body.socketId !== 'string' || typeof body.channel !== 'string') {
    return err(400, 'Parametri socketId e channel richiesti.');
  }
  if (body.channel !== canaleRepo(repoId)) return err(403, 'Canale non consentito.');

  const firma = await firmaIscrizione(env, body.socketId, body.channel);
  if (!firma) return err(400, 'socketId non valido.');
  return json({ auth: firma });
}
