import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { syncUnifiedFromLegacy, readVaultConfig, legacyDaConfig, cartellaAllegatiArchivio, impostaCartellaAllegatiArchivio } from './vaultConfig';
import { scriviAtomicoSync } from './scritturaAtomica';
import { configuraStore, leggiStore, scriviStore } from './settingsStore';
const { esaminaPatch } = require('./impostazioniRenderer');

const userDataPath = app.getPath('userData');
configuraStore(path.join(userDataPath, 'settings.json'));

const MAX_RECENTI = 20;

const VAULT_KEYS = ['isSharedVault','isPersonalCloud', 'sharedVaultId', 'driveAutofetch', 'pusherKey', 'pusherCluster', 'pusherWebhook'];

function stripVaultKeys(obj) {
  const out = { ...obj };
  for (const k of VAULT_KEYS) delete out[k];
  return out;
}

function getActiveVaultFlags() {
  const empty = {
    isSharedVault: false, isPersonalCloud: false, sharedVaultId: null,
    driveAutofetch: false, pusherKey: null, pusherCluster: null, pusherWebhook: null
  };
  if (!state.workspacePath) return empty;
  return legacyDaConfig(readVaultConfig(state.workspacePath, getAllSettings()));
}

const state = {
  workspacePath: '',
  dataFilePath: '',
  attachmentsDirPath: '',
  mainWindow: null as import('electron').BrowserWindow | null
};

function finestraPrincipale() {
  const w = state.mainWindow;
  return w && !w.isDestroyed() ? w : null;
}

function getAllSettings() {
  return leggiStore();
}

function scriviImpostazioni(impostazioni) {
  scriviStore(impostazioni);
}

function saveAllSettings(newSettings) {
  const current = getAllSettings();
  const updated = { ...current, ...newSettings };
  scriviImpostazioni(stripVaultKeys(updated));

  if (state.workspacePath) {
    const hasVaultKeys = VAULT_KEYS.some(k => Object.prototype.hasOwnProperty.call(newSettings, k));
    if (hasVaultKeys) {
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
          scriviAtomicoSync(driveSettingsPath, JSON.stringify(driveSettings, null, 2));
      } catch(e) { console.error("Errore salvataggio drive settings:", e); }

      syncUnifiedFromLegacy(state.workspacePath, updated);
    }
  }

  return updated;
}

function applicaCartellaAllegati() {
  if (!state.workspacePath) return;
  state.attachmentsDirPath = cartellaAllegatiArchivio(state.workspacePath);
  if (!fs.existsSync(state.attachmentsDirPath)) {
    fs.mkdirSync(state.attachmentsDirPath, { recursive: true });
  }
}

function migraCartellaAllegatiGlobale(settings, folderPath) {
  const globale = settings.customAttachmentsPath;
  if (typeof globale !== 'string' || !globale) return;
  for (const p of new Set([folderPath, ...(settings.recentWorkspaces || [])])) {
    try {
      if (!p || !fs.existsSync(p)) continue;
      if (cartellaAllegatiArchivio(p) === path.join(p, 'allegati_manoscritti')) impostaCartellaAllegatiArchivio(p, globale, settings);
    } catch (e) { console.error('Migrazione della cartella allegati non riuscita per', p, e); }
  }
  rimuoviImpostazioni(['customAttachmentsPath']);
}

function rimuoviImpostazioni(chiavi: string[]) {
  const current = getAllSettings();
  for (const k of chiavi) delete current[k];
  scriviImpostazioni(stripVaultKeys(current));
  return current;
}

