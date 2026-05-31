const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { state, initWorkspace, getAllSettings, saveHubConfig, loadHubConfig } = require('../workspaceManager');

function setupWorkspaceIpc() {
  ipcMain.handle('save-hub-config', (event, config) => {
    return saveHubConfig(config);
  });

  ipcMain.handle('load-hub-config', () => {
    return loadHubConfig();
  });

  ipcMain.handle('get-workspace-path', () => {
    return state.workspacePath;
  });

  ipcMain.handle('get-recent-workspaces', () => {
    const settings = getAllSettings();
    const recents = settings.recentWorkspaces || [];
    return recents.map((folderPath: string) => {
      let isShared = false;
      try {
        const vaultSettingsPath = path.join(folderPath, 'settings.json');
        if (fs.existsSync(vaultSettingsPath)) {
          const vaultSettings = JSON.parse(fs.readFileSync(vaultSettingsPath, 'utf8'));
          isShared = !!vaultSettings.isSharedVault;
        }
      } catch (e) {}
      return { path: folderPath, isShared };
    });
  });

  ipcMain.handle('open-recent-workspace', (event, folderPath) => {
    if (fs.existsSync(folderPath)) {
      initWorkspace(folderPath);
      app.relaunch();
      app.quit();
      return true;
    }
    return false;
  });

  ipcMain.handle('change-workspace', async (event, titleDialog) => {
    const result = await dialog.showOpenDialog({
      title: titleDialog || "Seleziona la nuova cartella di lavoro",
      properties: ['openDirectory', 'createDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const newPath = result.filePaths[0];
      
      if (state.workspacePath && path.resolve(newPath) === path.resolve(state.workspacePath)) {
          dialog.showMessageBoxSync({
              type: 'warning',
              title: 'Attenzione',
              message: 'Hai selezionato la cartella in cui ti trovi attualmente.',
              buttons: ['OK']
          });
          return false;
      }
      
      initWorkspace(newPath);
      app.relaunch();
      app.quit();
      return true;
    }
    return false;
  });

  ipcMain.handle('get-documents-path', () => {
    return app.getPath('documents');
  });

  ipcMain.handle('select-base-directory', async () => {
    const result = await dialog.showOpenDialog({
      title: "Seleziona la posizione per la nuova cartella",
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('create-workspace-in-path', async (event, basePath, folderName, config) => {
    const newPath = path.join(basePath, folderName);
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
    }
    if (config) {
      const settingsPath = path.join(newPath, 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2), 'utf8');
    }
    initWorkspace(newPath);
    app.relaunch();
    app.quit();
    return true;
  });

  ipcMain.handle('delete-vault-local', async (event, pathToRemove) => {
    try {
        if (fs.existsSync(pathToRemove)) {
            const { shell } = require('electron');
            await shell.trashItem(pathToRemove);
            return { success: true };
        }
        return { success: false, error: 'Path not found' };
    } catch(e) {
        console.error("Errore cancellazione vault:", e);
        return { success: false, error: e.message };
    }
  });

  ipcMain.handle('clone-workspace-hub', async (event, basePath, folderName, hubConfig, database) => {
    try {
      const newPath = path.join(basePath, folderName);
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true });
      }
      
      // Scrivi config dell'Hub (se presente e valido)
      if (hubConfig && hubConfig.hubUrl) {
          const configPath = path.join(newPath, '.archiview-hub.json');
          fs.writeFileSync(configPath, JSON.stringify(hubConfig, null, 2), 'utf8');
      }

      // Se hubConfig contiene dati Drive (è stato "abusato" per passare impostazioni Drive)
      if (hubConfig && hubConfig.isSharedVault) {
          const settingsPath = path.join(newPath, 'settings.json');
          fs.writeFileSync(settingsPath, JSON.stringify({
              isSharedVault: hubConfig.isSharedVault,
              sharedVaultId: hubConfig.sharedVaultId
          }, null, 2), 'utf8');
      }

      // Scrivi database JSON
      const dbPath = path.join(newPath, 'database_manoscritti.json');
      fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), 'utf8');

      // Crea cartella allegati vuota
      const attPath = path.join(newPath, 'allegati_manoscritti');
      if (!fs.existsSync(attPath)) {
        fs.mkdirSync(attPath, { recursive: true });
      }

      initWorkspace(newPath);
      app.relaunch();
      app.quit();
      return true;
    } catch (e) {
      console.error("Errore clonazione workspace Hub:", e);
      return false;
    }
  });

  ipcMain.handle('export-workspace-zip', async (event, titleDialog) => {
    const result = await dialog.showSaveDialog({
      title: titleDialog || 'Esporta Backup in ZIP',
      defaultPath: path.join(app.getPath('downloads'), `Backup_Archivio_${Date.now()}.zip`),
      filters: [{ name: 'File ZIP', extensions: ['zip'] }]
    });
    
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    
    const destPath = result.filePath;
    const archiverModule = await import('archiver');
    return new Promise((resolve) => {
      const output = fs.createWriteStream(destPath);
      // @ts-ignore
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
export {};
