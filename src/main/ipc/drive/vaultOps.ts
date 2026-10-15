import * as path from 'path';
import * as fs from 'fs';
import { state, getAllSettings, saveAllSettings, getActiveVaultFlags } from '../../workspaceManager';
import { driveState, loadSavedTokens, authenticateDrive, classifyDriveFolderError, ERR_VAULT_FORBIDDEN, ERR_VAULT_NOTFOUND } from './auth';
const { getOrCreateFolder, uploadFile, withDriveRetry } = require('./fileOps');

// Verifica che la cartella del vault sia raggiungibile con l'account attualmente autenticato.
// Senza questo probe una cartella inaccessibile produce solo una files.list vuota, indistinguibile
// da "nessun database ancora caricato".
async function assertVaultFolderAccessible(vaultFolderId: string): Promise<void> {
  try {
    await driveState.drive.files.get({ fileId: vaultFolderId, fields: 'id', supportsAllDrives: true });
  } catch (err: any) {
    const kind = classifyDriveFolderError(err);
    if (kind === 'forbidden') throw new Error(ERR_VAULT_FORBIDDEN);
    if (kind === 'notfound') throw new Error(ERR_VAULT_NOTFOUND);
    throw err;
  }
}

// true se il vault è già dichiarato cloud (shared o backup personale).
function isCloudVault(s: any): boolean {
  return !!(s && (s.isSharedVault || s.isPersonalCloud));
}

