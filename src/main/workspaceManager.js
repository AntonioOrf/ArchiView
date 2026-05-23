const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

const state = {
  workspacePath: '',
  dataFilePath: '',
  attachmentsDirPath: '',
  mainWindow: null
};

function loadWorkspace() {
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.workspacePath && fs.existsSync(settings.workspacePath)) {
        return settings.workspacePath;
      }
    } catch (error) { 
      console.error("Errore lettura settings:", error); 
    }
  }
  return null;
}

function initWorkspace(folderPath) {
  state.workspacePath = folderPath;
  state.dataFilePath = path.join(folderPath, 'database_manoscritti.json');
  state.attachmentsDirPath = path.join(folderPath, 'allegati_manoscritti');

  if (!fs.existsSync(state.attachmentsDirPath)) {
    fs.mkdirSync(state.attachmentsDirPath, { recursive: true });
  }

  fs.writeFileSync(settingsPath, JSON.stringify({ workspacePath: folderPath }, null, 2));
}

module.exports = {
  state,
  loadWorkspace,
  initWorkspace
};
