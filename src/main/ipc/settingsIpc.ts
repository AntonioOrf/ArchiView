import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { state, getAllSettings, saveAllSettings, patchSettings, rimuoviImpostazioni } from '../workspaceManager';
import { applicaZoom } from '../zoomInterfaccia';
import { leggiPerfConfig, scriviPerfConfig } from '../perfConfig';

function setupSettingsIpc() {
  // get-settings ritorna SOLO le preferenze globali. I flag del vault
  // (tipo/sharedVaultId/pusher*/driveAutofetch) si leggono via get-vault-config (vaultIpc).
  ipcMain.handle('get-settings', () => {
    return getAllSettings();
  });

  // Solo le chiavi che cambiano, solo preferenze: percorsi e chiavi del vault li scrive il
  // main, dai canali qui sotto o dai flussi di apertura/join. `null` riporta al predefinito.
  // Un errore di scrittura arriva al renderer come rifiuto dell'invoke.
  ipcMain.handle('patch-settings', (event, parziale) => {
    const esito = patchSettings(parziale);
    if (parziale && typeof parziale === 'object' && 'zoomInterfaccia' in parziale) applicaZoom();
    return esito;
  });

  // Cartella allegati in uso (personalizzata o predefinita), come la usa il main: il
  // renderer la mostra e non la compone.
  ipcMain.handle('percorso-allegati-effettivo', () => state.attachmentsDirPath || null);

  // Cartella allegati personalizzata: la sceglie l'utente in un dialogo del main, mai un
  // percorso passato dal renderer (che farebbe servire a local-asset una cartella qualsiasi).
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

  // Solo rimozione: aggiungere un archivio ai recenti vuol dire aprirlo (initWorkspace).
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

  // Preferenza globale (file in userData): vale per tutti i workspace ed è letta
  // all'avvio del main, prima che esista una finestra.
  ipcMain.handle('get-perf-mode', () => leggiPerfConfig());
  ipcMain.handle('set-perf-mode', (event, lowPerf) => scriviPerfConfig({ lowPerf }));
}

export { setupSettingsIpc };