function patchSettings(grezze) {
  const { valori, daRimuovere, rifiutate } = esaminaPatch(grezze);
  if (Object.keys(valori).length) saveAllSettings(valori);
  if (daRimuovere.length) rimuoviImpostazioni(daRimuovere);
  return { ok: rifiutate.length === 0, rifiutate };
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

  migraCartellaAllegatiGlobale(getAllSettings(), folderPath);
  applicaCartellaAllegati();

  const currentSettings = getAllSettings();
  let recentWorkspaces = currentSettings.recentWorkspaces || [];
  
  recentWorkspaces = recentWorkspaces.filter(p => p !== folderPath);
  recentWorkspaces.unshift(folderPath);
  
  recentWorkspaces = recentWorkspaces.slice(0, MAX_RECENTI);

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
              scriviAtomicoSync(driveSettingsPath, JSON.stringify(workspaceDriveSettings, null, 2));
          } catch(e) { console.error("Errore migrazione drive settings locali:", e); }
      }
  }

  const updatedGlobal = {
      ...stripVaultKeys(currentSettings),
      workspacePath: folderPath,
      recentWorkspaces
  };

  scriviImpostazioni(updatedGlobal);

  syncUnifiedFromLegacy(folderPath, { ...currentSettings, workspacePath: folderPath, ...workspaceDriveSettings });
}

function saveHubConfig(config) {
  if (!state.workspacePath) return false;
  const p = path.join(state.workspacePath, '.archiview-hub.json');
  try {
    const { saveHubSecrets } = require('./cloudTokenStore');
    const { repoKey, encKey, ...publicCfg } = config || {};
    if (publicCfg.repoId && (repoKey || encKey)) {
      saveHubSecrets(publicCfg.repoId, { repoKey, encKey });
    }
    scriviAtomicoSync(p, JSON.stringify(publicCfg, null, 2));
    syncUnifiedFromLegacy(state.workspacePath, getAllSettings());
    return true;
  } catch (e) {
    console.error("Errore salvataggio config Hub:", e);
    return false;
  }
}

function disconnectHub() {
  if (!state.workspacePath) return false;
  const p = path.join(state.workspacePath, '.archiview-hub.json');
  try {
    let repoId = null;
    try {
      if (fs.existsSync(p)) repoId = (JSON.parse(fs.readFileSync(p, 'utf8')) || {}).repoId || null;
    } catch (e) {}
    if (repoId) {
      const { clearHubSecrets } = require('./cloudTokenStore');
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
    const { saveHubSecrets, loadHubSecrets } = require('./cloudTokenStore');

    if (cfg.repoKey || cfg.encKey) {
      saveHubSecrets(cfg.repoId, { repoKey: cfg.repoKey, encKey: cfg.encKey });
      const { repoKey, encKey, ...publicCfg } = cfg;
      try { scriviAtomicoSync(p, JSON.stringify(publicCfg, null, 2)); } catch (e) {}
    }

    const secrets = loadHubSecrets(cfg.repoId) || {};
    const { repoKey: _rk, encKey: _ek, ...publicCfg } = cfg;
    return { ...publicCfg, repoKey: secrets.repoKey || null, encKey: secrets.encKey || null };
  } catch (e) {
    console.error("Errore lettura config Hub:", e);
  }
  return null;
}

function loadHubConfigPubblica() {
  const cfg = loadHubConfig();
  if (!cfg) return null;
  const { repoKey, encKey, ...publicCfg } = cfg;
  return { ...publicCfg, hasRepoKey: !!repoKey, hasEncKey: !!encKey };
}

function aggiornaHubConfigDalRenderer(parziale: any): boolean {
  const attuale = loadHubConfig();
  if (!attuale || !attuale.repoId || !parziale || typeof parziale !== 'object') return false;
  const next = { ...attuale };
  if (Number.isInteger(parziale.version) && parziale.version >= 0) next.version = parziale.version;
  if (Number.isFinite(parziale.lastLoadedAt) && parziale.lastLoadedAt >= 0) next.lastLoadedAt = parziale.lastLoadedAt;
  if (parziale.attachmentsMode === 'off' || parziale.attachmentsMode === 'drive-links') next.attachmentsMode = parziale.attachmentsMode;
  if (typeof parziale.name === 'string') next.name = parziale.name.slice(0, 200);
  return saveHubConfig(next);
}

export { state, finestraPrincipale, loadWorkspace, initWorkspace, getAllSettings, saveAllSettings, patchSettings, rimuoviImpostazioni, applicaCartellaAllegati, getActiveVaultFlags, saveHubConfig, loadHubConfig, loadHubConfigPubblica, aggiornaHubConfigDalRenderer, disconnectHub };
