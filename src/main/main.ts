const { app, BrowserWindow, shell, protocol, ipcMain, nativeTheme, net, nativeImage } = require('electron');
const path = require('path');

if (process.platform === 'win32') {
  app.setAppUserModelId("com.antonioorf.archiview");
}

const { state, loadWorkspace, initWorkspace } = require('./workspaceManager');
const { setupDatabaseIpc } = require('./ipc/databaseIpc');
const { setupAttachmentsIpc, setupAttachmentsProtocol } = require('./ipc/attachmentsIpc');
const { setupWorkspaceIpc } = require('./ipc/workspaceIpc');
const { setupUpdaterIpc } = require('./ipc/updaterIpc');
const { setupSettingsIpc } = require('./ipc/settingsIpc');
const { setupDriveIpc } = require('./ipc/driveSync');
const { setupMsIpc } = require('./ipc/msSync');
const { setupExportImportIpc } = require('./ipc/exportImportIpc');

// Protocollo custom per servire allegati
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-asset', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true } }
]);

function createWindow() {
  const iconPath = path.join(__dirname, '..', '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  
  state.mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "ArchiView",
    icon: nativeImage.createFromPath(iconPath),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#282828' : '#fafaf9',
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

  state.mainWindow.webContents.on('console-message', (event, ...args) => {
    const msg = event.message ?? args[1];
    const ln = event.line ?? args[2];
    const src = event.sourceId ?? args[3];
    console.log(`[RENDERER] ${msg} (${src}:${ln})`);
  });

  // Sicurezza: blocca l'apertura di finestre popup
  state.mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });
}

if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient('archiview', process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient('archiview');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Se c'è già una finestra aperta, la mettiamo in primo piano
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore();
      state.mainWindow.focus();

      // Cerca l'URL del protocollo personalizzato
      const url = commandLine.find(arg => arg.startsWith('archiview://'));
      if (url) {
        state.mainWindow.webContents.send('handle-invite-url', url);
      }
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (state.mainWindow) {
      state.mainWindow.webContents.send('handle-invite-url', url);
    }
  });

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
  setupSettingsIpc();
  setupDriveIpc();
  setupMsIpc();
  setupExportImportIpc();

  ipcMain.handle('apri-link-esterno', async (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      await shell.openExternal(url);
    }
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('invia-segnalazione', async (event, payload) => {
    try {
      const response = await net.fetch('https://formsubmit.co/ajax/9267297c79d548e052d348548565a2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Referer': 'https://archiview.app',
          'Origin': 'https://archiview.app'
        },
        body: JSON.stringify(payload)
      });
      return { ok: response.ok, status: response.status, text: await response.text() };
    } catch (e) {
      console.error('Errore invio segnalazione:', e);
      return { ok: false, error: e.message };
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
} // Chiude l'else di gotTheLock
export {};
