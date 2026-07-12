import type { Env } from '../types';
import { hmacSha256hex, md5hex } from '../crypto';
import { err, json } from '../http';

// POST /api/ping  body: { channel, event, data? }
// Relay generico verso Pusher via REST (sostituisce vercel-hub/api/ping.js).
// La firma REST Pusher richiede body_md5 (MD5) -> usiamo l'MD5 vendorizzato.
export async function handlePing(req: Request, env: Env): Promise<Response> {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    return err(503, 'Relay realtime non configurato sul server.');
  }

  let payload: { channel?: unknown; event?: unknown; data?: unknown };
  try {
    payload = await req.json();
  } catch {
    return err(400, 'Body JSON non valido.');
  }
  const { channel, event } = payload;
  if (typeof channel !== 'string' || typeof event !== 'string' || !channel || !event) {
    return err(400, 'Parametri channel ed event richiesti.');
  }

  // Pusher richiede data come stringa JSON dentro il body dell'evento.
  const eventBody = JSON.stringify({
    name: event,
    channel,
    data: JSON.stringify(payload.data ?? {}),
  });

  const path = `/apps/${PUSHER_APP_ID}/events`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyMd5 = md5hex(eventBody);

  // Query param in ordine alfabetico per la stringa da firmare.
  const params = new URLSearchParams({
    auth_key: PUSHER_KEY,
    auth_timestamp: timestamp,
    auth_version: '1.0',
    body_md5: bodyMd5,
  });
  const stringToSign = `POST\n${path}\n${params.toString()}`;
  const signature = await hmacSha256hex(PUSHER_SECRET, stringToSign);
  params.set('auth_signature', signature);

  const endpoint = `https://api-${PUSHER_CLUSTER}.pusher.com${path}?${params.toString()}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: eventBody,
    });
    if (!res.ok) {
      const detail = await res.text();
      return err(502, `Errore relay Pusher (${res.status}): ${detail.slice(0, 200)}`);
    }
    return json({ success: true });
  } catch (e: any) {
    return err(502, 'Impossibile contattare Pusher: ' + (e?.message || 'errore rete'));
  }
}
