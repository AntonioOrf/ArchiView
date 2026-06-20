const { ipcMain } = require('electron');
const fs = require('fs');
const fsp = require('fs').promises;
const { state } = require('../workspaceManager');

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

function isValidDatabase(dati) {
  if (!dati || typeof dati !== 'object') return false;
  if (!Array.isArray(dati.manoscritti)) return false;
  if (!Array.isArray(dati.cartelle)) return false;
  if (dati.strutturaCampi && !Array.isArray(dati.strutturaCampi)) return false;
  return true;
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
      
      if (!isValidDatabase(dati)) {
        throw new Error("Dati JSON corrotti. Salvataggio interrotto per prevenire la corruzione del database.");
      }

      isSavingSelf = true;
      await fsp.writeFile(state.dataFilePath, JSON.stringify(dati));
      
      if (!watcher) {
        startWatcher();
      }

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
