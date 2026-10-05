// ArchiView Scanner — adattatore Google Drive della ricezione (`SorgenteLotti`).
//
// Struttura su Drive (docs/scanner/CONTRATTO.md):
//   ArchiView/Scansioni in arrivo/lotti/<id>/{p0001.jpg, …, lotto.json}
// Scope `drive.file`, stesso progetto Google Cloud dell'app: desktop e telefono vedono le
// cartelle create da entrambi e nient'altro del Drive.
//
// Solo I/O: validazione, verifica e scrittura stanno in `arrivoLotti.ts`.

const { driveState } = require('../ipc/drive/auth');
const { getOrCreateFolder, downloadFile, withDriveRetry, escapeDriveQuery } = require('../ipc/drive/fileOps');

const CARTELLA_RADICE = 'ArchiView';
const CARTELLA_ARRIVO = 'Scansioni in arrivo';
const CARTELLA_LOTTI = 'lotti';
const MIME_CARTELLA = 'application/vnd.google-apps.folder';

type FileDrive = { id: string; name: string; size?: string; parents?: string[]; mimeType?: string };

/** `files.list` con tutte le pagine di risultati. */
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

/** Cartella `lotti` (creata se manca: il telefono la troverà già pronta). */
async function cartellaLotti(): Promise<string> {
  const radice = await withDriveRetry(() => getOrCreateFolder(CARTELLA_RADICE));
  const arrivo = await withDriveRetry(() => getOrCreateFolder(CARTELLA_ARRIVO, radice));
  return withDriveRetry(() => getOrCreateFolder(CARTELLA_LOTTI, arrivo));
}

/**
 * Crea la sorgente. Va chiamata con Drive già autenticato (`authenticateDrive`).
 * Tiene in memoria, per la durata di una ricezione, gli id delle cartelle dei lotti e dei
 * loro file: un `files.list` per lotto invece di uno per pagina.
 */
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
      // Un'unica query per tutti i manifest (con drive.file sono solo quelli dell'app):
      // un lotto è completo se fra i suoi file c'è `lotto.json`.
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
      // Il telefono elimina le copie parziali, ma se una ne rimane l'omonimo giusto è quello
      // con la dimensione del manifest; la verifica dello sha256 resta in arrivoLotti.
      const candidati = (await fileDel(id)).filter(f => f.name === pagina.file);
      const scelto = candidati.find(f => Number(f.size) === pagina.byte) || candidati[0];
      if (!scelto) throw new Error('pagina_assente');
      await withDriveRetry(() => downloadFile(scelto.id, destinazione));
    },

    async rimuovi(id: string): Promise<void> {
      const idCartella = cartelle.get(id);
      if (!idCartella) throw new Error('lotto_sconosciuto');
      // Cestino, non eliminazione: per 30 giorni il lotto resta recuperabile da Drive.
      await withDriveRetry(() => driveState.drive.files.update({
        fileId: idCartella,
        requestBody: { trashed: true },
        supportsAllDrives: true
      }));
    }
  };
}

module.exports = { creaSorgenteDrive, CARTELLA_ARRIVO, CARTELLA_LOTTI };
export {};
