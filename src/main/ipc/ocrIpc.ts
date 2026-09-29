// IPC dell'OCR (Fase 2.3).
//
// Sottile per scelta: dialoghi e stato stanno nel renderer, il lavoro in `src/main/ocr/`.
// L'unica cosa che vive qui è l'inoltro dell'avanzamento alla finestra, perché il canale
// verso il renderer è del main e non deve entrare nei moduli di calcolo.

const { ipcMain, dialog } = require('electron');
const { state } = require('../workspaceManager');
const { listaLingue, installaLingua, rimuoviLingua } = require('../ocr/ocrLangs');
const { eseguiOcr, annulla, occupato } = require('../ocr/ocrService');
const pdfRicercabile = require('../ocr/pdfRicercabile');
const { nomeFileSicuro } = require('./recordSelection');

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

  // PDF ricercabile: il renderer propone solo un nome, la destinazione la sceglie il dialogo
  // qui e resta nel main. Un canale che accettasse un percorso dal renderer sarebbe una
  // scrittura arbitraria su disco a portata di qualunque XSS.
  ipcMain.handle('ocr-pdf-inizia', async (event, nomeSuggerito, titolo) => {
    try {
      if (occupato()) return { ok: false, codice: 'occupato' };
      // Una sessione rimasta aperta (renderer ricaricato a metà) si scarta, non si riprende.
      if (pdfRicercabile.attiva()) await pdfRicercabile.concludi(true);
      const base = nomeFileSicuro(String(nomeSuggerito || '').replace(/\.pdf$/i, ''), 'OCR');
      const scelta = await dialog.showSaveDialog(state.mainWindow, {
        title: String(titolo || 'PDF'),
        defaultPath: `${base}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (scelta.canceled || !scelta.filePath) return { ok: false, canceled: true };
      await pdfRicercabile.apri(scelta.filePath);
      return { ok: true };
    } catch (errore) {
      console.error('[OCR] Avvio PDF ricercabile fallito:', errore);
      return { ok: false, errore: errore.message };
    }
  });

  ipcMain.handle('ocr-pdf-concludi', async (event, scarta) => {
    try {
      return await pdfRicercabile.concludi(!!scarta);
    } catch (errore) {
      console.error('[OCR] Scrittura PDF ricercabile fallita:', errore);
      return { ok: false, errore: errore.message };
    }
  });
}

module.exports = { setupOcrIpc };
export {};
