import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { scriviAtomicoSync } from './scritturaAtomica';

const VAULT_FILE = '.archiview-vault.json';
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
    vaultType: 'local',
    provider: 'none',
    sync: {
      sharedVaultId: null,
      driveAutofetch: false,
      syncAttachments: true
    },
    hub: { url: null, repoId: null, attachmentsMode: 'drive-links' },
    realtime: { pusherKey: null, pusherCluster: null, pusherWebhook: null }
  };
}

function degradaMicrosoft(cfg) {
  if (!cfg || cfg.provider !== 'microsoft') return cfg;
  return {
    ...cfg,
    vaultType: 'local',
    provider: 'none',
    migratedFromMicrosoft: true,
    sync: { ...(cfg.sync || {}), sharedVaultId: null }
  };
}

function deriveFromLegacy(folderPath, globalSettings) {
  const cfg = emptyConfig();
  const driveFile = safeReadJson(path.join(folderPath, DRIVE_FILE));
  const drive = driveFile || {};
  const hub = safeReadJson(path.join(folderPath, HUB_FILE));
  const inFolder = driveFile ? {} : (safeReadJson(path.join(folderPath, INFOLDER_SETTINGS_FILE)) || {});
  const g = globalSettings || {};

  let isActiveVault = false;
  try {
    isActiveVault = !!g.workspacePath && path.resolve(g.workspacePath) === path.resolve(folderPath);
  } catch (e) { isActiveVault = false; }
  const ga = isActiveVault ? g : {};

  const isShared = !!(drive.isSharedVault || inFolder.isSharedVault || ga.isSharedVault);
  const isPersonal = !!(drive.isPersonalCloud || inFolder.isPersonalCloud || ga.isPersonalCloud);

  if (hub || isShared) cfg.vaultType = 'shared';
  else if (isPersonal) cfg.vaultType = 'backup';
  else cfg.vaultType = 'local';

  if (hub) {
    cfg.provider = 'hub';
  } else if (cfg.vaultType !== 'local') {
    cfg.provider = ga.cloudProvider || drive.cloudProvider || 'google';
  } else {
    cfg.provider = 'none';
  }

  cfg.sync.sharedVaultId = drive.sharedVaultId || inFolder.sharedVaultId || ga.sharedVaultId || null;
  cfg.sync.driveAutofetch = !!(drive.driveAutofetch || ga.driveAutofetch);
  const syncAtt = drive.syncAttachments !== undefined ? drive.syncAttachments : ga.syncAttachments;
  cfg.sync.syncAttachments = syncAtt !== false;

  if (hub) {
    cfg.hub.url = hub.hubUrl || null;
    cfg.hub.repoId = hub.repoId || null;
    cfg.hub.attachmentsMode = hub.attachmentsMode || 'drive-links';
  }

  cfg.realtime.pusherKey = drive.pusherKey || ga.pusherKey || null;
  cfg.realtime.pusherCluster = drive.pusherCluster || ga.pusherCluster || null;
  cfg.realtime.pusherWebhook = drive.pusherWebhook || ga.pusherWebhook || null;

  return degradaMicrosoft(cfg);
}

function readVaultConfig(folderPath, globalSettings) {
  if (!folderPath) return emptyConfig();
  const existing = safeReadJson(path.join(folderPath, VAULT_FILE));
  if (existing && existing.schemaVersion) {
    const base = emptyConfig();
    return degradaMicrosoft({
      ...base,
      ...existing,
      sync: { ...base.sync, ...(existing.sync || {}) },
      hub: { ...base.hub, ...(existing.hub || {}) },
      realtime: { ...base.realtime, ...(existing.realtime || {}) }
    });
  }
  return deriveFromLegacy(folderPath, globalSettings);
}

function writeVaultConfig(folderPath, config) {
  if (!folderPath) return false;
  try {
    scriviAtomicoSync(path.join(folderPath, VAULT_FILE), JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error("Errore scrittura vault config unificata:", e);
    return false;
  }
}

function syncUnifiedFromLegacy(folderPath, globalSettings) {
  if (!folderPath) return null;
  try {
    if (!fs.existsSync(folderPath)) return null;
  } catch (e) { return null; }
  const cfg = deriveFromLegacy(folderPath, globalSettings);
  const prima = safeReadJson(path.join(folderPath, VAULT_FILE));
  if (prima && typeof prima.archivioId === 'string' && prima.archivioId) cfg.archivioId = prima.archivioId;
  if (prima && typeof prima.customAttachmentsPath === 'string' && prima.customAttachmentsPath) cfg.customAttachmentsPath = prima.customAttachmentsPath;
  writeVaultConfig(folderPath, cfg);
  return cfg;
}

function cartellaAllegatiArchivio(folderPath: string): string {
  const cfg = safeReadJson(path.join(folderPath, VAULT_FILE));
  const scelta = cfg && typeof cfg.customAttachmentsPath === 'string' ? cfg.customAttachmentsPath : '';
  return scelta || path.join(folderPath, 'allegati_manoscritti');
}

function impostaCartellaAllegatiArchivio(folderPath: string, percorso: string | null, globalSettings): boolean {
  if (!folderPath) return false;
  const cfg = readVaultConfig(folderPath, globalSettings);
  if (percorso) cfg.customAttachmentsPath = percorso; else delete cfg.customAttachmentsPath;
  return writeVaultConfig(folderPath, cfg);
}

function assicuraArchivioId(folderPath, globalSettings) {
  if (!folderPath) return null;
  try {
    if (!fs.existsSync(folderPath)) return null;
  } catch (e) { return null; }
  const cfg = readVaultConfig(folderPath, globalSettings);
  if (typeof cfg.archivioId === 'string' && cfg.archivioId) return cfg.archivioId;
  cfg.archivioId = crypto.randomUUID();
  return writeVaultConfig(folderPath, cfg) ? cfg.archivioId : null;
}

function legacyDaConfig(cfg) {
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

export { readVaultConfig, writeVaultConfig, syncUnifiedFromLegacy, assicuraArchivioId, legacyDaConfig, cartellaAllegatiArchivio, impostaCartellaAllegatiArchivio };
