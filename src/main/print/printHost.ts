// Fase 2.2 — Stampa e PDF: lo strato impuro.
//
// Qui vivono le tre cose che `printTemplate.ts` non puo' avere: il disco (miniature degli
// allegati), la finestra che rende il documento, e `printToPDF`/`print`. Nessuna libreria
// PDF: Electron ha gia' tutto.
//
// ⚠️ La finestra NON e' `offscreen: true`, a differenza di quella dell'OCR. `printToPDF`
// funziona in entrambi i casi, ma `webContents.print()` sull'offscreen rendering (software,
// senza compositor) e' terreno instabile, e qui le due strade devono passare dalla stessa
// finestra o la carta e il PDF non coincidono piu'. Una finestra `show: false` normale non
// e' mai visibile all'utente e ha un renderer completo.
//
// ⚠️ Come quella dell'OCR, conta come finestra aperta: viene distrutta a fine lavoro e,
// per sicurezza, sul `closed` della finestra principale (vedi `main.ts`). Senza, un'app
// chiusa mentre una stampa e' in coda resterebbe in memoria.

const { BrowserWindow, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { state } = require('../workspaceManager');

const SCHEMA = 'print-host';

// Formati che il renderer di Chromium sa disegnare in un `<img>`. Un allegato di altro tipo
// resta elencato senza miniatura (vedi `miniatureDi` nel template).
const IMMAGINI = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif']);

const TIPI_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif'
};

/** Documenti pronti per la finestra, per id di lavoro. Vivono il tempo di un caricamento. */
const documenti = new Map();
let contatore = 0;

let finestra = null;

/**
 * UNA sola autorita' (`app`), due radici per percorso — `/doc/<id>` e `/allegato/<nome>` —
 * esattamente come `ocr-host`. Due AUTORITA' diverse sarebbero due origini diverse, e le
 * miniature diventerebbero richieste cross-origin da una pagina con CSP restrittiva: il
 * difetto costato mezza giornata nella 2.3, che qui non si ripete.
 *
 * Non e' invece lo stesso schema dell'OCR: sono due sottosistemi indipendenti, e un errore
 * nel servire una pagina di stampa non deve poter rompere il riconoscimento del testo.
 */
function registraProtocollo() {
  protocol.handle(SCHEMA, async (request) => {
    try {
      const url = new URL(request.url);
      const segmenti = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      if (segmenti.length !== 2) return new Response('Access Denied', { status: 403 });
      const radice = segmenti[0];
      const nome = path.basename(segmenti[1] || '');
      if (!nome || nome === '.' || nome === '..') return new Response('Access Denied', { status: 403 });

      if (radice === 'doc') {
        const html = documenti.get(nome);
        if (html === undefined) return new Response('Not Found', { status: 404 });
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      if (radice === 'allegato') {
        if (!state.attachmentsDirPath) return new Response('Not Found', { status: 404 });
        const dati = await fsp.readFile(path.join(state.attachmentsDirPath, nome));
        return new Response(dati, {
          status: 200,
          headers: {
            'Content-Type': TIPI_MIME[path.extname(nome).toLowerCase()] || 'application/octet-stream',
            'Content-Length': String(dati.length)
          }
        });
      }
      return new Response('Not Found', { status: 404 });
    } catch (errore) {
      console.error('[Stampa] Richiesta print-host fallita:', errore);
      return new Response('Not Found', { status: 404 });
    }
  });
}

/**
 * Miniature: URL per gli allegati stampabili di questi record.
 *
 * Le immagini passano dal protocollo (nessuna copia in memoria: le legge il renderer quando
 * gli servono). I PDF vengono rasterizzati dalla finestra offscreen dell'OCR — e' esattamente
 * la riusabilita' prevista dalla roadmap, e l'alternativa sarebbe una seconda copia di pdf.js.
 *
 * Il tetto per scheda non e' prudenza: un fascicolo da ottanta carte stampato in layout
 * "scheda" genererebbe ottanta rasterizzazioni per un provino grande come un francobollo.
 */
const MAX_MINIATURE_PER_SCHEDA = 6;
const DPI_MINIATURA = 110;

async function preparaMiniature(records, { pdf = true } = {}) {
  const mappa = {};
  if (!state.attachmentsDirPath) return mappa;
  let pdfHost = null;

  for (const m of records) {
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    let fatte = 0;
    for (const a of allegati) {
      if (fatte >= MAX_MINIATURE_PER_SCHEDA) break;
      const file = typeof a === 'string' ? a : (a && (a.nome || a.name)) || '';
      if (!file) continue;
      if (mappa[file]) { fatte++; continue; }   // stesso file su piu' schede: una sola volta
      const ext = path.extname(file).toLowerCase();
      const percorso = path.join(state.attachmentsDirPath, path.basename(file));
      if (!fs.existsSync(percorso)) continue;

      if (IMMAGINI.has(ext)) {
        mappa[file] = `${SCHEMA}://app/allegato/${encodeURIComponent(path.basename(file))}`;
        fatte++;
      } else if (ext === '.pdf' && pdf) {
        try {
          if (!pdfHost) pdfHost = require('../ocr/pdfHost');
          const apertura = await pdfHost.apriPdf(file);
          if (apertura && apertura.ok) {
            const img = await pdfHost.immaginePagina(1, DPI_MINIATURA);
            if (img && img.ok && img.png) {
              mappa[file] = `data:image/png;base64,${img.png}`;
              fatte++;
            }
          }
        } catch (errore) {
          // Una miniatura mancante non deve impedire la stampa: l'allegato resta elencato.
          console.error('[Stampa] Miniatura PDF non generata per', file, errore);
        }
      }
    }
  }
  if (pdfHost) { try { await pdfHost.chiudiPdf(); } catch (e) { /* noop */ } }
  return mappa;
}

/** Carica l'HTML nella finestra e restituisce i suoi `webContents`, pronti per la stampa. */
async function caricaDocumento(html) {
  const id = `j${++contatore}`;
  documenti.set(id, html);

  if (!finestra || finestra.isDestroyed()) {
    finestra = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // Il documento e' statico: senza questo, una stampa lanciata mentre la finestra
        // principale ha il fuoco viene rallentata dal throttling dei timer in background.
        backgroundThrottling: false,
        javascript: false   // la pagina non ne ha bisogno: e' HTML e CSS, nient'altro
      }
    });
    finestra.on('closed', () => { finestra = null; });
  }

  try {
    // `loadURL` risolve al `did-finish-load`, cioè a sottorisorse caricate: è ciò che
    // garantisce che le miniature siano già arrivate quando `printToPDF` fotografa la
    // pagina, senza attese aggiuntive.
    // ⚠️ Non aggiungere qui una seconda attesa su `did-finish-load`: l'evento è GIÀ
    // passato, `isLoading()` può nondimeno restituire true un istante dopo, e la promessa
    // non si risolve mai — la stampa restava appesa per sempre, e l'unico sintomo visibile
    // era un pulsante disabilitato che non tornava più attivo.
    await finestra.loadURL(`${SCHEMA}://app/doc/${id}`);
    return finestra.webContents;
  } finally {
    // L'HTML non serve piu' una volta caricato: tenerlo significherebbe tenere in RAM ogni
    // documento stampato nella sessione.
    documenti.delete(id);
  }
}

