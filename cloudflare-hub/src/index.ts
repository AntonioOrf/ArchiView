import type { Env } from './types';
import { err, json, preflight } from './http';
import { handleCreateRepo } from './routes/repos';
import { handlePull } from './routes/pull';
import { handlePush } from './routes/push';
import { handleAddMember, handleListMembers, handleRevokeMember } from './routes/members';
import { handleGetVersion, handleListVersions } from './routes/versions';
import { handleDeleteChunk, handleGetIndex, handlePutIndex } from './routes/attachments';
import { handlePing } from './routes/ping';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return preflight();

    const url = new URL(req.url);
    // segmenti puliti: ['api','repos',':id','pull'] ...
    const seg = url.pathname.split('/').filter(Boolean);
    const M = req.method;

    try {
      // GET /  -> health check
      if (seg.length === 0) return json({ service: 'archiview-hub', ok: true });

      if (seg[0] !== 'api') return err(404, 'Not found');

      // POST /api/ping
      if (seg.length === 2 && seg[1] === 'ping' && M === 'POST') {
        return handlePing(req, env);
      }

      if (seg[1] === 'repos') {
        // POST /api/repos
        if (seg.length === 2 && M === 'POST') return handleCreateRepo(req, env);

        const repoId = seg[2];
        if (!repoId) return err(404, 'Not found');

        // /api/repos/:id/pull
        if (seg.length === 4 && seg[3] === 'pull' && M === 'GET') {
          return handlePull(req, env, repoId);
        }
        // /api/repos/:id/push
        if (seg.length === 4 && seg[3] === 'push' && M === 'POST') {
          return handlePush(req, env, repoId);
        }
        // /api/repos/:id/versions
        if (seg.length === 4 && seg[3] === 'versions' && M === 'GET') {
          return handleListVersions(req, env, repoId);
        }
        // /api/repos/:id/versions/:n
        if (seg.length === 5 && seg[3] === 'versions' && M === 'GET') {
          return handleGetVersion(req, env, repoId, seg[4]);
        }
        // /api/repos/:id/members
        if (seg.length === 4 && seg[3] === 'members') {
          if (M === 'GET') return handleListMembers(req, env, repoId);
          if (M === 'POST') return handleAddMember(req, env, repoId);
        }
        // /api/repos/:id/members/:mid
        if (seg.length === 5 && seg[3] === 'members' && M === 'DELETE') {
          return handleRevokeMember(req, env, repoId, seg[4]);
        }
        // /api/repos/:id/attachments/index
        if (seg.length === 5 && seg[3] === 'attachments' && seg[4] === 'index') {
          if (M === 'GET') return handleGetIndex(req, env, repoId);
          if (M === 'POST') return handlePutIndex(req, env, repoId);
        }
        // /api/repos/:id/attachments/chunks/:hash
        if (seg.length === 6 && seg[3] === 'attachments' && seg[4] === 'chunks' && M === 'DELETE') {
          return handleDeleteChunk(req, env, repoId, seg[5]);
        }
      }

      return err(404, 'Not found');
    } catch (e: any) {
      return err(500, 'Errore interno: ' + (e?.message || 'sconosciuto'));
    }
  },
};
