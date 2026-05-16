const { app, BrowserWindow, ipcMain, shell } = require('electron'); // Aggiunto 'shell' per aprire i PDF
const path = require('path');
const fs = require('fs');

const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'database_manoscritti.json');
// Rinominiamo la cartella in "allegati" visto che ora accetta anche PDF
const attachmentsDirPath = path.join(userDataPath, 'allegati_manoscritti');

if (!fs.existsSync(attachmentsDirPath)) {
  fs.mkdirSync(attachmentsDirPath, { recursive: true });
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Archivium Manuscriptorum",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, 
      nodeIntegration: false
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
}

app.whenReady().then(() => {
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
      const data = fs.readFileSync(dataFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) { console.error(error); }
  return null;
});

ipcMain.handle('salva-dati', async (event, dati) => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(dati, null, 2));
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
});

// --- IPC GESTIONE ALLEGATI (FOTO E PDF) ---
ipcMain.handle('salva-allegato', async (event, sourcePath) => {
  try {
    const ext = path.extname(sourcePath).toLowerCase();
    // Crea un nome univoco mantendo l'estensione originale (.jpg, .pdf, ecc.)
    const fileName = `doc_${Date.now()}${ext}`;
    const destPath = path.join(attachmentsDirPath, fileName);
    
    fs.copyFileSync(sourcePath, destPath);
    return { fileName, ext }; // Restituisce nome e tipo di estensione
  } catch (error) {
    console.error("Errore copia allegato:", error);
    return null;
  }
});

ipcMain.handle('leggi-immagine', async (event, fileName) => {
  try {
    const p = path.join(attachmentsDirPath, fileName);
    if (fs.existsSync(p)) {
      const buffer = fs.readFileSync(p);
      const ext = path.extname(fileName).substring(1);
      return `data:image/${ext};base64,${buffer.toString('base64')}`;
    }
  } catch (error) { console.error(error); }
  return null;
});

// Nuova funzione per aprire i PDF esternamente all'applicazione
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