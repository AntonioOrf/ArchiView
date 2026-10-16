import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { state, getAllSettings, saveAllSettings, patchSettings, rimuoviImpostazioni } from '../workspaceManager';
import { applicaZoom } from '../zoomInterfaccia';
import { leggiPerfConfig, scriviPerfConfig } from '../perfConfig';

function setupSettingsIpc() {
  ipcMain.handle('get-settings', () => {
    return getAllSettings();
  });

  ipcMain.handle('patch-settings', (event, parziale) => {
    const esito = patchSettings(parziale);
    if (parziale && typeof parziale === 'object' && 'zoomInterfaccia' in parziale) applicaZoom();
    return esito;
  });

  ipcMain.handle('percorso-allegati-effettivo', () => state.attachmentsDirPath || null);

  ipcMain.handle('scegli-cartella-allegati', async (event, titolo) => {
    try {
      const finestra = BrowserWindow.fromWebContents(event.sender);
      const opzioni: import('electron').OpenDialogOptions = {
        title: typeof titolo === 'string' ? titolo.slice(0, 200) : undefined,
        properties: ['openDirectory', 'createDirectory']
      };
      const esito = finestra ? await dialog.showOpenDialog(finestra, opzioni) : await dialog.showOpenDialog(opzioni);
      if (esito.canceled || !esito.filePaths || !esito.filePaths[0]) return null;
      const scelta = path.resolve(esito.filePaths[0]);
      if (!fs.statSync(scelta).isDirectory()) return null;
      saveAllSettings({ customAttachmentsPath: scelta });
      return scelta;
    } catch (error) {
      console.error('Errore scelta cartella allegati:', error);
      return null;
    }
  });

  ipcMain.handle('ripristina-cartella-allegati', () => {
    try {
      rimuoviImpostazioni(['customAttachmentsPath']);
      return true;
    } catch (error) {
      console.error('Errore ripristino cartella allegati:', error);
      return false;
    }
  });

  ipcMain.handle('rimuovi-archivio-recente', (event, percorso) => {
    try {
      if (typeof percorso !== 'string') return false;
      const recenti = getAllSettings().recentWorkspaces || [];
      saveAllSettings({ recentWorkspaces: recenti.filter((p: string) => p !== percorso) });
      return true;
    } catch (error) {
      console.error('Errore rimozione archivio recente:', error);
      return false;
    }
  });

  ipcMain.handle('get-perf-mode', () => leggiPerfConfig());
  ipcMain.handle('set-perf-mode', (event, lowPerf) => scriviPerfConfig({ lowPerf }));
}

export { setupSettingsIpc };
