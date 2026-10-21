import type { Env } from './types';
import { err, json, preflight } from './http';
import { handleCreateRepo, handleDeleteRepo } from './routes/repos';
import { handlePull } from './routes/pull';
import { handlePush } from './routes/push';
import { handleAddMember, handleListMembers, handleRevokeMember } from './routes/members';
import { handleGetVersion, handleListVersions } from './routes/versions';
import { handleDeleteChunk, handleGetIndex, handlePutIndex } from './routes/attachments';
import { handleRealtimeAuth } from './routes/realtime';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return preflight();

    const url = new URL(req.url);
    const seg = url.pathname.split('/').filter(Boolean);
    const M = req.method;

    try {
      if (seg.length === 0) return json({ service: 'archiview-hub', ok: true });

      if (seg[0] !== 'api') return err(404, 'Not found');

      if (seg[1] === 'repos') {
        if (seg.length === 2 && M === 'POST') return handleCreateRepo(req, env);

        const repoId = seg[2];
        if (!repoId) return err(404, 'Not found');

        if (seg.length === 3 && M === 'DELETE') return handleDeleteRepo(req, env, repoId);

        if (seg.length === 4 && seg[3] === 'pull' && M === 'GET') {
          return handlePull(req, env, repoId);
        }
        if (seg.length === 4 && seg[3] === 'push' && M === 'POST') {
          return handlePush(req, env, repoId, ctx);
        }
        if (seg.length === 4 && seg[3] === 'versions' && M === 'GET') {
          return handleListVersions(req, env, repoId);
        }
        if (seg.length === 5 && seg[3] === 'versions' && M === 'GET') {
          return handleGetVersion(req, env, repoId, seg[4]);
        }
        if (seg.length === 4 && seg[3] === 'realtime-auth' && M === 'POST') {
          return handleRealtimeAuth(req, env, repoId);
        }
        if (seg.length === 4 && seg[3] === 'members') {
          if (M === 'GET') return handleListMembers(req, env, repoId);
          if (M === 'POST') return handleAddMember(req, env, repoId);
        }
        if (seg.length === 5 && seg[3] === 'members' && M === 'DELETE') {
          return handleRevokeMember(req, env, repoId, seg[4]);
        }
        if (seg.length === 5 && seg[3] === 'attachments' && seg[4] === 'index') {
          if (M === 'GET') return handleGetIndex(req, env, repoId);
          if (M === 'POST') return handlePutIndex(req, env, repoId);
        }
        if (seg.length === 6 && seg[3] === 'attachments' && seg[4] === 'chunks' && M === 'DELETE') {
          return handleDeleteChunk(req, env, repoId, seg[5]);
        }
      }

      return err(404, 'Not found');
    } catch (e: any) {
      const rif = crypto.randomUUID().slice(0, 8);
      console.error(`[${rif}] ${req.method} ${new URL(req.url).pathname}:`, e?.stack || e?.message || e);
      return err(500, `Errore interno del server (rif. ${rif}).`);
    }
  },
};
