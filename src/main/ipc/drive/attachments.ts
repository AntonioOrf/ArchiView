const path = require('path');
const fs = require('fs');
const { state, getAllSettings, getActiveVaultFlags } = require('../../workspaceManager');
const { splitFileIntoChunks, assembleFileFromChunks } = require('../../chunkingLogic');
const { driveState, loadSavedTokens } = require('./auth');
const { getOrCreateFolder, uploadFile, downloadFile, asyncPool } = require('./fileOps');

async function syncAttachmentsBidirectional(): Promise<void> {
  if (!state.workspacePath) throw new Error("Nessun workspace aperto");
  if (!loadSavedTokens()) throw new Error("Autenticazione Google Drive non effettuata.");

  let projectFolderId: string | null = null;
  try {
    const s = { ...getAllSettings(), ...getActiveVaultFlags() };
    if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) projectFolderId = s.sharedVaultId;
    if (!s.syncAttachments) return;
  } catch (e) { console.error("Errore lettura settings:", e); }

  if (!projectFolderId) return;

  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
  const cacheDir = path.join(state.workspacePath, '.archiview-chunks');
  // cacheDir viene sempre pulita in finally, anche in caso di errore

  if (!fs.existsSync(allegatiLocalDir)) fs.mkdirSync(allegatiLocalDir, { recursive: true });
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  try {
  const usedAttachments = new Set<string>();
  try {
    if (fs.existsSync(dbPath)) {
      const db = JSON.parse(await fs.promises.readFile(dbPath, 'utf8'));
      if (db.manoscritti) {
        for (const m of db.manoscritti) {
          if (m.allegati) { for (const a of m.allegati) { if (a.nome) usedAttachments.add(a.nome); } }
        }
      }
    }
  } catch (e) {
    console.error("Errore lettura db per filtro upload allegati:", e);
    return;
  }

  const dataFolderId = await getOrCreateFolder('data', projectFolderId);

  let remoteIndex: any = {};
  let indexFileId: string | null = null;
  const indexRes = await driveState.drive.files.list({
    q: `name='index.json' and '${projectFolderId}' in parents and trashed=false`,
    fields: 'files(id)'
  });
  if (indexRes.data.files && indexRes.data.files.length > 0) {
    indexFileId = indexRes.data.files[0].id;
    const indexContent = await driveState.drive.files.get({ fileId: indexFileId, alt: 'media' });
    remoteIndex = typeof indexContent.data === 'string' ? JSON.parse(indexContent.data) : indexContent.data;
  }

  const filesToUpload = fs.readdirSync(allegatiLocalDir).filter((f: string) => usedAttachments.has(f));
  const allRequiredHashes = new Set<string>();
  let indexChanged = false;

  for (const file of filesToUpload) {
    const filePath = path.join(allegatiLocalDir, file);
    if (fs.statSync(filePath).isFile()) {
      const hashes = await splitFileIntoChunks(filePath, cacheDir);
      const currentHashes = remoteIndex[file];
      if (!currentHashes || JSON.stringify(currentHashes) !== JSON.stringify(hashes)) {
        remoteIndex[file] = hashes;
        indexChanged = true;
      }
      hashes.forEach((h: string) => allRequiredHashes.add(h));
    }
  }

  const chunksToDownload = new Set<string>();
  const filesToReassemble: any[] = [];
  for (const fileName of usedAttachments) {
    const localPath = path.join(allegatiLocalDir, fileName);
    if (!fs.existsSync(localPath) && remoteIndex[fileName]) {
      const hashes = remoteIndex[fileName];
      filesToReassemble.push({ fileName, hashes });
      hashes.forEach((h: string) => {
        if (!fs.existsSync(path.join(cacheDir, h))) chunksToDownload.add(h);
      });
    }
  }

  const existingDriveChunks = new Set<string>();
  const chunkIdsToDownload: any[] = [];

  if (chunksToDownload.size > 0 || allRequiredHashes.size > 0) {
    let pageToken: string | undefined = undefined;
    do {
      const resAll = await driveState.drive.files.list({
        q: `'${dataFolderId}' in parents and trashed=false`,
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name)',
        pageToken
      });
      if (resAll.data.files) {
        resAll.data.files.forEach((f: any) => {
          existingDriveChunks.add(f.name);
          if (chunksToDownload.has(f.name)) chunkIdsToDownload.push(f);
        });
      }
      pageToken = resAll.data.nextPageToken;
    } while (pageToken);
  }

  const win = require('electron').BrowserWindow.getAllWindows()[0];

  let iDown = 0;
  const totalDown = chunkIdsToDownload.length;
  await asyncPool(5, chunkIdsToDownload, async (f: any) => {
    iDown++;
    if (win && (iDown % 5 === 0 || iDown === totalDown)) {
      win.webContents.send('sync-progress', { percent: (iDown / totalDown) * 100, message: `Scaricamento blocco allegati ${iDown} di ${totalDown}` });
    }
    await downloadFile(f.id, path.join(cacheDir, f.name));
  });

  for (const item of filesToReassemble) {
    await assembleFileFromChunks(item.hashes, cacheDir, path.join(allegatiLocalDir, item.fileName));
    if (win) win.webContents.send('allegato-scaricato', item.fileName);
  }

  const chunksToUpload = Array.from(allRequiredHashes).filter((h: string) => !existingDriveChunks.has(h));
  let iUp = 0;
  const totalUp = chunksToUpload.length;
  await asyncPool(5, chunksToUpload, async (hash: string) => {
    iUp++;
    const filePath = path.join(cacheDir, hash);
    if (fs.existsSync(filePath)) {
      if (win && (iUp % 5 === 0 || iUp === totalUp)) {
        win.webContents.send('sync-progress', { percent: (iUp / totalUp) * 100, message: `Caricamento blocco allegati ${iUp} di ${totalUp}` });
      }
      await uploadFile(filePath, hash, dataFolderId, true);
    }
  });

  if (indexChanged) {
    if (indexFileId) {
      try {
        const latestContent = await driveState.drive.files.get({ fileId: indexFileId, alt: 'media' });
        const latestRemoteIndex = typeof latestContent.data === 'string' ? JSON.parse(latestContent.data) : latestContent.data;
        remoteIndex = { ...latestRemoteIndex, ...remoteIndex };
      } catch (e) { console.warn("Errore durante il refetch di index.json:", e); }
    }
    const localIndexPath = path.join(cacheDir, 'index.json');
    fs.writeFileSync(localIndexPath, JSON.stringify(remoteIndex, null, 2));
    await uploadFile(localIndexPath, 'index.json', projectFolderId, false);
  }

  } finally {
    if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

module.exports = { syncAttachmentsBidirectional };
export {};
