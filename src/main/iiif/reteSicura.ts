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
// DNS rebinding: la guardia risolve con `session.resolveHost`, cioè con il resolver di
// Chromium e della stessa sessione che poi si connette (stessi DNS, DoH, file hosts). La
// risposta finisce nella cache host della sessione e la connessione, che parte subito dopo,
// la ritrova lì. Resta un margine teorico (cache scaduta o svuotata fra i due passi), molto
// più stretto dei due resolver indipendenti (Node + Chromium) di prima. Chiuderlo del tutto
// vorrebbe dire lasciare lo stack di rete di Chromium, e perdere proxy di sistema e
// certificati aziendali, che nelle biblioteche sono la norma.

const dns = require('dns');
const net = require('net');

/**
 * Loopback, reti private, link-local, CGNAT, "questa rete", IETF (192.0.0.0/24),
 * benchmark (198.18.0.0/15), multicast/riservati.
 */
function ipv4Privato(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

/** IPv6 testuale (già validato da `net.isIP`) → 8 gruppi da 16 bit. */
function gruppiIpv6(ip: string): number[] {
  let testo = ip;
  // Coda in notazione puntata (::ffff:10.0.0.1) → due gruppi esadecimali
  const puntata = testo.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (puntata) {
    const q = puntata[2].split('.').map(Number);
    testo = puntata[1] + ((q[0] << 8) | q[1]).toString(16) + ':' + ((q[2] << 8) | q[3]).toString(16);
  }
  const [testa, coda] = testo.split('::');
  const sx = testa ? testa.split(':') : [];
  const dx = coda !== undefined && coda ? coda.split(':') : [];
  const zeri = coda !== undefined ? 8 - sx.length - dx.length : 0;
  return [...sx, ...Array(zeri).fill('0'), ...dx].map(g => parseInt(g, 16));
}

const ipv4DaGruppi = (alto: number, basso: number) =>
  [alto >> 8, alto & 255, basso >> 8, basso & 255].join('.');

function ipv6Privato(ip: string): boolean {
  const g = gruppiIpv6(ip);
  if (g.length !== 8 || g.some(n => !Number.isInteger(n) || n < 0 || n > 0xffff)) return true;
  const zeri = (da: number, a: number) => g.slice(da, a).every(n => n === 0);

  // ::/96 (IPv4 compatibile, deprecato: ::7f00:1 = 127.0.0.1), :: e ::1 compresi.
  // Nessun server pubblico ci sta: si nega tutto il blocco.
  if (zeri(0, 6)) return true;
  // ::ffff:0:0/96 (mappato) e ::ffff:0:0:0/96 (SIIT)
  if (zeri(0, 5) && g[5] === 0xffff) return ipv4Privato(ipv4DaGruppi(g[6], g[7]));
  if (zeri(0, 4) && g[4] === 0xffff && g[5] === 0) return ipv4Privato(ipv4DaGruppi(g[6], g[7]));
  // NAT64: 64:ff9b::/96 porta all'IPv4 incapsulato; 64:ff9b:1::/48 è per uso locale
  if (g[0] === 0x64 && g[1] === 0xff9b) {
    if (g[2] === 1) return true;
    if (zeri(2, 6)) return ipv4Privato(ipv4DaGruppi(g[6], g[7]));
  }
  // 6to4: 2002:AABB:CCDD::/48 incapsula AA.BB.CC.DD
  if (g[0] === 0x2002) return ipv4Privato(ipv4DaGruppi(g[1], g[2]));
  return (g[0] === 0x2001 && g[1] === 0)        // 2001::/32 Teredo (IPv4 offuscato)
    || (g[0] === 0x2001 && g[1] === 0xdb8)      // 2001:db8::/32 documentazione
    || (g[0] === 0x100 && zeri(1, 4))           // 100::/64 discard
    || (g[0] & 0xfe00) === 0xfc00               // fc00::/7 unique local
    || (g[0] & 0xffc0) === 0xfe80               // fe80::/10 link-local
    || (g[0] & 0xffc0) === 0xfec0               // fec0::/10 site-local (deprecato)
    || (g[0] & 0xff00) === 0xff00;              // ff00::/8 multicast
}

/**
 * `true` se l'indirizzo non è raggiungibile "da Internet". Un valore che non è un IP
 * valido conta come privato: nel dubbio si nega.
 */
function ipPrivato(indirizzo: string): boolean {
  const ip = String(indirizzo || '').replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  const tipo = net.isIP(ip);
  if (tipo === 4) return ipv4Privato(ip);
  if (tipo === 6) return ipv6Privato(ip);
  return true;
}

type Lookup = (host: string, opzioni: any) => Promise<Array<{ address: string }>>;

interface OpzioniHost {
  /**
   * La richiesta esce da un proxy (nessun `DIRECT` fra le regole): a risolvere e connettersi
   * è il proxy, non questa macchina. Solo in quel caso un DNS locale che non risponde non
   * basta a negare.
   */
  viaProxy?: boolean;
}

/**
 * `true` se l'host è, o risolve verso, un indirizzo privato. Basta UN indirizzo privato fra
 * quelli restituiti: Chromium potrebbe scegliere proprio quello.
 *
 * DNS che fallisce: si nega, salvo `viaProxy`. Il resolver di Chromium potrebbe rispondere
 * dove questo non ha risposto (configurazione diversa, risposta che cambia), e una risposta
 * mai vista non si può classificare.
 */
async function hostPrivato(hostname: string, lookup: Lookup = dns.promises.lookup, opzioni: OpzioniHost = {}): Promise<boolean> {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host) return true;
  if (net.isIP(host)) return ipPrivato(host);
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  try {
    const indirizzi = await lookup(host, { all: true, verbatim: true });
    if (!Array.isArray(indirizzi) || !indirizzi.length) return !opzioni.viaProxy;
    return indirizzi.some((r: any) => ipPrivato(r.address));
  } catch {
    return !opzioni.viaProxy;
  }
}

