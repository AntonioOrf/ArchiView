// Server HTTP effimero per i redirect OAuth (Google, Microsoft) e per il Google Picker.
//
// `server.listen(porta)` senza host ascolta su TUTTE le interfacce: chiunque sulla stessa rete
// poteva mandare un `?code=` al server di login in attesa (S3 in REVIEW-SECURITY.md). Qui si
// ascolta solo sul loopback, IPv4 e IPv6: gli URI di redirect registrati dicono `localhost`, e
// il browser può risolverlo in 127.0.0.1 o in ::1. Porte e URI restano quelli registrati.
//
// Nessuna dipendenza da electron: testabile in Node puro (test/loopbackServer.test.js).
const http = require('http');

const INDIRIZZI_LOOPBACK = ['127.0.0.1', '::1'];

// IPv6 assente o disattivato: il server IPv4 basta, non è un errore.
const ERRORI_IPV6_TOLLERATI = new Set(['EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EINVAL']);

export interface ServerLoopback {
  close(): void;
}

/**
 * Avvia `gestore` su 127.0.0.1:porta e, se disponibile, su [::1]:porta.
 * Rifiuta se la porta IPv4 non si apre (occupata): senza quella il redirect non arriverebbe.
 */
function avviaServerLoopback(porta: number, gestore: (req: any, res: any) => void): Promise<ServerLoopback> {
  const serverAperti: any[] = [];
  const chiudi = () => { for (const s of serverAperti) { try { s.close(); } catch { /* già chiuso */ } } };

  const ascolta = (host: string) => new Promise<void>((resolve, reject) => {
    const server = http.createServer(gestore);
    server.once('error', reject);
    server.listen(porta, host, () => {
      server.off('error', reject);
      server.on('error', (e: any) => console.error(`[loopback] errore su ${host}:${porta}:`, e && e.message));
      serverAperti.push(server);
      resolve();
    });
  });

  return (async () => {
    try {
      await ascolta(INDIRIZZI_LOOPBACK[0]);
    } catch (e) {
      chiudi();
      throw e;
    }
    try {
      await ascolta(INDIRIZZI_LOOPBACK[1]);
    } catch (e: any) {
      if (!ERRORI_IPV6_TOLLERATI.has(e && e.code)) {
        chiudi();
        throw e;
      }
    }
    return { close: chiudi };
  })();
}

export type CallbackOAuth =
  | { tipo: 'codice'; code: string }
  | { tipo: 'negato'; errore: string }   // l'utente ha annullato il consenso
  | { tipo: 'estranea' }                  // path diverso (favicon, sonde): si ignora
  | { tipo: 'rifiutata' };                // path giusto ma state assente o diverso

/**
 * Classifica una richiesta arrivata al server di redirect. Il `state` è un segreto emesso con
 * l'URL di login: un `?code=` senza lo stesso state non viene da quel login (login CSRF /
 * iniezione di un codice dell'attaccante) e non deve né essere scambiato né interrompere il
 * login vero ancora in corso.
 */
function leggiCallbackOAuth(reqUrl: string, atteso: { path: string; stato: string }): CallbackOAuth {
  let url: URL;
  try { url = new URL(reqUrl, 'http://localhost'); } catch { return { tipo: 'estranea' }; }
  if (url.pathname !== atteso.path) return { tipo: 'estranea' };
  const stato = url.searchParams.get('state');
  if (!atteso.stato || !stato || !confrontoCostante(stato, atteso.stato)) return { tipo: 'rifiutata' };
  const errore = url.searchParams.get('error');
  if (errore) return { tipo: 'negato', errore };
  const code = url.searchParams.get('code');
  return code ? { tipo: 'codice', code } : { tipo: 'rifiutata' };
}

function confrontoCostante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

module.exports = { avviaServerLoopback, leggiCallbackOAuth, INDIRIZZI_LOOPBACK };
