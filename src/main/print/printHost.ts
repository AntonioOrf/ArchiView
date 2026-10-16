import { BrowserWindow, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
const fsp = require('fs').promises;
import { state } from '../workspaceManager';

const SCHEMA = 'print-host';

const IMMAGINI = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif']);

const TIPI_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif'
};

const documenti = new Map();
let contatore = 0;

let finestra: import('electron').BrowserWindow | null = null;

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

const MAX_MINIATURE_PER_SCHEDA = 6;
const DPI_MINIATURA = 110;

async function preparaMiniature(records, { pdf = true } = {}) {
  const mappa = {};
  if (!state.attachmentsDirPath) return mappa;
  let pdfHost: any = null;

  for (const m of records) {
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    let fatte = 0;
    for (const a of allegati) {
      if (fatte >= MAX_MINIATURE_PER_SCHEDA) break;
      const file = typeof a === 'string' ? a : (a && (a.nome || a.name)) || '';
      if (!file) continue;
      if (mappa[file]) { fatte++; continue; }

      if (typeof a === 'object' && a.remoto && a.iiif) {
        try {
          const { candidatiDa } = require('../iiif/imageHost');
          const cache = require('../iiif/imageCache');
          const candidati = candidatiDa({
            s: a.iiif.serviceId || null,
            v: a.iiif.apiVersione || 0,
            u: a.iiif.urlStatico || null,
            l: 300
          }).filter(cache.urlAmmesso);
          if (candidati.length) {
            const img = await cache.immagine(candidati);
            if (img && img.dati) {
              mappa[file] = `data:${img.mime || 'image/jpeg'};base64,${img.dati.toString('base64')}`;
              fatte++;
              continue;
            }
          }
        } catch (errore) {
          console.error('[Stampa] Miniatura IIIF non caricata per', file, errore);
        }
      }

      if (!state.attachmentsDirPath) continue;
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
          console.error('[Stampa] Miniatura PDF non generata per', file, errore);
        }
      }
    }
  }
  if (pdfHost) { try { await pdfHost.chiudiPdf(); } catch (e) {} }
  return mappa;
}

async function caricaDocumento(html) {
  const id = `j${++contatore}`;
  documenti.set(id, html);

  let f = finestra;
  if (!f || f.isDestroyed()) {
    f = <import('electron').BrowserWindow>new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        javascript: false
      }
    });
    f.on('closed', () => { finestra = null; });
    finestra = f;
  }

  try {
    await f.loadURL(`${SCHEMA}://app/doc/${id}`);
    return f.webContents;
  } finally {
    documenti.delete(id);
  }
}

function margini(opzioni) {
  const mm = Number(opzioni && opzioni.margine);
  const cm = (Number.isFinite(mm) && mm >= 0 ? mm : 18) / 25.4;
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

function escapeTemplate(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

async function stampa(html, opzioni: any = {}) {
  const contenuti = await caricaDocumento(html);
  return new Promise((resolve) => {
    contenuti.print({
      silent: false,
      printBackground: true,
      landscape: opzioni.orientamento === 'landscape',
      pageSize: opzioni.formato || 'A4'
    }, (successo, motivo) => {
      resolve({ success: !!successo, canceled: !successo && motivo === 'cancelled', error: successo ? null : motivo });
    });
  });
}

function distruggi() {
  documenti.clear();
  if (finestra && !finestra.isDestroyed()) finestra.destroy();
  finestra = null;
}

export { SCHEMA, registraProtocollo, preparaMiniature, generaPdf, stampa, distruggi };
