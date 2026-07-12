const { ipcMain } = require('electron');
const { getAllSettings, saveAllSettings } = require('../workspaceManager');

function setupSettingsIpc() {
  // get-settings ritorna SOLO le preferenze globali. I flag del vault
  // (tipo/sharedVaultId/pusher*/driveAutofetch) si leggono via get-vault-config (vaultIpc).
  ipcMain.handle('get-settings', () => {
    return getAllSettings();
  });

  ipcMain.handle('save-settings', (event, newSettings) => {
    return saveAllSettings(newSettings);
  });
}

module.exports = { setupSettingsIpc };
export {};
