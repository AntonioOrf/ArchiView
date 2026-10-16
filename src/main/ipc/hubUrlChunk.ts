const HOST_CHUNK_AMMESSI = ['drive.google.com', 'googleapis.com', 'usercontent.google.com'];
const MAX_REDIRECT = 5;

function urlChunkAmmesso(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (u.port && u.port !== '443') return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  return HOST_CHUNK_AMMESSI.some((d) => host === d || host.endsWith('.' + d));
}

async function fetchChunkGuardata(url: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  let corrente = url;
  for (let salto = 0; salto <= MAX_REDIRECT; salto++) {
    if (!urlChunkAmmesso(corrente)) throw new Error(`host non ammesso per un chunk: ${corrente.slice(0, 80)}`);
    const res = await fetchImpl(corrente, { redirect: 'manual' });
    if (res.status < 300 || res.status > 399) return res;
    const location = res.headers.get('location');
    try { await res.body?.cancel(); } catch {}
    if (!location) throw new Error(`redirect ${res.status} senza Location`);
    corrente = new URL(location, corrente).toString();
  }
  throw new Error(`troppi redirect (>${MAX_REDIRECT})`);
}

async function leggiConTetto(res: Response, max: number): Promise<Buffer | null> {
  const dichiarati = Number(res.headers.get('content-length'));
  if (Number.isFinite(dichiarati) && dichiarati > max) {
    try { await res.body?.cancel(); } catch {}
    return null;
  }
  if (!res.body) return Buffer.alloc(0);
  const parti: Buffer[] = [];
  let totale = 0;
  const lettore = res.body.getReader();
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > max) {
      try { await lettore.cancel(); } catch {}
      return null;
    }
    parti.push(Buffer.from(value));
  }
  return Buffer.concat(parti, totale);
}

export { urlChunkAmmesso, fetchChunkGuardata, leggiConTetto, HOST_CHUNK_AMMESSI };
