import { File, UploadType } from 'expo-file-system';
import { tokenDrive, scartaToken } from './accesso';
import { ScannerLotto, type ConfigScanner, type Lotto } from './contratto';
import { configDaDatabase, SUFFISSO_VAULT } from './scelta';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const MIME_CARTELLA = 'application/vnd.google-apps.folder';
const PERCORSO = ['ArchiView', 'Scansioni in arrivo', 'lotti'];
const TENTATIVI = 4;

export class ErroreDrive extends Error {
  stato: number;
  constructor(messaggio: string, stato: number) {
    super(messaggio);
    this.stato = stato;
  }
}

const attendi = (ms: number) => new Promise(r => setTimeout(r, ms));
const ritentabile = (stato: number) => stato === 429 || stato >= 500;
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function chiama(fn: (token: string) => Promise<Response>): Promise<Response> {
  let rinnovato = false;
  let ritardo = 1000;
  for (let tentativo = 1; ; tentativo++) {
    const token = await tokenDrive();
    let res: Response;
    try {
      res = await fn(token);
    } catch (e) {
      if (tentativo >= TENTATIVI) throw e;
      await attendi(ritardo); ritardo *= 2;
      continue;
    }
    if (res.status === 401 && !rinnovato) { rinnovato = true; await scartaToken(token); continue; }
    if (ritentabile(res.status) && tentativo < TENTATIVI) { await attendi(ritardo); ritardo *= 2; continue; }
    if (!res.ok) throw new ErroreDrive(`drive_${res.status}: ${await res.text().catch(() => '')}`, res.status);
    return res;
  }
}

type FileDrive = { id: string; name: string; size?: string; modifiedTime?: string; md5Checksum?: string };

async function elenca(q: string, orderBy?: string): Promise<FileDrive[]> {
  const out: FileDrive[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ q, fields: 'nextPageToken,files(id,name,size,modifiedTime,md5Checksum)', pageSize: '1000', spaces: 'drive' });
    if (orderBy) params.set('orderBy', orderBy);
    if (pageToken) params.set('pageToken', pageToken);
    const res = await chiama(t => fetch(`${API}/files?${params}`, { headers: { Authorization: `Bearer ${t}` } }));
    const json = await res.json();
    out.push(...(json.files || []));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return out;
}

async function cartella(nome: string, padre: string | null): Promise<string> {
  let q = `name='${escape(nome)}' and mimeType='${MIME_CARTELLA}' and trashed=false`;
  if (padre) q += ` and '${padre}' in parents`;
  const trovate = await elenca(q);
  if (trovate.length) return trovate[0].id;
  const res = await chiama(t => fetch(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: MIME_CARTELLA, parents: padre ? [padre] : undefined })
  }));
  return (await res.json()).id;
}

let cacheLotti: string | null = null;

export function azzeraCartelle(): void {
  cacheLotti = null;
  cacheDoc = null;
}

async function cartellaLotti(): Promise<string> {
  if (cacheLotti) return cacheLotti;
  let padre: string | null = null;
  for (const nome of PERCORSO) padre = await cartella(nome, padre);
  cacheLotti = padre;
  return padre!;
}

