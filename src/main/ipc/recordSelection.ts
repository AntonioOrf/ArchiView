// Lettura del database e risoluzione degli id da esportare/stampare.
//
// Esisteva in tre copie identiche (`export-csv`, `printIpc`, e ora l'export di testo della
// 2.5/2.6): tre punti in cui l'ORDINE della selezione poteva divergere, cioe' tre modi
// diversi di rispondere alla stessa domanda "cosa ha scelto l'utente". Sta qui una volta.

const fs = require('fs');
const path = require('path');
const { state } = require('../workspaceManager');

/** Il DB come sta SU DISCO: cio' che si esporta e' cio' che e' stato salvato. */
async function leggiDb() {
  if (!state.workspacePath) return null;
  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  if (!fs.existsSync(dbPath)) return null;
  return JSON.parse(await fs.promises.readFile(dbPath, 'utf8'));
}

/**
 * Record richiesti NELL'ORDINE della selezione arrivata dal renderer: e' l'ordinamento che
 * l'utente vede a schermo (Fase 1.1). Gli id ripetuti valgono una volta sola, quelli
 * inesistenti (cancellati fra il click e la lettura del file) cadono senza errore.
 */
function recordsRichiesti(db: any, ids: any[]): any[] {
  const manoscritti = (db && db.manoscritti) || [];
  const indice = new Map(manoscritti.map((m: any) => [String(m.id), m]));
  const visti = new Set<string>();
  return (ids || []).map(String).filter((id) => {
    if (visti.has(id)) return false;
    visti.add(id); return true;
  }).map((id) => indice.get(id)).filter(Boolean);
}

/** Nome file proposto nel dialog: niente caratteri vietati da Windows, mai vuoto. */
function nomeFileSicuro(base: any, fallback: string): string {
  return String(base || '').replace(/[\/:*?"<>|]/g, '_').trim().slice(0, 80) || fallback;
}

module.exports = { leggiDb, recordsRichiesti, nomeFileSicuro };
export {};
