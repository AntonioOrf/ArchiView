const { ipcMain, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { state } = require('../workspaceManager');

function setupAttachmentsIpc() {
  ipcMain.handle('salva-allegato', async (event, sourcePath) => {
    try {
      if (!state.attachmentsDirPath) throw new Error("Cartella allegati non definita");
      const ext = path.extname(sourcePath).toLowerCase();
      const fileName = `doc_${Date.now()}${ext}`;
      const destPath = path.join(state.attachmentsDirPath, fileName);
      
      await fsp.copyFile(sourcePath, destPath);
      return { fileName, ext }; 
    } catch (error) {
      console.error("Errore copia allegato:", error);
      return null;
    }
  });

  ipcMain.handle('apri-pdf-esterno', async (event, fileName) => {
    try {
      if (!state.attachmentsDirPath) return false;
      const p = path.join(state.attachmentsDirPath, fileName);
      if (fs.existsSync(p)) {
        await shell.openPath(p); 
        return true;
      }
    } catch (error) { 
      console.error("Errore apertura PDF:", error); 
    }
    return false;
  });

  ipcMain.handle('get-allegato-path', (event, fileName) => {
    if (!state.attachmentsDirPath) return '';
    return path.join(state.attachmentsDirPath, fileName);
  });
}

function setupAttachmentsProtocol() {
  protocol.handle('local-asset', (request) => {
    let filePath = request.url.slice('local-asset://'.length);
    filePath = decodeURIComponent(filePath);
    return net.fetch('file://' + path.join(state.attachmentsDirPath, filePath));
  });
}

module.exports = { setupAttachmentsIpc, setupAttachmentsProtocol };
