import { app, BrowserWindow, shell, protocol, ipcMain, nativeTheme, net, nativeImage } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';

require('./e2eBootstrap');

import { leggiPerfConfig } from './perfConfig';
const perfConfig = leggiPerfConfig();
if (perfConfig.lowPerf) {
  app.disableHardwareAcceleration();
}

if (process.platform === 'win32' && app.isPackaged) {
  app.setAppUserModelId("com.antonioorf.archiview");
}

import { state, loadWorkspace, initWorkspace } from './workspaceManager';
import { setupDatabaseIpc } from './ipc/databaseIpc';
import { setupAttachmentsIpc, setupAttachmentsProtocol } from './ipc/attachmentsIpc';
import { setupWorkspaceIpc } from './ipc/workspaceIpc';
import { setupUpdaterIpc } from './ipc/updaterIpc';
import { setupSettingsIpc } from './ipc/settingsIpc';
import { collegaZoom } from './zoomInterfaccia';
import { setupVaultIpc } from './ipc/vaultIpc';
import { setupHubIpc } from './ipc/hubIpc';
import { setupDriveIpc } from './ipc/drive';
import { setupExportImportIpc } from './ipc/exportImportIpc';
import { setupOcrIpc } from './ipc/ocrIpc';
import { setupIiifIpc } from './ipc/iiifIpc';
import { setupAuthorityIpc } from './ipc/authorityIpc';
import { setupPrintIpc } from './ipc/printIpc';
import { setupTextExportIpc } from './ipc/textExportIpc';
import { setupSafetyIpc } from './ipc/safetyIpc';
import { setupCrossArchiveIpc } from './ipc/crossArchiveIpc';
import { setupScannerIpc } from './ipc/scannerIpc';
import * as pdfHost from './ocr/pdfHost';
import * as printHost from './print/printHost';
import * as iiifImageHost from './iiif/imageHost';
import * as iiifCache from './iiif/imageCache';
import * as schemaApp from './schemaApp';

