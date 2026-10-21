import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { fileFiltrato, fileOcr, fileValido, ocrAggiornato, prossimoFile, UUID, type Documento, type OcrPagina, type PaginaDoc } from './elencoDocumenti';
import type { Filtro } from './filtri';
import { leggiJson, rimpiazzaFile, scriviJson } from './fileJson';
import { filtrata } from './immagini';
import { daRisultato, type Parola } from './testo';

function radice(): Directory {
  const d = new Directory(Paths.document, 'documenti');
  d.create({ intermediates: true, idempotent: true });
  return d;
}

function cartellaDoc(id: string): Directory {
  if (!UUID.test(id)) throw new Error('id_non_valido');
  return new Directory(radice(), id);
}

function fileDoc(d: Documento, file: string): File {
  if (!fileValido(file)) throw new Error('file_non_valido');
  return new File(cartellaDoc(d.id), file);
}

export function uriPagina(d: Documento, p: PaginaDoc): string {
  return `${uriUscita(d, p)}?v=${p.v}`;
}

export function uriFile(d: Documento, p: PaginaDoc): string {
  return fileDoc(d, p.file).uri;
}

export function uriUscita(d: Documento, p: PaginaDoc): string {
  return fileDoc(d, p.filtro ? fileFiltrato(p.file) : p.file).uri;
}

async function rifaiFiltrata(d: Documento, p: PaginaDoc, filtro: Filtro): Promise<void> {
  const dest = fileDoc(d, fileFiltrato(p.file));
  const tmp = new File(cartellaDoc(d.id), `${fileFiltrato(p.file)}.nuova`);
  if (tmp.exists) tmp.delete();
  await filtrata(uriFile(d, p), filtro, tmp.uri);
  if (dest.exists) dest.delete();
  await tmp.move(dest);
}

export async function impostaFiltro(d: Documento, file: string, filtro: Filtro | null): Promise<Documento> {
  const p = d.pagine.find(x => x.file === file);
  if (!p) throw new Error('pagina_assente');
  if ((p.filtro ?? null) === filtro) return d;
  if (filtro) await rifaiFiltrata(d, p, filtro);
  else {
    const f = fileDoc(d, fileFiltrato(file));
    if (f.exists) f.delete();
  }
  const { filtro: _vecchio, ...resto } = p;
  const nuova: PaginaDoc = { ...resto, v: p.v + 1, ...(filtro ? { filtro } : {}) };
  return salvaDocumento({ ...d, pagine: d.pagine.map(x => (x.file === file ? nuova : x)) });
}

export function salvaDocumento(d: Documento): Documento {
  scriviJson(new File(cartellaDoc(d.id), 'documento.json'), d);
  return d;
}

export function elencaDocumenti(): Documento[] {
  const out: Documento[] = [];
  for (const voce of radice().list()) {
    if (!(voce instanceof Directory) || !UUID.test(voce.name)) continue;
    try {
      const d = leggiJson(new File(voce, 'documento.json')) as Documento;
      if (!d || d.id !== voce.name || !Array.isArray(d.pagine)) throw new Error('documento_incoerente');
      out.push(d);
    } catch (e) {
      console.warn('[documenti] documento illeggibile', voce.name, e);
    }
  }
  return out;
}

function fileCartelle(): File {
  return new File(radice(), 'cartelle.json');
}

