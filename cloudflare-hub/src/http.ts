// Helper risposta + CORS. Il renderer Electron chiama l'hub cross-origin:
// serve CORS permissivo e gestione del preflight OPTIONS (Authorization lo scatena).

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Create-Secret',
  'Access-Control-Max-Age': '86400',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

export function err(status: number, message: string): Response {
  return json({ error: message }, status);
}

/** 429 con header Retry-After (secondi) per il rate-limit. */
export function tooMany(message: string, retryAfterSec: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': String(Math.max(1, Math.ceil(retryAfterSec))),
      ...CORS,
    },
  });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
