import * as http from 'http';

const INDIRIZZI_LOOPBACK = ['127.0.0.1', '::1'];

const ERRORI_IPV6_TOLLERATI = new Set(['EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EINVAL']);

export interface ServerLoopback {
  close(): void;
}

function avviaServerLoopback(porta: number, gestore: (req: any, res: any) => void): Promise<ServerLoopback> {
  const serverAperti: any[] = [];
  const chiudi = () => { for (const s of serverAperti) { try { s.close(); } catch {} } };

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
  | { tipo: 'negato'; errore: string }
  | { tipo: 'estranea' }
  | { tipo: 'rifiutata' };

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

export { avviaServerLoopback, leggiCallbackOAuth, INDIRIZZI_LOOPBACK };
