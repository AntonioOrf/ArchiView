import type { AuthCtx, Env } from '../types';
import { bearer, resolveAuth } from '../auth';
import { randomId, randomKey, sha256hex } from '../crypto';
import { err, json } from '../http';

async function requireOwner(req: Request, env: Env, repoId: string): Promise<AuthCtx | Response> {
  const auth = await resolveAuth(env, repoId, bearer(req));
  if (!auth) return err(401, 'Chiave di accesso non valida per questo repository.');
  if (auth.role !== 'owner') return err(403, 'Operazione riservata al proprietario del repository.');
  return auth;
}

// GET /api/repos/:id/members  (owner) -> { members: [...] }
export async function handleListMembers(req: Request, env: Env, repoId: string): Promise<Response> {
  const gate = await requireOwner(req, env, repoId);
  if (gate instanceof Response) return gate;

  const rows = await env.DB.prepare(
    'SELECT member_id, label, role, revoked_at, created_at FROM members WHERE repo_id = ? ORDER BY created_at ASC'
  ).bind(repoId).all<{ member_id: string; label: string | null; role: string; revoked_at: number | null; created_at: number }>();

  const members = (rows.results ?? []).map((m) => ({
    memberId: m.member_id,
    label: m.label,
    role: m.role,
    revoked: m.revoked_at != null,
    revokedAt: m.revoked_at,
    createdAt: m.created_at,
  }));
  return json({ members });
}

// POST /api/repos/:id/members  (owner)  body: { label?, role? } -> { memberId, memberKey }
export async function handleAddMember(req: Request, env: Env, repoId: string): Promise<Response> {
  const gate = await requireOwner(req, env, repoId);
  if (gate instanceof Response) return gate;

  let label: string | null = null;
  let role = 'member';
  try {
    const raw = await req.text();
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.label === 'string') label = p.label.slice(0, 200);
      if (p && p.role === 'member') role = 'member'; // owner non assegnabile via API
    }
  } catch { /* body opzionale */ }

  const memberId = randomId('mbr_');
  const memberKey = randomKey();
  const keyHash = await sha256hex(memberKey);

  await env.DB.prepare(
    'INSERT INTO members(member_id,repo_id,label,key_hash,role,revoked_at,created_at) VALUES(?,?,?,?,?,NULL,?)'
  ).bind(memberId, repoId, label, keyHash, role, Date.now()).run();

  // memberKey mostrata UNA sola volta (finisce nell'invite code).
  return json({ memberId, memberKey }, 201);
}

// DELETE /api/repos/:id/members/:mid  (owner) -> revoca soft
export async function handleRevokeMember(
  req: Request, env: Env, repoId: string, memberId: string
): Promise<Response> {
  const gate = await requireOwner(req, env, repoId);
  if (gate instanceof Response) return gate;

  const res = await env.DB.prepare(
    'UPDATE members SET revoked_at = ? WHERE repo_id = ? AND member_id = ? AND revoked_at IS NULL'
  ).bind(Date.now(), repoId, memberId).run();

  if (res.meta.changes === 0) return err(404, 'Membro inesistente o già revocato.');
  return json({ ok: true, memberId });
}
