const { app, BrowserWindow, shell, protocol, ipcMain } = require('electron');
const path = require('path');

const { state, loadWorkspace, initWorkspace } = require('./workspaceManager');
const { setupDatabaseIpc } = require('./ipc/databaseIpc');
const { setupAttachmentsIpc, setupAttachmentsProtocol } = require('./ipc/attachmentsIpc');
const { setupWorkspaceIpc } = require('./ipc/workspaceIpc');
const { setupUpdaterIpc } = require('./ipc/updaterIpc');

// Protocollo custom per servire allegati
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-asset', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true } }
]);

function createWindow() {
  state.mainWindow = new BrowserWindow({
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

  state.mainWindow.setMenuBarVisibility(false);
  state.mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Sicurezza: blocca la navigazione interna
  state.mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
  });

  state.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message} (${sourceId}:${line})`);
  });

  // Sicurezza: blocca l'apertura di finestre popup
  state.mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  setupAttachmentsProtocol();

  const savedWorkspace = loadWorkspace();
  if (savedWorkspace) {
    initWorkspace(savedWorkspace);
  }

  setupDatabaseIpc();
  setupAttachmentsIpc();
  setupWorkspaceIpc();
  setupUpdaterIpc();

  ipcMain.handle('apri-link-esterno', async (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      await shell.openExternal(url);
    }
  });

  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
