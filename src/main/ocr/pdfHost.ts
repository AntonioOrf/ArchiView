// Estrazione e rasterizzazione delle pagine PDF (Fase 2.3).
//
// Perché una finestra offscreen e non pdf.js nel main: il livello testo si estrae ovunque,
// ma **rasterizzare vuole un canvas**, cioè un contesto Chromium. L'alternativa sarebbe un
// modulo nativo (node-canvas), che qui non entra: l'applicazione non ha, e non vuole avere,
// dipendenze native — vedi `package.json`, tutte JS pure.
//
// La finestra è un processo a sé, quindi il rendering di una carta a 300 dpi non tocca
// l'event loop del main né la UI. È la stessa infrastruttura che servirà alla stampa (2.2).

const { BrowserWindow, protocol } = require('electron');
const path = require('path');
const fsp = require('fs').promises;
const { state } = require('../workspaceManager');

const SCHEMA = 'ocr-host';

let finestra = null;
let pronta = null;

/** Cartella dei file statici della pagina host (HTML + build di pdf.js), dentro out/renderer. */
function cartellaHost() {
  return path.join(__dirname, '..', '..', 'renderer', 'ocr');
}

const TIPI_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf'
};

/**
 * UNA sola autorità (`app`), due radici distinte per percorso: `/file/<nome>` sono i file
 * dell'applicazione, `/allegato/<nome>` è la cartella allegati del workspace. `path.basename`
 * sull'ultimo segmento elimina qualsiasi traversal, come già fa `local-asset`.
 *
 * ⚠️ Le due radici NON possono essere due autorità diverse (`ocr-host://app` e
 * `ocr-host://pdf`), che sarebbe la separazione più naturale: sono **origini diverse**, e
 * pdf.js scarica il documento con `fetch` — la risposta arriverebbe opaca e la libreria
 * fallisce con "Unexpected server response (0)". Era il difetto per cui l'OCR funzionava
 * sulle immagini e falliva su TUTTI i PDF, cioè sul caso principale della funzione.
 *
 * ⚠️ La `Response` è costruita qui e non delegata a `net.fetch('file://…')`, che risponde
 * anch'essa con `status: 0`: accettabile per una navigazione, non per una fetch.
 */
function registraProtocollo() {
  protocol.handle(SCHEMA, async (request) => {
    try {
      const url = new URL(request.url);
      const segmenti = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      const radice = segmenti[0];
      const nome = path.basename(segmenti[segmenti.length - 1] || '');
      if (segmenti.length !== 2 || !nome || nome === '.' || nome === '..') {
        return new Response('Access Denied', { status: 403 });
      }

      let base = null;
      if (radice === 'allegato') base = state.attachmentsDirPath;
      else if (radice === 'file') base = cartellaHost();
      if (!base) return new Response('Not Found', { status: 404 });

      const dati = await fsp.readFile(path.join(base, nome));
      return new Response(dati, {
        status: 200,
        headers: {
          'Content-Type': TIPI_MIME[path.extname(nome).toLowerCase()] || 'application/octet-stream',
          'Content-Length': String(dati.length),
          // pdf.js altrimenti tenta il caricamento a intervalli, che qui non serve: il file
          // è locale e arriva già interamente in memoria.
          'Accept-Ranges': 'none'
        }
      });
    } catch (errore) {
      console.error('[OCR] Richiesta ocr-host fallita:', errore);
      return new Response('Not Found', { status: 404 });
    }
  });
}

/**
 * La finestra è creata al primo uso e tenuta viva: caricare pdf.js costa qualche decina di
 * millisecondi e un OCR in massa la userebbe centinaia di volte di fila. `show: false` non
 * basta da solo — senza `offscreen` Windows le assegna comunque una posizione in barra.
 */
async function avvia() {
  if (finestra && !finestra.isDestroyed()) return pronta;

  finestra = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Nessun preload: il main parla con la pagina solo via executeJavaScript, e la pagina
      // non ha alcun canale per parlare col main. Meno superficie, meno da rivedere.
      sandbox: false,
      backgroundThrottling: false
    }
  });

  finestra.on('closed', () => { finestra = null; pronta = null; });

  pronta = finestra.loadURL(`${SCHEMA}://app/file/pdfHost.html`).then(async () => {
    // `loadURL` risolve al DOMContentLoaded: il modulo ES può non aver ancora valutato.
    for (let i = 0; i < 100; i++) {
      const ok = await finestra.webContents.executeJavaScript('window.__pdfPronto === true').catch(() => false);
      if (ok) return true;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error('Host PDF non inizializzato');
  });

  return pronta;
}

async function chiama(espressione) {
  await avvia();
  return finestra.webContents.executeJavaScript(espressione);
}

async function apriPdf(nomeFile) {
  return chiama(`window.__pdfApri(${JSON.stringify(path.basename(nomeFile))})`);
}

async function testoPagina(numero) {
  return chiama(`window.__pdfTesto(${Number(numero)})`);
}

async function immaginePagina(numero, dpi) {
  return chiama(`window.__pdfImmagine(${Number(numero)}, ${Number(dpi) || 300})`);
}

async function chiudiPdf() {
  if (!finestra || finestra.isDestroyed()) return { ok: true };
  return chiama('window.__pdfChiudi()').catch(() => ({ ok: true }));
}

/** Chiusura definitiva: usata all'uscita dell'app e dai test, non fra un OCR e il successivo. */
function distruggi() {
  if (finestra && !finestra.isDestroyed()) finestra.destroy();
  finestra = null;
  pronta = null;
}

module.exports = { SCHEMA, registraProtocollo, apriPdf, testoPagina, immaginePagina, chiudiPdf, distruggi };
export {};
