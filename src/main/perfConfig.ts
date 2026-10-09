const { app } = require('electron');
const path = require('path');
const { getAllSettings, saveAllSettings } = require('./workspaceManager');
const { migraPerfConfig } = require('./settingsStore');

// "Prestazioni ridotte" è letto prima di app.ready (`app.disableHardwareAcceleration()`):
// è l'unica lettura di settings.json fatta al boot, sincrona. Prima stava in perf-config.json,
// migrato qui alla prima lettura.
function leggiPerfConfig() {
  migraPerfConfig(path.join(app.getPath('userData'), 'perf-config.json'));
  return { lowPerf: !!getAllSettings().lowPerf };
}

function scriviPerfConfig(config) {
  try {
    saveAllSettings({ lowPerf: !!(config && config.lowPerf) });
    return { success: true };
  } catch (error) {
    console.error("Errore scrittura di lowPerf in settings.json:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { leggiPerfConfig, scriviPerfConfig };
export {};
