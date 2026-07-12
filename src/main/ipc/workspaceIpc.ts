const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { state, initWorkspace, getAllSettings, saveHubConfig, loadHubConfig, disconnectHub } = require('../workspaceManager');
const { readVaultConfig, syncUnifiedFromLegacy } = require('../vaultConfig');

function setupWorkspaceIpc() {
  ipcMain.handle('save-hub-config', (event, config) => {
    return saveHubConfig(config);
  });

  ipcMain.handle('load-hub-config', () => {
    return loadHubConfig();
  });

  ipcMain.handle('disconnect-hub', () => {
    return disconnectHub();
  });

  ipcMain.handle('apri-cartella-workspace', async () => {
    const { shell } = require('electron');
    if (state.workspacePath) {
      await shell.openPath(state.workspacePath);
      return true;
    }
    return false;
  });

  ipcMain.handle('get-workspace-path', () => {
    return state.workspacePath;
  });

  ipcMain.handle('get-recent-workspaces', () => {
    const settings = getAllSettings();
    const recents = settings.recentWorkspaces || [];
    // Fonte di verità unica: .archiview-vault.json (con fallback derivato dai legacy)
    return recents.map((folderPath: string) => {
      const cfg = readVaultConfig(folderPath, settings);
      return {
        path: folderPath,
        vaultType: cfg.vaultType,
        provider: cfg.provider,
        // Campi derivati per retrocompatibilità con il renderer (sidebar)
        isShared: cfg.vaultType === 'shared',
        isPersonal: cfg.vaultType === 'backup'
      };
    });
  });

  ipcMain.handle('open-recent-workspace', (event, folderPath) => {
    if (fs.existsSync(folderPath)) {
      initWorkspace(folderPath);
      if (state.mainWindow) {
          state.mainWindow.reload();
      }
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
      if (state.mainWindow) {
          state.mainWindow.reload();
      }
      return true;
    }
    return false;
  });

  ipcMain.handle('get-documents-path', () => {
    return app.getPath('documents');
  });

  ipcMain.handle('select-base-directory', async (event, titleDialog) => {
    const result = await dialog.showOpenDialog({
      title: titleDialog || "Seleziona la posizione per la nuova cartella",
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('create-workspace-in-path', async (event, basePath, folderName, config) => {
    const resolvedBase = path.resolve(basePath);
    const newPath = path.resolve(path.join(resolvedBase, folderName));
    if (!newPath.startsWith(resolvedBase + path.sep)) {
      console.error("[SECURITY] Path traversal attempt in create-workspace-in-path blocked.");
      return false;
    }
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
    }
    initWorkspace(newPath);
    if (config) {
      const { saveAllSettings } = require('../workspaceManager');
      saveAllSettings(config);
    }
    if (state.mainWindow) {
        state.mainWindow.reload();
    }
    return true;
  });

  ipcMain.handle('delete-vault-local', async (event, pathToRemove) => {
    try {
        // Sicurezza: Controlliamo che il percorso appartenga alla lista di workspace recenti o a quello attuale
        const settings = getAllSettings();
        const recentWorkspaces = settings.recentWorkspaces || [];
        const isKnownWorkspace = (state.workspacePath && path.resolve(pathToRemove) === path.resolve(state.workspacePath)) || 
                                 recentWorkspaces.some((w: string) => path.resolve(w) === path.resolve(pathToRemove));
        
        if (!isKnownWorkspace) {
            console.warn(`[SECURITY] Tentativo di eliminazione bloccato per: ${pathToRemove}`);
            return { success: false, error: 'Access Denied: Path is not a recognized workspace' };
        }

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
      const resolvedBase = path.resolve(basePath);
      const newPath = path.resolve(path.join(resolvedBase, folderName));
      if (!newPath.startsWith(resolvedBase + path.sep)) {
          console.error("[SECURITY] Path traversal attempt in clone-workspace-hub blocked.");
          return false;
      }
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true });
      }
      
      // Scrivi config dell'Hub (se presente e valido). I segreti (repoKey/encKey) vanno
      // in cloudTokenStore (DPAPI), MAI in chiaro nel file di vault potenzialmente sincronizzato.
      if (hubConfig && hubConfig.hubUrl) {
          const { saveHubSecrets } = require('../cloudTokenStore');
          const { repoKey, encKey, ...publicCfg } = hubConfig;
          // Salva i segreti sotto lo scope del NUOVO workspace (state.workspacePath punta ancora
          // a quello corrente: senza override finirebbero nello slot sbagliato e il clone
          // non li ritroverebbe al riavvio).
          if (publicCfg.repoId && (repoKey || encKey)) saveHubSecrets(publicCfg.repoId, { repoKey, encKey }, newPath);
          const configPath = path.join(newPath, '.archiview-hub.json');
          fs.writeFileSync(configPath, JSON.stringify(publicCfg, null, 2), 'utf8');
          // Realtime: deriveFromLegacy legge i campi Pusher da .archiview-drive.json.
          if (publicCfg.pusherKey) {
            fs.writeFileSync(path.join(newPath, '.archiview-drive.json'), JSON.stringify({
              pusherKey: publicCfg.pusherKey,
              pusherCluster: publicCfg.pusherCluster || '',
              pusherWebhook: publicCfg.pusherWebhook || (publicCfg.hubUrl ? `${publicCfg.hubUrl}/api/ping` : '')
            }, null, 2), 'utf8');
          }
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

      // Genera subito il modello unificato dai legacy appena scritti
      syncUnifiedFromLegacy(newPath, getAllSettings());

      initWorkspace(newPath);
      if (state.mainWindow) {
          state.mainWindow.reload();
      }
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

  ipcMain.handle('load-tutorial-workspace', async () => {
    try {
      const sourceDir = path.join(app.getAppPath(), 'assets', 'tutorial_workspace');
      const targetDir = path.join(app.getPath('userData'), 'Tutorial_Archive');

      // Crea cartella di destinazione se non esiste
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Funzione di copia ricorsiva
      const copyRecursiveSync = function(src, dest) {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();
        if (isDirectory) {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
          fs.readdirSync(src).forEach(function(childItemName) {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
          });
        } else {
          fs.copyFileSync(src, dest);
        }
      };

      if (fs.existsSync(sourceDir)) {
        copyRecursiveSync(sourceDir, targetDir);
      } else {
          // Fallback manuale nel caso gli asset non siano trovati (es. in dev mode)
          const fallbackSource = path.join(__dirname, '..', '..', '..', 'assets', 'tutorial_workspace');
          if (fs.existsSync(fallbackSource)) {
             copyRecursiveSync(fallbackSource, targetDir);
          } else {
             return { success: false, error: 'Tutorial assets not found' };
          }
      }

      initWorkspace(targetDir);
      if (state.mainWindow) {
          state.mainWindow.reload();
      }
      return { success: true };
    } catch (e) {
      console.error("Errore nel caricamento del tutorial workspace:", e);
      return { success: false, error: e.message };
    }
  });
}

module.exports = { setupWorkspaceIpc };
export {};
