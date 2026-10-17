import { ipcMain } from 'electron';
import { state, getAllSettings, saveAllSettings } from '../workspaceManager';
import { readVaultConfig, legacyDaConfig } from '../vaultConfig';
import { idDriveValido } from './drive/pickerSecurity';

function currentConfig() {
  return readVaultConfig(state.workspacePath, getAllSettings());
}

function setupVaultIpc() {
  ipcMain.handle('get-vault-config', () => {
    return currentConfig();
  });

  ipcMain.handle('set-vault-type', (event: any, payload: any) => {
    const { vaultType, sharedVaultId, driveAutofetch } = payload || {};
    if (!['local', 'backup', 'shared'].includes(vaultType)) {
      throw new Error("vaultType non valido: " + vaultType);
    }

    const current = currentConfig();
    const legacy: any = legacyDaConfig(current);

    legacy.isSharedVault = vaultType === 'shared';
    legacy.isPersonalCloud = vaultType === 'backup';
    legacy.driveAutofetch = driveAutofetch !== undefined ? !!driveAutofetch : (vaultType !== 'local');

    if (sharedVaultId !== undefined && sharedVaultId !== null && !idDriveValido(sharedVaultId)) {
      throw new Error("Id Drive non valido");
    }
    if (sharedVaultId !== undefined) legacy.sharedVaultId = sharedVaultId;
    else if (vaultType === 'local' || current.vaultType === 'local') legacy.sharedVaultId = null;

    saveAllSettings(legacy);
    return currentConfig();
  });
}

export { setupVaultIpc };
