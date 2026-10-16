import type { AuthCtx, Env } from './types';
import { sha256hex, timingSafeEqual } from './crypto';
import { err } from './http';

export function bearer(req: Request): string | null {
  const h = req.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function resolveAuth(
  env: Env,
  repoId: string,
  key: string | null
): Promise<AuthCtx | null> {
  if (!key) return null;
  const keyHash = await sha256hex(key);

  const repo = await env.DB.prepare('SELECT owner_key_hash FROM repos WHERE repo_id = ?')
    .bind(repoId).first<{ owner_key_hash: string }>();
  if (!repo) return null;

  if (timingSafeEqual(keyHash, repo.owner_key_hash)) {
    return { role: 'owner', memberId: null };
  }

  const member = await env.DB.prepare(
    'SELECT member_id, revoked_at FROM members WHERE repo_id = ? AND key_hash = ?'
  ).bind(repoId, keyHash).first<{ member_id: string; revoked_at: number | null }>();

  if (member && member.revoked_at == null) {
    return { role: 'member', memberId: member.member_id };
  }
  return null;
}

export async function rispostaNegata(env: Env, repoId: string, key: string | null): Promise<Response> {
  if (key) {
    const revocato = await env.DB.prepare(
      'SELECT 1 AS r FROM members WHERE repo_id = ? AND key_hash = ? AND revoked_at IS NOT NULL'
    ).bind(repoId, await sha256hex(key)).first<{ r: number }>();
    if (revocato) return err(403, 'Il tuo accesso a questo repository è stato revocato dal proprietario.');
  }
  return err(401, 'Chiave di accesso non valida per questo repository.');
}
