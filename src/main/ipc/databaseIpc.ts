const { ipcMain } = require('electron');
const fs = require('fs');
const fsp = require('fs').promises;
const { state } = require('../workspaceManager');
const Model = require('../../shared/model');
const { forseCreaSnapshotAutomatico } = require('../snapshots');

let watcher = null;
let isSavingSelf = false;
let watcherDebounceTimer = null;

function startWatcher() {
  if (watcher) {
    try {
      watcher.close();
    } catch (e) {}
    watcher = null;
  }

  if (!state.dataFilePath || !fs.existsSync(state.dataFilePath)) return;

  try {
    watcher = fs.watch(state.dataFilePath, (event) => {
      if (event === 'change') {
        if (isSavingSelf) return;
        clearTimeout(watcherDebounceTimer);
        watcherDebounceTimer = setTimeout(() => {
          if (state.mainWindow && !state.mainWindow.isDestroyed()) {
            state.mainWindow.webContents.send('database-modificato-esterno');
          }
        }, 150);
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

      isSavingSelf = true;

      // Scrittura atomica: file temporaneo + rename. Su macchine lente un crash a metà
      // write() lasciava il database troncato e irrecuperabile.
      const tmpPath = `${state.dataFilePath}.tmp`;
      const fh = await fsp.open(tmpPath, 'w');
      try {
        await fh.writeFile(payload, 'utf8');
        await fh.sync();
      } finally {
        await fh.close();
      }
      await fsp.rename(tmpPath, state.dataFilePath);

      // Il rename sostituisce l'inode: il watcher va riagganciato al nuovo file.
      startWatcher();

      // Fase 4.2 — la fotografia dell'archivio si prende DOPO il rename, sul payload appena
      // scritto, e senza attenderla: uno snapshot non deve stare fra il salvataggio e il
      // ritorno del controllo all'utente, e un suo fallimento non deve far fallire il
      // salvataggio (vedi la decisione 3 in testa a snapshots.ts).
      void forseCreaSnapshotAutomatico(payload);

      // Restituisce il controllo dopo un piccolo delay per far passare l'evento di scrittura del filesystem
      setTimeout(() => {
        isSavingSelf = false;
      }, 1000);

      return { success: true };
    } catch (error) {
      isSavingSelf = false;
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('leggi-dati-base', async () => {
    try {
      if (state.workspacePath) {
        const path = require('path');
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
      const path = require('path');
      const basePath = path.join(state.workspacePath, '.archiview-base.json');
      await fsp.writeFile(basePath, JSON.stringify(dati));
      return { success: true };
    } catch (error) {
      console.error("Errore salvataggio dati base:", error);
      return { success: false, error: error.message }; 
    }
  });
}

module.exports = { setupDatabaseIpc };
export {};
