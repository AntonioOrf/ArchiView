import { protocol } from 'electron';
import * as cache from './imageCache';
const Iiif = require('../../shared/iiifManifest');
import * as schemaApp from '../schemaApp';

const SCHEMA = 'iiif-img';

function candidatiDa(riferimento: any): string[] {
  if (typeof riferimento === 'string') return [riferimento];
  if (!riferimento || typeof riferimento !== 'object') return [];
  return Iiif.candidati(
    { serviceId: riferimento.s || null, apiVersione: riferimento.v || 0, urlStatico: riferimento.u || null },
    { lato: Number(riferimento.l) || 0 }
  );
}

function registraProtocollo() {
  protocol.handle(SCHEMA, async (request: any) => {
    try {
      const url = new URL(request.url);
      const segmenti = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      if (segmenti.length !== 1) return new Response('Access Denied', { status: 403 });

      const candidati = candidatiDa(cache.decodificaRiferimento(segmenti[0])).filter(cache.urlAmmesso);
      if (!candidati.length) return new Response('Access Denied', { status: 403 });

      const immagine = await cache.immagine(candidati);
      if (!immagine) return new Response('Not Found', { status: 404 });

      return new Response(immagine.dati as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': immagine.mime,
          'Content-Length': String(immagine.dati.length),
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': schemaApp.ORIGINE
        }
      });
    } catch (errore) {
      console.error('[IIIF] Richiesta iiif-img fallita:', errore);
      return new Response('Not Found', { status: 404 });
    }
  });
}

export { SCHEMA, registraProtocollo, candidatiDa };