export function leggiCartelle(): string[] {
  try {
    const f = fileCartelle();
    const v = f.exists ? JSON.parse(f.textSync()) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch (e) {
    console.warn('[documenti] cartelle illeggibili', e);
    return [];
  }
}

export function salvaCartelle(cartelle: string[]): void {
  fileCartelle().write(JSON.stringify([...new Set(cartelle)]));
}

export async function nuovoDocumento(nome: string, cartella: string, uris: string[], sposta = false): Promise<Documento | null> {
  const d: Documento = { id: Crypto.randomUUID(), nome, creatoIl: new Date().toISOString(), pagine: [], ...(cartella ? { cartella } : {}) };
  cartellaDoc(d.id).create({ intermediates: true });
  const finale = await aggiungiPagine(d, uris, sposta);
  if (finale.pagine.length) return finale;
  eliminaDocumento(finale);
  return null;
}

export async function aggiungiPagine(d: Documento, uris: string[], sposta = false): Promise<Documento> {
  const pagine = [...d.pagine];
  try {
    for (const uri of uris) {
      const file = prossimoFile(pagine);
      const dest = fileDoc(d, file);
      if (dest.exists) dest.delete();
      if (sposta) new File(uri).moveSync(dest);
      else await new File(uri).copy(dest);
      pagine.push({ file, v: 0 });
    }
  } finally {
    salvaDocumento({ ...d, pagine });
  }
  return { ...d, pagine };
}

export async function sostituisciPagina(d: Documento, file: string, uriNuova: string): Promise<Documento> {
  await rimpiazzaFile(fileDoc(d, file), uriNuova);
  const p = d.pagine.find(x => x.file === file);
  if (p?.filtro) await rifaiFiltrata(d, p, p.filtro);
  return salvaDocumento({ ...d, pagine: d.pagine.map(x => (x.file === file ? { ...x, v: x.v + 1 } : x)) });
}

export async function riconosci(d: Documento, file: string): Promise<Documento> {
  const p = d.pagine.find(x => x.file === file);
  if (!p) throw new Error('pagina_assente');
  if (ocrAggiornato(p) && fileDoc(d, fileOcr(file)).exists) return d;
  const { testo, parole } = daRisultato(await recognizeText(uriUscita(d, p)));
  fileDoc(d, fileOcr(file)).write(JSON.stringify({ v: p.v, parole }));
  const ocr: OcrPagina = p.ocr?.corretto ? { ...p.ocr, v: p.v } : { v: p.v, testo };
  return salvaDocumento({ ...d, pagine: d.pagine.map(x => (x.file === file ? { ...x, ocr } : x)) });
}

export function correggiTesto(d: Documento, file: string, testo: string): Documento {
  return salvaDocumento({ ...d, pagine: d.pagine.map(x => (x.file === file ? { ...x, ocr: { v: x.ocr?.v ?? x.v, testo, corretto: true } } : x)) });
}

export function paroleOcr(d: Documento, p: PaginaDoc): Parola[] | null {
  try {
    const f = fileDoc(d, fileOcr(p.file));
    if (!f.exists) return null;
    const o = JSON.parse(f.textSync()) as { v: number; parole: Parola[] };
    return o.v === p.v && Array.isArray(o.parole) ? o.parole : null;
  } catch (e) {
    console.warn('[documenti] parole OCR illeggibili', p.file, e);
    return null;
  }
}

export function rimuoviPagina(d: Documento, file: string): Documento {
  for (const nome of [file, fileFiltrato(file), fileOcr(file)]) {
    const f = fileDoc(d, nome);
    if (f.exists) f.delete();
  }
  return salvaDocumento({ ...d, pagine: d.pagine.filter(p => p.file !== file) });
}

async function copiaPagine(src: Documento, dest: Documento, pagine: PaginaDoc[]): Promise<PaginaDoc[]> {
  const out = [...dest.pagine];
  const copiati: File[] = [];
  try {
    for (const p of pagine) {
      const file = prossimoFile(out);
      for (const [da, a] of [[p.file, file], [fileFiltrato(p.file), fileFiltrato(file)], [fileOcr(p.file), fileOcr(file)]]) {
        const f = fileDoc(src, da);
        if (!f.exists) continue;
        const t = fileDoc(dest, a);
        if (t.exists) t.delete();
        await f.copy(t);
        copiati.push(t);
      }
      out.push({ ...p, file });
    }
  } catch (e) {
    for (const t of copiati) { try { if (t.exists) t.delete(); } catch (e2) { console.warn('[documenti] copia non tolta', t.uri, e2); } }
    throw e;
  }
  return out;
}

export async function unisciDocumenti(dest: Documento, src: Documento): Promise<Documento> {
  if (dest.id === src.id) throw new Error('stesso_documento');
  const unito = salvaDocumento({ ...dest, pagine: await copiaPagine(src, dest, src.pagine) });
  eliminaDocumento(src);
  return unito;
}

export async function dividiDocumento(d: Documento, da: number, nome: string): Promise<{ prima: Documento; seconda: Documento }> {
  if (da < 1 || da >= d.pagine.length) throw new Error('divisione_non_valida');
  const nuovo: Documento = { id: Crypto.randomUUID(), nome, creatoIl: new Date().toISOString(), pagine: [], ...(d.cartella ? { cartella: d.cartella } : {}) };
  const dir = cartellaDoc(nuovo.id);
  dir.create({ intermediates: true });
  let seconda: Documento;
  try {
    seconda = salvaDocumento({ ...nuovo, pagine: await copiaPagine(d, nuovo, d.pagine.slice(da)) });
  } catch (e) {
    if (dir.exists) dir.delete();
    throw e;
  }
  let prima = d;
  for (const p of d.pagine.slice(da)) prima = rimuoviPagina(prima, p.file);
  return { prima, seconda };
}

export function eliminaDocumento(d: Documento): void {
  const c = cartellaDoc(d.id);
  if (c.exists) c.delete();
  try { fileEliminati().write(JSON.stringify([...new Set([...eliminati(), d.id])])); }
  catch (e) { console.warn('[documenti] eliminazione non registrata per la copia', d.id, e); }
}

export const radiceDocumenti = radice;
export { cartellaDoc };
const fileEliminati = () => new File(radice(), 'eliminati.json');

export function eliminati(): string[] {
  try {
    const f = fileEliminati();
    const v = f.exists ? JSON.parse(f.textSync()) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && UUID.test(x)) : [];
  } catch (e) {
    console.warn('[documenti] eliminati illeggibili', e);
    return [];
  }
}

export function eliminatiCopiati(ids: string[]): void {
  const restano = eliminati().filter(x => !ids.includes(x));
  const f = fileEliminati();
  if (restano.length) f.write(JSON.stringify(restano));
  else if (f.exists) f.delete();
}
