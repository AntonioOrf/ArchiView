// Invio di un lotto su Google Drive (docs/scanner/CONTRATTO.md §4.1).
//
//   ArchiView/Scansioni in arrivo/lotti/<id>/{p0001.jpg, …, lotto.json}
//
// Ordine non negoziabile: tutte le pagine, poi `lotto.json`. Il desktop considera completo
// un lotto solo quando c'è il manifest, quindi un invio interrotto si riprende senza danni:
// le pagine già presenti con la dimensione giusta si saltano, le copie sbagliate si eliminano.

import { File, UploadType } from 'expo-file-system';
import { tokenDrive, scartaToken } from './accesso';
import { ScannerLotto, type Lotto } from './contratto';

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

/**
 * Esegue una chiamata con il token corrente. 401 → si scarta il token e si riprova una
 * volta; 429/5xx/rete → backoff esponenziale.
 */
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

type FileDrive = { id: string; name: string; size?: string };

async function elenca(q: string): Promise<FileDrive[]> {
  const out: FileDrive[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ q, fields: 'nextPageToken,files(id,name,size)', pageSize: '1000', spaces: 'drive' });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await chiama(t => fetch(`${API}/files?${params}`, { headers: { Authorization: `Bearer ${t}` } }));
    const json = await res.json();
    out.push(...(json.files || []));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return out;
}

/** Come `getOrCreateFolder` del desktop: la prima cartella con quel nome, altrimenti la crea. */
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

/** Sessione resumable + PUT del file in binario. Restituisce la dimensione vista da Drive. */
async function caricaPagina(locale: File, nome: string, cartellaId: string, byte: number): Promise<number> {
  const mime = nome.endsWith('.png') ? 'image/png' : 'image/jpeg';
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

export type Avanzamento = { fatte: number; totali: number };

/**
 * Invia un lotto. `fileDi(nome)` restituisce il file locale della pagina. Il manifest viene
 * validato PRIMA di caricare qualunque cosa: un lotto che il desktop rifiuterebbe non parte.
 */
export async function inviaLotto(lotto: Lotto, fileDi: (nome: string) => File, avanzamento?: (a: Avanzamento) => void): Promise<void> {
  const esito = ScannerLotto.valida(lotto);
  if (!esito.ok) throw new Error('lotto_non_valido: ' + esito.errori.map(e => e.codice + '@' + e.percorso).join(', '));
  const pulito = esito.lotto;

  const idLotti = await cartellaLotti();
  const idCartella = await cartella(pulito.id, idLotti);
  const presenti = await elenca(`'${idCartella}' in parents and trashed=false`);
  // Già completo (invio ripetuto dopo un errore di rete sulla risposta): niente da fare.
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
