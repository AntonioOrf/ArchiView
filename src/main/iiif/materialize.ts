import * as path from 'path';
import * as fs from 'fs';
const fsp = require('fs').promises;
import * as crypto from 'crypto';
import { leggiCorpoLimitato, fetchGuardata } from './reteSicura';
import { state } from '../workspaceManager';
import { safeAttachmentPathOrNull } from '../ipc/pathSafety';
import * as cache from './imageCache';

const CONCORRENZA = 3;
const TIMEOUT_MS = 60000;

let annullato = false;
let inCorso = false;

function annulla() { annullato = true; }
function occupato() { return inCorso; }

async function scaricaUna(richiesta: any, dir: string): Promise<any> {
  const nome = richiesta && richiesta.nome;
  const candidati = (Array.isArray(richiesta && richiesta.urls) ? richiesta.urls : [richiesta && richiesta.url])
    .filter((u: any) => cache.urlAmmesso(u));

  const destinazione = safeAttachmentPathOrNull(dir, nome);
  if (!destinazione) return { nome, ok: false, codice: 'nome_non_valido' };
  if (!candidati.length) return { nome, ok: false, codice: 'url_non_valido' };

  const temporaneo = destinazione + '.part';
  try {
    let dati: Buffer | null = null;
    let mime = '';

    const daCache = await cache.leggiDallaCache(candidati[0]);
    if (daCache) {
      dati = daCache.dati;
      mime = daCache.mime;
    } else {
      let ultimoStato = 0;
      for (const url of candidati) {
        try {
          const risposta = await fetchGuardata(url, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { 'Accept': 'image/jpeg,image/png,image/*;q=0.8' }
          });
          if (!risposta.ok) { ultimoStato = risposta.status; continue; }
          const corpo = await leggiCorpoLimitato(risposta, cache.MAX_IMMAGINE);
          if (!corpo) {
            console.warn(`[IIIF] Carta oltre ${cache.MAX_IMMAGINE} byte, interrotta: ${url}`);
            continue;
          }
          if (!corpo.length) continue;
          dati = corpo;
          mime = (risposta.headers.get('content-type') || '').split(';')[0].trim();
          break;
        } catch (tentativo: any) {
          console.warn(`[IIIF] Tentativo fallito (${url}):`, tentativo && tentativo.message);
        }
      }
      if (!dati) return { nome, ok: false, codice: ultimoStato ? 'http' : 'rete', stato: ultimoStato || undefined };
    }

    if (!dati || !dati.length) return { nome, ok: false, codice: 'vuota' };
    if (mime && !/^image\//i.test(mime)) return { nome, ok: false, codice: 'non_immagine' };

    await fsp.writeFile(temporaneo, dati);
    await fsp.rename(temporaneo, destinazione);

    const hash = crypto.createHash('sha256').update(dati).digest('hex');
    return { nome, ok: true, hash, dimensione: dati.length };
  } catch (errore: any) {
    const codice = (errore && (errore.name === 'TimeoutError' || errore.name === 'AbortError')) ? 'timeout' : 'rete';
    console.error(`[IIIF] Materializzazione di ${nome} fallita:`, errore && errore.message);
    try { if (fs.existsSync(temporaneo)) await fsp.unlink(temporaneo); } catch {}
    return { nome, ok: false, codice, errore: errore && errore.message };
  }
}

async function materializza(richieste: any[], progresso?: (d: any) => void): Promise<any> {
  if (!state.attachmentsDirPath) return { ok: false, codice: 'nessun_workspace' };
  const elenco = Array.isArray(richieste) ? richieste.filter(Boolean) : [];
  if (!elenco.length) return { ok: true, risultati: [] };
  if (inCorso) return { ok: false, codice: 'occupato' };

  inCorso = true;
  annullato = false;
  const dir = state.attachmentsDirPath;
  fs.mkdirSync(dir, { recursive: true });

  const risultati: any[] = new Array(elenco.length);
  let fatte = 0;
  let prossima = 0;

  const avvisa = (nome: string) => {
    fatte++;
    if (typeof progresso === 'function') {
      progresso({ percent: (fatte / elenco.length) * 100, message: `${fatte}/${elenco.length} — ${nome}`, fatte, totale: elenco.length });
    }
  };

  async function lavoratore() {
    while (true) {
      const i = prossima++;
      if (i >= elenco.length) return;
      if (annullato) { risultati[i] = { nome: elenco[i].nome, ok: false, codice: 'annullato' }; avvisa(elenco[i].nome); continue; }
      risultati[i] = await scaricaUna(elenco[i], dir);
      avvisa(elenco[i].nome);
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(CONCORRENZA, elenco.length) }, lavoratore));
    return { ok: true, risultati, annullato };
  } finally {
    inCorso = false;
    annullato = false;
  }
}

export { CONCORRENZA, materializza, annulla, occupato };
