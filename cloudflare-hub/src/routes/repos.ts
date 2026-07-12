import type { Env } from '../types';
import { randomId, randomKey, sha256hex, timingSafeEqual } from '../crypto';
import { err, json, tooMany } from '../http';
import { clientIp, enforceCreateLimits, verifyTurnstile } from '../ratelimit';

// POST /api/repos  — protetto da X-Create-Secret (anti-abuso, bakeato nel client)
// body: { name?, turnstileToken? }  ->  { repoId, ownerKey }
export async function handleCreateRepo(req: Request, env: Env): Promise<Response> {
  if (!env.CREATE_SECRET) {
    return err(503, 'Creazione repository non configurata sul server.');
  }
  const provided = req.headers.get('X-Create-Secret') || '';
  // Confronto costante sugli hash per non rivelare il secret via timing.
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
  } catch { /* body opzionale */ }

  const ip = clientIp(req);

  // Turnstile (inerte finché TURNSTILE_SECRET non è impostato).
  if (!(await verifyTurnstile(env, req, ip, turnstileToken))) {
    return err(403, 'Verifica anti-bot fallita.');
  }

  // Argine reale: il secret è estraibile dal binario, il rate-limit no.
  const limit = await enforceCreateLimits(env, ip);
  if (!limit.ok) return tooMany(limit.reason, limit.retryAfterSec);

  const repoId = randomId('repo_');
  const ownerKey = randomKey();
  const ownerKeyHash = await sha256hex(ownerKey);
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO repos(repo_id,name,owner_key_hash,current_version,created_at,updated_at) VALUES(?,?,?,0,?,?)'
  ).bind(repoId, name, ownerKeyHash, now, now).run();

  // ownerKey mostrata UNA sola volta: sul server resta solo l'hash.
  return json({ repoId, ownerKey }, 201);
}
