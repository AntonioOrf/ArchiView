// IPC degli export testuali: trascrizione (Fase 2.5) e citazioni (Fase 2.6).
//
// Sottile come quello della stampa: legge il DB DAL DISCO (`recordSelection`), chiede la
// stringa al modulo puro e la scrive dove dice il dialog nativo. Nessuna decisione di
// formato vive qui — è l'unico modo perché quelle decisioni restino testabili senza avviare
// Electron.

const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const { leggiDb, recordsRichiesti, nomeFileSicuro } = require('./recordSelection');
const { generaEsportazioneTrascrizione } = require('../export/transcriptExport');
const { generaCitazioni } = require('../export/citations');

// Etichetta e filtro del dialog per estensione. Il nome del formato NON arriva tradotto dal
// renderer perché è un'estensione di file, non una frase: "BibTeX" è "BibTeX" ovunque.
const FILTRI: { [k: string]: { name: string; extensions: string[] } } = {
  html: { name: 'HTML', extensions: ['html'] },
  md: { name: 'Markdown', extensions: ['md'] },
  rtf: { name: 'RTF (Word, LibreOffice)', extensions: ['rtf'] },
  bib: { name: 'BibTeX', extensions: ['bib'] },
  ris: { name: 'RIS (Zotero, EndNote)', extensions: ['ris'] }
};

/**
 * Tronco comune ai due handler: risolvi gli id, genera, salva, apri.
 *
 * @param genera (records) => { contenuto, estensione }
 */
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

  // UTF-8 senza BOM: a differenza del CSV (2.1) qui non c'è Excel da assecondare, e un BOM
  // in testa a un .bib fa fallire il parser di BibTeX sulla prima voce.
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

module.exports = { setupTextExportIpc };
export {};
