const { ipcMain } = require('electron');
const { state, getAllSettings, saveAllSettings } = require('../workspaceManager');
const { readVaultConfig } = require('../vaultConfig');

// IPC dedicato al modello unificato del vault (.archiview-vault.json).
// Sostituisce, lato renderer, la lettura/scrittura dei flag vault tramite settings globali.

// Deriva l'oggetto "legacy" completo (le 7 vault keys) dal modello unificato.
// Serve perché saveAllSettings ricostruisce .archiview-drive.json da questo set completo:
// passarne solo un sottoinsieme azzererebbe i campi mancanti.
function buildLegacyFromConfig(cfg: any) {
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

// Fallback delle credenziali Pusher di default (prima era in settingsIpc.get-settings, load-bearing
// per il realtime del proprietario di un vault condiviso che non ha pusher* persistiti).
function applyCredsFallback(cfg: any) {
  if (cfg && cfg.realtime && !cfg.realtime.pusherKey) {
    try {
      const creds = require('./cloudCredentials');
      cfg.realtime.pusherKey = creds.PUSHER_KEY || null;
      cfg.realtime.pusherCluster = creds.PUSHER_CLUSTER || null;
      cfg.realtime.pusherWebhook = creds.PUSHER_WEBHOOK || null;
    } catch (e) { /* cloudCredentials opzionale */ }
  }
  return cfg;
}

function currentConfig() {
  return readVaultConfig(state.workspacePath, getAllSettings());
}

function setupVaultIpc() {
  // Ritorna la config normalizzata del vault ATTIVO (con fallback creds pusher).
  ipcMain.handle('get-vault-config', () => {
    return applyCredsFallback(currentConfig());
  });

  // Imposta il tipo di vault ('local' | 'backup' | 'shared') e i campi correlati.
  ipcMain.handle('set-vault-type', (event: any, payload: any) => {
    const { vaultType, sharedVaultId, driveAutofetch, provider } = payload || {};
    if (!['local', 'backup', 'shared'].includes(vaultType)) {
      throw new Error("vaultType non valido: " + vaultType);
    }

    const current = currentConfig();
    const legacy: any = buildLegacyFromConfig(current);

    legacy.isSharedVault = vaultType === 'shared';
    legacy.isPersonalCloud = vaultType === 'backup';
    legacy.driveAutofetch = driveAutofetch !== undefined ? !!driveAutofetch : (vaultType !== 'local');

    // sharedVaultId:
    //  - esplicito nel payload → usa quello
    //  - passaggio a 'local' → azzera
    //  - transizione da 'local' a cloud → azzera (nuova cartella creata al primo sync)
    //  - switch shared<->backup → mantieni l'id esistente (già in legacy.sharedVaultId)
    if (sharedVaultId !== undefined) legacy.sharedVaultId = sharedVaultId;
    else if (vaultType === 'local' || current.vaultType === 'local') legacy.sharedVaultId = null;

    if (provider !== undefined) legacy.cloudProvider = provider;

    saveAllSettings(legacy);
    return applyCredsFallback(currentConfig());
  });

  // Imposta la config realtime (Pusher + autofetch) preservando tipo e sharedVaultId del vault.
  ipcMain.handle('set-realtime-config', (event: any, payload: any) => {
    const { pusherKey, pusherCluster, pusherWebhook, driveAutofetch } = payload || {};
    const legacy: any = buildLegacyFromConfig(currentConfig());

    if (driveAutofetch !== undefined) legacy.driveAutofetch = !!driveAutofetch;
    if (pusherKey !== undefined) legacy.pusherKey = pusherKey;
    if (pusherCluster !== undefined) legacy.pusherCluster = pusherCluster;
    if (pusherWebhook !== undefined) legacy.pusherWebhook = pusherWebhook;

    saveAllSettings(legacy);
    return applyCredsFallback(currentConfig());
  });
}

module.exports = { setupVaultIpc };
export {};
