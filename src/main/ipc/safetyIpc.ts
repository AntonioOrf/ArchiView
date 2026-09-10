// Fase 4 — Sicurezza del dato: il ponte verso cestino (4.1), snapshot (4.2) e cronologia
// per scheda (4.3).
//
// Un solo file per tre funzioni perché sono la stessa cosa vista da tre distanze: la copia
// di ciò che è stato buttato, la fotografia periodica dell'archivio intero e la storia di
// una scheda ricavata da quelle fotografie. Tengono anche lo stesso invariante — nessuna di
// esse tocca il database vero né la sincronizzazione — e vivono nella stessa cartella
// `.archiview/`.
//
// Il renderer non vede mai un percorso: chiede per nome (snapshot) o per id (schede), e
// riceve dati. Ogni nome che arriva da qui passa da `percorsoSicuro` in `snapshots.ts`.

const { ipcMain } = require('electron');
const snapshots = require('../snapshots');
const trash = require('../trash');

/** Uniforma l'esito: il renderer distingue "fatto" da "fallito" senza try/catch ovunque. */
async function esito(fn: () => Promise<any>): Promise<any> {
  try {
    const dati = await fn();
    return { success: true, ...(dati && typeof dati === 'object' && !Array.isArray(dati) ? dati : { dati }) };
  } catch (error: any) {
    console.error('[Fase 4] Operazione fallita:', error && error.message);
    return { success: false, error: (error && error.message) || String(error) };
  }
}

function setupSafetyIpc() {
  // --- Cestino (4.1) ---
  ipcMain.handle('cestino-elenca', async () => esito(async () => ({ voci: await trash.elencaCestino() })));
  ipcMain.handle('cestino-aggiungi', async (event: any, records: any[], da: string) =>
    esito(async () => ({ aggiunte: await trash.aggiungiAlCestino(records, da) })));
  ipcMain.handle('cestino-prendi', async (event: any, ids: string[]) =>
    esito(async () => ({ record: await trash.prendiDalCestino(ids) })));
  ipcMain.handle('cestino-elimina', async (event: any, ids: string[]) =>
    esito(async () => ({ eliminate: await trash.eliminaDalCestino(ids) })));
  ipcMain.handle('cestino-svuota', async () => esito(async () => ({ eliminate: await trash.svuotaCestino() })));

  // --- Snapshot (4.2) ---
  ipcMain.handle('snapshot-elenca', async () => esito(async () => ({ voci: await snapshots.elencaSnapshot() })));
  ipcMain.handle('snapshot-crea', async (event: any, motivo: string) =>
    esito(async () => ({ voce: await snapshots.creaSnapshot(null, motivo || 'manuale') })));
  ipcMain.handle('snapshot-carica', async (event: any, nome: string) =>
    esito(async () => ({ database: await snapshots.caricaSnapshot(nome) })));
  ipcMain.handle('snapshot-elimina', async (event: any, nome: string) =>
    esito(async () => { await snapshots.eliminaSnapshot(nome); return {}; }));

  // --- Cronologia per scheda (4.3) ---
  ipcMain.handle('snapshot-storia-record', async (event: any, id: string) =>
    esito(async () => ({ tappe: await snapshots.storiaRecord(id) })));
}

module.exports = { setupSafetyIpc };
export {};
