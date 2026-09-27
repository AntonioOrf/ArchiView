const { ipcMain, shell, protocol, net, app } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { state } = require('../workspaceManager');
const crypto = require('crypto');
const { safeAttachmentPath } = require('./pathSafety');

/**
 * Il percorso sorgente arriva dal renderer (file scelto o trascinato). Non si può legare a un
 * dialogo del main, ma si escludono i casi che non sono "un file dell'utente da allegare":
 * percorsi relativi, cartelle, e i dati dell'app (userData con i token cifrati, la cartella
 * .archiview del workspace): copiati fra gli allegati finirebbero sincronizzati ai colleghi.
 */
async function verificaSorgenteAllegato(sourcePath: unknown): Promise<void> {
  if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath)) throw new Error('Percorso allegato non valido');
  const reale = await fsp.realpath(sourcePath);
  const st = await fsp.stat(reale);
  if (!st.isFile()) throw new Error('L\'allegato non è un file');
  const dentro = (dir: string) => {
    const rel = path.relative(path.resolve(dir), reale);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  };
  const ws = state.workspacePath;
  // userData sì, ma non il workspace aperto quando sta lì (l'archivio del tutorial).
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
      // Solo lettere/cifre nell'estensione: è l'unica parte del nome che resta com'è.
      const ext = path.extname(sourcePath).toLowerCase().replace(/[^a-z0-9.]/g, '').substring(0, 16);

      const cleanOriginalName = path.basename(sourcePath, path.extname(sourcePath))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50);

      // L'id della scheda arriva dal vault (anche condiviso): con "..\\..\\x" il file allegato
      // veniva copiato fuori dalla cartella allegati (S4 in REVIEW-SECURITY.md).
      const idPulito = typeof documentoId === 'string' || typeof documentoId === 'number'
        ? String(documentoId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64)
        : '';
      const prefix = idPulito ? `${idPulito}_` : `doc_${Date.now()}_`;
      const fileName = `${prefix}${cleanOriginalName}${ext}`;
      const destPath = safeAttachmentPath(state.attachmentsDirPath, fileName);

      await fsp.copyFile(sourcePath, destPath);
      
      const fileBuffer = await fsp.readFile(destPath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const hash = hashSum.digest('hex');

      return { fileName, ext, hash }; 
    } catch (error) {
      console.error("Errore copia allegato:", error);
      return null;
    }
  });

  ipcMain.handle('verifica-hash-allegato', async (event, fileName, expectedHash) => {
    try {
      if (!state.attachmentsDirPath || !fileName || !expectedHash) return { status: 'missing', path: '' };
      const safeFileName = path.basename(fileName);
      const destPath = path.join(state.attachmentsDirPath, safeFileName);
      if (!fs.existsSync(destPath)) {
        return { status: 'missing', path: state.attachmentsDirPath };
      }
      
      const fileBuffer = await fsp.readFile(destPath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const hash = hashSum.digest('hex');
      
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

  // `apri-pdf-esterno` rimosso (L4 in REVIEW-SECURITY.md): nessuno lo chiamava, e faceva
  // shell.openPath su un nome arrivato dal vault, cioè eseguiva un .hta/.lnk condiviso.

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
}

function setupAttachmentsProtocol() {
  protocol.handle('local-asset', (request) => {
    // path.basename elimina qualsiasi traversal relativo o assoluto: solo il nome file
    const safeFileName = path.basename(decodeURIComponent(request.url.slice('local-asset://'.length)));
    if (!safeFileName) {
      console.warn(`[SECURITY] Richiesta local-asset con path vuoto bloccata.`);
      return new Response('Access Denied', { status: 403 });
    }
    const resolvedPath = path.join(state.attachmentsDirPath, safeFileName);
    return net.fetch('file://' + resolvedPath);
  });
}

module.exports = { setupAttachmentsIpc, setupAttachmentsProtocol };
export {};
