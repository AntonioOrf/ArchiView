import * as fs from 'fs';
import { pipeline } from 'stream/promises';
import { driveState } from './auth';

const escapeDriveQuery = (str: string) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const STATI_TRANSITORI = new Set([429, 500, 502, 503, 504, 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']);
const MOTIVI_RATE_LIMIT = new Set(['rateLimitExceeded', 'userRateLimitExceeded']);

function riprovabile(e: any): boolean {
  const status = e?.response?.status ?? e?.code;
  if (STATI_TRANSITORI.has(status)) return true;
  const motivi = e?.response?.data?.error?.errors || [];
  return status === 403 && motivi.some((m: any) => MOTIVI_RATE_LIMIT.has(m?.reason));
}

async function withDriveRetry(fn: () => Promise<any>, maxRetries = 3, attesaBaseMs = 1000): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      if (!riprovabile(e) || attempt >= maxRetries) throw e;
      const retryAfter = Number(e?.response?.headers?.['retry-after']) * 1000;
      const backoff = attesaBaseMs * 2 ** attempt * (0.5 + Math.random());
      await new Promise(r => setTimeout(r, Number.isFinite(retryAfter) ? Math.max(retryAfter, backoff) : backoff));
    }
  }
}

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

module.exports = {
  escapeDriveQuery, withDriveRetry, getOrCreateFolder, asyncPool,
  uploadFile: (localPath: string, nome: string, parentId: string, skipIfExist = false) =>
    withDriveRetry(() => uploadFile(localPath, nome, parentId, skipIfExist)),
  uploadFileReturningId: (localPath: string, nome: string, parentId: string) =>
    withDriveRetry(() => uploadFileReturningId(localPath, nome, parentId)),
  makeFilePublic: (fileId: string) => withDriveRetry(() => makeFilePublic(fileId)),
  downloadFile: (fileId: string, destPath: string) => withDriveRetry(() => downloadFile(fileId, destPath))
};
export {};
