import { ipcMain } from 'electron';
import { state, getAllSettings, saveAllSettings } from '../workspaceManager';
import { readVaultConfig, legacyDaConfig } from '../vaultConfig';

// IPC dedicato al modello unificato del vault (.archiview-vault.json).
// Sostituisce, lato renderer, la lettura/scrittura dei flag vault tramite settings globali.

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
    const legacy: any = legacyDaConfig(current);

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

export { setupVaultIpc };
