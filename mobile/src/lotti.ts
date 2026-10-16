import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { prossimaEtichetta } from './etichette';
import { ritagliata, ruotata, sfocata } from './immagini';
import { inviatiScaduti, type DopoInvio, type Riquadro } from './pagine';
import { ScannerLotto, type Destinazione, type Lotto, type Modalita, type Pagina } from './contratto';
import { leggiJson, rimpiazzaFile, scriviJson } from './fileJson';
import { t } from './lingua';

const ALFABETO = '0123456789abcdefghijklmnopqrstuvwxyz';

export type StatoLotto = 'aperto' | 'in_coda' | 'inviato';

export type Bozza = {
  id: string;
  creatoIl: string;
  stato: StatoLotto;
  inviatoIl?: string;
  archivio?: string;
  archivioNuovo?: boolean;
  titolo?: string;
  nota?: string;
  destinazione: Destinazione;
  pagine: Pagina[];
  sfocate?: string[];
};

function radice(): Directory {
  const d = new Directory(Paths.document, 'lotti');
  d.create({ intermediates: true, idempotent: true });
  return d;
}

export function cartellaLotto(id: string): Directory {
  if (!ScannerLotto.idValido(id)) throw new Error('id_non_valido');
  return new Directory(radice(), id);
}

function isoLocale(d: Date): string {
  const due = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const segno = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}T${due(d.getHours())}:${due(d.getMinutes())}:${due(d.getSeconds())}` +
    `${segno}${due(Math.floor(a / 60))}:${due(a % 60)}`;
}

function suffissoCasuale(): string {
  return Array.from(Crypto.getRandomBytes(4), b => ALFABETO[b % ALFABETO.length]).join('');
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

export function salvaBozza(b: Bozza): Bozza {
  scriviJson(new File(cartellaLotto(b.id), 'bozza.json'), b, 2);
  return b;
}

export function nuovoLotto(destinazione: Destinazione = { tipo: 'nessuna' }, extra?: Pick<Bozza, 'archivio' | 'archivioNuovo' | 'titolo' | 'nota'>): Bozza {
  const ora = new Date();
  const b: Bozza = { id: ScannerLotto.nuovoId(ora, suffissoCasuale()), creatoIl: isoLocale(ora), stato: 'aperto', ...extra, destinazione, pagine: [] };
  cartellaLotto(b.id).create({ intermediates: true });
  return salvaBozza(b);
}

export function chiudiAperti(): void {
  for (const b of elencaLotti()) {
    if (b.stato !== 'aperto') continue;
    if (b.pagine.length) salvaBozza({ ...b, stato: 'in_coda' });
    else eliminaLotto(b);
  }
}

export function leggiLotti(): { lotti: Bozza[]; rotti: string[] } {
  const out: Bozza[] = [];
  const rotti: string[] = [];
  for (const voce of radice().list()) {
    if (!(voce instanceof Directory) || !ScannerLotto.idValido(voce.name)) continue;
    try {
      const b = leggiJson(new File(voce, 'bozza.json')) as Bozza;
      if (!b || b.id !== voce.name || !Array.isArray(b.pagine)) throw new Error('bozza_incoerente');
      out.push({ ...b, stato: b.stato || 'aperto' });
    } catch (e) {
      console.warn('[lotti] bozza illeggibile', voce.name, e);
      rotti.push(voce.name);
    }
  }
  return { lotti: out.sort((a, b) => a.id.localeCompare(b.id)), rotti };
}

export const elencaLotti = () => leggiLotti().lotti;

export async function recuperaLotto(id: string, archivio?: string): Promise<Bozza | null> {
  const d = cartellaLotto(id);
  const foto = d.list()
    .filter((f): f is File => f instanceof File && /^p\d{4}\.(jpe?g|png)$/.test(f.name) && ScannerLotto.nomeFileValido(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!foto.length) { d.delete(); return null; }
  const pagine: Pagina[] = [];
  for (const f of foto) pagine.push({ file: f.name, ...(await impronta(f)), modalita: 'documento' });
  return salvaBozza({
    id, creatoIl: isoLocale(new Date()), stato: 'in_coda', titolo: t('Scansioni recuperate'),
    ...(archivio ? { archivio } : {}), destinazione: { tipo: 'nessuna' }, pagine
  });
}

async function impronta(f: File): Promise<{ sha256: string; byte: number }> {
  // ponytail: legge tutto il file in memoria (ok fino a ~20 MB); per file più grandi hash a blocchi.
  const bytes = await f.bytes();
  return { sha256: hex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)), byte: bytes.byteLength };
}

function prossimoNome(b: Bozza): string {
  const max = b.pagine.reduce((m, p) => Math.max(m, Number(p.file.slice(1, 5))), 0);
  return ScannerLotto.nomePagina(max + 1);
}

export async function aggiungiPagina(b: Bozza, uriSorgente: string, modalita: Modalita, extra?: { larghezza?: number; altezza?: number; etichetta?: string; nota?: string }): Promise<Bozza> {
  const nome = prossimoNome(b);
  const dest = new File(cartellaLotto(b.id), nome);
  if (dest.exists) dest.delete();
  await new File(uriSorgente).copy(dest);
  const pagina: Pagina = { file: nome, ...(await impronta(dest)), modalita };
  if (extra?.larghezza) pagina.larghezza = Math.round(extra.larghezza);
  if (extra?.altezza) pagina.altezza = Math.round(extra.altezza);
  if (extra?.etichetta?.trim()) pagina.etichetta = extra.etichetta.trim();
  if (extra?.nota?.trim()) pagina.nota = extra.nota.trim();
  return salvaBozza({ ...b, pagine: [...b.pagine, pagina] });
}

export function etichettaPagina(b: Bozza, file: string, etichetta: string): Bozza {
  return testoPagina(b, file, 'etichetta', etichetta);
}

export function notaPagina(b: Bozza, file: string, nota: string): Bozza {
  return testoPagina(b, file, 'nota', nota);
}

function testoPagina(b: Bozza, file: string, chiave: 'etichetta' | 'nota', valore: string): Bozza {
  const pagine = b.pagine.map(p => {
    if (p.file !== file) return p;
    const { [chiave]: _vecchio, ...resto } = p;
    return valore.trim() ? { ...resto, [chiave]: valore } : resto;
  });
  return salvaBozza({ ...b, pagine });
}

export function rimuoviPagina(b: Bozza, file: string): Bozza {
  const f = fileDellaPagina(b, file);
  if (f.exists) f.delete();
  return salvaBozza(conSfocate({ ...b, pagine: b.pagine.filter(p => p.file !== file) }, b.sfocate ?? []));
}

function conSfocate(b: Bozza, sfocate: string[]): Bozza {
  const { sfocate: _vecchie, ...resto } = b;
  const restano = [...new Set(sfocate)].filter(f => b.pagine.some(p => p.file === f));
  return restano.length ? { ...resto, sfocate: restano } : resto;
}

export async function controllaSfocate(b: Bozza, file: string[]): Promise<Bozza | null> {
  const sfocate: string[] = [];
  for (const f of file) {
    try {
      if (await sfocata(fileDellaPagina(b, f).uri)) sfocate.push(f);
    } catch (e) {
      console.warn('[lotti] nitidezza non misurata', b.id, f, e);
    }
  }
  const json = new File(cartellaLotto(b.id), 'bozza.json');
  if (!json.exists) return null;
  const ora = leggiJson(json) as Bozza;
  return salvaBozza(conSfocate(ora, [...(ora.sfocate ?? []).filter(f => !file.includes(f)), ...sfocate]));
}

export async function dividiPagina(b: Bozza, file: string, frazione: number): Promise<Bozza> {
  const i = b.pagine.findIndex(p => p.file === file);
  if (i < 0) throw new Error('pagina_assente');
  const pg = b.pagine[i];
  if (pg.doppia) throw new Error('pagina_gia_divisa');
  const sorgente = fileDellaPagina(b, file);
  const intera = await ImageManipulator.manipulate(sorgente.uri).renderAsync();
  const piega = Math.round(Math.min(0.9, Math.max(0.1, frazione)) * intera.width);
  const meta = async (originX: number, width: number) => {
    const ctx = ImageManipulator.manipulate(sorgente.uri);
    ctx.crop({ originX, originY: 0, width, height: intera.height });
    return (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 1 });
  };
  const sx = await meta(0, piega);
  const dx = await meta(piega, intera.width - piega);

  let nb = await aggiungiPagina(b, sx.uri, pg.modalita, { larghezza: sx.width, altezza: sx.height, etichetta: pg.etichetta, nota: pg.nota });
  nb = await aggiungiPagina(nb, dx.uri, pg.modalita, { larghezza: dx.width, altezza: dx.height, etichetta: prossimaEtichetta(pg.etichetta), nota: pg.nota });
  const [psx, pdx] = nb.pagine.slice(-2);
  const pagine = [...b.pagine.slice(0, i), { ...psx, doppia: { lato: 'sx' as const } }, { ...pdx, doppia: { lato: 'dx' as const } }, ...b.pagine.slice(i + 1)];
  const finale = salvaBozza(conSfocate({ ...nb, pagine }, b.sfocate ?? []));
  for (const uri of [sorgente.uri, sx.uri, dx.uri]) {
    try { new File(uri).delete(); } catch (e) { console.warn('[lotti] file temporaneo non eliminato', uri, e); }
  }
  return finale;
}

export async function sostituisciPagina(b: Bozza, file: string, uriNuova: string, dim?: { larghezza: number; altezza: number }): Promise<Bozza> {
  const vecchia = b.pagine.find(p => p.file === file);
  if (!vecchia) throw new Error('pagina_assente');
  await rimpiazzaFile(fileDellaPagina(b, file), uriNuova);
  const { larghezza: _l, altezza: _a, ...resto } = vecchia;
  const pagina: Pagina = { ...resto, ...(await impronta(fileDellaPagina(b, file))) };
  if (dim) { pagina.larghezza = Math.round(dim.larghezza); pagina.altezza = Math.round(dim.altezza); }
  return salvaBozza({ ...b, pagine: b.pagine.map(p => (p.file === file ? pagina : p)) });
}

export async function ruotaPagina(b: Bozza, file: string): Promise<Bozza> {
  const img = await ruotata(fileDellaPagina(b, file).uri);
  return sostituisciPagina(b, file, img.uri, { larghezza: img.width, altezza: img.height });
}

export async function ritagliaPagina(b: Bozza, file: string, r: Riquadro): Promise<Bozza> {
  const img = await ritagliata(fileDellaPagina(b, file).uri, r);
  return sostituisciPagina(b, file, img.uri, { larghezza: img.width, altezza: img.height });
}

export function uriAnteprima(b: Bozza, p: Pagina): string {
  return `${fileDellaPagina(b, p.file).uri}?v=${p.sha256.slice(0, 12)}`;
}

export function fileDellaPagina(b: Bozza, nome: string): File {
  if (!ScannerLotto.nomeFileValido(nome)) throw new Error('file_non_valido');
  return new File(cartellaLotto(b.id), nome);
}

export function manifest(b: Bozza, dispositivo?: string): Lotto {
  const l: Lotto = {
    formato: ScannerLotto.FORMATO,
    versione: ScannerLotto.VERSIONE,
    id: b.id,
    creatoIl: b.creatoIl,
    destinazione: b.destinazione,
    pagine: b.pagine
  };
  if (b.archivio) {
    l.archivio = b.archivio;
    if (b.archivioNuovo) l.archivioNuovo = true;
  }
  if (dispositivo) l.dispositivo = dispositivo;
  if (b.titolo?.trim()) l.titolo = b.titolo;
  if (b.nota?.trim()) l.nota = b.nota;
  return l;
}

export function eliminaLotto(b: Bozza): void {
  const d = cartellaLotto(b.id);
  if (d.exists) d.delete();
}

export function segnaInviato(b: Bozza, regola: DopoInvio): void {
  if (regola.modo === 'subito') eliminaLotto(b);
  else salvaBozza({ ...b, stato: 'inviato', inviatoIl: isoLocale(new Date()) });
}

export function pulisciInviati(regola: DopoInvio, ora = new Date()): void {
  const inviati = elencaLotti().filter(l => l.stato === 'inviato');
  for (const id of inviatiScaduti(inviati, regola, ora)) {
    try { eliminaLotto(inviati.find(l => l.id === id)!); } catch (e) { console.warn('[lotti] inviato non eliminato', id, e); }
  }
}
