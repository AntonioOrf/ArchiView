const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { state, initWorkspace } = require('../workspaceManager');

function setupWorkspaceIpc() {
  ipcMain.handle('get-workspace-path', () => {
    return state.workspacePath;
  });

  ipcMain.handle('change-workspace', async (event) => {
    const result = await dialog.showOpenDialog({
      title: "Seleziona la nuova cartella di lavoro",
      properties: ['openDirectory', 'createDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const newPath = result.filePaths[0];
      initWorkspace(newPath);
      app.relaunch();
      app.quit();
      return true;
    }
    return false;
  });

  ipcMain.handle('export-workspace-zip', async (event) => {
    const result = await dialog.showSaveDialog({
      title: 'Esporta Backup in ZIP',
      defaultPath: path.join(app.getPath('downloads'), `Backup_Archivio_${Date.now()}.zip`),
      filters: [{ name: 'File ZIP', extensions: ['zip'] }]
    });
    
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    
    const destPath = result.filePath;
    const archiverModule = await import('archiver');
    return new Promise((resolve) => {
      const output = fs.createWriteStream(destPath);
      const archive = new archiverModule.ZipArchive({ zlib: { level: 9 } });

      output.on('close', function() {
        resolve({ success: true, path: destPath });
      });
      
      archive.on('error', function(err) {
        resolve({ success: false, error: err.message });
      });

      archive.on('progress', (progress) => {
        if (state.mainWindow) {
          state.mainWindow.webContents.send('export-progress', progress);
        }
      });

      archive.pipe(output);
      archive.directory(state.workspacePath, false);
      archive.finalize();
    });
  });
}

module.exports = { setupWorkspaceIpc };
