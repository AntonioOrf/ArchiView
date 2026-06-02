const { ipcMain } = require('electron');
const { getAllSettings, saveAllSettings } = require('../workspaceManager');

function setupSettingsIpc() {
  ipcMain.handle('get-settings', () => {
    return getAllSettings();
  });

  ipcMain.handle('save-settings', (event, newSettings) => {
    return saveAllSettings(newSettings);
  });
}

module.exports = { setupSettingsIpc };
export {};
