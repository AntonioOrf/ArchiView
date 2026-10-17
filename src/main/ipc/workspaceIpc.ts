import { ipcMain, dialog, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { state, initWorkspace, getAllSettings, saveAllSettings, aggiornaHubConfigDalRenderer, loadHubConfigPubblica, disconnectHub } from '../workspaceManager';
import { readVaultConfig, syncUnifiedFromLegacy } from '../vaultConfig';
import { safeChildDir } from './pathSafety';
import { scriviAtomicoSync } from '../scritturaAtomica';

function clonaWorkspace(basePath: string, folderName: string, hubConfig: any, database: any): boolean {
  try {
    let newPath: string;
    try {
      newPath = safeChildDir(basePath, folderName);
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
    
    if (hubConfig && hubConfig.hubUrl) {
        const { saveHubSecrets } = require('../cloudTokenStore');
        const { repoKey, encKey, ...publicCfg } = hubConfig;
        if (publicCfg.repoId && (repoKey || encKey)) saveHubSecrets(publicCfg.repoId, { repoKey, encKey }, newPath);
        const configPath = path.join(newPath, '.archiview-hub.json');
        scriviAtomicoSync(configPath, JSON.stringify(publicCfg, null, 2));
    }

    if (hubConfig && hubConfig.isSharedVault) {
        fs.writeFileSync(path.join(newPath, '.archiview-drive.json'), JSON.stringify({
            isSharedVault: true, isPersonalCloud: false,
            sharedVaultId: hubConfig.sharedVaultId || null,
            pusherKey: null, pusherCluster: null, pusherWebhook: null, driveAutofetch: false
        }, null, 2), 'utf8');
    }

    const { baseObjects, baseHashes, ...dbSenzaBase } = database || {};
    const dbPath = path.join(newPath, 'database_manoscritti.json');
    fs.writeFileSync(dbPath, JSON.stringify(dbSenzaBase, null, 2), 'utf8');

    const attPath = path.join(newPath, 'allegati_manoscritti');
    if (!fs.existsSync(attPath)) {
      fs.mkdirSync(attPath, { recursive: true });
    }

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
    return recents.map((folderPath: string) => {
      const cfg = readVaultConfig(folderPath, settings);
      return {
        path: folderPath,
        vaultType: cfg.vaultType,
        provider: cfg.provider,
        isShared: cfg.vaultType === 'shared',
        isPersonal: cfg.vaultType === 'backup'
      };
    });
  });

  ipcMain.handle('open-recent-workspace', (event, folderPath) => {
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

  ipcMain.handle('ricollega-archivio-recente', async (event, vecchioPercorso, titoloDialogo) => {
    try {
      const recenti: string[] = getAllSettings().recentWorkspaces || [];
      if (typeof vecchioPercorso !== 'string' || !recenti.includes(vecchioPercorso)) return { ok: false };
      const result = await dialog.showOpenDialog({
        title: typeof titoloDialogo === 'string' ? titoloDialogo : "Seleziona la cartella dell'archivio",
        properties: ['openDirectory']
      });
      if (result.canceled || result.filePaths.length === 0) return { ok: false, annullato: true };
      const nuovo = result.filePaths[0];
      if (!['database_manoscritti.json', '.archiview-vault.json'].some(f => fs.existsSync(path.join(nuovo, f)))) {
        return { ok: false, motivo: 'non-archivio' };
      }
      saveAllSettings({ recentWorkspaces: recenti.filter(p => p !== vecchioPercorso) });
      initWorkspace(nuovo);
      if (state.mainWindow) state.mainWindow.reload();
      return { ok: true };
    } catch (error) {
      console.error('Errore ricollegamento archivio recente:', error);
      return { ok: false, motivo: error.message };
    }
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
        const settings = getAllSettings();
        const recentWorkspaces = settings.recentWorkspaces || [];
        const isKnownWorkspace = (state.workspacePath && path.resolve(pathToRemove) === path.resolve(state.workspacePath)) || 
                                 recentWorkspaces.some((w: string) => path.resolve(w) === path.resolve(pathToRemove));
        
        if (!isKnownWorkspace) {
            console.warn(`[SECURITY] Tentativo di eliminazione bloccato per: ${pathToRemove}`);
            return { success: false, error: 'Access Denied: Path is not a recognized workspace' };
        }

        if (fs.existsSync(pathToRemove)) {
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
      const giaCompressi = /\.(jpe?g|png|gif|webp|avif|heic|jp2|tiff?|pdf|zip|gz|7z|mp3|mp4|m4a)$/i;
      const voce = (e: any) => (giaCompressi.test(e.name) ? { ...e, store: true } : e);
      archive.directory(state.workspacePath, false, voce);
      const att = state.attachmentsDirPath;
      const rel = att ? path.relative(state.workspacePath, att) : '';
      if (att && (rel.startsWith('..') || path.isAbsolute(rel)) && fs.existsSync(att)) {
        archive.directory(att, 'allegati_manoscritti', voce);
      }
      archive.finalize();
    });
  });

  ipcMain.handle('load-tutorial-workspace', async () => {
    try {
      const sourceDir = path.join(app.getAppPath(), 'assets', 'tutorial_workspace');
      const targetDir = path.join(app.getPath('userData'), 'Tutorial_Archive');

      const fallbackSource = path.join(__dirname, '..', '..', '..', 'assets', 'tutorial_workspace');
      const sorgente = fs.existsSync(sourceDir) ? sourceDir : fallbackSource;
      if (!fs.existsSync(sorgente)) return { success: false, error: 'Tutorial assets not found' };
      await copiaCartella(sorgente, targetDir);

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

async function copiaCartella(da: string, a: string): Promise<void> {
  await fs.promises.mkdir(a, { recursive: true });
  for (const voce of await fs.promises.readdir(da, { withFileTypes: true })) {
    const sorgente = path.join(da, voce.name);
    const destinazione = path.join(a, voce.name);
    if (voce.isDirectory()) await copiaCartella(sorgente, destinazione);
    else await fs.promises.writeFile(destinazione, await fs.promises.readFile(sorgente));
  }
}

export { setupWorkspaceIpc, clonaWorkspace };
