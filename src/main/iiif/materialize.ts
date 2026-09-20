// Import IIIF — materializzazione delle carte.
//
// "Materializzare" significa una cosa sola: far comparire in `allegati_manoscritti/` il file
// al nome che la carta si è già riservata all'import. Da quel momento la carta è un allegato
// come tutti gli altri — OCR, stampa, export e sincronizzazione la trattano senza sapere che
// veniva da un manifest — e il renderer toglie dal record `remoto` e `iiif`.
//
// ⚠️ L'hash si calcola sul buffer che si ha già in mano, non rileggendo il file appena
// scritto come fa `salva-allegato`: su un facsimile da 30 MB per 400 carte sarebbero 12 GB
// di letture in più per ottenere lo stesso numero.

const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const crypto = require('crypto');
const { net } = require('electron');
const { state } = require('../workspaceManager');
const { safeAttachmentPathOrNull } = require('../ipc/pathSafety');
const cache = require('./imageCache');

const CONCORRENZA = 3;
const TIMEOUT_MS = 60000;

let annullato = false;
let inCorso = false;

function annulla() { annullato = true; }
function occupato() { return inCorso; }

/**
 * Le richieste arrivano dal renderer come `{ nome, urls }`, dove `urls` è la catena di
 * candidati di `avIiifCandidati` — la misura chiesta, poi la massima, poi l'immagine
 * statica. Un solo URL non basterebbe: il server che non sa servire una misura risponde 504,
 * e con 400 carte una catena mancante significa 400 caselle vuote.
 *
 * Il `nome` è quello deciso da `avIiifNomeAllegato`, ma arriva comunque da fuori: passa da
 * `safeAttachmentPathOrNull` come ogni altro nome di provenienza non locale.
 */
async function scaricaUna(richiesta: any, dir: string): Promise<any> {
  const nome = richiesta && richiesta.nome;
  const candidati = (Array.isArray(richiesta && richiesta.urls) ? richiesta.urls : [richiesta && richiesta.url])
    .filter((u: any) => cache.urlAmmesso(u));

  const destinazione = safeAttachmentPathOrNull(dir, nome);
  if (!destinazione) return { nome, ok: false, codice: 'nome_non_valido' };
  if (!candidati.length) return { nome, ok: false, codice: 'url_non_valido' };

  const temporaneo = destinazione + '.part';
  try {
    // La carta può essere già in cache: è quella che l'utente sta guardando mentre decide di
    // scaricarla. Si LEGGE la cache ma non ci si scrive — `cache.immagine` lo farebbe —
    // perché il file sta per esistere in `allegati_manoscritti/`: tenerne una seconda copia
    // in `userData` raddoppierebbe lo spazio occupato da ogni codice materializzato.
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
          const risposta = await net.fetch(url, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { 'Accept': 'image/jpeg,image/png,image/*;q=0.8' }
          });
          if (!risposta.ok) { ultimoStato = risposta.status; continue; }
          const corpo = Buffer.from(await risposta.arrayBuffer());
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

    // `.part` + rename: senza, un'interruzione lascerebbe nella cartella allegati un JPEG
    // troncato con l'hash giusto nel database, cioè un allegato che la verifica segnala
    // corrotto a ogni apertura.
    await fsp.writeFile(temporaneo, dati);
    await fsp.rename(temporaneo, destinazione);

    const hash = crypto.createHash('sha256').update(dati).digest('hex');
    return { nome, ok: true, hash, dimensione: dati.length };
  } catch (errore: any) {
    const codice = (errore && (errore.name === 'TimeoutError' || errore.name === 'AbortError')) ? 'timeout' : 'rete';
    console.error(`[IIIF] Materializzazione di ${nome} fallita:`, errore && errore.message);
    try { if (fs.existsSync(temporaneo)) await fsp.unlink(temporaneo); } catch { /* best effort */ }
    return { nome, ok: false, codice, errore: errore && errore.message };
  }
}

/**
 * Scarica le carte richieste. Non si ferma al primo errore: con 400 carte, una che manca sul
 * server della biblioteca non deve annullare le 399 riuscite. Il chiamante riceve l'esito di
 * ciascuna e aggiorna il record solo per quelle andate a buon fine.
 */
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

module.exports = { CONCORRENZA, materializza, annulla, occupato };
export {};
