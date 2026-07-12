const path = require('path');
const fs = require('fs');
const { state, getActiveVaultFlags } = require('../../workspaceManager');
const { driveState, loadSavedTokens, initGoogle } = require('./auth');
const { uploadFile } = require('./fileOps');

async function getDbFileId(): Promise<string> {
  let projectFolderId: string | null = null;
  try {
    const s = getActiveVaultFlags();
    if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) projectFolderId = s.sharedVaultId;
  } catch (e) { console.error("Errore lettura settings:", e); }

  if (!projectFolderId) {
    throw new Error("Vault non collegato al Cloud. Sincronizza almeno una volta prima di vedere lo storico.");
  }

  let res;
  try {
    res = await driveState.drive.files.list({
      q: `name='database_manoscritti.json' and '${projectFolderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id)'
    });
  } catch (e: any) {
    const status = e.code || e.status || (e.response && e.response.status);
    const msg = (e.message || '').toLowerCase();
    if (status === 404 || msg.includes('file not found')) {
      throw new Error("La cartella condivisa non è accessibile con questo account Google (permesso non esteso ai file interni) oppure è stata eliminata. Riapri il vault dal Picker o richiedi un nuovo invito.");
    }
    if (status === 403 || msg.includes('forbidden') || msg.includes('insufficient')) {
      throw new Error("Questo account Google non è autorizzato ad accedere all'archivio condiviso.");
    }
    throw new Error("Impossibile recuperare lo storico: " + e.message);
  }
  if (!res.data.files || res.data.files.length === 0) {
    throw new Error("File database non trovato su Google Drive. Carica almeno una volta.");
  }
  return res.data.files[0].id;
}

async function listDriveRevisions(fileId: string): Promise<any[]> {
  if (!loadSavedTokens()) throw new Error("Autenticazione Google Drive non effettuata.");
  try {
    const res = await driveState.drive.revisions.list({
      fileId,
      fields: 'revisions(id, modifiedTime, lastModifyingUser, size, keepForever)',
      pageSize: 1000
    });
    return (res.data.revisions || []).reverse();
  } catch (e: any) {
    throw new Error("Impossibile recuperare lo storico: " + e.message);
  }
}

async function getDriveRevision(fileId: string, revisionId: string): Promise<any> {
  if (!loadSavedTokens()) throw new Error("Autenticazione Google Drive non effettuata.");
  try {
    const res = await driveState.drive.revisions.get({ fileId, revisionId, alt: 'media' });
    let data = res.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { console.error("Errore parse revisione Drive:", e); }
    }
    return data;
  } catch (e: any) {
    throw new Error("Impossibile scaricare la revisione: " + e.message);
  }
}

async function restoreRevision(fileId: string, revisionId: string): Promise<boolean> {
  const revData = await getDriveRevision(fileId, revisionId);
  if (!revData) throw new Error("Revisione non trovata.");
  if (!state.workspacePath) throw new Error("Nessun workspace aperto.");

  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  fs.writeFileSync(dbPath, typeof revData === 'string' ? revData : JSON.stringify(revData, null, 2), 'utf8');

  let projectFolderId: string | null = null;
  try {
    const s = getActiveVaultFlags();
    if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) projectFolderId = s.sharedVaultId;
  } catch (e) { console.error("Errore lettura settings:", e); }
  if (projectFolderId) await uploadFile(dbPath, 'database_manoscritti.json', projectFolderId);

  return true;
}

module.exports = { getDbFileId, listDriveRevisions, getDriveRevision, restoreRevision };
export {};
