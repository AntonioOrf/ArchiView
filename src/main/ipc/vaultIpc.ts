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

function currentConfig() {
  return readVaultConfig(state.workspacePath, getAllSettings());
}

function setupVaultIpc() {
  // Ritorna la config normalizzata del vault ATTIVO. Il realtime dei vault Hub legge le chiavi
  // Pusher da .archiview-hub.json (load-hub-config); i vault Drive non ne hanno.
  ipcMain.handle('get-vault-config', () => {
    return currentConfig();
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
    return currentConfig();
  });
}

module.exports = { setupVaultIpc };
export {};
