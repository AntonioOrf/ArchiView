const { ipcMain } = require('electron');
const { driveState, initGoogle, loadSavedTokens, authenticateDrive, logoutDrive, checkDriveStatus } = require('./auth');
const { listVaultsFromDrive, checkUpdatesFromDrive, pullFromDrive, syncToDrive, cleanOrphanedAttachments } = require('./vaultOps');
const { syncAttachmentsBidirectional } = require('./attachments');
const { getDbFileId, listDriveRevisions, getDriveRevision, restoreRevision } = require('./revisions');
const { generateInviteCode, decodeInviteCode, joinByInviteCode, joinByFolderId, shareVault, listPermissions, removePermission, openExternalPicker } = require('./sharing');

function setupDriveIpc() {
  // Auth
  ipcMain.handle('drive-auth', async (event: any, forceLocal: boolean) => {
    return await authenticateDrive(forceLocal);
  });
  ipcMain.handle('drive-logout', async () => {
    return await logoutDrive();
  });
  ipcMain.handle('drive-check-auth', async () => {
    return loadSavedTokens();
  });
  ipcMain.handle('drive-status', async () => {
    return await checkDriveStatus();
  });

  // Vault Operations
  ipcMain.handle('drive-list-vaults', async () => {
    return await listVaultsFromDrive();
  });
  ipcMain.handle('drive-pull', async (event: any, vaultId: string) => {
    return await pullFromDrive(vaultId);
  });
  ipcMain.handle('drive-peek-db', async (event: any, vaultId: string) => {
    return await pullFromDrive(vaultId);
  });
  ipcMain.handle('drive-sync', async (event: any, parentModifiedTime: number) => {
    return await syncToDrive(parentModifiedTime);
  });
  ipcMain.handle('drive-check-updates', async (event: any, vaultId: string) => {
    return await checkUpdatesFromDrive(vaultId);
  });
  ipcMain.handle('drive-clean-orphans', async () => {
    return await cleanOrphanedAttachments();
  });

  // Attachments
  ipcMain.handle('drive-sync-attachments', async () => {
    return await syncAttachmentsBidirectional();
  });

  // Revisions
  ipcMain.handle('drive-get-db-file-id', async () => {
    initGoogle();
    return await getDbFileId();
  });
  ipcMain.handle('drive-list-revisions', async (event: any, fileId: string) => {
    initGoogle();
    return await listDriveRevisions(fileId);
  });
  ipcMain.handle('drive-get-revision', async (event: any, fileId: string, revisionId: string) => {
    initGoogle();
    return await getDriveRevision(fileId, revisionId);
  });
  ipcMain.handle('drive-restore-revision', async (event: any, fileId: string, revisionId: string) => {
    initGoogle();
    return await restoreRevision(fileId, revisionId);
  });

  // Sharing & Invites
  ipcMain.handle('drive-generate-invite', async () => {
    return await generateInviteCode();
  });
  ipcMain.handle('drive-decode-invite', async (event: any, inviteCode: string) => {
    try {
      return decodeInviteCode(inviteCode);
    } catch (e: any) {
      throw new Error("Codice invito non valido: " + e.message);
    }
  });
  ipcMain.handle('drive-join-invite', async (event: any, inviteCode: string, basePath: string, name: string) => {
    try {
      return await joinByInviteCode(inviteCode, basePath, name);
    } catch (e: any) {
      throw new Error("Codice invito non valido o errore nella creazione: " + e.message);
    }
  });
  ipcMain.handle('drive-join-folder-id', async (event: any, vaultId: string, vaultName: string, basePath: string, customPusher: any) => {
    try {
      return await joinByFolderId(vaultId, vaultName, basePath, customPusher);
    } catch (e: any) {
      throw new Error("Errore connessione archivio: " + e.message);
    }
  });
  ipcMain.handle('drive-share-vault', async (event: any, email: string) => {
    try {
      return await shareVault(email);
    } catch (e: any) {
      throw new Error("Errore durante la condivisione: " + e.message);
    }
  });
  ipcMain.handle('drive-list-permissions', async () => {
    try {
      return await listPermissions();
    } catch (e: any) {
      if (e.message && e.message.includes("File not found")) {
        throw new Error("La cartella condivisa non esiste più su Google Drive. Scollega questo archivio dal Cloud o ricaricalo.");
      }
      throw new Error("Impossibile caricare i membri: " + e.message);
    }
  });
  ipcMain.handle('drive-remove-permission', async (event: any, permissionId: string) => {
    try {
      return await removePermission(permissionId);
    } catch (e: any) {
      throw new Error("Impossibile rimuovere il membro: " + e.message);
    }
  });

  // Utilities
  ipcMain.handle('drive-get-client-id', async () => {
    try {
      const creds = require('../cloudCredentials');
      const clientId = creds.GOOGLE_CLIENT_ID;
      const apiKey = creds.GOOGLE_API_KEY || '';
      return { clientId, appId: clientId ? clientId.split('-')[0] : '', apiKey };
    } catch (e) {
      return { clientId: '', appId: '', apiKey: '' };
    }
  });
  ipcMain.handle('drive-open-external-picker', async () => {
    return await openExternalPicker();
  });

  // DIAGNOSTICA (temporanea): verifica se il file dell'owner è accessibile PER ID
  // col grant drive.file ottenuto via Picker sulla cartella. Prerequisito dell'opzione B.
  ipcMain.handle('drive-get-file-meta', async (event: any, fileId: string) => {
    if (!loadSavedTokens()) throw new Error("Autenticazione Google Drive non effettuata.");
    const res = await driveState.drive.files.get({
      fileId,
      fields: 'id, name, parents, modifiedTime, owners(emailAddress)',
      supportsAllDrives: true
    });
    return res.data;
  });
}

module.exports = { setupDriveIpc };
export {};
