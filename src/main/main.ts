import { app, BrowserWindow, shell, protocol, ipcMain, nativeTheme, net, nativeImage } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';

// Isolamento test E2E: reindirizza userData se ARCHIVIEW_E2E_USER_DATA è impostata.
// Deve precedere il require di workspaceManager (che legge userData a import-time).
require('./e2eBootstrap');

// Modalità "prestazioni ridotte": la disattivazione dell'accelerazione hardware deve
// avvenire prima di app.ready, quindi il flag si legge dal file dedicato in userData.
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
// Fase 4 — cestino, snapshot locali e cronologia per scheda.
import { setupSafetyIpc } from './ipc/safetyIpc';
import { setupCrossArchiveIpc } from './ipc/crossArchiveIpc';
// ArchiScanner — ricezione dei lotti dal telefono (PIANO-SCANNER.md).
import { setupScannerIpc } from './ipc/scannerIpc';
import * as pdfHost from './ocr/pdfHost';
import * as printHost from './print/printHost';
import * as iiifImageHost from './iiif/imageHost';
import * as iiifCache from './iiif/imageCache';
import * as schemaApp from './schemaApp';

// Protocollo custom per servire allegati
protocol.registerSchemesAsPrivileged([
  // O3: la finestra principale. `codeCache` vale solo con `standard`.
  { scheme: schemaApp.SCHEMA, privileges: schemaApp.PRIVILEGI },
  // corsEnabled (P4): le immagini rispondono con Access-Control-Allow-Origin per la sola
  // origine dell'app, così il visualizzatore ne legge i pixel per i filtri (canvas non
  // "tainted"). Il PDF no, e un <img> senza crossorigin si carica come prima.
  { scheme: 'local-asset', privileges: { secure: true, supportFetchAPI: true, corsEnabled: true } },
  // Host PDF dell'OCR (Fase 2.3). Serve `standard: true` — e non solo `secure` come per
  // local-asset — perché la pagina host carica pdf.js come modulo ES e ne avvia il worker:
  // entrambi vogliono un'origine vera, che uno schema non standard non ha.
  { scheme: pdfHost.SCHEMA, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  // Host di stampa (Fase 2.2). Stesse privilegiature: il documento e le miniature degli
  // allegati devono stare nella STESSA origine, o la CSP della pagina generata blocca le
  // immagini. Schema distinto da quello dell'OCR perché i due sottosistemi sono
  // indipendenti: un errore nel servire una stampa non deve toccare il riconoscimento.
  { scheme: printHost.SCHEMA, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  // Carte IIIF remote. Stessi privilegi di local-asset e non di piu': le immagini sono
  // caricate con un <img> dentro la pagina principale, non da una pagina a se stante, quindi
  // non serve `standard: true` — che significherebbe dare a questo schema un'origine vera.
  // corsEnabled come local-asset (P4).
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
    // Sotto questa soglia sidebar (w-60) e vista principale non convivono più. 640 lascia
    // passare la metà schermo di Windows Snap anche su un portatile 1280×800.
    minWidth: 640,
    minHeight: 480,
    title: "ArchiView",
    icon: iconPath,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#282828' : '#fafaf9',
    // Mostrata solo su 'ready-to-show': niente flash bianco né repaint multipli su HW lento.
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  state.mainWindow = finestra;

  // E2E in background: fuori schermo, senza focus né icona nella barra, così i test non
  // interrompono chi lavora. Non `show: false`: una finestra nascosta non disegna.
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

  // Sicurezza: blocca la navigazione verso destinazioni esterne.
  // ATTENZIONE: da Electron 34+ questo evento viene emesso anche per i reload avviati dal
  // renderer (`location.reload()`), che qui è l'ultimo passo di flussi come la creazione di un
  // repository Hub o il cambio workspace. Un preventDefault() incondizionato li congelava
  // (overlay "Preparazione dell'archivio condiviso" infinito), quindi consentiamo solo la
  // ri-navigazione verso la index locale dell'app.
  finestra.webContents.on('will-navigate', (event, url) => {
    const target = url.split('#')[0].split('?')[0];
    if (target === indexUrl || target === finestra.webContents.getURL().split('#')[0].split('?')[0]) return;
    event.preventDefault();
  });

  // Solo in dev: in produzione ogni console.log del renderer costerebbe un round-trip IPC.
  if (!app.isPackaged) {
    finestra.webContents.on('console-message', (event, ...args) => {
      const msg = event.message ?? args[1];
      const ln = event.lineNumber ?? args[2];
      const src = event.sourceId ?? args[3];
      console.log(`[RENDERER] ${msg} (${src}:${ln})`);
    });
  }

  // Sicurezza: blocca l'apertura di finestre popup
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
    // L2 + N9: permessi concessi solo alla finestra principale e solo quelli usati; nessun
    // webContents secondario naviga, apre finestre o aggancia <webview>. Prima di createWindow.
    require('./guardieWebContents').installaGuardieWebContents(
      app, require('electron').session.defaultSession, () => state.mainWindow
    );
    // N1: nessuna richiesta file: verso un host di rete (hash NTLM), tranne dentro l'archivio
    // aperto e la sua cartella allegati, che possono stare su un NAS.
    require('./guardiaFile').installaGuardiaFile(
      require('electron').session.defaultSession,
      () => [state.workspacePath, state.attachmentsDirPath]
    );
    schemaApp.registraProtocollo(path.join(__dirname, '..', 'renderer'));
    setupAttachmentsProtocol();
    pdfHost.registraProtocollo();
    printHost.registraProtocollo();
    iiifImageHost.registraProtocollo();
    // Lo sfoltimento della cache IIIF gira una volta all'avvio e senza attesa: e' una
    // pulizia, non un prerequisito, e contare una cartella da qualche migliaio di file non
    // deve ritardare la comparsa della finestra.
    iiifCache.sfoltisci().catch(() => {});

    const savedWorkspace = loadWorkspace();
    if (savedWorkspace) {
      initWorkspace(savedWorkspace);
    }
    // OneDrive rimosso: via i token MSAL rimasti (dopo initWorkspace, che fissa il workspace).
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
    if (url.startsWith('http://') || url.startsWith('https://')) {
      await shell.openExternal(url);
      return true;
    }
    console.warn(`[SECURITY] Tentativo bloccato di aprire link esterno non sicuro: ${url}`);
    return false;
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
        // Attendi prima del retry (es: 1s, 2s)
        await new Promise(res => setTimeout(res, attempt * 1000));
    }
    console.error('Errore invio segnalazione dopo 3 tentativi:', lastError);
    return lastError;
  });

  createWindow();
  // PIANO-SCHEDA-AFFIANCATA — scheda o documento in una finestra a parte (finestraStaccata.ts).
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
    // In E2E la conferma di chiusura non è pilotabile e il renderer, sulla welcome modal,
    // non registra nemmeno l'handler request-close → app.close() si bloccherebbe.
    if (process.env.ARCHIVIEW_E2E_USER_DATA) return;
    if (!forceClose && state.mainWindow && state.mainWindow.webContents) {
      e.preventDefault();
      state.mainWindow.webContents.send('request-close');
    }
  });

  ipcMain.on('confirm-close', () => {
    forceClose = true;
    if (state.mainWindow) state.mainWindow.close();
  });

  // L'host PDF dell'OCR è una BrowserWindow offscreen, quindi conta come finestra aperta:
  // lasciarla viva impedirebbe a `window-all-closed` di scattare e l'applicazione chiusa
  // resterebbe in memoria. Va abbattuta insieme alla finestra principale, non dopo.
  state.mainWindow?.on('closed', () => { pdfHost.distruggi(); printHost.distruggi(); finestraStaccata.distruggiFinestraStaccata(); });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
} // Chiude l'else di gotTheLock
export {};
