// IPC dell'OCR (Fase 2.3).
//
// Sottile per scelta: dialoghi e stato stanno nel renderer, il lavoro in `src/main/ocr/`.
// L'unica cosa che vive qui è l'inoltro dell'avanzamento alla finestra, perché il canale
// verso il renderer è del main e non deve entrare nei moduli di calcolo.

const { ipcMain } = require('electron');
const { state } = require('../workspaceManager');
const { listaLingue, installaLingua, rimuoviLingua } = require('../ocr/ocrLangs');
const { eseguiOcr, annulla, occupato } = require('../ocr/ocrService');

function inviaProgresso(dati) {
  const w = state.mainWindow;
  if (w && !w.isDestroyed() && w.webContents && !w.webContents.isDestroyed()) {
    w.webContents.send('ocr-progress', dati);
  }
}

function setupOcrIpc() {
  ipcMain.handle('ocr-lingue', () => {
    try {
      return { ok: true, lingue: listaLingue() };
    } catch (errore) {
      console.error('[OCR] Elenco lingue fallito:', errore);
      return { ok: false, lingue: [], errore: errore.message };
    }
  });

  ipcMain.handle('ocr-installa-lingua', async (event, codice) => {
    try {
      return await installaLingua(codice);
    } catch (errore) {
      console.error('[OCR] Installazione lingua fallita:', errore);
      return { ok: false, errore: errore.message };
    }
  });

  ipcMain.handle('ocr-rimuovi-lingua', async (event, codice) => {
    try {
      return await rimuoviLingua(codice);
    } catch (errore) {
      console.error('[OCR] Rimozione lingua fallita:', errore);
      return { ok: false, errore: errore.message };
    }
  });

  ipcMain.handle('ocr-esegui', async (event, opzioni) => {
    try {
      return await eseguiOcr(opzioni, inviaProgresso);
    } catch (errore) {
      console.error('[OCR] Esecuzione fallita:', errore);
      return { ok: false, codice: errore && errore.codice ? errore.codice : 'errore', errore: errore && errore.message };
    }
  });

  ipcMain.handle('ocr-annulla', () => {
    annulla();
    return { ok: true };
  });

  ipcMain.handle('ocr-stato', () => ({ ok: true, occupato: occupato() }));
}

module.exports = { setupOcrIpc };
export {};
