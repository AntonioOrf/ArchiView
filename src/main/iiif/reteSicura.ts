// Import IIIF — guardie di rete per gli URL che arrivano da terzi.
//
// Gli URL delle immagini stanno nel manifest, cioè in un JSON scritto da chiunque: senza
// filtro il Main scaricherebbe quello che il manifest dice, anche `http://192.168.1.1/...`
// o `http://127.0.0.1:<porta>/...` — richieste verso la LAN o verso servizi locali partite
// dal computer dell'utente (SSRF). Il controllo sta nel `webRequest` di una sessione
// dedicata e non prima della fetch, perché lì passa anche ogni salto di redirect: un host
// pubblico che risponde 302 verso la LAN verrebbe altrimenti seguito senza controlli.
// (`net.fetch` con `redirect: 'manual'` in Electron annulla la richiesta invece di
// restituire il 302, e `response.url` resta vuoto: da lì i salti non si vedono.)
//
// ⚠️ Compromesso accettato: il DNS lo risolve Node qui e Chromium di nuovo alla
// connessione. Un host che cambia risposta fra le due (DNS rebinding) passa. Chiudere anche
// quella finestra vorrebbe dire lasciare lo stack di rete di Chromium, e perdere proxy di
// sistema e certificati aziendali, che nelle biblioteche sono la norma.

const dns = require('dns');
const net = require('net');

/** Loopback, reti private, link-local, CGNAT, "questa rete", multicast/riservati. */
function ipv4Privato(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

/**
 * `true` se l'indirizzo non è raggiungibile "da Internet". Un valore che non è un IP
 * valido conta come privato: nel dubbio si nega.
 */
function ipPrivato(indirizzo: string): boolean {
  const ip = String(indirizzo || '').replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  const tipo = net.isIP(ip);
  if (tipo === 4) return ipv4Privato(ip);
  if (tipo !== 6) return true;

  if (ip === '::' || ip === '::1') return true;
  // IPv4 incapsulato (::ffff:10.0.0.1, anche nella forma esadecimale ::ffff:a00:1)
  const mappato = ip.match(/^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mappato) return ipv4Privato(mappato[1]);
  const mappatoHex = ip.match(/^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappatoHex) {
    const alto = parseInt(mappatoHex[1], 16), basso = parseInt(mappatoHex[2], 16);
    return ipv4Privato([alto >> 8, alto & 255, basso >> 8, basso & 255].join('.'));
  }
  const primo = parseInt(ip.split(':')[0] || '0', 16);
  return (primo & 0xfe00) === 0xfc00      // fc00::/7 unique local
    || (primo & 0xffc0) === 0xfe80        // fe80::/10 link-local
    || (primo & 0xff00) === 0xff00;       // ff00::/8 multicast
}

/**
 * `true` se l'host è, o risolve verso, un indirizzo privato. Basta UN indirizzo privato fra
 * quelli restituiti: Chromium potrebbe scegliere proprio quello.
 *
 * Se il DNS locale non risponde si lascia passare: senza risoluzione Chromium non può
 * connettersi direttamente a un indirizzo della LAN, e dietro un proxy (che risolve lui)
 * la rete raggiunta è quella del proxy, non quella dell'utente.
 */
async function hostPrivato(hostname: string, lookup = dns.promises.lookup): Promise<boolean> {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host) return true;
  if (net.isIP(host)) return ipPrivato(host);
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  try {
    const indirizzi = await lookup(host, { all: true, verbatim: true });
    return indirizzi.some((r: any) => ipPrivato(r.address));
  } catch {
    return false;
  }
}

/** `true` se l'URL è http/https e non punta alla rete locale. */
async function urlPubblico(url: string, lookup = dns.promises.lookup): Promise<boolean> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return !(await hostPrivato(u.hostname, lookup));
  } catch {
    return false;
  }
}

/**
 * Legge il corpo a pezzi e smette appena supera `max`. `text()`/`arrayBuffer()` leggono
 * tutto prima di restituire: senza `Content-Length` (o con uno falso) il limite arriverebbe
 * dopo aver già riempito la memoria. Ritorna `null` se il limite è superato.
 */
async function leggiCorpoLimitato(risposta: any, max: number): Promise<Buffer | null> {
  if (!risposta.body) return Buffer.alloc(0);
  const lettore = risposta.body.getReader();
  const pezzi: Buffer[] = [];
  let totale = 0;
  try {
    for (;;) {
      const { done, value } = await lettore.read();
      if (done) break;
      totale += value.length;
      if (totale > max) {
        lettore.cancel().catch(() => {});
        return null;
      }
      pezzi.push(Buffer.from(value));
    }
  } finally {
    try { lettore.releaseLock(); } catch { /* già rilasciato dopo cancel */ }
  }
  return Buffer.concat(pezzi, totale);
}

/**
 * Origini locali autorizzate dall'utente, per la sessione dell'app: quella di un manifest
 * incollato a mano che sta nella LAN (il server IIIF del laboratorio). Le sue immagini
 * vivono di norma sullo stesso server; un manifest che rimanda a UN ALTRO host locale resta
 * bloccato. In memoria e non su disco: una fiducia data a mano non deve sopravvivere
 * all'archivio in cui è stata data.
 */
const originiAutorizzate = new Set<string>();

function autorizzaOrigine(url: string) {
  try { originiAutorizzate.add(new URL(url).origin); } catch { /* URL già validato dal chiamante */ }
}

function origineAutorizzata(url: string): boolean {
  try { return originiAutorizzate.has(new URL(url).origin); } catch { return false; }
}

let sessione: any = null;

/**
 * Sessione in memoria (niente `persist:`: la cache vera è `imageCache`) con la guardia su
 * ogni richiesta, redirect compresi. `net::ERR_BLOCKED_BY_CLIENT` è l'errore che vede chi
 * chiama quando la guardia nega.
 */
function sessioneGuardata() {
  if (sessione) return sessione;
  const { session } = require('electron');
  sessione = session.fromPartition('iiif-rete');
  sessione.webRequest.onBeforeRequest((dettagli: any, callback: any) => {
    if (origineAutorizzata(dettagli.url)) { callback({ cancel: false }); return; }
    urlPubblico(dettagli.url).then((ok) => {
      if (!ok) console.warn(`[IIIF] Richiesta verso la rete locale bloccata: ${dettagli.url}`);
      callback({ cancel: !ok });
    }, () => callback({ cancel: true }));
  });
  return sessione;
}

/** `fetch` per URL di terzi: solo host pubblici, anche dopo i redirect. */
function fetchGuardata(url: string, init?: any): Promise<any> {
  return sessioneGuardata().fetch(url, init);
}

module.exports = {
  ipPrivato, hostPrivato, urlPubblico, leggiCorpoLimitato,
  autorizzaOrigine, origineAutorizzata, fetchGuardata
};
export {};
