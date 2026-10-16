import { ipcMain, shell, protocol, net, app } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';
import * as fs from 'fs';
const fsp = require('fs').promises;
import { state } from '../workspaceManager';
import { safeAttachmentPath, safeAttachmentPathOrNull, dentroCartellaReale } from './pathSafety';
import { hashFile } from '../chunkingLogic';
import * as schemaApp from '../schemaApp';

async function verificaSorgenteAllegato(sourcePath: unknown): Promise<void> {
  if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath)) throw new Error('Percorso allegato non valido');
  const reale = await fsp.realpath(sourcePath);
  const st = await fsp.stat(reale);
  if (!st.isFile()) throw new Error('L\'allegato non è un file');
  const dentro = (dir: string) => dentroCartellaReale(reale, dir);
  const ws = state.workspacePath;
  const inUserData = dentro(app.getPath('userData')) && !(ws && dentro(ws));
  if (inUserData || (ws && dentro(path.join(ws, '.archiview')))) {
    throw new Error('File interno dell\'applicazione: non allegabile');
  }
}

function setupAttachmentsIpc() {
  ipcMain.handle('salva-allegato', async (event, sourcePath, documentoId) => {
    try {
      if (!state.attachmentsDirPath) throw new Error("Cartella allegati non definita");
      await verificaSorgenteAllegato(sourcePath);
      const ext = path.extname(sourcePath).toLowerCase().replace(/[^a-z0-9.]/g, '').substring(0, 16);

      const cleanOriginalName = path.basename(sourcePath, path.extname(sourcePath))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50);

      const idPulito = typeof documentoId === 'string' || typeof documentoId === 'number'
        ? String(documentoId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64)
        : '';
      const prefix = idPulito ? `${idPulito}_` : `doc_${Date.now()}_`;
      const fileName = `${prefix}${cleanOriginalName}${ext}`;
      const destPath = safeAttachmentPath(state.attachmentsDirPath, fileName);

      await fsp.copyFile(sourcePath, destPath);

      const hash = await hashFile(destPath);

      return { fileName, ext, hash };
    } catch (error) {
      console.error("Errore copia allegato:", error);
      return null;
    }
  });

  ipcMain.handle('verifica-hash-allegato', async (event, fileName, expectedHash) => {
    try {
      if (!state.attachmentsDirPath || !fileName || !expectedHash) return { status: 'missing', path: '' };
      const destPath = safeAttachmentPathOrNull(state.attachmentsDirPath, fileName);
      if (!destPath || !fs.existsSync(destPath)) {
        return { status: 'missing', path: state.attachmentsDirPath };
      }

      const hash = await hashFile(destPath);

      if (hash === expectedHash) {
        return { status: 'ok' };
      } else {
        return { status: 'corrupted' };
      }
    } catch (error) {
      console.error("Errore verifica hash allegato:", error);
      return { status: 'error', message: error.message };
    }
  });

  ipcMain.handle('mostra-cartella-allegato', async (event, fileName) => {
    try {
      if (!state.attachmentsDirPath) return false;
      const safeFileName = path.basename(fileName);
      const p = path.join(state.attachmentsDirPath, safeFileName);
      if (fs.existsSync(p)) {
        shell.showItemInFolder(p); 
        return true;
      }
    } catch (error) { 
      console.error("Errore mostra cartella:", error); 
    }
    return false;
  });

  ipcMain.handle('get-allegato-path', (event, fileName) => {
    if (!state.attachmentsDirPath) return '';
    const safeFileName = path.basename(fileName);
    return path.join(state.attachmentsDirPath, safeFileName);
  });

  ipcMain.handle('pdf-allegato-info', async (event, fileName) => {
    try {
      const percorso = percorsoPdfAllegato(fileName);
      const st = await fsp.stat(percorso);
      if (!st.isFile()) throw new Error('L\'allegato non è un file');
      const iniziale = await leggiIntervallo(percorso, 0, Math.min(st.size, PDF_PEZZO_INIZIALE));
      return { ok: true, dimensione: st.size, iniziale };
    } catch (error) {
      return { ok: false, errore: error.message };
    }
  });

  ipcMain.handle('pdf-allegato-intervallo', async (event, fileName, inizio, fine) => {
    try {
      if (!Number.isSafeInteger(inizio) || !Number.isSafeInteger(fine) || inizio < 0 || fine <= inizio) {
        throw new Error('Intervallo non valido');
      }
      if (fine - inizio > PDF_MAX_INTERVALLO) throw new Error('Intervallo troppo ampio');
      const dati = await leggiIntervallo(percorsoPdfAllegato(fileName), inizio, fine);
      return { ok: true, dati };
    } catch (error) {
      return { ok: false, errore: error.message };
    }
  });
}

const PDF_PEZZO_INIZIALE = 64 * 1024;
const PDF_MAX_INTERVALLO = 16 * 1024 * 1024;

function percorsoPdfAllegato(fileName: unknown): string {
  if (!state.attachmentsDirPath) throw new Error('Cartella allegati non definita');
  const percorso = safeAttachmentPath(state.attachmentsDirPath, fileName as string);
  if (path.extname(percorso).toLowerCase() !== '.pdf') throw new Error('L\'allegato non è un PDF');
  return percorso;
}

async function leggiIntervallo(percorso: string, inizio: number, fine: number): Promise<Uint8Array> {
  const fh = await fsp.open(percorso, 'r');
  try {
    const buffer = Buffer.alloc(fine - inizio);
    const { bytesRead } = await fh.read(buffer, 0, buffer.length, inizio);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);
  } finally {
    await fh.close();
  }
}

const TIPI_LOCAL_ASSET: { [ext: string]: string } = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf'
};
const CSP_LOCAL_ASSET = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";

function negato(motivo: string): Response {
  console.warn(`[SECURITY] local-asset: ${motivo}`);
  return new Response('Access Denied', { status: 403 });
}

async function rispostaLocalAsset(url: string): Promise<Response> {
  if (!state.attachmentsDirPath) return negato('cartella allegati non definita');
  const grezzo = url.slice('local-asset://'.length).split(/[?#]/)[0];
  let nome: string;
  try {
    nome = decodeURIComponent(grezzo);
  } catch {
    return negato('nome non decodificabile');
  }
  let percorso: string;
  try {
    percorso = safeAttachmentPath(state.attachmentsDirPath, nome);
  } catch {
    return negato('nome non valido');
  }
  const tipo = TIPI_LOCAL_ASSET[path.extname(percorso).toLowerCase()];
  if (!tipo) return negato(`tipo non servito (${path.extname(percorso) || 'senza estensione'})`);

  try {
    const r = await net.fetch(pathToFileURL(percorso).href);
    if (!r.ok) return new Response(null, { status: r.status });
    const headers: { [k: string]: string } = { 'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff' };
    if (tipo !== 'application/pdf') {
      headers['Content-Security-Policy'] = CSP_LOCAL_ASSET;
      headers['Access-Control-Allow-Origin'] = schemaApp.ORIGINE;
    }
    const lunghezza = r.headers.get('content-length');
    if (lunghezza) headers['Content-Length'] = lunghezza;
    return new Response(r.body, { status: 200, headers });
  } catch (error) {
    console.error('Errore lettura local-asset:', error && error.message);
    return new Response(null, { status: 404 });
  }
}

function setupAttachmentsProtocol() {
  protocol.handle('local-asset', (request) => rispostaLocalAsset(request.url));
}

export { setupAttachmentsIpc, setupAttachmentsProtocol };
