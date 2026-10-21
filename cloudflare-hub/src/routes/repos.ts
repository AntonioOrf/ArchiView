import type { Env } from '../types';
import { bearer, resolveAuth, rispostaNegata } from '../auth';
import { randomId, randomKey, sha256hex, timingSafeEqual } from '../crypto';
import { err, json, tooMany } from '../http';
import { clientIp, enforceCreateLimits, verifyTurnstile } from '../ratelimit';

const TABELLE_REPO = ['version_blobs', 'versions', 'attachment_chunks', 'attachment_files', 'members', 'repos'];

export async function handleDeleteRepo(req: Request, env: Env, repoId: string): Promise<Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return rispostaNegata(env, repoId, bearer(req));
  if (auth.role !== 'owner') return err(403, 'Operazione riservata al proprietario del repository.');

  await env.DB.batch(TABELLE_REPO.map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE repo_id = ?`).bind(repoId)));
  return json({ ok: true, repoId });
}

export async function handleCreateRepo(req: Request, env: Env): Promise<Response> {
  if (!env.CREATE_SECRET) {
    return err(503, 'Creazione repository non configurata sul server.');
  }
  const provided = req.headers.get('X-Create-Secret') || '';
  const [a, b] = await Promise.all([sha256hex(provided), sha256hex(env.CREATE_SECRET)]);
  if (!timingSafeEqual(a, b)) return err(403, 'Non autorizzato a creare repository.');

  let name: string | null = null;
  let turnstileToken: string | null = null;
  try {
    const raw = await req.text();
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string') name = parsed.name.slice(0, 200);
      if (parsed && typeof parsed.turnstileToken === 'string') turnstileToken = parsed.turnstileToken;
    }
  } catch {}

  const ip = clientIp(req);

  if (!(await verifyTurnstile(env, req, ip, turnstileToken))) {
    return err(403, 'Verifica anti-bot fallita.');
  }

  const limit = await enforceCreateLimits(env, ip);
  if (!limit.ok) return tooMany(limit.reason, limit.retryAfterSec);

  const repoId = randomId('repo_');
  const ownerKey = randomKey();
  const ownerKeyHash = await sha256hex(ownerKey);
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO repos(repo_id,name,owner_key_hash,current_version,created_at,updated_at) VALUES(?,?,?,0,?,?)'
  ).bind(repoId, name, ownerKeyHash, now, now).run();

  return json({ repoId, ownerKey }, 201);
}
