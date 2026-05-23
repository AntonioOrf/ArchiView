const { app, BrowserWindow, ipcMain, shell, dialog, protocol, net } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

let workspacePath = '';
let dataFilePath = '';
let attachmentsDirPath = '';
let mainWindow = null;

// Protocollo custom per servire allegati
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-asset', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true } }
]);

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

  fs.writeFileSync(settingsPath, JSON.stringify({ workspacePath: folderPath }, null, 2));
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "ArchiView",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, 
      nodeIntegration: false,
      plugins: true // Abilita il lettore PDF nativo di Chromium
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Sicurezza: blocca la navigazione interna
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message} (${sourceId}:${line})`);
  });

  // Sicurezza: blocca l'apertura di finestre popup
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  protocol.handle('local-asset', (request) => {
    let filePath = request.url.slice('local-asset://'.length);
    filePath = decodeURIComponent(filePath);
    return net.fetch('file://' + path.join(attachmentsDirPath, filePath));
  });

  let savedWorkspace = loadWorkspace();
  
  if (savedWorkspace) {
    initWorkspace(savedWorkspace);
  }

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
  const archiverModule = await import('archiver');
  return new Promise((resolve) => {
    const output = fs.createWriteStream(destPath);
    const archive = new archiverModule.ZipArchive({ zlib: { level: 9 } });

    output.on('close', function() {
      resolve({ success: true, path: destPath });
    });
    
    archive.on('error', function(err) {
      resolve({ success: false, error: err.message });
    });

    archive.on('progress', (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('export-progress', progress);
      }
    });

    archive.pipe(output);
    archive.directory(workspacePath, false);
    archive.finalize();
  });
});

// --- IPC AUTO-UPDATER ---
autoUpdater.autoDownload = false; // L'utente deciderà quando scaricare

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.updateInfo) {
      const isNewer = result.updateInfo.version !== app.getVersion();
      return { 
        updateAvailable: isNewer, 
        latestVersion: result.updateInfo.version, 
        currentVersion: app.getVersion()
      };
    }
    return { updateAvailable: false, currentVersion: app.getVersion() };
  } catch (error) {
    return { error: error.message || "Errore sconosciuto nel controllo aggiornamenti." };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(true, true);
});

// Eventi inviati al renderer per l'interfaccia
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
  }
});

ipcMain.handle('apri-link-esterno', async (event, url) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    await shell.openExternal(url);
  }
});