/** `true` se l'URL è http/https e non punta alla rete locale. */
async function urlPubblico(url: string, lookup: Lookup = dns.promises.lookup, opzioni: OpzioniHost = {}): Promise<boolean> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return !(await hostPrivato(u.hostname, lookup, opzioni));
  } catch {
    return false;
  }
}

/**
 * `true` se le regole proxy (formato PAC: `"PROXY h:p; DIRECT"`) mandano la richiesta solo
 * attraverso proxy. Con un `DIRECT` fra le alternative Chromium può connettersi da sé.
 */
function soloViaProxy(regole: string): boolean {
  const voci = String(regole || '').split(';').map(v => v.trim().toUpperCase()).filter(Boolean);
  return voci.length > 0 && voci.every(v => !v.startsWith('DIRECT'));
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
  const ses = session.fromPartition('iiif-rete');
  // Resolver di Chromium per questa sessione: vedi la nota sul rebinding in testa al file.
  const lookupChromium: Lookup = async (host) => {
    const risolto = await ses.resolveHost(host);
    return (risolto?.endpoints || []).map((e: any) => ({ address: e.address }));
  };
  ses.webRequest.onBeforeRequest((dettagli: any, callback: any) => {
    if (origineAutorizzata(dettagli.url)) { callback({ cancel: false }); return; }
    ses.resolveProxy(dettagli.url)
      .then((regole: string) => soloViaProxy(regole), () => false)
      .then((viaProxy: boolean) => urlPubblico(dettagli.url, lookupChromium, { viaProxy }))
      .then((ok: boolean) => {
        if (!ok) console.warn(`[IIIF] Richiesta verso la rete locale bloccata: ${dettagli.url}`);
        callback({ cancel: !ok });
      }, () => callback({ cancel: true }));
  });
  sessione = ses;
  return sessione;
}

/** `fetch` per URL di terzi: solo host pubblici, anche dopo i redirect. */
function fetchGuardata(url: string, init?: any): Promise<any> {
  return sessioneGuardata().fetch(url, init);
}

module.exports = {
  ipPrivato, hostPrivato, urlPubblico, soloViaProxy, leggiCorpoLimitato,
  autorizzaOrigine, origineAutorizzata, fetchGuardata
};
export {};
