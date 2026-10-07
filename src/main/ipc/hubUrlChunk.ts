// Hub — URL dei chunk allegati. L'indice (hash → URL) arriva dall'Hub, quindi da terzi:
// un Hub ostile (invito con `hubUrl` self-hosted) potrebbe indicare `http://192.168.1.1/...`
// e far partire richieste alla cieca verso la LAN della vittima. Hash e GCM scartano i dati
// falsi, ma la richiesta sarebbe già partita. Stessa whitelist del Worker
// (`cloudflare-hub/src/routes/attachments.ts`), applicata anche a ogni salto di redirect:
// `drive.google.com/uc` rimanda di norma a `drive.usercontent.google.com`.

const HOST_CHUNK_AMMESSI = ['drive.google.com', 'googleapis.com', 'usercontent.google.com'];
const MAX_REDIRECT = 5;

/** `true` se l'URL è https verso un host Google ammesso (dominio esatto o sottodominio). */
function urlChunkAmmesso(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (u.port && u.port !== '443') return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  return HOST_CHUNK_AMMESSI.some((d) => host === d || host.endsWith('.' + d));
}

/**
 * `fetch` di un chunk con i redirect seguiti a mano: ogni `Location` passa dalla whitelist
 * prima di essere richiesta. Lancia se un salto esce dalla whitelist o se i salti sono troppi.
 */
async function fetchChunkGuardata(url: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  let corrente = url;
  for (let salto = 0; salto <= MAX_REDIRECT; salto++) {
    if (!urlChunkAmmesso(corrente)) throw new Error(`host non ammesso per un chunk: ${corrente.slice(0, 80)}`);
    const res = await fetchImpl(corrente, { redirect: 'manual' });
    if (res.status < 300 || res.status > 399) return res;
    const location = res.headers.get('location');
    try { await res.body?.cancel(); } catch { /* corpo già consumato o assente */ }
    if (!location) throw new Error(`redirect ${res.status} senza Location`);
    corrente = new URL(location, corrente).toString();
  }
  throw new Error(`troppi redirect (>${MAX_REDIRECT})`);
}

module.exports = { urlChunkAmmesso, fetchChunkGuardata, HOST_CHUNK_AMMESSI };
export {};
