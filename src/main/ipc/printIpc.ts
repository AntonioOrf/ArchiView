// IPC della stampa (Fase 2.2).
//
// Sottile come quello dell'OCR: legge il database dal disco (come `export-csv`, cosi' che
// cio' che si stampa sia cio' che e' stato salvato), chiede il documento al template puro e
// lo passa a `printHost`. Nessuna decisione di layout vive qui.

const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const { state } = require('../workspaceManager');
const { leggiDb, recordsRichiesti, nomeFileSicuro } = require('./recordSelection');
const { generaHtmlStampa } = require('../print/printTemplate');
const printHost = require('../print/printHost');

/** Documento pronto per la finestra: template puro + miniature lette da disco. */
async function componiDocumento(ids, opzioni) {
  const db = await leggiDb();
  if (!db) return { errore: 'Database non trovato' };
  const records = recordsRichiesti(db, ids);
  if (records.length === 0) return { errore: 'Nessuna scheda da stampare' };

  // Le miniature costano I/O e rasterizzazione: si preparano SOLO per il layout che le
  // mostra. Un inventario di trecento schede non deve pagare trecento letture di file.
  const miniature = opzioni.layout === 'scheda' && opzioni.miniature !== false
    ? await printHost.preparaMiniature(records, { pdf: opzioni.miniaturePdf !== false })
    : {};

  const html = generaHtmlStampa(records, db.tipiDocumento || [], {
    layout: opzioni.layout,
    etichette: opzioni.etichette || {},
    nomiTipi: opzioni.nomiTipi || {},
    colonne: opzioni.colonne || [],
    intestazione: opzioni.intestazione || {},
    frontespizio: !!opzioni.frontespizio,
    includiTrascrizione: !!opzioni.includiTrascrizione,
    includiVuoti: !!opzioni.includiVuoti,
    orientamento: opzioni.orientamento,
    testi: opzioni.testi || {},
    miniature
  });
  return { html, records };
}

function setupPrintIpc() {
  ipcMain.handle('print-pdf', async (event, ids, opzioni) => {
    if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
    const opt = opzioni || {};
    try {
      const doc = await componiDocumento(ids, opt);
      if (doc.errore) return { success: false, error: doc.errore };

      const base = doc.records.length === 1
        ? (doc.records[0].segnatura || 'Scheda')
        : ((opt.intestazione && opt.intestazione.fondo) || 'Schedatura');
      const safeBase = nomeFileSicuro(base, 'Schedatura');

      const scelta = await dialog.showSaveDialog({
        title: opt.titolo || 'Salva in PDF',
        defaultPath: `${safeBase}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (scelta.canceled || !scelta.filePath) return { success: false, canceled: true };

      const pdf = await printHost.generaPdf(doc.html, opt);
      await fs.promises.writeFile(scelta.filePath, pdf);
      // Il PDF si apre da solo: e' l'anteprima. Confrontare la resa a schermo con quella
      // stampata e' l'unico modo di accorgersi di un troncamento, e chiederlo con un
      // secondo clic significa che quasi nessuno lo farebbe.
      if (opt.apri !== false) shell.openPath(scelta.filePath).catch(() => {});
      return { success: true, count: doc.records.length, path: scelta.filePath };
    } catch (errore) {
      console.error('[Stampa] Generazione PDF fallita:', errore);
      return { success: false, error: errore && errore.message ? errore.message : String(errore) };
    }
  });

  ipcMain.handle('print-direct', async (event, ids, opzioni) => {
    if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
    const opt = opzioni || {};
    try {
      const doc = await componiDocumento(ids, opt);
      if (doc.errore) return { success: false, error: doc.errore };
      const esito = await printHost.stampa(doc.html, opt);
      return Object.assign({ count: doc.records.length }, esito);
    } catch (errore) {
      console.error('[Stampa] Stampa diretta fallita:', errore);
      return { success: false, error: errore && errore.message ? errore.message : String(errore) };
    }
  });
}

module.exports = { setupPrintIpc };
export {};
