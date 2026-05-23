const { ipcMain, app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { state } = require('../workspaceManager');

function setupUpdaterIpc() {
  autoUpdater.autoDownload = false; // L'utente deciderà quando scaricare

  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result && result.updateInfo) {
        const isNewer = result.updateInfo.version !== app.getVersion();
        return { 
          updateAvailable: isNewer, 
          latestVersion: result.updateInfo.version, 
          currentVersion: app.getVersion()
        };
      }
      return { updateAvailable: false, currentVersion: app.getVersion() };
    } catch (error) {
      return { error: error.message || "Errore sconosciuto nel controllo aggiornamenti." };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (state.mainWindow) {
      state.mainWindow.webContents.send('update-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (state.mainWindow) {
      state.mainWindow.webContents.send('update-downloaded');
    }
  });
}

module.exports = { setupUpdaterIpc };
