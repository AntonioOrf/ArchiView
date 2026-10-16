import { ipcMain, dialog } from 'electron';
import { state } from '../workspaceManager';
import { listaLingue, installaLingua, rimuoviLingua } from '../ocr/ocrLangs';
import { eseguiOcr, annulla, occupato } from '../ocr/ocrService';
import * as pdfRicercabile from '../ocr/pdfRicercabile';
import { nomeFileSicuro } from './recordSelection';

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

  ipcMain.handle('ocr-pdf-inizia', async (event, nomeSuggerito, titolo) => {
    try {
      if (occupato()) return { ok: false, codice: 'occupato' };
      if (pdfRicercabile.attiva()) await pdfRicercabile.concludi(true);
      const base = nomeFileSicuro(String(nomeSuggerito || '').replace(/\.pdf$/i, ''), 'OCR');
      const opzioni = {
        title: String(titolo || 'PDF'),
        defaultPath: `${base}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      };
      const scelta = state.mainWindow
        ? await dialog.showSaveDialog(state.mainWindow, opzioni)
        : await dialog.showSaveDialog(opzioni);
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

export { setupOcrIpc };
