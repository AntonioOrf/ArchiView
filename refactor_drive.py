import os

file_path = "src/main/ipc/driveSync.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Rimuovere logic allegati da pullFromDrive
pull_start_marker = "    // Scarica allegati con Chunking"
pull_end_marker = "    let parsedDb = driveRes.data;"

if pull_start_marker in content and pull_end_marker in content:
    start_idx = content.find(pull_start_marker)
    end_idx = content.find(pull_end_marker)
    content = content[:start_idx] + content[end_idx:]

# 2. Rimuovere logic allegati da syncToDrive
sync_start_marker = "  // Sincronizzazione allegati con Chunking"
sync_end_marker = "  return finalModifiedTime || Date.now();\n}"

if sync_start_marker in content and sync_end_marker in content:
    start_idx = content.find(sync_start_marker)
    end_idx = content.find(sync_end_marker)
    content = content[:start_idx] + content[end_idx:]

# 3. Aggiungere la funzione syncAttachmentsBidirectional
new_function = """
async function syncAttachmentsBidirectional() {
  if (!state.workspacePath) throw new Error("Nessun workspace aperto");
  if (!loadSavedTokens()) {
    throw new Error("Autenticazione Google Drive non effettuata.");
  }

  let projectFolderId;
  try {
      const s = getAllSettings();
      if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) {
          projectFolderId = s.sharedVaultId;
      }
      if (!s.syncAttachments) return;
  } catch(e) {}
  
  if (!projectFolderId) return; // Non sincronizzato

  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
  const cacheDir = path.join(state.workspacePath, '.archiview-chunks');
  
  if (!fs.existsSync(allegatiLocalDir)) fs.mkdirSync(allegatiLocalDir, { recursive: true });
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const usedAttachments = new Set();
  try {
      if (fs.existsSync(dbPath)) {
          const dbData = await fs.promises.readFile(dbPath, 'utf8');
          const db = JSON.parse(dbData);
          if (db.manoscritti) {
              for (const m of db.manoscritti) {
                  if (m.allegati) {
                      for (const a of m.allegati) {
                          if (a.nome) usedAttachments.add(a.nome);
                      }
                  }
              }
          }
      }
  } catch (e) {
      console.error("Errore lettura db per filtro upload allegati:", e);
      return;
  }

  const dataFolderId = await getOrCreateFolder('data', projectFolderId);

  // Scarica o Inizializza index.json per poterlo aggiornare
  let remoteIndex: any = {};
  let indexFileId = null;
  const qIndex = `name='index.json' and '${projectFolderId}' in parents and trashed=false`;
  const indexRes = await drive.files.list({ q: qIndex, fields: 'files(id)' });
  if (indexRes.data.files && indexRes.data.files.length > 0) {
      indexFileId = indexRes.data.files[0].id;
      const indexContent = await drive.files.get({ fileId: indexFileId, alt: 'media' });
      if (typeof indexContent.data === 'string') {
          remoteIndex = JSON.parse(indexContent.data);
      } else {
          remoteIndex = indexContent.data;
      }
  }

  const allFiles = fs.readdirSync(allegatiLocalDir);
  const filesToUpload = allFiles.filter(f => usedAttachments.has(f));
  const allRequiredHashes = new Set();
  let indexChanged = false;

  // UPLOAD PREPARATION
  for (const file of filesToUpload) {
      const filePath = path.join(allegatiLocalDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
          const hashes = await splitFileIntoChunks(filePath, cacheDir);
          const currentHashes = remoteIndex[file];
          if (!currentHashes || JSON.stringify(currentHashes) !== JSON.stringify(hashes)) {
              remoteIndex[file] = hashes;
              indexChanged = true;
          }
          hashes.forEach((h: string) => allRequiredHashes.add(h));
      }
  }

  // DOWNLOAD PREPARATION
  const chunksToDownload = new Set();
  const filesToReassemble: any[] = [];
  for (const fileName of Array.from(usedAttachments)) {
      const localPath = path.join(allegatiLocalDir, fileName as string);
      if (!fs.existsSync(localPath) && remoteIndex[fileName as string]) {
          const hashes = remoteIndex[fileName as string];
          filesToReassemble.push({ fileName, hashes });
          hashes.forEach((h: string) => {
              if (!fs.existsSync(path.join(cacheDir, h))) chunksToDownload.add(h);
          });
      }
  }

  // FETCH REMOTE CHUNKS INFO
  const existingDriveChunks = new Set();
  const chunkIdsToDownload: any[] = [];
  
  if (chunksToDownload.size > 0 || allRequiredHashes.size > 0) {
      let pageToken = undefined;
      do {
          const resAll = await drive.files.list({ 
              q: `'${dataFolderId}' in parents and trashed=false`, 
              pageSize: 1000, 
              fields: 'nextPageToken, files(id, name)',
              pageToken: pageToken
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

  // DOWNLOAD CHUNKS
  let iDown = 0;
  const totalDown = chunkIdsToDownload.length;
  await asyncPool(5, chunkIdsToDownload, async (f: any) => {
      iDown++;
      if (win) win.webContents.send('sync-progress', { percent: (iDown / totalDown) * 100, message: `Scaricamento blocco allegati ${iDown} di ${totalDown}` });
      const localPath = path.join(cacheDir, f.name);
      await downloadFile(f.id, localPath);
  });

  // REASSEMBLE
  for (const item of filesToReassemble) {
      const destPath = path.join(allegatiLocalDir, item.fileName);
      await assembleFileFromChunks(item.hashes, cacheDir, destPath);
      if (win) win.webContents.send('allegato-scaricato', item.fileName);
  }

  // UPLOAD CHUNKS
  const chunksToUpload = Array.from(allRequiredHashes).filter(h => !existingDriveChunks.has(h));
  let iUp = 0;
  const totalUp = chunksToUpload.length;
  await asyncPool(5, chunksToUpload, async (hash) => {
      iUp++;
      const filePath = path.join(cacheDir, hash as string);
      if (fs.existsSync(filePath)) {
          if (win) win.webContents.send('sync-progress', { percent: (iUp / totalUp) * 100, message: `Caricamento blocco allegati ${iUp} di ${totalUp}` });
          await uploadFile(filePath, hash as string, dataFolderId, true);
      }
  });

  // UPDATE REMOTE INDEX
  if (indexChanged) {
      if (indexFileId) {
          try {
              const latestIndexContent = await drive.files.get({ fileId: indexFileId, alt: 'media' });
              let latestRemoteIndex: any = {};
              if (typeof latestIndexContent.data === 'string') {
                  latestRemoteIndex = JSON.parse(latestIndexContent.data);
              } else {
                  latestRemoteIndex = latestIndexContent.data;
              }
              remoteIndex = { ...latestRemoteIndex, ...remoteIndex };
          } catch (e) {
              console.warn("Errore durante il refetch di index.json:", e);
          }
      }

      const localIndexPath = path.join(cacheDir, 'index.json');
      fs.writeFileSync(localIndexPath, JSON.stringify(remoteIndex, null, 2));
      await uploadFile(localIndexPath, 'index.json', projectFolderId, false);
  }

  // PULIZIA CACHE
  if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
}
"""

if "async function syncAttachmentsBidirectional" not in content:
    content += new_function

# 4. Aggiungere il nuovo handler in setupDriveIpc
handler_marker = "ipcMain.handle('drive-sync', async (event, parentModifiedTime) => {"
new_handler = """  ipcMain.handle('drive-sync-attachments', async () => {
    return await syncAttachmentsBidirectional();
  });
"""

if "ipcMain.handle('drive-sync-attachments'" not in content:
    content = content.replace(handler_marker, new_handler + handler_marker)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated driveSync.ts")
