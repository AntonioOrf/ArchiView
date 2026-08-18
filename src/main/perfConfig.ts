const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Il flag "prestazioni ridotte" NON può stare nelle impostazioni del workspace:
// `app.disableHardwareAcceleration()` va invocato prima di app.ready, quando nessun
// workspace è ancora aperto. Sta quindi in un file dedicato in userData.
function perfConfigPath() {
  return path.join(app.getPath('userData'), 'perf-config.json');
}

function leggiPerfConfig() {
  try {
    const p = perfConfigPath();
    if (!fs.existsSync(p)) return { lowPerf: false };
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { lowPerf: !!(raw && raw.lowPerf) };
  } catch (error) {
    console.warn("perf-config.json illeggibile, uso i valori predefiniti:", error.message);
    return { lowPerf: false };
  }
}

function scriviPerfConfig(config) {
  try {
    fs.writeFileSync(perfConfigPath(), JSON.stringify({ lowPerf: !!config.lowPerf }));
    return { success: true };
  } catch (error) {
    console.error("Errore scrittura perf-config.json:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { leggiPerfConfig, scriviPerfConfig };
export {};
