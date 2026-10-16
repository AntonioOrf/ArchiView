import { ipcMain, dialog, shell } from 'electron';
import * as fs from 'fs';
import { leggiDb, recordsRichiesti, nomeFileSicuro } from './recordSelection';
import { generaEsportazioneTrascrizione } from '../export/transcriptExport';
import { generaCitazioni } from '../export/citations';

const FILTRI: { [k: string]: { name: string; extensions: string[] } } = {
  html: { name: 'HTML', extensions: ['html'] },
  md: { name: 'Markdown', extensions: ['md'] },
  rtf: { name: 'RTF (Word, LibreOffice)', extensions: ['rtf'] },
  bib: { name: 'BibTeX', extensions: ['bib'] },
  ris: { name: 'RIS (Zotero, EndNote)', extensions: ['ris'] }
};

async function esporta(ids: any[], opt: any, genera: (r: any[]) => { contenuto: string; estensione: string }) {
  const db = await leggiDb();
  if (!db) return { success: false, error: 'Database non trovato' };
  const records = recordsRichiesti(db, ids);
  if (records.length === 0) return { success: false, error: 'Nessun record trovato per l\'esportazione' };

  const { contenuto, estensione } = genera(records);
  const base = records.length === 1
    ? (records[0].segnatura || 'Scheda')
    : (opt.fondo || 'Schedatura');

  const scelta = await dialog.showSaveDialog({
    title: opt.titolo || 'Esporta',
    defaultPath: `${nomeFileSicuro(base, 'Schedatura')}.${estensione}`,
    filters: [FILTRI[estensione] || { name: estensione.toUpperCase(), extensions: [estensione] }]
  });
  if (scelta.canceled || !scelta.filePath) return { success: false, canceled: true };

  await fs.promises.writeFile(scelta.filePath, contenuto, 'utf8');
  if (opt.apri) shell.openPath(scelta.filePath).catch(() => {});
  return { success: true, count: records.length, path: scelta.filePath };
}

function setupTextExportIpc() {
  ipcMain.handle('export-transcript', async (_event: any, ids: any[], opzioni: any) => {
    const opt = opzioni || {};
    try {
      return await esporta(ids, opt, (records) => generaEsportazioneTrascrizione(records, {
        formato: opt.formato,
        etichette: opt.etichette || {},
        nomiTipi: opt.nomiTipi || {},
        intestazione: opt.intestazione !== false,
        intestazioneDocumento: opt.intestazioneDocumento || {},
        testi: opt.testi || {}
      }));
    } catch (errore: any) {
      console.error('[Export] Trascrizione non esportata:', errore);
      return { success: false, error: errore && errore.message ? errore.message : String(errore) };
    }
  });

  ipcMain.handle('export-citations', async (_event: any, ids: any[], opzioni: any) => {
    const opt = opzioni || {};
    try {
      return await esporta(ids, opt, (records) => generaCitazioni(records, {
        formato: opt.formato,
        fondo: opt.fondo || '',
        nomiTipi: opt.nomiTipi || {},
        testi: opt.testi || {}
      }));
    } catch (errore: any) {
      console.error('[Export] Citazioni non esportate:', errore);
      return { success: false, error: errore && errore.message ? errore.message : String(errore) };
    }
  });
}

export { setupTextExportIpc };
