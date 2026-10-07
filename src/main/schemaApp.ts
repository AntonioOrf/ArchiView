// Schema `app://` della finestra principale (PIANO-SICUREZZA-OTTIMIZZAZIONE.md, O3).
//
// Prima il renderer girava su `file://`: V8 ricompilava da zero il bundle a ogni avvio
// (Chromium non tiene cache del codice per `file:`), e nella CSP `'self'` comprendeva
// qualunque `file:`, quindi anche `file://host/…` verso la rete (N1).
// Con uno schema `standard` + `codeCache` la pagina ha un'origine vera (`app://archiview`),
// la cache del codice V8 sopravvive fra un avvio e l'altro e `'self'` non tocca più il disco.
//
// Si serve solo la cartella out/renderer, in sola lettura, con un Content-Type fisso per
// estensione: ciò che non è nell'elenco non si serve.
const { protocol } = require('electron');
const path = require('path');
const fsp = require('fs').promises;

const SCHEMA = 'app';
const HOST = 'archiview';
const ORIGINE = `${SCHEMA}://${HOST}`;
const URL_INDEX = `${ORIGINE}/index.html`;

const PRIVILEGI = { standard: true, secure: true, supportFetchAPI: true, codeCache: true };

const TIPI_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

/**
 * Percorso su disco per una richiesta `app://archiview/<percorso>`, o null se esce dalla
 * radice, punta a un'altra autorità o a un tipo non servito. Pura, per i test.
 */
function percorsoRichiesto(radice: string, url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== SCHEMA + ':' || u.host !== HOST) return null;
  let relativo: string;
  try { relativo = decodeURIComponent(u.pathname); } catch { return null; }
  if (relativo.includes('\0')) return null;
  const base = path.resolve(radice);
  const completo = path.resolve(base, '.' + path.posix.normalize('/' + relativo.replace(/\\/g, '/')));
  if (completo !== base && !completo.startsWith(base + path.sep)) return null;
  if (!TIPI_MIME[path.extname(completo).toLowerCase()]) return null;
  return completo;
}

function registraProtocollo(radice: string) {
  protocol.handle(SCHEMA, async (request: Request) => {
    const file = percorsoRichiesto(radice, request.url);
    if (!file) return new Response('Not Found', { status: 404 });
    try {
      const dati = await fsp.readFile(file);
      return new Response(dati, {
        status: 200,
        headers: {
          'Content-Type': TIPI_MIME[path.extname(file).toLowerCase()],
          'X-Content-Type-Options': 'nosniff'
        }
      });
    } catch (errore: any) {
      if (errore && errore.code !== 'ENOENT') console.error('[app://] Lettura non riuscita:', file, errore);
      return new Response('Not Found', { status: 404 });
    }
  });
}

module.exports = { SCHEMA, HOST, ORIGINE, URL_INDEX, PRIVILEGI, TIPI_MIME, percorsoRichiesto, registraProtocollo };
export {};
