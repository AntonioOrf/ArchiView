// Import IIIF — il protocollo che serve le carte remote al renderer.
//
// PERCHÉ UNO SCHEMA CUSTOM E NON `img-src https:` NELLA CSP
//
// La CSP di `index.html` ammette oggi `'self'`, `data:`, `local-asset:` e i due host di
// Google. Allargarla a `https:` sarebbe una riga invece di questo file, ma aprirebbe il
// renderer a qualunque host della rete e perderebbe la cache offline, che è metà del valore
// dell'import IIIF: senza, chi lavora in biblioteca senza rete vede un archivio vuoto.
//
// Qui l'URL remoto viaggia in UN segmento di path, codificato base64url — i suoi `/`, `?` e
// `&` non diventano struttura dell'URL — e il main resta l'unico a parlare con l'esterno,
// come per ogni altra chiamata di rete dell'applicazione.

const { protocol } = require('electron');
const cache = require('./imageCache');
const Iiif = require('../../shared/iiifManifest');

const SCHEMA = 'iiif-img';

/**
 * I candidati per un riferimento. Il riferimento è la CARTA, non un URL: è il main, con la
 * stessa `shared/iiifManifest.ts` che usa il renderer, a derivarne la misura chiesta e i
 * ripieghi. Cosi' la conoscenza di come si interroga un server IIIF resta in un posto solo.
 */
function candidatiDa(riferimento: any): string[] {
  if (typeof riferimento === 'string') return [riferimento];
  if (!riferimento || typeof riferimento !== 'object') return [];
  return Iiif.candidati(
    { serviceId: riferimento.s || null, apiVersione: riferimento.v || 0, urlStatico: riferimento.u || null },
    { lato: Number(riferimento.l) || 0 }
  );
}

/**
 * Una sola autorità (`img`) e un solo segmento: il riferimento. Il traversal non è un
 * problema come per `local-asset` (qui non si apre nessun file per nome), lo è invece lo
 * schema degli URL decodificati, controllato da `cache.urlAmmesso`.
 */
function registraProtocollo() {
  protocol.handle(SCHEMA, async (request: any) => {
    try {
      const url = new URL(request.url);
      const segmenti = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      if (segmenti.length !== 1) return new Response('Access Denied', { status: 403 });

      const candidati = candidatiDa(cache.decodificaRiferimento(segmenti[0])).filter(cache.urlAmmesso);
      if (!candidati.length) return new Response('Access Denied', { status: 403 });

      const immagine = await cache.immagine(candidati);
      // 404 e non 500: per il renderer "questa carta ora non si vede" è uno stato normale
      // (si è offline e non è in cache), non un guasto da segnalare.
      if (!immagine) return new Response('Not Found', { status: 404 });

      return new Response(immagine.dati, {
        status: 200,
        headers: {
          'Content-Type': immagine.mime,
          'Content-Length': String(immagine.dati.length),
          // La cache vera è quella su disco, gestita qui: quella del renderer aggiungerebbe
          // solo una seconda copia in memoria della stessa carta.
          'Cache-Control': 'no-store'
        }
      });
    } catch (errore) {
      console.error('[IIIF] Richiesta iiif-img fallita:', errore);
      return new Response('Not Found', { status: 404 });
    }
  });
}

module.exports = { SCHEMA, registraProtocollo, candidatiDa };
export {};
