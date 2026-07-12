const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { syncUnifiedFromLegacy, readVaultConfig } = require('./vaultConfig');

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

// Chiavi che descrivono lo stato del vault: NON devono più stare nel settings.json globale.
// Coincidono con l'oggetto driveSettings scritto in .archiview-drive.json.
const VAULT_KEYS = ['isSharedVault', 'isPersonalCloud', 'sharedVaultId', 'driveAutofetch', 'pusherKey', 'pusherCluster', 'pusherWebhook'];

function stripVaultKeys(obj) {
  const out = { ...obj };
  for (const k of VAULT_KEYS) delete out[k];
  return out;
}

// Stato del vault ATTIVO in formato legacy, derivato dal modello unificato (.archiview-vault.json).
// Unica fonte di verità per i consumer di sync, al posto dei flag globali.
function getActiveVaultFlags() {
  const empty = {
    isSharedVault: false, isPersonalCloud: false, sharedVaultId: null,
    driveAutofetch: false, pusherKey: null, pusherCluster: null, pusherWebhook: null
  };
  if (!state.workspacePath) return empty;
  const cfg = readVaultConfig(state.workspacePath, getAllSettings());
  return {
    isSharedVault: cfg.vaultType === 'shared',
    isPersonalCloud: cfg.vaultType === 'backup',
    sharedVaultId: (cfg.sync && cfg.sync.sharedVaultId) || null,
    driveAutofetch: !!(cfg.sync && cfg.sync.driveAutofetch),
    pusherKey: (cfg.realtime && cfg.realtime.pusherKey) || null,
    pusherCluster: (cfg.realtime && cfg.realtime.pusherCluster) || null,
    pusherWebhook: (cfg.realtime && cfg.realtime.pusherWebhook) || null
  };
}

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
  // Il settings.json globale NON contiene più stato di vault: le vault keys vanno solo nel file del vault.
  fs.writeFileSync(settingsPath, JSON.stringify(stripVaultKeys(updated), null, 2));

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

    // Scrivi lo stato del vault (.archiview-drive.json + modello unico) SOLO se newSettings
    // contiene davvero delle vault keys. Altrimenti un save "globale" (es. lastSyncTime,
    // syncAttachments, lastSeenVersion) ricostruirebbe .archiview-drive.json con tutti i flag
    // a false, azzerando lo stato del vault (regressione dopo la rimozione del ponte get-settings).
    const hasVaultKeys = VAULT_KEYS.some(k => Object.prototype.hasOwnProperty.call(newSettings, k));
    if (hasVaultKeys) {
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

      // Allinea il modello unificato dopo ogni modifica ai legacy
      syncUnifiedFromLegacy(state.workspacePath, updated);
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

  // Il settings.json globale NON eredita più i flag del vault (niente "bleeding"):
  // lo stato del vault vive in .archiview-vault.json / .archiview-drive.json.
  const updatedGlobal = {
      ...stripVaultKeys(currentSettings),
      workspacePath: folderPath,
      recentWorkspaces
  };

  fs.writeFileSync(settingsPath, JSON.stringify(updatedGlobal, null, 2));

  // Migrazione/refresh del modello unificato (.archiview-vault.json), legacy mantenuti.
  // Passiamo currentSettings (non strippato) come fallback per il vault attivo durante l'upgrade.
  syncUnifiedFromLegacy(folderPath, { ...currentSettings, workspacePath: folderPath, ...workspaceDriveSettings });
}

// I segreti (repoKey/encKey) NON vanno mai scritti in chiaro nel file di vault, che può
// finire in una cartella sincronizzata: vivono in cloudTokenStore (DPAPI, userData), keyed per repoId.
function saveHubConfig(config) {
  if (!state.workspacePath) return false;
  const p = path.join(state.workspacePath, '.archiview-hub.json');
  try {
    const { saveHubSecrets } = require('./cloudTokenStore'); // lazy: evita ciclo con cloudTokenStore
    const { repoKey, encKey, ...publicCfg } = config || {};
    if (publicCfg.repoId && (repoKey || encKey)) {
      saveHubSecrets(publicCfg.repoId, { repoKey, encKey });
    }
    fs.writeFileSync(p, JSON.stringify(publicCfg, null, 2), 'utf8');
    // Allinea il modello unificato (provider 'hub')
    syncUnifiedFromLegacy(state.workspacePath, getAllSettings());
    return true;
  } catch (e) {
    console.error("Errore salvataggio config Hub:", e);
    return false;
  }
}

// Scollega il vault dall'Hub: rimuove .archiview-hub.json + i segreti in cloudTokenStore,
// poi ricalcola il modello unificato (che tornerà a provider google/none dai legacy Drive).
// I dati locali e l'eventuale config Drive dormiente (.archiview-drive.json) restano intatti.
function disconnectHub() {
  if (!state.workspacePath) return false;
  const p = path.join(state.workspacePath, '.archiview-hub.json');
  try {
    let repoId = null;
    try {
      if (fs.existsSync(p)) repoId = (JSON.parse(fs.readFileSync(p, 'utf8')) || {}).repoId || null;
    } catch (e) { /* best-effort */ }
    if (repoId) {
      const { clearHubSecrets } = require('./cloudTokenStore'); // lazy: evita ciclo
      clearHubSecrets(repoId);
    }
    if (fs.existsSync(p)) fs.unlinkSync(p);
    syncUnifiedFromLegacy(state.workspacePath, getAllSettings());
    return true;
  } catch (e) {
    console.error("Errore scollegamento Hub:", e);
    return false;
  }
}

function loadHubConfig() {
  if (!state.workspacePath) return null;
  const p = path.join(state.workspacePath, '.archiview-hub.json');
  try {
    if (!fs.existsSync(p)) return null;
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!cfg || !cfg.repoId) return cfg || null;
    const { saveHubSecrets, loadHubSecrets } = require('./cloudTokenStore'); // lazy: evita ciclo

    // Migrazione one-shot: se il file legacy contiene ancora la chiave in chiaro,
    // spostala in cloudTokenStore e riscrivi il file senza segreti.
    if (cfg.repoKey || cfg.encKey) {
      saveHubSecrets(cfg.repoId, { repoKey: cfg.repoKey, encKey: cfg.encKey });
      const { repoKey, encKey, ...publicCfg } = cfg;
      try { fs.writeFileSync(p, JSON.stringify(publicCfg, null, 2), 'utf8'); } catch (e) { /* best-effort */ }
    }

    // Ri-merge dei segreti dal token store: il renderer riceve l'oggetto completo (contratto invariato).
    const secrets = loadHubSecrets(cfg.repoId) || {};
    const { repoKey: _rk, encKey: _ek, ...publicCfg } = cfg;
    return { ...publicCfg, repoKey: secrets.repoKey || null, encKey: secrets.encKey || null };
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
  getActiveVaultFlags,
  saveHubConfig,
  loadHubConfig,
  disconnectHub
};
export {};
