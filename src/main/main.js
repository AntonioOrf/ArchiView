const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { exec } = require('child_process');

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

let workspacePath = '';
let dataFilePath = '';
let attachmentsDirPath = '';

// Cache in-memory per le immagini già lette (evita rilettura ripetuta dal disco)
const imageCache = new Map();

function loadWorkspace() {
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.workspacePath && fs.existsSync(settings.workspacePath)) {
        return settings.workspacePath;
      }
    } catch (error) { console.error("Errore lettura settings:", error); }
  }
  return null;
}

function initWorkspace(folderPath) {
  workspacePath = folderPath;
  dataFilePath = path.join(workspacePath, 'database_manoscritti.json');
  attachmentsDirPath = path.join(workspacePath, 'allegati_manoscritti');

  if (!fs.existsSync(attachmentsDirPath)) {
    fs.mkdirSync(attachmentsDirPath, { recursive: true });
  }

  // Quando si cambia workspace, svuota la cache immagini
  imageCache.clear();
  
  fs.writeFileSync(settingsPath, JSON.stringify({ workspacePath: folderPath }, null, 2));
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Archivium Manuscriptorum",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, 
      nodeIntegration: false,
      plugins: true // Abilita il lettore PDF nativo di Chromium
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  let savedWorkspace = loadWorkspace();
  
  if (!savedWorkspace) {
    const result = dialog.showOpenDialogSync({
      title: "Seleziona la cartella di lavoro per l'Archivio",
      message: "Scegli o crea una cartella dove salvare il database e tutti gli allegati",
      properties: ['openDirectory', 'createDirectory']
    });
    
    if (result && result.length > 0) {
      savedWorkspace = result[0];
    } else {
      dialog.showErrorBox("Selezione Annullata", "È necessario selezionare una cartella di lavoro per poter avviare Archivium Manuscriptorum.");
      app.quit();
      return;
    }
  }
  
  initWorkspace(savedWorkspace);

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC DATABASE ---
ipcMain.handle('leggi-dati', async () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = await fsp.readFile(dataFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) { console.error(error); }
  return null;
});

ipcMain.handle('salva-dati', async (event, dati) => {
  try {
    await fsp.writeFile(dataFilePath, JSON.stringify(dati, null, 2));
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
});

// --- IPC GESTIONE ALLEGATI (FOTO E PDF) ---
ipcMain.handle('salva-allegato', async (event, sourcePath) => {
  try {
    const ext = path.extname(sourcePath).toLowerCase();
    // Crea un nome univoco mantenendo l'estensione originale (.jpg, .pdf, ecc.)
    const fileName = `doc_${Date.now()}${ext}`;
    const destPath = path.join(attachmentsDirPath, fileName);
    
    await fsp.copyFile(sourcePath, destPath);
    return { fileName, ext }; // Restituisce nome e tipo di estensione
  } catch (error) {
    console.error("Errore copia allegato:", error);
    return null;
  }
});

ipcMain.handle('leggi-immagine', async (event, fileName) => {
  try {
    // Restituisce il risultato dalla cache se già letto in precedenza
    if (imageCache.has(fileName)) {
      return imageCache.get(fileName);
    }
    const p = path.join(attachmentsDirPath, fileName);
    if (fs.existsSync(p)) {
      const buffer = await fsp.readFile(p);
      const ext = path.extname(fileName).substring(1);
      const dataUrl = `data:image/${ext};base64,${buffer.toString('base64')}`;
      imageCache.set(fileName, dataUrl);
      return dataUrl;
    }
  } catch (error) { console.error(error); }
  return null;
});

// Apri i PDF esternamente all'applicazione
ipcMain.handle('apri-pdf-esterno', async (event, fileName) => {
  try {
    const p = path.join(attachmentsDirPath, fileName);
    if (fs.existsSync(p)) {
      await shell.openPath(p); // Apre il file con il lettore di sistema
      return true;
    }
  } catch (error) { console.error("Errore apertura PDF:", error); }
  return false;
});

// Ottieni il percorso assoluto per iframe interno
ipcMain.handle('get-allegato-path', (event, fileName) => {
  return path.join(attachmentsDirPath, fileName);
});

ipcMain.handle('get-workspace-path', () => {
  return workspacePath;
});

ipcMain.handle('change-workspace', async (event) => {
  const result = await dialog.showOpenDialog({
    title: "Seleziona la nuova cartella di lavoro",
    properties: ['openDirectory', 'createDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const newPath = result.filePaths[0];
    initWorkspace(newPath);
    app.relaunch();
    app.quit();
    return true;
  }
  return false;
});

ipcMain.handle('export-workspace-zip', async (event) => {
  const result = await dialog.showSaveDialog({
    title: 'Esporta Backup in ZIP',
    defaultPath: path.join(app.getPath('downloads'), `Backup_Archivio_${Date.now()}.zip`),
    filters: [{ name: 'File ZIP', extensions: ['zip'] }]
  });
  
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  
  const destPath = result.filePath;
  return new Promise((resolve) => {
    let command;
    if (process.platform === 'win32') {
      const safeWorkspacePath = workspacePath.replace(/'/g, "''");
      const safeDestPath = destPath.replace(/'/g, "''");
      command = `powershell.exe -NoProfile -Command "Compress-Archive -Path '${safeWorkspacePath}\\*' -DestinationPath '${safeDestPath}' -Force"`;
    } else {
      const safeWorkspacePathMac = workspacePath.replace(/"/g, '\\"');
      const safeDestPathMac = destPath.replace(/"/g, '\\"');
      command = `cd "${safeWorkspacePathMac}" && zip -r "${safeDestPathMac}" .`;
    }
    
    exec(command, (error) => {
      if (error) resolve({ success: false, error: error.message });
      else resolve({ success: true, path: destPath });
    });
  });
});