async function listVaultsFromDrive(): Promise<any[]> {
  await authenticateDrive();
  const rootFolderId = await getOrCreateFolder('ArchiView');
  const q = `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await driveState.drive.files.list({ q, spaces: 'drive', fields: 'files(id, name, modifiedTime)' });
  return res.data.files || [];
}

// Cartella Drive del vault aperto (cloud), o null.
function cartellaVaultAttivo(): string | null {
  try {
    const s = getActiveVaultFlags();
    return (s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId ? s.sharedVaultId : null;
  } catch (e) { console.error("Errore lettura settings:", e); return null; }
}

/**
 * Il database_manoscritti.json più recente (Drive ammette omonimi): nella cartella data, e
 * SOLO senza archivio aperto (primo ingresso) fra tutti i propri e poi i condivisi. Con un
 * archivio aperto, il database di un altro vault non è mai una risposta valida.
 */
async function trovaDbDrive(cartella: string | null): Promise<any | null> {
  const cerca = (q: string) => withDriveRetry(() => driveState.drive.files.list({
    q, spaces: 'drive', orderBy: 'modifiedTime desc',
    fields: 'files(id, modifiedTime, parents, lastModifyingUser)',
    includeItemsFromAllDrives: true, supportsAllDrives: true
  })).then((r: any) => (r.data.files || [])[0] || null);
  const nome = `name='database_manoscritti.json' and trashed=false`;
  const trovato = cartella ? await cerca(`${nome} and '${cartella}' in parents`) : null;
  if (trovato || state.workspacePath) return trovato;
  return (await cerca(nome)) || cerca(`${nome} and sharedWithMe=true`);
}

async function checkUpdatesFromDrive(vaultFolderId: string | null = null): Promise<number | null> {
  if (!loadSavedTokens()) return null;
  const cartella = vaultFolderId || (state.workspacePath ? cartellaVaultAttivo() : null);
  if (!cartella && state.workspacePath) return null;
  const file = await trovaDbDrive(cartella);
  return file ? new Date(file.modifiedTime).getTime() : null;
}

async function pullFromDrive(vaultFolderId: string | null = null): Promise<any | null> {
  if (!loadSavedTokens()) {
    throw new Error("Autenticazione Google Drive non effettuata. Apri il menu Cloud ed effettua l'accesso.");
  }
  const cartella = vaultFolderId || (state.workspacePath ? cartellaVaultAttivo() : null);
  // Archivio aperto senza cartella Drive: legittimo solo alla prima pubblicazione del vault.
  // Il renderer avvisa (pull vuoto) invece di annunciare una sincronizzazione riuscita.
  if (!cartella && state.workspacePath) return null;
  if (cartella) await assertVaultFolderAccessible(cartella);

  const file = await trovaDbDrive(cartella);
  if (!file) return null;
  const driveModifiedTime = new Date(file.modifiedTime).getTime();
  const lastModifyingUser = file.lastModifyingUser || null;

  const driveRes = await withDriveRetry(() => driveState.drive.files.get({ fileId: file.id, alt: 'media', supportsAllDrives: true }));

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
  let flags: any = {};
  try {
    flags = getActiveVaultFlags();
    if (isCloudVault(flags) && flags.sharedVaultId) projectFolderId = flags.sharedVaultId;
  } catch (e) { console.error("Errore lettura settings:", e); }

  if (!projectFolderId) {
    // getOrCreateFolder invece della files.create diretta: se la cartella con quel nome esiste già
    // sull'account (creata da un altro PC dello stesso utente) viene RIUSATA e non duplicata.
    // La create diretta faceva nascere una seconda cartella omonima e i due PC divergevano.
    const rootFolderId = await getOrCreateFolder('ArchiView');
    projectFolderId = await getOrCreateFolder(path.basename(state.workspacePath) + '_ArchiView', rootFolderId);
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
    projectFolderId = (await getOrCreateFolder(path.basename(state.workspacePath) + '_ArchiView', rootFolderId)) as string;
  }

  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  if (!fs.existsSync(dbPath)) return { deletedLocal: 0, deletedDrive: 0 };

  const db = JSON.parse(await fs.promises.readFile(dbPath, 'utf8'));
  const usedLocal = new Set<string>();
  // Il cestino non sta nel DB: senza le sue schede, ripristinarne una la riporterebbe senza file.
  const { elencaCestino } = require('../../trash');
  const cestinate = (await elencaCestino()).map((v: any) => v.record);
  for (const m of [...(db.manoscritti || []), ...cestinate]) {
    for (const a of m.allegati || []) { if (a.nome) usedLocal.add(a.nome); }
  }

  let deletedLocal = 0;
  let deletedDrive = 0;

  // Di proposito la cartella predefinita e non `state.attachmentsDirPath`: quella personalizzata
  // è un'impostazione globale, condivisa da tutti gli archivi, e qui si cancellerebbero i loro file.
  const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
  if (fs.existsSync(allegatiLocalDir)) {
    for (const file of fs.readdirSync(allegatiLocalDir)) {
      if (!usedLocal.has(file)) {
        try { fs.unlinkSync(path.join(allegatiLocalDir, file)); deletedLocal++; } catch (e) { console.error("Errore eliminazione locale:", e); }
      }
    }
  }

  try {
    // Su Drive è "in uso" anche ciò che usano i colleghi: senza un DB remoto leggibile non si tocca nulla.
    const remoto = await pullFromDrive(projectFolderId);
    if (!remoto || !Array.isArray(remoto.database?.manoscritti)) return { deletedLocal, deletedDrive };
    const usedAttachments = new Set<string>(usedLocal);
    for (const m of remoto.database.manoscritti) {
      for (const a of m.allegati || []) { if (a.nome) usedAttachments.add(a.nome); }
    }

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

        deletedDrive += await cestinaChunkInutili(projectFolderId, usedHashes);

        // Aggiorna index.json su Drive senza le entry orfane
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

/**
 * Cestina su Drive i chunk di `data/` che nessun allegato usa più. Restituisce quanti. Il cestino
 * di Drive e non la cancellazione: un errore di calcolo resta recuperabile per trenta giorni.
 */
async function cestinaChunkInutili(projectFolderId: string, usedHashes: Set<string>): Promise<number> {
  const dataFolderRes = await withDriveRetry(() => driveState.drive.files.list({
    q: `name='data' and '${projectFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)'
  }));
  if (!dataFolderRes.data.files || dataFolderRes.data.files.length === 0) return 0;

  const dataFolderId = dataFolderRes.data.files[0].id;
  const MAX_PAGES = 100;
  let cestinati = 0;
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const chunksRes = await withDriveRetry(() => driveState.drive.files.list({
      q: `'${dataFolderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 1000,
      pageToken
    }));
    for (const f of (chunksRes.data.files || [])) {
      if (usedHashes.has(f.name)) continue;
      try {
        // Invariante 7: anche questa passa da withDriveRetry (rimettere nel cestino è idempotente).
        await withDriveRetry(() => driveState.drive.files.update({ fileId: f.id, requestBody: { trashed: true } }));
        cestinati++;
      } catch (e) { console.error("Errore eliminazione chunk Drive:", e); }
    }
    pageToken = chunksRes.data.nextPageToken;
    pages++;
  } while (pageToken && pages < MAX_PAGES);
  return cestinati;
}

export { listVaultsFromDrive, checkUpdatesFromDrive, pullFromDrive, syncToDrive, cleanOrphanedAttachments };
