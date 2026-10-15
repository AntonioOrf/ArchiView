import { app } from 'electron';
import * as path from 'path';
import { getAllSettings, saveAllSettings } from './workspaceManager';
import { migraPerfConfig } from './settingsStore';

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

export { leggiPerfConfig, scriviPerfConfig };
