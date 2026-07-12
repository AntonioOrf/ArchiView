import type { Env } from './types';

const MINUTE = 60_000;
const DAY = 86_400_000;

function intVar(v: string | undefined, def: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
}

export interface LimitResult {
  ok: boolean;
  retryAfterSec: number;
  reason: string;
}

/** IP client reale: alla edge Cloudflare sovrascrive CF-Connecting-IP (non falsificabile in prod). */
export function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown';
}

/**
 * Incremento atomico del contatore di finestra con INSERT ... ON CONFLICT ... RETURNING.
 * Un solo round-trip per bucket; ritorna il valore post-incremento.
 */
async function bump(env: Env, bucket: string, windowStart: number): Promise<number> {
  const row = await env.DB.prepare(
    `INSERT INTO rate_counters(bucket, window_start, count) VALUES(?, ?, 1)
     ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1
     RETURNING count`
  ).bind(bucket, windowStart).first<{ count: number }>();
  return row?.count ?? 1;
}

/**
 * Argine anti-abuso su POST /api/repos, persistito su D1.
 * Il CREATE_SECRET è bakeato nel client e quindi estraibile: questo è il vero limite.
 * Tre finestre, dalla più stretta: burst per-IP/minuto, quota per-IP/giorno, tetto globale/giorno.
 * Ogni tentativo consuma quota anche se poi rifiutato (più severo, voluto).
 */
export async function enforceCreateLimits(env: Env, ip: string): Promise<LimitResult> {
  const now = Date.now();
  const minute = Math.floor(now / MINUTE) * MINUTE;
  const day = Math.floor(now / DAY) * DAY;
  const minReset = Math.ceil((minute + MINUTE - now) / 1000);
  const dayReset = Math.ceil((day + DAY - now) / 1000);

  const perIpMin = intVar(env.CREATE_MAX_PER_IP_MIN, 5);
  const perIpDay = intVar(env.CREATE_MAX_PER_IP_DAY, 20);
  const globalDay = intVar(env.CREATE_MAX_GLOBAL_DAY, 500);

  if ((await bump(env, `ipmin:${ip}`, minute)) > perIpMin) {
    return { ok: false, retryAfterSec: minReset, reason: 'Troppe richieste di creazione, riprova tra poco.' };
  }
  if ((await bump(env, `ipday:${ip}`, day)) > perIpDay) {
    return { ok: false, retryAfterSec: dayReset, reason: 'Limite giornaliero di repository raggiunto per questo dispositivo.' };
  }
  if ((await bump(env, 'global', day)) > globalDay) {
    return { ok: false, retryAfterSec: dayReset, reason: 'Limite giornaliero globale raggiunto, riprova domani.' };
  }

  // Pulizia opportunistica delle finestre scadute (volume basso: costo trascurabile).
  await env.DB.prepare('DELETE FROM rate_counters WHERE window_start < ?').bind(now - 2 * DAY).run();

  return { ok: true, retryAfterSec: 0, reason: '' };
}

/**
 * Verifica Turnstile opzionale: attiva solo se TURNSTILE_SECRET è impostato.
 * Il client deve inviare il token in header `CF-Turnstile-Response` o body `{ turnstileToken }`.
 * Ritorna true se disabilitata (nessun secret) o token valido.
 */
export async function verifyTurnstile(env: Env, req: Request, ip: string, token: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  const t = token || req.headers.get('CF-Turnstile-Response');
  if (!t) return false;
  try {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', t);
    if (ip && ip !== 'unknown') body.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = await res.json<{ success?: boolean }>().catch(() => null);
    return !!data?.success;
  } catch {
    return false;
  }
}
