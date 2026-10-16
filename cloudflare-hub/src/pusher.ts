import type { Env } from './types';
import { hmacSha256hex, md5hex } from './crypto';

export const EVENTO_AGGIORNATO = 'hub-updated';

export function canaleRepo(repoId: string): string {
  return `private-repo-${repoId}`;
}

export function pusherConfigurato(env: Env): boolean {
  return !!(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.PUSHER_CLUSTER);
}

function baseApi(env: Env): string {
  return env.PUSHER_HOST ? env.PUSHER_HOST.replace(/\/+$/, '') : `https://api-${env.PUSHER_CLUSTER}.pusher.com`;
}

export async function pubblica(env: Env, channel: string, event: string, data: unknown): Promise<boolean> {
  if (!pusherConfigurato(env)) return false;
  try {
    const eventBody = JSON.stringify({ name: event, channel, data: JSON.stringify(data ?? {}) });
    const path = `/apps/${env.PUSHER_APP_ID}/events`;
    const params = new URLSearchParams({
      auth_key: env.PUSHER_KEY!,
      auth_timestamp: Math.floor(Date.now() / 1000).toString(),
      auth_version: '1.0',
      body_md5: md5hex(eventBody),
    });
    params.set('auth_signature', await hmacSha256hex(env.PUSHER_SECRET!, `POST\n${path}\n${params.toString()}`));
    const res = await fetch(`${baseApi(env)}${path}?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: eventBody,
    });
    if (!res.ok) console.error(`[pusher] pubblicazione fallita: HTTP ${res.status}`);
    return res.ok;
  } catch (e: any) {
    console.error('[pusher] pubblicazione fallita:', e?.message || e);
    return false;
  }
}

const SOCKET_ID = /^\d{1,20}\.\d{1,20}$/;

export async function firmaIscrizione(env: Env, socketId: string, channel: string): Promise<string | null> {
  if (!pusherConfigurato(env) || !SOCKET_ID.test(socketId)) return null;
  const sig = await hmacSha256hex(env.PUSHER_SECRET!, `${socketId}:${channel}`);
  return `${env.PUSHER_KEY}:${sig}`;
}
