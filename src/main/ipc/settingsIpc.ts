const { ipcMain } = require('electron');
const { getAllSettings, saveAllSettings } = require('../workspaceManager');

function setupSettingsIpc() {
  ipcMain.handle('get-settings', () => {
    const s = getAllSettings();
    if (!s.pusherKey) {
        try {
            const creds = require('./cloudCredentials');
            s.pusherKey = creds.PUSHER_KEY;
            s.pusherCluster = creds.PUSHER_CLUSTER;
            s.pusherWebhook = creds.PUSHER_WEBHOOK;
        } catch(e) {}
    }
    return s;
  });

  ipcMain.handle('save-settings', (event, newSettings) => {
    return saveAllSettings(newSettings);
  });
}

module.exports = { setupSettingsIpc };
export {};
