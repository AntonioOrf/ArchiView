const { ipcMain } = require('electron');
const { getAllSettings, saveAllSettings } = require('../workspaceManager');
const { leggiPerfConfig, scriviPerfConfig } = require('../perfConfig');

function setupSettingsIpc() {
  // get-settings ritorna SOLO le preferenze globali. I flag del vault
  // (tipo/sharedVaultId/pusher*/driveAutofetch) si leggono via get-vault-config (vaultIpc).
  ipcMain.handle('get-settings', () => {
    return getAllSettings();
  });

  ipcMain.handle('save-settings', (event, newSettings) => {
    return saveAllSettings(newSettings);
  });

  // Preferenza globale (file in userData): vale per tutti i workspace ed è letta
  // all'avvio del main, prima che esista una finestra.
  ipcMain.handle('get-perf-mode', () => leggiPerfConfig());
  ipcMain.handle('set-perf-mode', (event, lowPerf) => scriviPerfConfig({ lowPerf }));
}

module.exports = { setupSettingsIpc };
export {};
