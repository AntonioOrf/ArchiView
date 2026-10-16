import { ipcMain } from 'electron';
import * as fs from 'fs';
const fsp = require('fs').promises;
import * as path from 'path';
import * as crypto from 'crypto';
import { state } from '../workspaceManager';
import { forseCreaSnapshotAutomatico } from '../snapshots';
import { scriviAtomico } from '../scritturaAtomica';

let watcher: import('fs').FSWatcher | null = null;
let watcherDebounceTimer: NodeJS.Timeout | undefined;

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

function isValidSerializedDatabase(json) {
  if (typeof json !== 'string' || json.length < 2) return false;
  if (json.charCodeAt(0) !== 123 || json.charCodeAt(json.length - 1) !== 125) return false;
  return /"manoscritti"\s*:\s*\[/.test(json) && /"cartelle"\s*:\s*\[/.test(json);
}

function setupDatabaseIpc() {
  ipcMain.handle('leggi-dati', async () => {
    try {
      if (state.dataFilePath && fs.existsSync(state.dataFilePath)) {
        startWatcher();
        const data = await fsp.readFile(state.dataFilePath, 'utf8');
        ricorda(contenutiNoti, hashContenuto(data));
        return data;
      }
    } catch (error) { 
      console.error(error); 
    }
    return null;
  });

  ipcMain.handle('salva-dati', async (event, dati) => {
    try {
      if (!state.dataFilePath) throw new Error("Percorso file dati non impostato");

      if (!isValidSerializedDatabase(dati)) {
        throw new Error("Dati JSON corrotti. Salvataggio interrotto per prevenire la corruzione del database.");
      }
      const payload = dati;

      const percorso = state.dataFilePath;
      ricorda(contenutiNoti, hashContenuto(payload));

      await scriviAtomico(percorso, payload);
      try { ricorda(firmeNote, firma(await fsp.stat(percorso))); } catch (_) {}

      startWatcher();

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

export { setupDatabaseIpc };
