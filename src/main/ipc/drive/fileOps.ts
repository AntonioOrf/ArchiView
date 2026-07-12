const fs = require('fs');
const { pipeline } = require('stream/promises');
const { driveState } = require('./auth');

// --- Drive Query Helpers ---

const escapeDriveQuery = (str: string) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function getOrCreateFolder(folderName: string, parentId: string | null = null): Promise<string> {
  let q = `name='${escapeDriveQuery(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  let res = await driveState.drive.files.list({
    q,
    fields: 'files(id, name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  if (res.data.files.length === 0 && !parentId) {
    const qShared = `name='${escapeDriveQuery(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false and sharedWithMe=true`;
    const resShared = await driveState.drive.files.list({
      q: qShared,
      spaces: 'drive',
      fields: 'files(id, name)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });
    if (resShared.data.files.length > 0) return resShared.data.files[0].id;
  }

  if (res.data.files.length > 0) return res.data.files[0].id;

  const folder = await driveState.drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    },
    fields: 'id'
  });
  return folder.data.id;
}

async function uploadFile(localPath: string, driveFileName: string, parentId: string, skipIfExist = false): Promise<number | undefined> {
  const mimeType = driveFileName.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  const q = `name='${escapeDriveQuery(driveFileName)}' and '${parentId}' in parents and trashed=false`;
  const res = await driveState.drive.files.list({
    q,
    fields: 'files(id, modifiedTime)',
    orderBy: 'modifiedTime desc',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  const files = res.data.files || [];
  if (files.length > 0) {
    if (skipIfExist) return;
    // Dedup: Drive consente più file omonimi nella stessa cartella. Se esistono duplicati,
    // aggiorna il più recente (files[0], orderBy modifiedTime desc) ed elimina gli altri,
    // altrimenti pull/push finiscono su file diversi → i dati "non si sincronizzano".
    if (files.length > 1) {
      for (let i = 1; i < files.length; i++) {
        try {
          await driveState.drive.files.delete({ fileId: files[i].id, supportsAllDrives: true });
        } catch (e: any) {
          console.warn("Impossibile eliminare duplicato Drive:", files[i].id, e.message);
        }
      }
    }
    const updateRes = await driveState.drive.files.update({
      fileId: files[0].id,
      media: { mimeType, body: fs.createReadStream(localPath) },
      fields: 'id, modifiedTime',
      supportsAllDrives: true
    });
    return new Date(updateRes.data.modifiedTime).getTime();
  } else {
    const createRes = await driveState.drive.files.create({
      requestBody: { name: driveFileName, parents: [parentId] },
      media: { mimeType, body: fs.createReadStream(localPath) },
      fields: 'id, modifiedTime',
      supportsAllDrives: true
    });
    return new Date(createRes.data.modifiedTime).getTime();
  }
}

// Come uploadFile ma ritorna l'id Drive del file (serve agli allegati hub per costruire il link pubblico).
// Nessuna dedup per-nome: i chunk hanno nome = hash (content-addressable), il chiamante fa lo skip a monte.
async function uploadFileReturningId(localPath: string, driveFileName: string, parentId: string): Promise<string> {
  const mimeType = driveFileName.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  const createRes = await driveState.drive.files.create({
    requestBody: { name: driveFileName, parents: [parentId] },
    media: { mimeType, body: fs.createReadStream(localPath) },
    fields: 'id',
    supportsAllDrives: true
  });
  return createRes.data.id;
}

// Rende un file scaricabile da chiunque abbia il link (reader) e ritorna l'id (idempotente).
async function makeFilePublic(fileId: string): Promise<void> {
  await driveState.drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true
  });
}

async function asyncPool(poolLimit: number, array: any[], iteratorFn: Function): Promise<any[]> {
  const ret: Promise<any>[] = [];
  const executing = new Set<Promise<void>>();
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e: Promise<void> = p.then(() => { executing.delete(e); });
      executing.add(e);
      if (executing.size >= poolLimit) await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

async function downloadFile(fileId: string, destPath: string): Promise<void> {
  const res = await driveState.drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
  const dest = fs.createWriteStream(destPath);
  await pipeline(res.data, dest);
}

module.exports = { escapeDriveQuery, getOrCreateFolder, uploadFile, uploadFileReturningId, makeFilePublic, asyncPool, downloadFile };
export {};
