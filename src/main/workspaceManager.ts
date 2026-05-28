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

function getAllSettings() {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (error) {
      console.error("Errore lettura settings:", error);
    }
  }
  return {};
}

function saveAllSettings(newSettings) {
  const current = getAllSettings();
  const updated = { ...current, ...newSettings };
  fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2));

  // Update attachments directory dynamically if workspace is active
  if (state.workspacePath) {
    if (updated.customAttachmentsPath) {
      state.attachmentsDirPath = updated.customAttachmentsPath;
    } else {
      state.attachmentsDirPath = path.join(state.workspacePath, 'allegati_manoscritti');
    }
    if (!fs.existsSync(state.attachmentsDirPath)) {
      fs.mkdirSync(state.attachmentsDirPath, { recursive: true });
    }
  }

  return updated;
}

function loadWorkspace() {
  const settings = getAllSettings();
  if (settings.workspacePath && fs.existsSync(settings.workspacePath)) {
    return settings.workspacePath;
  }
  return null;
}

function initWorkspace(folderPath) {
  state.workspacePath = folderPath;
  state.dataFilePath = path.join(folderPath, 'database_manoscritti.json');

  const settings = getAllSettings();
  if (settings.customAttachmentsPath) {
    state.attachmentsDirPath = settings.customAttachmentsPath;
  } else {
    state.attachmentsDirPath = path.join(folderPath, 'allegati_manoscritti');
  }

  if (!fs.existsSync(state.attachmentsDirPath)) {
    fs.mkdirSync(state.attachmentsDirPath, { recursive: true });
  }

  const currentSettings = getAllSettings();
  let recentWorkspaces = currentSettings.recentWorkspaces || [];
  
  // Rimuovi se esiste già, poi metti in cima
  recentWorkspaces = recentWorkspaces.filter(p => p !== folderPath);
  recentWorkspaces.unshift(folderPath);
  
  // Tieni gli ultimi 5
  recentWorkspaces = recentWorkspaces.slice(0, 5);

  saveAllSettings({ workspacePath: folderPath, recentWorkspaces });
}

function saveHubConfig(config) {
  if (!state.workspacePath) return false;
  const p = path.join(state.workspacePath, '.archiview-hub.json');
  try {
    fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error("Errore salvataggio config Hub:", e);
    return false;
  }
}

function loadHubConfig() {
  if (!state.workspacePath) return null;
  const p = path.join(state.workspacePath, '.archiview-hub.json');
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {
    console.error("Errore lettura config Hub:", e);
  }
  return null;
}

module.exports = {
  state,
  loadWorkspace,
  initWorkspace,
  getAllSettings,
  saveAllSettings,
  saveHubConfig,
  loadHubConfig
};
export {};
