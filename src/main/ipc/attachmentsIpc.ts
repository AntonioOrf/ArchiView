const { ipcMain, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { state } = require('../workspaceManager');
const crypto = require('crypto');

function setupAttachmentsIpc() {
  ipcMain.handle('salva-allegato', async (event, sourcePath, documentoId) => {
    try {
      if (!state.attachmentsDirPath) throw new Error("Cartella allegati non definita");
      const ext = path.extname(sourcePath).toLowerCase();
      
      const cleanOriginalName = path.basename(sourcePath, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50);
        
      const prefix = documentoId ? `${documentoId}_` : `doc_${Date.now()}_`;
      const fileName = `${prefix}${cleanOriginalName}${ext}`;
      const destPath = path.join(state.attachmentsDirPath, fileName);
      
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

  ipcMain.handle('apri-pdf-esterno', async (event, fileName) => {
    try {
      if (!state.attachmentsDirPath) return false;
      const safeFileName = path.basename(fileName);
      const p = path.join(state.attachmentsDirPath, safeFileName);
      if (fs.existsSync(p)) {
        await shell.openPath(p); 
        return true;
      }
    } catch (error) { 
      console.error("Errore apertura PDF:", error); 
    }
    return false;
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
