const path = require('path');
const fs = require('fs');
const { state, getAllSettings, saveAllSettings, getActiveVaultFlags } = require('../../workspaceManager');
const { driveState, loadSavedTokens, authenticateDrive } = require('./auth');
const { getOrCreateFolder, uploadFile } = require('./fileOps');

async function withDriveRetry(fn: () => Promise<any>, maxRetries = 3): Promise<any> {
  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const status = e?.response?.status ?? e?.code;
      const retryable = status === 429 || status === 500 || status === 503 || status === 'ECONNRESET' || status === 'ETIMEDOUT';
      if (!retryable || attempt === maxRetries) throw e;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('unreachable');
}

async function listVaultsFromDrive(): Promise<any[]> {
  await authenticateDrive();
  const rootFolderId = await getOrCreateFolder('ArchiView');
  const q = `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await driveState.drive.files.list({ q, spaces: 'drive', fields: 'files(id, name, modifiedTime)' });
  return res.data.files || [];
}

async function checkUpdatesFromDrive(vaultFolderId: string | null = null): Promise<number | null> {
  if (!loadSavedTokens()) return null;
  let driveModifiedTime: number | null = null;
  let actualVaultFolderId = vaultFolderId;

  if (!actualVaultFolderId && state.workspacePath) {
    try {
      const s = getActiveVaultFlags();
      if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) actualVaultFolderId = s.sharedVaultId;
    } catch (e) { console.error("Errore lettura settings:", e); }
  }

  if (actualVaultFolderId) {
    const res = await driveState.drive.files.list({
      q: `name='database_manoscritti.json' and '${actualVaultFolderId}' in parents and trashed=false`,
      fields: 'files(id, modifiedTime)',
      orderBy: 'modifiedTime desc',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });
    if (res.data.files.length > 0) driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
  } else if (state.workspacePath) {
    return null;
  }

  if (!driveModifiedTime) {
    let res = await driveState.drive.files.list({
      q: `name='database_manoscritti.json' and trashed=false`,
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
      fields: 'files(id, modifiedTime)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });
    if (res.data.files.length === 0) {
      res = await driveState.drive.files.list({
        q: `name='database_manoscritti.json' and trashed=false and sharedWithMe=true`,
        spaces: 'drive',
        orderBy: 'modifiedTime desc',
        fields: 'files(id, modifiedTime)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });
    }
    if (res.data.files.length > 0) driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
  }

  return driveModifiedTime;
}

async function pullFromDrive(vaultFolderId: string | null = null): Promise<any | null> {
  if (!loadSavedTokens()) {
    throw new Error("Autenticazione Google Drive non effettuata. Apri il menu Cloud ed effettua l'accesso.");
  }
  let fileId: string | null = null;
  let driveModifiedTime: number | null = null;
  let actualVaultFolderId = vaultFolderId;

  if (!actualVaultFolderId && state.workspacePath) {
    try {
      const s = getActiveVaultFlags();
      if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) actualVaultFolderId = s.sharedVaultId;
    } catch (e) { console.error("Errore lettura settings:", e); }
  }

  let lastModifyingUser: any = null;

  if (actualVaultFolderId) {
    const res = await withDriveRetry(() => driveState.drive.files.list({
      q: `name='database_manoscritti.json' and '${actualVaultFolderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, modifiedTime, parents, lastModifyingUser)',
      orderBy: 'modifiedTime desc',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    }));
    if (res.data.files.length > 0) {
      fileId = res.data.files[0].id;
      driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
      lastModifyingUser = res.data.files[0].lastModifyingUser;
      if (!actualVaultFolderId && res.data.files[0].parents) actualVaultFolderId = res.data.files[0].parents[0];
    }
  } else if (state.workspacePath) {
    return null;
  }

  if (!fileId && !state.workspacePath) {
    let res = await withDriveRetry(() => driveState.drive.files.list({
      q: `name='database_manoscritti.json' and trashed=false`,
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
      fields: 'files(id, modifiedTime, parents, lastModifyingUser)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    }));
    if (res.data.files.length === 0) {
      res = await withDriveRetry(() => driveState.drive.files.list({
        q: `name='database_manoscritti.json' and trashed=false and sharedWithMe=true`,
        spaces: 'drive',
        orderBy: 'modifiedTime desc',
        fields: 'files(id, modifiedTime, parents, lastModifyingUser)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      }));
    }
    if (res.data.files.length > 0) {
      fileId = res.data.files[0].id;
      driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
      lastModifyingUser = res.data.files[0].lastModifyingUser;
      if (!actualVaultFolderId && res.data.files[0].parents) actualVaultFolderId = res.data.files[0].parents[0];
    }
  }

  if (!fileId) return null;

  const driveRes = await driveState.drive.files.get({ fileId, alt: 'media', supportsAllDrives: true });

  let parsedDb = driveRes.data;
  if (typeof parsedDb === 'string') {
    try { parsedDb = JSON.parse(parsedDb); } catch (e) { console.error("Errore parse JSON db da Drive:", e); }
  }

  return { database: parsedDb, driveModifiedTime, lastModifyingUser };
}

async function syncToDrive(parentModifiedTime: number | null = null): Promise<number> {
  if (!state.workspacePath) throw new Error("Nessun workspace aperto");
  if (!loadSavedTokens()) {
    throw new Error("Autenticazione Google Drive non effettuata. Apri il menu Cloud ed effettua l'accesso.");
  }

  let projectFolderId: string | null = null;
  try {
    const s = getActiveVaultFlags();
    if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) projectFolderId = s.sharedVaultId;
  } catch (e) { console.error("Errore lettura settings:", e); }

  if (!projectFolderId) {
    const rootFolderId = await getOrCreateFolder('ArchiView');
    const folder = await driveState.drive.files.create({
      requestBody: {
        name: path.basename(state.workspacePath) + '_ArchiView',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId]
      },
      fields: 'id'
    });
    projectFolderId = folder.data.id;
    try {
      const s = getActiveVaultFlags();
      s.sharedVaultId = projectFolderId;
      if (!s.isSharedVault) s.isPersonalCloud = true;
      saveAllSettings(s);
    } catch (e) { console.error("Errore salvataggio sharedVaultId:", e); }
  }

  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  if (!fs.existsSync(dbPath)) return Date.now();

  if (parentModifiedTime) {
    const res = await driveState.drive.files.list({
      q: `name='database_manoscritti.json' and '${projectFolderId}' in parents and trashed=false`,
      fields: 'files(id, modifiedTime)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });
    if (res.data.files.length > 0) {
      const currentModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
      if (currentModifiedTime > parentModifiedTime + 1000) {
        throw new Error("409_CONFLICT: Un altro utente ha salvato modifiche più recenti sul Cloud. E' necessario prima ricevere gli aggiornamenti.");
      }
    }
  }

  const newDbTime = await uploadFile(dbPath, 'database_manoscritti.json', projectFolderId);
  return newDbTime || Date.now();
}

async function cleanOrphanedAttachments(): Promise<{ deletedLocal: number; deletedDrive: number }> {
  if (!state.workspacePath) throw new Error("Nessun workspace aperto");
  if (!loadSavedTokens()) throw new Error("Autenticazione Google Drive non effettuata.");

  let projectFolderId: string | null = null;
  try {
    const s = getActiveVaultFlags();
    if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) projectFolderId = s.sharedVaultId;
  } catch (e) { console.error("Errore lettura settings:", e); }

  if (!projectFolderId) {
    const rootFolderId = await getOrCreateFolder('ArchiView');
    projectFolderId = await getOrCreateFolder(path.basename(state.workspacePath) + '_ArchiView', rootFolderId);
  }

  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  if (!fs.existsSync(dbPath)) return { deletedLocal: 0, deletedDrive: 0 };

  const db = JSON.parse(await fs.promises.readFile(dbPath, 'utf8'));
  const usedAttachments = new Set<string>();
  if (db.manoscritti) {
    for (const m of db.manoscritti) {
      if (m.allegati) { for (const a of m.allegati) { if (a.nome) usedAttachments.add(a.nome); } }
    }
  }

  let deletedLocal = 0;
  let deletedDrive = 0;

  const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
  if (fs.existsSync(allegatiLocalDir)) {
    for (const file of fs.readdirSync(allegatiLocalDir)) {
      if (!usedAttachments.has(file)) {
        try { fs.unlinkSync(path.join(allegatiLocalDir, file)); deletedLocal++; } catch (e) { console.error("Errore eliminazione locale:", e); }
      }
    }
  }

  try {
    // La struttura su Drive usa index.json + data/ (chunk content-addressable), non allegati_manoscritti
    const indexRes = await driveState.drive.files.list({
      q: `name='index.json' and '${projectFolderId}' in parents and trashed=false`,
      fields: 'files(id)'
    });
    if (indexRes.data.files && indexRes.data.files.length > 0) {
      const indexFileId = indexRes.data.files[0].id;
      const indexContent = await driveState.drive.files.get({ fileId: indexFileId, alt: 'media' });
      let remoteIndex: any = typeof indexContent.data === 'string' ? JSON.parse(indexContent.data) : indexContent.data;

      // Rimuove dall'indice le entry di file non più referenziati
      const orphanedFileNames = Object.keys(remoteIndex).filter(name => !usedAttachments.has(name));
      if (orphanedFileNames.length > 0) {
        // Raccoglie gli hash ancora in uso dopo la rimozione degli orfani
        const usedHashes = new Set<string>();
        for (const name of Object.keys(remoteIndex)) {
          if (usedAttachments.has(name)) {
            for (const h of remoteIndex[name]) usedHashes.add(h);
          }
        }
        for (const name of orphanedFileNames) delete remoteIndex[name];

        // Cancella chunk su Drive che non servono più
        const dataFolderRes = await withDriveRetry(() => driveState.drive.files.list({
          q: `name='data' and '${projectFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)'
        }));
        if (dataFolderRes.data.files && dataFolderRes.data.files.length > 0) {
          const dataFolderId = dataFolderRes.data.files[0].id;
          let pageToken: string | undefined;
          const MAX_PAGES = 100;
          let pages = 0;
          do {
            const chunksRes = await withDriveRetry(() => driveState.drive.files.list({
              q: `'${dataFolderId}' in parents and trashed=false`,
              fields: 'nextPageToken, files(id, name)',
              pageSize: 1000,
              pageToken
            }));
            for (const f of (chunksRes.data.files || [])) {
              if (!usedHashes.has(f.name)) {
                try { await driveState.drive.files.update({ fileId: f.id, requestBody: { trashed: true } }); deletedDrive++; } catch (e) { console.error("Errore eliminazione chunk Drive:", e); }
              }
            }
            pageToken = chunksRes.data.nextPageToken;
            pages++;
          } while (pageToken && pages < MAX_PAGES);
        }

        // Aggiorna index.json su Drive senza le entry orfane
        const { uploadFile } = require('./fileOps');
        const cacheDir = path.join(state.workspacePath, '.archiview-chunks');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        const localIndexPath = path.join(cacheDir, 'index.json');
        fs.writeFileSync(localIndexPath, JSON.stringify(remoteIndex, null, 2));
        await uploadFile(localIndexPath, 'index.json', projectFolderId, false);
        try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch (e) { /* non bloccante */ }
      }
    }
  } catch (e) { console.error("Errore durante pulizia Drive:", e); }

  return { deletedLocal, deletedDrive };
}

module.exports = { listVaultsFromDrive, checkUpdatesFromDrive, pullFromDrive, syncToDrive, cleanOrphanedAttachments };
export {};
