import { driveState } from '../ipc/drive/auth';
const { getOrCreateFolder, downloadFile, withDriveRetry, escapeDriveQuery } = require('../ipc/drive/fileOps');
const ScannerLotto = require('../../shared/scannerLotto');

const CARTELLA_RADICE = 'ArchiView';
const CARTELLA_ARRIVO = 'Scansioni in arrivo';
const CARTELLA_LOTTI = 'lotti';
const MIME_CARTELLA = 'application/vnd.google-apps.folder';

type FileDrive = { id: string; name: string; size?: string; parents?: string[]; mimeType?: string };

async function elencaTutti(q: string, fields: string): Promise<FileDrive[]> {
  const out: FileDrive[] = [];
  let pageToken: string | undefined;
  do {
    const res = await withDriveRetry(() => driveState.drive.files.list({
      q,
      fields: 'nextPageToken, files(' + fields + ')',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    }));
    out.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return out;
}

async function cartellaLotti(): Promise<string> {
  const radice = await withDriveRetry(() => getOrCreateFolder(CARTELLA_RADICE));
  const arrivo = await withDriveRetry(() => getOrCreateFolder(CARTELLA_ARRIVO, radice));
  return withDriveRetry(() => getOrCreateFolder(CARTELLA_LOTTI, arrivo));
}

async function creaSorgenteDrive() {
  if (!driveState.drive) throw new Error('drive_non_autenticato');
  const idLotti = await cartellaLotti();
  const cartelle = new Map<string, string>();
  const contenuti = new Map<string, FileDrive[]>();

  async function fileDel(id: string): Promise<FileDrive[]> {
    const cached = contenuti.get(id);
    if (cached) return cached;
    const idCartella = cartelle.get(id);
    if (!idCartella) throw new Error('lotto_sconosciuto');
    const files = await elencaTutti(`'${idCartella}' in parents and trashed=false and mimeType!='${MIME_CARTELLA}'`, 'id, name, size');
    contenuti.set(id, files);
    return files;
  }

  return {
    async elenca() {
      const sottocartelle = await elencaTutti(`'${idLotti}' in parents and mimeType='${MIME_CARTELLA}' and trashed=false`, 'id, name');
      cartelle.clear();
      contenuti.clear();
      for (const c of sottocartelle) cartelle.set(c.name, c.id);
      const manifest = await elencaTutti(`name='${escapeDriveQuery('lotto.json')}' and trashed=false`, 'id, parents');
      const conManifest = new Set<string>();
      for (const m of manifest) for (const p of m.parents || []) conManifest.add(p);
      return sottocartelle.map(c => ({ id: c.name, completo: conManifest.has(c.id) }));
    },

    async leggiManifest(id: string, maxByte: number): Promise<string> {
      const m = (await fileDel(id)).filter(f => f.name === 'lotto.json');
      if (m.length !== 1) throw new Error(m.length ? 'manifest_duplicato' : 'manifest_assente');
      if (Number(m[0].size) > maxByte) throw new Error('manifest_troppo_grande');
      const res = await withDriveRetry(() => driveState.drive.files.get(
        { fileId: m[0].id, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      ));
      return Buffer.from(res.data).toString('utf8');
    },

    async scaricaPagina(id: string, pagina: { file: string; byte: number }, destinazione: string): Promise<void> {
      const candidati = (await fileDel(id)).filter(f => f.name === pagina.file);
      const scelto = candidati.find(f => Number(f.size) === pagina.byte) || candidati[0];
      if (!scelto) throw new Error('pagina_assente');
      await downloadFile(scelto.id, destinazione);
    },

    async rimuovi(id: string): Promise<void> {
      const idCartella = cartelle.get(id);
      if (!idCartella) throw new Error('lotto_sconosciuto');
      await withDriveRetry(() => driveState.drive.files.update({
        fileId: idCartella,
        requestBody: { trashed: true },
        supportsAllDrives: true
      }));
    }
  };
}

async function manifestSuDrive(maxByte: number): Promise<string[]> {
  if (!driveState.drive) throw new Error('drive_non_autenticato');
  const manifest = await elencaTutti(`name='${escapeDriveQuery('lotto.json')}' and trashed=false`, 'id, size');
  const testi: string[] = [];
  for (const m of manifest) {
    if (Number(m.size) > maxByte) continue;
    const res = await withDriveRetry(() => driveState.drive.files.get(
      { fileId: m.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    ));
    testi.push(Buffer.from(res.data).toString('utf8'));
  }
  return testi;
}

async function pubblicaConfig(nome: string, testo: string): Promise<void> {
  if (!driveState.drive) throw new Error('drive_non_autenticato');
  const radice = await withDriveRetry(() => getOrCreateFolder(CARTELLA_RADICE));
  const base = await withDriveRetry(() => getOrCreateFolder(CARTELLA_ARRIVO, radice));
  const arrivo = await withDriveRetry(() => getOrCreateFolder(ScannerLotto.CARTELLA_ARCHIVI, base));
  const esistenti = await elencaTutti(`'${arrivo}' in parents and name='${escapeDriveQuery(nome)}' and trashed=false`, 'id');
  const media = { mimeType: 'application/json', body: testo };
  if (esistenti.length) {
    await withDriveRetry(() => driveState.drive.files.update({ fileId: esistenti[0].id, media, supportsAllDrives: true }));
  } else {
    await withDriveRetry(() => driveState.drive.files.create({
      requestBody: { name: nome, parents: [arrivo], mimeType: 'application/json' },
      media,
      fields: 'id',
      supportsAllDrives: true
    }));
  }
}

export { creaSorgenteDrive, pubblicaConfig, manifestSuDrive, CARTELLA_ARRIVO, CARTELLA_LOTTI };