function margini(opzioni) {
  const mm = Number(opzioni && opzioni.margine);
  const cm = (Number.isFinite(mm) && mm >= 0 ? mm : 18) / 25.4;   // printToPDF ragiona in pollici
  return { top: cm, bottom: cm, left: cm, right: cm };
}

function intestazioniPagina(opzioni) {
  const o = opzioni || {};
  if (!o.numeriPagina && !o.testoIntestazione) return { displayHeaderFooter: false };
  const stile = 'font-size:8px; color:#78716c; width:100%; padding:0 14mm; font-family:Georgia,serif;';
  return {
    displayHeaderFooter: true,
    headerTemplate: `<div style="${stile}">${escapeTemplate(o.testoIntestazione || '')}</div>`,
    footerTemplate: o.numeriPagina
      ? `<div style="${stile} text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`
      : `<div style="${stile}"></div>`
  };
}

/** I template di intestazione sono HTML iniettato da Chromium: il nome del fondo va scappato. */
function escapeTemplate(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Genera il PDF. Non scrive nulla: restituisce il buffer, e chi lo salva e' l'IPC — cosi'
 * la stessa funzione serve tanto al salvataggio quanto a un'eventuale anteprima.
 */
async function generaPdf(html, opzioni: any = {}) {
  const contenuti = await caricaDocumento(html);
  return contenuti.printToPDF(Object.assign({
    printBackground: true,
    landscape: opzioni.orientamento === 'landscape',
    pageSize: opzioni.formato || 'A4',
    margins: margini(opzioni),
    preferCSSPageSize: false,
    generateDocumentOutline: false
  }, intestazioniPagina(opzioni)));
}

/**
 * Manda il documento alla stampante. `silent: false` apre il dialogo di sistema: la scelta
 * della stampante e delle copie e' del sistema operativo, non nostra.
 */
async function stampa(html, opzioni: any = {}) {
  const contenuti = await caricaDocumento(html);
  return new Promise((resolve) => {
    contenuti.print({
      silent: false,
      printBackground: true,
      landscape: opzioni.orientamento === 'landscape',
      pageSize: opzioni.formato || 'A4'
    }, (successo, motivo) => {
      // `cancelled` non e' un errore: e' l'utente che ha chiuso il dialogo di stampa.
      resolve({ success: !!successo, canceled: !successo && motivo === 'cancelled', error: successo ? null : motivo });
    });
  });
}

function distruggi() {
  documenti.clear();
  if (finestra && !finestra.isDestroyed()) finestra.destroy();
  finestra = null;
}

module.exports = { SCHEMA, registraProtocollo, preparaMiniature, generaPdf, stampa, distruggi };
export {};
