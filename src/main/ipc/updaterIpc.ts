const { ipcMain, app } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { state } = require('../workspaceManager');
const { classifyUpdateError } = require('./updateErrorClassifier');

// Logger minimale su file per diagnosticare fallimenti in produzione (electron-updater
// non stampa nulla di suo se non gli si assegna un logger). Rotazione semplice a 1MB:
// evita di far crescere il file indefinitamente su installazioni di lunga durata.
const LOG_MAX_BYTES = 1024 * 1024;
function getUpdaterLogPath() {
  return path.join(app.getPath('userData'), 'logs', 'updater.log');
}
function writeUpdaterLog(level, args) {
  try {
    const logPath = getUpdaterLogPath();
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    try {
      const st = fs.statSync(logPath);
      if (st.size > LOG_MAX_BYTES) fs.renameSync(logPath, logPath + '.old');
    } catch { /* file non ancora esistente: ok */ }
    const line = `[${new Date().toISOString()}] [${level}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
    fs.appendFileSync(logPath, line);
  } catch { /* logging best-effort: non deve mai bloccare l'updater */ }
}
const updaterLogger = {
  info: (...args) => writeUpdaterLog('info', args),
  warn: (...args) => writeUpdaterLog('warn', args),
  error: (...args) => writeUpdaterLog('error', args),
  debug: (...args) => writeUpdaterLog('debug', args)
};

function setupUpdaterIpc() {
  autoUpdater.logger = updaterLogger;
  autoUpdater.autoDownload = false; // L'utente deciderà quando scaricare
  autoUpdater.autoInstallOnAppQuit = true; // Se scaricato ma non installato, installa alla chiusura successiva

  let lastCheckResult = null; // Ultimo UpdateCheckResult riuscito (per download-update senza ri-check)
  let lastCheckAt = 0;
  let checkInFlight = null; // Promise in corso, per deduplicare click ripetuti
  let downloadInFlight = null;
  const CHECK_CACHE_MS = 10 * 60 * 1000; // 10 minuti: evita rate-limit sull'API GitHub

  function sendToRenderer(channel, payload?) {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send(channel, payload);
    }
  }

  async function doCheckForUpdates() {
    const result = await autoUpdater.checkForUpdates();
    lastCheckResult = result;
    lastCheckAt = Date.now();
    if (result && result.updateInfo) {
      return {
        updateAvailable: !!result.isUpdateAvailable,
        latestVersion: result.updateInfo.version,
        currentVersion: app.getVersion(),
        releaseNotes: typeof result.updateInfo.releaseNotes === 'string' ? result.updateInfo.releaseNotes : null
      };
    }
    return { updateAvailable: false, currentVersion: app.getVersion() };
  }

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      return { updateAvailable: false, currentVersion: app.getVersion(), devMode: true };
    }
    try {
      if (checkInFlight) {
        return await checkInFlight;
      }
      if (lastCheckResult && (Date.now() - lastCheckAt) < CHECK_CACHE_MS) {
        const info = lastCheckResult.updateInfo;
        return {
          updateAvailable: !!lastCheckResult.isUpdateAvailable,
          latestVersion: info && info.version,
          currentVersion: app.getVersion(),
          releaseNotes: info && typeof info.releaseNotes === 'string' ? info.releaseNotes : null
        };
      }
      checkInFlight = doCheckForUpdates();
      return await checkInFlight;
    } catch (error) {
      return { error: error.message || "Errore sconosciuto nel controllo aggiornamenti.", errorCode: classifyUpdateError(error) };
    } finally {
      checkInFlight = null;
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      if (downloadInFlight) {
        await downloadInFlight;
        return { success: true };
      }
      if (!lastCheckResult) {
        // Nessun check eseguito in questa sessione: eseguilo prima di scaricare
        await doCheckForUpdates();
      }
      downloadInFlight = autoUpdater.downloadUpdate();
      await downloadInFlight;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message, errorCode: classifyUpdateError(error) };
    } finally {
      downloadInFlight = null;
    }
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(true, true);
  });

  let lastLoggedPercent = -1;
  autoUpdater.on('download-progress', (progressObj) => {
    const perc = Math.floor(progressObj.percent / 10) * 10;
    if (perc !== lastLoggedPercent) {
      lastLoggedPercent = perc;
      updaterLogger.info(`Download progress: ${Math.round(progressObj.percent)}%`);
    }
    sendToRenderer('update-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', () => {
    lastLoggedPercent = -1;
    updaterLogger.info('Update downloaded successfully.');
    sendToRenderer('update-downloaded');
  });

  // Errori emessi in modo asincrono (rete caduta a metà download, checksum non valido, ecc.):
  // senza questo listener, un 'error' non gestito su un EventEmitter termina il processo main.
  autoUpdater.on('error', (error) => {
    downloadInFlight = null;
    sendToRenderer('update-error', {
      error: (error && error.message) || String(error),
      errorCode: classifyUpdateError(error)
    });
  });
}

module.exports = { setupUpdaterIpc };
export {};