async function elimina(id: string): Promise<void> {
  await chiama(t => fetch(`${API}/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } }));
}

async function caricaPagina(locale: File, nome: string, cartellaId: string, byte: number): Promise<number> {
  const mime = nome.endsWith('.png') ? 'image/png' : nome.endsWith('.json') ? 'application/json' : 'image/jpeg';
  const sessione = await chiama(t => fetch(`${UPLOAD}/files?uploadType=resumable&fields=id,size`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mime,
      'X-Upload-Content-Length': String(byte)
    },
    body: JSON.stringify({ name: nome, parents: [cartellaId] })
  }));
  const url = sessione.headers.get('location');
  if (!url) throw new ErroreDrive('sessione_senza_location', 0);
  const token = await tokenDrive();
  const r = await locale.upload(url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mime }
  });
  if (r.status !== 200 && r.status !== 201) throw new ErroreDrive(`upload_${r.status}: ${r.body}`, r.status);
  return Number(JSON.parse(r.body).size);
}

async function caricaManifest(lotto: Lotto, cartellaId: string): Promise<void> {
  const confine = 'archiview-' + Math.random().toString(36).slice(2);
  const corpo =
    `--${confine}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: ScannerLotto.NOME_MANIFEST, parents: [cartellaId], mimeType: 'application/json' }) +
    `\r\n--${confine}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(lotto, null, 2) +
    `\r\n--${confine}--`;
  await chiama(t => fetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': `multipart/related; boundary=${confine}` },
    body: corpo
  }));
}

async function trovaCartella(percorso: string[]): Promise<string | null> {
  let padre: string | null = null;
  for (const nome of percorso) {
    const q: string = `name='${escape(nome)}' and mimeType='${MIME_CARTELLA}' and trashed=false` + (padre ? ` and '${padre}' in parents` : '');
    const trovata = (await elenca(q))[0];
    if (!trovata) return null;
    padre = trovata.id;
  }
  return padre;
}

async function fileArchivi(): Promise<FileDrive[]> {
  const id = await trovaCartella([PERCORSO[0], PERCORSO[1], ScannerLotto.CARTELLA_ARCHIVI]);
  if (!id) return [];
  return (await elenca(`'${id}' in parents and trashed=false and mimeType!='${MIME_CARTELLA}'`)).filter(f => f.name.endsWith('.json'));
}

async function cartelleVault(): Promise<FileDrive[]> {
  const radice = await trovaCartella([PERCORSO[0]]);
  if (!radice) return [];
  return (await elenca(`'${radice}' in parents and mimeType='${MIME_CARTELLA}' and trashed=false`))
    .filter(c => c.name.endsWith(SUFFISSO_VAULT) && c.name.length > SUFFISSO_VAULT.length);
}

const nomeDi = (f: FileDrive) => ScannerLotto.nomeArchivio(f.name.endsWith('.json') ? f.name.slice(0, -'.json'.length) : f.name);

export async function elencaArchivi(): Promise<string[]> {
  const nomi = new Set([...(await fileArchivi()), ...(await cartelleVault())].map(nomeDi));
  return [...nomi].sort((a, b) => a.localeCompare(b));
}

const scarica = (id: string) => chiama(t => fetch(`${API}/files/${id}?alt=media`, { headers: { Authorization: `Bearer ${t}` } }));

/** ponytail: il database si scarica intero (trascrizioni comprese); se pesa troppo, un indice
 * leggero pubblicato dal desktop a ogni sincronizzazione.
 */
export async function scaricaConfig(archivio: string, conDatabase = true): Promise<ConfigScanner | null> {
  const pubblicato = (await fileArchivi()).find(f => nomeDi(f) === archivio);
  const vault = conDatabase ? (await cartelleVault()).find(c => nomeDi(c) === archivio) : undefined;
  const db = vault ? (await elenca(`name='database_manoscritti.json' and '${vault.id}' in parents and trashed=false`, 'modifiedTime desc'))[0] : undefined;
  const quando = (f?: FileDrive) => (f?.modifiedTime ? Date.parse(f.modifiedTime) : 0);

  let json: unknown;
  if (db && quando(db) > quando(pubblicato)) json = configDaDatabase(archivio, await (await scarica(db.id)).json(), db.modifiedTime || new Date().toISOString(), ScannerLotto.daVedere);
  else if (pubblicato) json = await (await scarica(pubblicato.id)).json();
  else return null;
  const esito = ScannerLotto.validaConfig(json);
  if (!esito.ok) throw new Error('elenco_non_valido: ' + esito.errori.map(e => e.codice).join(', '));
  return { ...esito.config, archivio };
}

export type Avanzamento = { fatte: number; totali: number };

export async function inviaLotto(lotto: Lotto, fileDi: (nome: string) => File, avanzamento?: (a: Avanzamento) => void): Promise<void> {
  const esito = ScannerLotto.valida(lotto);
  if (!esito.ok) throw new Error('lotto_non_valido: ' + esito.errori.map(e => e.codice + '@' + e.percorso).join(', '));
  try {
    await inviaValidato(esito.lotto, fileDi, avanzamento);
  } catch (e) {
    if (!(e instanceof ErroreDrive && e.stato === 404) || !cacheLotti) throw e;
    azzeraCartelle();
    await inviaValidato(esito.lotto, fileDi, avanzamento);
  }
}

async function inviaValidato(pulito: Lotto, fileDi: (nome: string) => File, avanzamento?: (a: Avanzamento) => void): Promise<void> {
  const idLotti = await cartellaLotti();
  const idCartella = await cartella(pulito.id, idLotti);
  const presenti = await elenca(`'${idCartella}' in parents and trashed=false`);
  if (presenti.some(f => f.name === ScannerLotto.NOME_MANIFEST)) return;

  let fatte = 0;
  for (const pg of pulito.pagine) {
    const omonimi = presenti.filter(f => f.name === pg.file);
    const buono = omonimi.find(f => Number(f.size) === pg.byte);
    for (const f of omonimi) if (f !== buono) await elimina(f.id);
    if (!buono) {
      const size = await caricaPagina(fileDi(pg.file), pg.file, idCartella, pg.byte);
      if (size !== pg.byte) throw new Error(`dimensione_diversa: ${pg.file} ${size}/${pg.byte}`);
    }
    fatte++;
    avanzamento?.({ fatte, totali: pulito.pagine.length });
  }
  await caricaManifest(pulito, idCartella);
}

const PERCORSO_DOC = [PERCORSO[0], 'Documenti telefono'];
let cacheDoc: string | null = null;

async function cartellaDocumenti(): Promise<string> {
  if (cacheDoc) return cacheDoc;
  let padre: string | null = null;
  for (const nome of PERCORSO_DOC) padre = await cartella(nome, padre);
  cacheDoc = padre;
  return padre!;
}

export type FileDaCopiare = { nome: string; file: File; md5: string; byte: number };

export async function specchia(nome: string, file: FileDaCopiare[]): Promise<void> {
  try {
    await specchiaUnaVolta(nome, file);
  } catch (e) {
    if (!(e instanceof ErroreDrive && e.stato === 404) || !cacheDoc) throw e;
    cacheDoc = null;
    await specchiaUnaVolta(nome, file);
  }
}

async function specchiaUnaVolta(nome: string, file: FileDaCopiare[]): Promise<void> {
  const radice = await cartellaDocumenti();
  const id = nome ? await cartella(nome, radice) : radice;
  const presenti = await elenca(`'${id}' in parents and trashed=false and mimeType!='${MIME_CARTELLA}'`);
  for (const f of file) {
    const omonimi = presenti.filter(x => x.name === f.nome);
    const buono = omonimi.find(x => x.md5Checksum === f.md5);
    for (const x of omonimi) if (x !== buono) await elimina(x.id);
    if (!buono) {
      const size = await caricaPagina(f.file, f.nome, id, f.byte);
      if (size !== f.byte) throw new Error(`dimensione_diversa: ${f.nome} ${size}/${f.byte}`);
    }
  }
  for (const x of presenti) if (!file.some(f => f.nome === x.name)) await elimina(x.id);
}

export async function eliminaCopia(nome: string): Promise<void> {
  const radice = await cartellaDocumenti();
  const q = `name='${escape(nome)}' and mimeType='${MIME_CARTELLA}' and trashed=false and '${radice}' in parents`;
  for (const c of await elenca(q)) await elimina(c.id);
}

export type CopiaDrive = { nome: string; file: { id: string; nome: string }[] };

export async function elencaCopie(): Promise<CopiaDrive[]> {
  const radice = await trovaCartella(PERCORSO_DOC);
  if (!radice) return [];
  const voce = async (nome: string, id: string): Promise<CopiaDrive> => ({
    nome, file: (await elenca(`'${id}' in parents and trashed=false and mimeType!='${MIME_CARTELLA}'`)).map(f => ({ id: f.id, nome: f.name }))
  });
  const out = [await voce('', radice)];
  for (const c of await elenca(`'${radice}' in parents and trashed=false and mimeType='${MIME_CARTELLA}'`)) out.push(await voce(c.name, c.id));
  return out;
}

/** ponytail: niente nuovo tentativo su 401 a metà; la volta dopo riparte. */
export async function scaricaIn(id: string, dest: File): Promise<void> {
  const token = await tokenDrive();
  await File.downloadFileAsync(`${API}/files/${id}?alt=media`, dest, { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
}
