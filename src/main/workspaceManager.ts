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
    
    // Save drive settings locally to the workspace so they don't bleed into other workspaces
    const driveSettingsPath = path.join(state.workspacePath, '.archiview-drive.json');
    const driveSettings = {
        isSharedVault: updated.isSharedVault || false,
        isPersonalCloud: updated.isPersonalCloud || false,
        sharedVaultId: updated.sharedVaultId || null,
        pusherKey: updated.pusherKey || null,
        pusherCluster: updated.pusherCluster || null,
        pusherWebhook: updated.pusherWebhook || null,
        driveAutofetch: updated.driveAutofetch || false
    };
    try {
        fs.writeFileSync(driveSettingsPath, JSON.stringify(driveSettings, null, 2));
    } catch(e) { console.error("Errore salvataggio drive settings:", e); }
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

  // Load drive settings specific to this workspace
  const driveSettingsPath = path.join(folderPath, '.archiview-drive.json');
  let workspaceDriveSettings = {
      isSharedVault: false,
      isPersonalCloud: false,
      sharedVaultId: null,
      pusherKey: null,
      pusherCluster: null,
      pusherWebhook: null,
      driveAutofetch: false
  };
  
  if (fs.existsSync(driveSettingsPath)) {
      try {
          workspaceDriveSettings = JSON.parse(fs.readFileSync(driveSettingsPath, 'utf8'));
      } catch(e) { console.error("Errore parsing drive settings locali:", e); }
  } else {
      // If no local config exists, but this is the SAME workspace as the global one, migrate global settings to local
      if (currentSettings.workspacePath === folderPath && (currentSettings.isSharedVault || currentSettings.isPersonalCloud)) {
          workspaceDriveSettings = {
              isSharedVault: currentSettings.isSharedVault || false,
              isPersonalCloud: currentSettings.isPersonalCloud || false,
              sharedVaultId: currentSettings.sharedVaultId || null,
              pusherKey: currentSettings.pusherKey || null,
              pusherCluster: currentSettings.pusherCluster || null,
              pusherWebhook: currentSettings.pusherWebhook || null,
              driveAutofetch: currentSettings.driveAutofetch || false
          };
          try {
              fs.writeFileSync(driveSettingsPath, JSON.stringify(workspaceDriveSettings, null, 2));
          } catch(e) { console.error("Errore migrazione drive settings locali:", e); }
      }
  }

  // We do NOT call saveAllSettings here for the drive settings because saveAllSettings would write them back to .archiview-drive.json
  // Instead, we just update the global settings file directly with the merged config
  const updatedGlobal = { 
      ...currentSettings, 
      workspacePath: folderPath, 
      recentWorkspaces,
      ...workspaceDriveSettings
  };
  
  fs.writeFileSync(settingsPath, JSON.stringify(updatedGlobal, null, 2));
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
