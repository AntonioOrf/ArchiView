// ArchiView Scanner — IPC della ricezione dei lotti (Fase 0 di PIANO-SCANNER.md).
//
// Il renderer non passa percorsi né id Drive: chiede "ricevi" e ottiene l'esito. I lotti
// finiscono in `<workspace>/.archiview/scanner/arrivo/<id>/`, cartella interna che non si
// sincronizza e da cui `attachmentsIpc` rifiuta di copiare (l'assegnazione a una scheda,
// Fase 2, avrà un handler suo).

const path = require('path');
const { ipcMain } = require('electron');
const { state } = require('../workspaceManager');
const { authenticateDrive } = require('./drive/auth');
const { riceviLotti } = require('../scanner/arrivoLotti');
const { creaSorgenteDrive } = require('../scanner/driveArrivo');

/** Una ricezione alla volta: due giri paralleli si contenderebbero la cartella temporanea. */
let inCorso: Promise<any> | null = null;

function cartelleScanner(): { arrivo: string; temp: string } {
  if (!state.workspacePath) throw new Error('nessun_archivio_aperto');
  const base = path.join(state.workspacePath, '.archiview', 'scanner');
  return { arrivo: path.join(base, 'arrivo'), temp: path.join(base, 'tmp') };
}

function setupScannerIpc() {
  ipcMain.handle('scanner-ricevi-drive', async (event: any) => {
    if (inCorso) return { success: false, error: 'ricezione_in_corso' };
    inCorso = (async () => {
      try {
        const { arrivo, temp } = cartelleScanner();
        await authenticateDrive();
        const sorgente = await creaSorgenteDrive();
        const esito = await riceviLotti({
          sorgente,
          cartellaArrivo: arrivo,
          cartellaTemp: temp,
          avanzamento: (e: any) => {
            if (!event.sender.isDestroyed()) event.sender.send('scanner-progress', e);
          }
        });
        if (esito.falliti.length) console.warn('[scanner] lotti non ricevuti:', JSON.stringify(esito.falliti));
        return { success: true, ...esito };
      } catch (error: any) {
        console.error('[scanner] ricezione da Drive fallita:', error && error.message);
        return { success: false, error: (error && error.message) || String(error) };
      }
    })();
    try { return await inCorso; } finally { inCorso = null; }
  });
}

module.exports = { setupScannerIpc };
export {};
