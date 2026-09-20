// IPC dell'import IIIF.
//
// Sottile per scelta, come `ocrIpc.ts`: qui c'è solo l'inoltro dell'avanzamento alla
// finestra, perché il canale verso il renderer è del main e non deve entrare nei moduli che
// fanno il lavoro. Interpretazione del manifest e interfaccia stanno altrove.

const { ipcMain } = require('electron');
const { state } = require('../workspaceManager');
const { leggiManifest } = require('../iiif/fetchManifest');
const { materializza, annulla, occupato } = require('../iiif/materialize');

function inviaProgresso(dati: any) {
  const w = state.mainWindow;
  if (w && !w.isDestroyed() && w.webContents && !w.webContents.isDestroyed()) {
    w.webContents.send('iiif-progress', dati);
  }
}

function setupIiifIpc() {
  ipcMain.handle('iiif-leggi-manifest', async (event: any, url: string) => {
    try {
      return await leggiManifest(url);
    } catch (errore: any) {
      console.error('[IIIF] Lettura manifest fallita:', errore);
      return { ok: false, codice: 'rete', errore: errore && errore.message };
    }
  });

  ipcMain.handle('iiif-materializza', async (event: any, richieste: any[]) => {
    try {
      return await materializza(richieste, inviaProgresso);
    } catch (errore: any) {
      console.error('[IIIF] Materializzazione fallita:', errore);
      return { ok: false, codice: 'errore', errore: errore && errore.message };
    }
  });

  ipcMain.handle('iiif-annulla', () => {
    annulla();
    return { ok: true };
  });

  ipcMain.handle('iiif-stato', () => ({ ok: true, occupato: occupato() }));
}

module.exports = { setupIiifIpc };
export {};
