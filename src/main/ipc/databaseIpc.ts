const { ipcMain } = require('electron');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { state } = require('../workspaceManager');
const Model = require('../../shared/model');
const { forseCreaSnapshotAutomatico } = require('../snapshots');
const { scriviAtomico } = require('../scritturaAtomica');

let watcher = null;
let watcherDebounceTimer = null;

// N5 — Il watcher riconosce le scritture proprie dal CONTENUTO, non da una finestra di tempo:
// prima `isSavingSelf` restava attivo 1 s dopo ogni salvataggio, e un cambiamento esterno vero
// (client Drive desktop, seconda istanza) in quella finestra si perdeva.
// `contenutiNoti`: hash degli ultimi contenuti scritti o letti da noi. `firmeNote`: dimensione e
// mtime dopo le nostre scritture, per riconoscerle con uno stat senza rileggere il file.
const MAX_NOTI = 4;
const contenutiNoti: string[] = [];
const firmeNote: string[] = [];

function ricorda(lista: string[], valore: string) {
  if (lista.includes(valore)) return;
  lista.push(valore);
  if (lista.length > MAX_NOTI) lista.shift();
}

function hashContenuto(contenuto: string | Buffer): string {
  return crypto.createHash('sha256').update(contenuto).digest('hex');
}

function firma(st): string {
  return `${st.size}:${st.mtimeMs}`;
}

async function verificaCambiamentoEsterno(percorso: string) {
  try {
    if (percorso !== state.dataFilePath) return;
    const st = await fsp.stat(percorso);
    if (firmeNote.includes(firma(st))) return;
    const hash = hashContenuto(await fsp.readFile(percorso));
    if (contenutiNoti.includes(hash)) return;
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('database-modificato-esterno');
    }
  } catch (error) {
    // File momentaneamente assente o bloccato (rename in corso, client di sync): il
    // prossimo evento del watcher riproverà.
    if (error && error.code !== 'ENOENT') console.error("Errore verifica modifica esterna del database:", error);
  }
}

function startWatcher() {
  if (watcher) {
    try {
      watcher.close();
    } catch (e) {}
    watcher = null;
  }

  if (!state.dataFilePath || !fs.existsSync(state.dataFilePath)) return;

  const percorso = state.dataFilePath;
  try {
    watcher = fs.watch(percorso, (event) => {
      if (event === 'change') {
        clearTimeout(watcherDebounceTimer);
        watcherDebounceTimer = setTimeout(() => { void verificaCambiamentoEsterno(percorso); }, 150);
      }
    });
  } catch (error) {
    console.error("Errore fs.watch database:", error);
  }
}

// Validazione a basso costo del payload già serializzato: evita di ri-parsare l'intero DB
// nel main solo per accertarsi che non sia spazzatura (il renderer valida l'oggetto prima
// di serializzarlo). Controlla involucro + presenza delle due collezioni obbligatorie.
function isValidSerializedDatabase(json) {
  if (typeof json !== 'string' || json.length < 2) return false;
  if (json.charCodeAt(0) !== 123 /* { */ || json.charCodeAt(json.length - 1) !== 125 /* } */) return false;
  return /"manoscritti"\s*:\s*\[/.test(json) && /"cartelle"\s*:\s*\[/.test(json);
}

// Fase 3.0: il criterio di validita' e' quello condiviso (`src/shared/model.ts`). Prima
// erano due elenchi di controlli — uno qui, uno in `eseguiSalvataggio` nel renderer — che
// dovevano restare d'accordo senza che nulla lo garantisse.
function isValidDatabase(dati) {
  return Model.databaseValido(dati);
}

function setupDatabaseIpc() {
  ipcMain.handle('leggi-dati', async () => {
    try {
      if (state.dataFilePath && fs.existsSync(state.dataFilePath)) {
        startWatcher();
        const data = await fsp.readFile(state.dataFilePath, 'utf8');
        ricorda(contenutiNoti, hashContenuto(data));
        return JSON.parse(data);
      }
    } catch (error) { 
      console.error(error); 
    }
    return null;
  });

  ipcMain.handle('salva-dati', async (event, dati) => {
    try {
      if (!state.dataFilePath) throw new Error("Percorso file dati non impostato");

      // Il renderer invia il DB già serializzato: una sola serializzazione invece di
      // structured-clone dell'intero oggetto via IPC + JSON.stringify qui.
      // Il ramo oggetto resta per retro-compatibilità con eventuali chiamanti legacy.
      let payload;
      if (typeof dati === 'string') {
        if (!isValidSerializedDatabase(dati)) {
          throw new Error("Dati JSON corrotti. Salvataggio interrotto per prevenire la corruzione del database.");
        }
        payload = dati;
      } else {
        if (!isValidDatabase(dati)) {
          throw new Error("Dati JSON corrotti. Salvataggio interrotto per prevenire la corruzione del database.");
        }
        payload = JSON.stringify(dati);
      }

      // Il contenuto si registra PRIMA del rename: l'evento del watcher può arrivare subito.
      const percorso = state.dataFilePath;
      ricorda(contenutiNoti, hashContenuto(payload));

      // Scrittura atomica (temporaneo univoco + rename) e in coda alle altre dello stesso
      // file: un crash a metà non tronca il DB, due salvataggi sovrapposti non si mescolano.
      await scriviAtomico(percorso, payload);
      try { ricorda(firmeNote, firma(await fsp.stat(percorso))); } catch (_) {}

      // Il rename sostituisce l'inode: il watcher va riagganciato al nuovo file.
      startWatcher();

      // Fase 4.2 — la fotografia dell'archivio si prende DOPO il rename, sul payload appena
      // scritto, e senza attenderla: uno snapshot non deve stare fra il salvataggio e il
      // ritorno del controllo all'utente, e un suo fallimento non deve far fallire il
      // salvataggio (vedi la decisione 3 in testa a snapshots.ts).
      void forseCreaSnapshotAutomatico(payload);

      return { success: true };
    } catch (error) {
      console.error("Errore salvataggio database:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('leggi-dati-base', async () => {
    try {
      if (state.workspacePath) {
        const basePath = path.join(state.workspacePath, '.archiview-base.json');
        if (fs.existsSync(basePath)) {
          const data = await fsp.readFile(basePath, 'utf8');
          return JSON.parse(data);
        }
      }
    } catch (error) { 
      console.error("Errore lettura dati base:", error); 
    }
    return null;
  });

  ipcMain.handle('salva-dati-base', async (event, dati) => {
    try {
      if (!state.workspacePath) throw new Error("Workspace non impostato");
      const basePath = path.join(state.workspacePath, '.archiview-base.json');
      await scriviAtomico(basePath, JSON.stringify(dati));
      return { success: true };
    } catch (error) {
      console.error("Errore salvataggio dati base:", error);
      return { success: false, error: error.message }; 
    }
  });
}

module.exports = { setupDatabaseIpc };
export {};