protocol.registerSchemesAsPrivileged([
  { scheme: schemaApp.SCHEMA, privileges: schemaApp.PRIVILEGI },
  { scheme: 'local-asset', privileges: { secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: pdfHost.SCHEMA, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: printHost.SCHEMA, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: iiifImageHost.SCHEMA, privileges: { secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

function createWindow() {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', iconFile)
    : path.join(__dirname, '..', '..', 'assets', iconFile);
  
  const finestra = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: "ArchiView",
    icon: iconPath,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#282828' : '#fafaf9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  state.mainWindow = finestra;

  if (process.env.ARCHIVIEW_E2E_USER_DATA && process.env.ARCHIVIEW_E2E_BACKGROUND) {
    finestra.setSkipTaskbar(true);
    finestra.setPosition(-32000, -32000);
    finestra.once('ready-to-show', () => finestra.showInactive());
  } else {
    finestra.once('ready-to-show', () => finestra.show());
  }

  finestra.setMenuBarVisibility(false);
  collegaZoom(finestra);
  const indexUrl = schemaApp.URL_INDEX;
  finestra.loadURL(indexUrl);

  finestra.webContents.on('will-navigate', (event, url) => {
    const target = url.split('#')[0].split('?')[0];
    if (target === indexUrl || target === finestra.webContents.getURL().split('#')[0].split('?')[0]) return;
    event.preventDefault();
  });

  if (!app.isPackaged) {
    finestra.webContents.on('console-message', (event, ...args) => {
      const msg = event.message ?? args[1];
      const ln = event.lineNumber ?? args[2];
      const src = event.sourceId ?? args[3];
      console.log(`[RENDERER] ${msg} (${src}:${ln})`);
    });
  }

  finestra.webContents.setWindowOpenHandler((details) => {
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

const urlInvitoDa = (argv: string[]) => argv.find(arg => typeof arg === 'string' && arg.startsWith('archiview://')) || null;
let urlInvitoInAttesa: string | null = urlInvitoDa(process.argv);

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore();
      state.mainWindow.focus();

      const url = urlInvitoDa(commandLine);
      if (url) {
        state.mainWindow.webContents.send('handle-invite-url', url);
      }
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (state.mainWindow) {
      state.mainWindow.webContents.send('handle-invite-url', url);
    } else {
      urlInvitoInAttesa = url;
    }
  });

  app.whenReady().then(() => {
    require('./guardieWebContents').installaGuardieWebContents(
      app, require('electron').session.defaultSession, () => state.mainWindow
    );
    require('./guardiaFile').installaGuardiaFile(
      require('electron').session.defaultSession,
      () => [state.workspacePath, state.attachmentsDirPath]
    );
    schemaApp.registraProtocollo(path.join(__dirname, '..', 'renderer'));
    setupAttachmentsProtocol();
    pdfHost.registraProtocollo();
    printHost.registraProtocollo();
    iiifImageHost.registraProtocollo();
    iiifCache.sfoltisci().catch(() => {});

    const savedWorkspace = loadWorkspace();
    if (savedWorkspace) {
      initWorkspace(savedWorkspace);
    }
    try { require('./cloudTokenStore').purgeMicrosoftTokens(); } catch (e) { console.warn('Pulizia token Microsoft non riuscita:', e); }

  setupDatabaseIpc();
  setupAttachmentsIpc();
  setupWorkspaceIpc();
  setupUpdaterIpc();
  setupSettingsIpc();
  setupVaultIpc();
  setupHubIpc();
  setupDriveIpc();
  setupExportImportIpc();
  setupOcrIpc();
  setupIiifIpc();
  setupAuthorityIpc();
  setupPrintIpc();
  setupTextExportIpc();
  setupSafetyIpc();
  setupCrossArchiveIpc();
  setupScannerIpc();

  ipcMain.handle('apri-link-esterno', async (event, url) => {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url);
      return true;
    }
    console.warn(`[SECURITY] Tentativo bloccato di aprire link esterno non sicuro: ${url}`);
    return false;
  });

  ipcMain.handle('prendi-url-invito', () => {
    const url = urlInvitoInAttesa;
    urlInvitoInAttesa = null;
    return url;
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('invia-segnalazione', async (event, payload) => {
    let lastError: { ok: boolean; status?: number; text?: string; error?: string } | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await net.fetch('https://formsubmit.co/ajax/9267297c79d548e052d348548565a2fa', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Referer': 'https://archiview.app',
              'Origin': 'https://archiview.app',
              'User-Agent': 'ArchiView-Desktop-App/1.0'
            },
            body: JSON.stringify(payload)
          });
          if (response.ok) {
              return { ok: true, status: response.status, text: await response.text() };
          } else {
              lastError = { ok: false, status: response.status, text: await response.text() };
          }
        } catch (e) {
          lastError = { ok: false, error: e.message };
        }
        await new Promise(res => setTimeout(res, attempt * 1000));
    }
    console.error('Errore invio segnalazione dopo 3 tentativi:', lastError);
    return lastError;
  });

  createWindow();
  const finestraStaccata = require('./finestraStaccata');
  finestraStaccata.setupFinestraStaccata({
    principale: () => state.mainWindow,
    urlIndex: schemaApp.URL_INDEX,
    preload: path.join(__dirname, 'preload.js'),
    icona: app.isPackaged
      ? path.join(process.resourcesPath, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
      : path.join(__dirname, '..', '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
  });

  let forceClose = false;
  state.mainWindow?.on('close', (e) => {
    if (process.env.ARCHIVIEW_E2E_USER_DATA) return;
    if (!forceClose && state.mainWindow && state.mainWindow.webContents && !state.mainWindow.webContents.isCrashed()) {
      e.preventDefault();
      state.mainWindow.webContents.send('request-close');
    }
  });

  ipcMain.on('confirm-close', () => {
    forceClose = true;
    if (state.mainWindow) state.mainWindow.close();
  });

  state.mainWindow?.on('closed', () => { pdfHost.distruggi(); printHost.distruggi(); finestraStaccata.distruggiFinestraStaccata(); });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
export {};
