import { BrowserWindow, protocol } from 'electron';
import * as path from 'path';
const fsp = require('fs').promises;
import { state } from '../workspaceManager';

const SCHEMA = 'ocr-host';

let finestra: import('electron').BrowserWindow | null = null;
let pronta: Promise<boolean> | null = null;

function cartellaHost() {
  return path.join(__dirname, '..', '..', 'renderer', 'ocr');
}

const TIPI_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf'
};

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

      let base: string | null = null;
      if (radice === 'allegato') base = state.attachmentsDirPath;
      else if (radice === 'file') base = cartellaHost();
      if (!base) return new Response('Not Found', { status: 404 });

      const dati = await fsp.readFile(path.join(base, nome));
      return new Response(dati, {
        status: 200,
        headers: {
          'Content-Type': TIPI_MIME[path.extname(nome).toLowerCase()] || 'application/octet-stream',
          'Content-Length': String(dati.length),
          'Accept-Ranges': 'none'
        }
      });
    } catch (errore) {
      console.error('[OCR] Richiesta ocr-host fallita:', errore);
      return new Response('Not Found', { status: 404 });
    }
  });
}

async function avvia() {
  if (finestra && !finestra.isDestroyed()) return pronta;

  const f = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  finestra = f;
  f.on('closed', () => { finestra = null; pronta = null; });

  pronta = f.loadURL(`${SCHEMA}://app/file/pdfHost.html`).then(async () => {
    for (let i = 0; i < 100 && !f.isDestroyed(); i++) {
      const ok = await f.webContents.executeJavaScript('window.__pdfPronto === true').catch(() => false);
      if (ok) return true;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error('Host PDF non inizializzato');
  });

  return pronta;
}

async function chiama(espressione) {
  await avvia();
  if (!finestra || finestra.isDestroyed()) throw new Error('Host PDF chiuso');
  return finestra.webContents.executeJavaScript(espressione);
}

async function apriPdf(nomeFile) {
  return chiama(`window.__pdfApri(${JSON.stringify(path.basename(nomeFile))})`);
}

async function testoPagina(numero) {
  return chiama(`window.__pdfTesto(${Number(numero)})`);
}

async function immaginePagina(numero, dpi, rotazioneExtra?) {
  return chiama(`window.__pdfImmagine(${Number(numero)}, ${Number(dpi) || 300}, ${Number(rotazioneExtra) || 0})`);
}

async function immagineRuotata(nomeFile, gradi) {
  return chiama(`window.__immagineRuotata(${JSON.stringify(path.basename(nomeFile))}, ${Number(gradi) || 0})`);
}

async function chiudiPdf() {
  if (!finestra || finestra.isDestroyed()) return { ok: true };
  return chiama('window.__pdfChiudi()').catch(() => ({ ok: true }));
}

function distruggi() {
  if (finestra && !finestra.isDestroyed()) finestra.destroy();
  finestra = null;
  pronta = null;
}

export { SCHEMA, registraProtocollo, apriPdf, testoPagina, immaginePagina, immagineRuotata, chiudiPdf, distruggi };
