const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { state, initWorkspace, getAllSettings, aggiornaHubConfigDalRenderer, loadHubConfigPubblica, disconnectHub } = require('../workspaceManager');
const { readVaultConfig, syncUnifiedFromLegacy } = require('../vaultConfig');
const { safeChildDir } = require('./pathSafety');

/**
 * Crea un nuovo workspace in basePath/folderName con il database dato e lo apre.
 * `hubConfig` completo di segreti arriva solo dal main (join Hub in hubIpc); dal renderer passa
 * solo la variante Drive ({ isSharedVault, sharedVaultId }).
 */
function clonaWorkspace(basePath: string, folderName: string, hubConfig: any, database: any): boolean {
  try {
    let newPath: string;
    try {
      // folderName è digitato o viene dall'invito: un nome con separatori è rifiutato, non riscritto.
      newPath = safeChildDir(basePath, folderName);
      // Una cartella che contiene già un archivio non si sovrascrive: si prende "Nome (2)", "Nome (3)"…
      for (let n = 2; fs.existsSync(path.join(newPath, 'database_manoscritti.json')); n++) {
        newPath = safeChildDir(basePath, `${folderName} (${n})`);
      }
    } catch (e: any) {
      console.error("[SECURITY] clone workspace bloccato:", e.message);
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
        // Le chiavi Pusher restano in .archiview-hub.json: è da lì che le legge il realtime Hub.
        fs.writeFileSync(configPath, JSON.stringify(publicCfg, null, 2), 'utf8');
    }

    // Se hubConfig contiene dati Drive (è stato "abusato" per passare impostazioni Drive)
    if (hubConfig && hubConfig.isSharedVault) {
        const settingsPath = path.join(newPath, 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify({
            isSharedVault: hubConfig.isSharedVault,
            sharedVaultId: hubConfig.sharedVaultId
        }, null, 2), 'utf8');
    }

    // Scrivi database JSON, senza la base del merge di chi l'ha caricato (DB di versioni vecchie).
    const { baseObjects, baseHashes, ...dbSenzaBase } = database || {};
    const dbPath = path.join(newPath, 'database_manoscritti.json');
    fs.writeFileSync(dbPath, JSON.stringify(dbSenzaBase, null, 2), 'utf8');

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
}

function setupWorkspaceIpc() {
  ipcMain.handle('save-hub-config', (event, config) => {
    return aggiornaHubConfigDalRenderer(config);
  });

  ipcMain.handle('load-hub-config', () => {
    return loadHubConfigPubblica();
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
    // Solo un archivio già fra i recenti (N2): un percorso qualsiasi dal renderer diventerebbe
    // un recente, e delete-vault-local cestina i recenti.
    const recenti: string[] = getAllSettings().recentWorkspaces || [];
    if (typeof folderPath !== 'string' || !recenti.some(w => path.resolve(w) === path.resolve(folderPath))) return false;
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
    let newPath: string;
    try {
      newPath = safeChildDir(basePath, folderName);
    } catch (e: any) {
      console.error("[SECURITY] create-workspace-in-path bloccato:", e.message);
      return false;
    }
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
    }
    initWorkspace(newPath);
    if (config) {
      // Dal renderer passano solo preferenze (i flag autoStart*), non percorsi né chiavi del vault (N2).
      const { saveAllSettings } = require('../workspaceManager');
      const { filtraImpostazioniRenderer } = require('../impostazioniRenderer');
      saveAllSettings(filtraImpostazioniRenderer(config));
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
            // Conferma nel main con il percorso per esteso: la finestra del renderer non basta
            // se il renderer è compromesso.
            const { response } = await dialog.showMessageBox({
                type: 'warning',
                title: 'Elimina archivio',
                message: `Spostare nel cestino la cartella dell'archivio?\n\n${path.resolve(pathToRemove)}`,
                buttons: ['Sposta nel cestino', 'Annulla'],
                defaultId: 1,
                cancelId: 1
            });
            if (response !== 0) return { success: false, canceled: true };
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

  // Dal renderer solo il ripristino Drive: la config Hub con i segreti la scrive hub-join nel main,
  // altrimenti il renderer potrebbe legare un vault a un Hub arbitrario.
  ipcMain.handle('clone-workspace-hub', async (event, basePath, folderName, driveConfig, database) => {
    if (driveConfig && (driveConfig.hubUrl || driveConfig.repoKey || driveConfig.encKey)) {
      console.error("[SECURITY] clone-workspace-hub: config Hub dal renderer rifiutata.");
      return false;
    }
    const cfg = driveConfig && driveConfig.isSharedVault
      ? { isSharedVault: true, sharedVaultId: String(driveConfig.sharedVaultId || '') }
      : null;
    return clonaWorkspace(basePath, folderName, cfg, database);
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
      // Destinazione non scrivibile o bloccata (EBUSY): senza listener è un'eccezione nel main.
      output.on('error', function(err) {
        archive.abort();
        resolve({ success: false, error: err.message });
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

      // Fallback nel caso gli asset non siano trovati (es. in dev mode)
      const fallbackSource = path.join(__dirname, '..', '..', '..', 'assets', 'tutorial_workspace');
      const sorgente = fs.existsSync(sourceDir) ? sourceDir : fallbackSource;
      if (!fs.existsSync(sorgente)) return { success: false, error: 'Tutorial assets not found' };
      // Asincrona: la copia ricorsiva sincrona bloccava il main per tutta la durata.
      await fs.promises.cp(sorgente, targetDir, { recursive: true });

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

module.exports = { setupWorkspaceIpc, clonaWorkspace };
export {};
