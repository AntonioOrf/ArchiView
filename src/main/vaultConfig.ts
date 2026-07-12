const path = require('path');
const fs = require('fs');

// Nome del file unificato (fonte di verità per il tipo/provider di un vault)
const VAULT_FILE = '.archiview-vault.json';
// File legacy mantenuti in sola lettura come fallback / per retrocompatibilità
const DRIVE_FILE = '.archiview-drive.json';
const HUB_FILE = '.archiview-hub.json';
const INFOLDER_SETTINGS_FILE = 'settings.json';

function safeReadJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Errore lettura ${filePath}:`, e);
  }
  return null;
}

function emptyConfig() {
  return {
    schemaVersion: 1,
    vaultType: 'local',      // 'local' | 'backup' | 'shared'
    provider: 'none',        // 'none' | 'google' | 'microsoft' | 'hub'
    sync: {
      sharedVaultId: null,
      driveAutofetch: false,
      syncAttachments: true
    },
    hub: { url: null, repoId: null, attachmentsMode: 'drive-links' }, // 'drive-links' | 'off'
    realtime: { pusherKey: null, pusherCluster: null, pusherWebhook: null }
  };
}

// Deriva il modello normalizzato dai file legacy (+ settings globali per il vault attivo).
// Non scrive nulla.
function deriveFromLegacy(folderPath, globalSettings) {
  const cfg = emptyConfig();
  const drive = safeReadJson(path.join(folderPath, DRIVE_FILE)) || {};
  const hub = safeReadJson(path.join(folderPath, HUB_FILE));
  const inFolder = safeReadJson(path.join(folderPath, INFOLDER_SETTINGS_FILE)) || {};
  const g = globalSettings || {};

  // I flag globali valgono solo per il vault attualmente attivo
  let isActiveVault = false;
  try {
    isActiveVault = !!g.workspacePath && path.resolve(g.workspacePath) === path.resolve(folderPath);
  } catch (e) { isActiveVault = false; }
  const ga = isActiveVault ? g : {};

  const isShared = !!(drive.isSharedVault || inFolder.isSharedVault || ga.isSharedVault);
  const isPersonal = !!(drive.isPersonalCloud || inFolder.isPersonalCloud || ga.isPersonalCloud);

  // Tipo vault
  if (hub || isShared) cfg.vaultType = 'shared';
  else if (isPersonal) cfg.vaultType = 'backup';
  else cfg.vaultType = 'local';

  // Provider
  if (hub) {
    cfg.provider = 'hub';
  } else if (cfg.vaultType !== 'local') {
    cfg.provider = ga.cloudProvider || drive.cloudProvider || 'google';
  } else {
    cfg.provider = 'none';
  }

  // Sync
  cfg.sync.sharedVaultId = drive.sharedVaultId || inFolder.sharedVaultId || ga.sharedVaultId || null;
  cfg.sync.driveAutofetch = !!(drive.driveAutofetch || ga.driveAutofetch);
  const syncAtt = drive.syncAttachments !== undefined ? drive.syncAttachments : ga.syncAttachments;
  cfg.sync.syncAttachments = syncAtt !== false; // default true

  // Hub
  if (hub) {
    cfg.hub.url = hub.hubUrl || null;
    cfg.hub.repoId = hub.repoId || null;
    cfg.hub.attachmentsMode = hub.attachmentsMode || 'drive-links';
  }

  // Realtime (Pusher)
  cfg.realtime.pusherKey = drive.pusherKey || ga.pusherKey || null;
  cfg.realtime.pusherCluster = drive.pusherCluster || ga.pusherCluster || null;
  cfg.realtime.pusherWebhook = drive.pusherWebhook || ga.pusherWebhook || null;

  return cfg;
}

// Ritorna il modello normalizzato: legge il file unificato se presente,
// altrimenti deriva dai legacy (senza scrivere).
function readVaultConfig(folderPath, globalSettings) {
  if (!folderPath) return emptyConfig();
  const existing = safeReadJson(path.join(folderPath, VAULT_FILE));
  if (existing && existing.schemaVersion) {
    const base = emptyConfig();
    return {
      ...base,
      ...existing,
      sync: { ...base.sync, ...(existing.sync || {}) },
      hub: { ...base.hub, ...(existing.hub || {}) },
      realtime: { ...base.realtime, ...(existing.realtime || {}) }
    };
  }
  return deriveFromLegacy(folderPath, globalSettings);
}

// Scrive SOLO il file unificato (non tocca i legacy).
function writeVaultConfig(folderPath, config) {
  if (!folderPath) return false;
  try {
    fs.writeFileSync(path.join(folderPath, VAULT_FILE), JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error("Errore scrittura vault config unificata:", e);
    return false;
  }
}

// Primitiva di migrazione/refresh: ricalcola dai legacy e (ri)scrive il file unificato. Idempotente.
function syncUnifiedFromLegacy(folderPath, globalSettings) {
  if (!folderPath) return null;
  try {
    if (!fs.existsSync(folderPath)) return null;
  } catch (e) { return null; }
  const cfg = deriveFromLegacy(folderPath, globalSettings);
  writeVaultConfig(folderPath, cfg);
  return cfg;
}

module.exports = {
  readVaultConfig,
  writeVaultConfig,
  syncUnifiedFromLegacy
};
export {};
