import { ipcMain, dialog, shell } from 'electron';
import * as fs from 'fs';
import { state } from '../workspaceManager';
import { leggiDb, recordsRichiesti, nomeFileSicuro } from './recordSelection';
import { generaHtmlStampa } from '../print/printTemplate';
import * as printHost from '../print/printHost';
const Model = require('../../shared/model');

async function componiDocumento(ids, opzioni) {
  const db = await leggiDb();
  if (!db) return { errore: 'Database non trovato' };
  const records = recordsRichiesti(db, ids);
  if (records.length === 0) return { errore: 'Nessuna scheda da stampare' };

  const miniature = opzioni.layout === 'scheda' && opzioni.miniature !== false
    ? await printHost.preparaMiniature(records, { pdf: opzioni.miniaturePdf !== false })
    : {};

  const tipiDoc = (Array.isArray(db.tipiDocumento) && db.tipiDocumento.length > 0)
    ? db.tipiDocumento
    : Model.MODELLI_PREDEFINITI.map((m: any) => ({ id: m.id, nome: m.nome, campi: m.campi.slice() }));

  const html = generaHtmlStampa(records, tipiDoc, {
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
      if (doc.errore || !doc.records) return { success: false, error: doc.errore };

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
      if (doc.errore || !doc.records) return { success: false, error: doc.errore };
      const esito = await printHost.stampa(doc.html, opt);
      return Object.assign({ count: doc.records.length }, esito);
    } catch (errore) {
      console.error('[Stampa] Stampa diretta fallita:', errore);
      return { success: false, error: errore && errore.message ? errore.message : String(errore) };
    }
  });
}

export { setupPrintIpc };
