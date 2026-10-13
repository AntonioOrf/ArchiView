// Fase 15b: conti puri sui Documenti (nomi, date, elenco filtrato), senza moduli Expo così si
// provano con `node --test`. I Documenti restano sul telefono: niente contratto, niente invio.

import type { Filtro } from './filtri';
import { lingua, t } from './lingua';

/**
 * `v` cresce a ogni sostituzione (ruota, ritaglia, rifai, filtro): l'URI cambia e la cache delle
 * immagini si svuota. `filtro` (15d): c'è una copia filtrata accanto (`fileFiltrato`), `file` resta l'originale.
 */
/**
 * `ocr` (15e): testo riconosciuto sulla versione `v` della pagina (le parole con la posizione
 * stanno in `fileOcr`); `corretto` = l'utente l'ha corretto a mano, un nuovo OCR non lo cambia.
 */
export type OcrPagina = { v: number; testo: string; corretto?: boolean };
export type PaginaDoc = { file: string; v: number; filtro?: Filtro; ocr?: OcrPagina };

/** L'OCR c'è ed è della foto attuale (ruota, filtro, rifai cambiano `v`). */
export const ocrAggiornato = (p: PaginaDoc) => p.ocr?.v === p.v;
/** `cartella`: un livello solo, assente = fuori dalle cartelle. `creatoIl`: ISO. */
export type Documento = { id: string; nome: string; cartella?: string; creatoIl: string; pagine: PaginaDoc[] };

// Fissi e non da Intl: il nome resta uguale su ogni telefono, e i test non dipendono dall'ICU.
const MESI = { it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
const mese = (d: Date) => MESI[lingua()][d.getMonth()];
export const LUNGHEZZA_NOME = 100;

const due = (n: number) => String(n).padStart(2, '0');
const ora = (d: Date) => `${due(d.getHours())}:${due(d.getMinutes())}`;

/** «Documento 9 ott 18:05»: il nome di un documento appena scansionato, poi rinominabile. */
export function nomeAutomatico(d: Date): string {
  return t('Documento {data}', { data: `${d.getDate()} ${mese(d)} ${ora(d)}` });
}

/** «Oggi 14:32», «Ieri 9:10», «9 ott», «9 ott 2025» (anno solo se diverso). */
export function quando(iso: string, adesso: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const giorno = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((giorno(adesso) - giorno(d)) / 86_400_000);
  if (diff === 0) return t('Oggi {ora}', { ora: ora(d) });
  if (diff === 1) return t('Ieri {ora}', { ora: ora(d) });
  return `${d.getDate()} ${mese(d)}${d.getFullYear() === adesso.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

/** Nome di documento o di cartella: non vuoto, non troppo lungo; per le cartelle niente «/». */
export function nomeValido(nome: string, cartella = false): boolean {
  const n = nome.trim();
  return !!n && n.length <= LUNGHEZZA_NOME && !(cartella && n.includes('/'));
}

const normalizza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * I documenti da mostrare, dal più recente. Con `cerca` si cerca in tutti (nome e testo
 * riconosciuto), altrimenti quelli di `cartella` ('' = fuori dalle cartelle).
 * ponytail: normalizza i testi a ogni ricerca; con migliaia di pagine riconosciute, tenere un indice.
 */
export function documentiDi(docs: Documento[], cartella: string, cerca = ''): Documento[] {
  const q = normalizza(cerca.trim());
  const trova = (d: Documento) => normalizza(d.nome).includes(q) || d.pagine.some(p => !!p.ocr && normalizza(p.ocr.testo).includes(q));
  const scelti = q ? docs.filter(trova) : docs.filter(d => (d.cartella || '') === cartella);
  return [...scelti].sort((a, b) => b.creatoIl.localeCompare(a.creatoIl));
}

/** Cartelle in ordine alfabetico col numero di documenti: quelle salvate più quelle usate dai documenti. */
export function cartelleConConta(cartelle: string[], docs: Documento[]): { nome: string; conta: number }[] {
  const conta = new Map(cartelle.map(c => [c, 0]));
  for (const d of docs) if (d.cartella) conta.set(d.cartella, (conta.get(d.cartella) || 0) + 1);
  return [...conta].map(([nome, n]) => ({ nome, conta: n })).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

/** Nome del file della prossima pagina: dopo il più alto, così una pagina eliminata non crea doppioni. */
export function prossimoFile(pagine: PaginaDoc[]): string {
  const max = pagine.reduce((m, p) => Math.max(m, Number(p.file.slice(1, 5)) || 0), 0);
  return `p${String(max + 1).padStart(4, '0')}.jpg`;
}

/** F11: nome della seconda parte di un documento diviso: «Nome (2)», «Nome (2)» → «Nome (3)»; mai oltre `LUNGHEZZA_NOME`. */
export function nomeSeguito(nome: string): string {
  const m = /^(.*) \((\d+)\)$/.exec(nome.trim());
  const base = m ? m[1] : nome.trim();
  const suffisso = ` (${m ? Number(m[2]) + 1 : 2})`;
  return base.slice(0, LUNGHEZZA_NOME - suffisso.length).trimEnd() + suffisso;
}

/** Riordino: l'elemento `da` va in posizione `a` (limitata all'elenco); stesso array se non cambia nulla. */
export function spostata<T>(elenco: T[], da: number, a: number): T[] {
  const dove = Math.min(elenco.length - 1, Math.max(0, a));
  if (da === dove || da < 0 || da >= elenco.length) return elenco;
  const copia = elenco.slice();
  copia.splice(dove, 0, ...copia.splice(da, 1));
  return copia;
}

export const fileValido =(f: string) => /^p\d{4}(\.jpg|\.f\.jpg|\.ocr\.json)$/.test(f);
/** La copia filtrata accanto all'originale: `p0001.jpg` → `p0001.f.jpg`. */
export const fileFiltrato = (f: string) => f.replace(/\.jpg$/, '.f.jpg');
/** Le parole dell'OCR con la posizione: `p0001.jpg` → `p0001.ocr.json`. */
export const fileOcr = (f: string) => f.replace(/\.jpg$/, '.ocr.json');

/** Nome di file per l'uscita (PDF, JPEG): senza caratteri vietati da Android/Windows, mai vuoto. */
export function nomeFile(nome: string): string {
  const pulito = nome.replace(/\s+/g, ' ').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().replace(/^\.+|\.+$/g, '').slice(0, 80).trim();
  return pulito || 'Documento';
}

/** Id di un documento: è anche il nome della sua cartella, sul telefono e su Drive. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** F5: i documenti da copiare su Drive: mai copiati, o `documento.json` cambiato dall'ultima copia. */
export function daCopiare(ore: { id: string; ora: number }[], copiati: Record<string, number>): { id: string; ora: number }[] {
  return ore.filter(o => copiati[o.id] !== o.ora);
}

/**
 * F5: le copie su Drive da riportare sul telefono: cartella con id valido, non già qui, con
 * `documento.json`. Dentro, solo i file ammessi (foto, filtrate, OCR), `documento.json` per ultimo:
 * una copia interrotta non ha il documento e al giro dopo riparte.
 */
export function daRipristinare<F extends { nome: string }>(copie: { nome: string; file: F[] }[], qui: string[]): { nome: string; file: F[] }[] {
  return copie
    .filter(c => UUID.test(c.nome) && !qui.includes(c.nome) && c.file.some(f => f.nome === 'documento.json'))
    .map(c => ({
      nome: c.nome,
      file: [...c.file.filter(f => fileValido(f.nome)), c.file.find(f => f.nome === 'documento.json')!]
    }));
}

/** Nomi delle immagini in uscita: «Nome.jpg» se una, «Nome - 01.jpg …» se più (ordinabili). */
export function nomiImmagini(nome: string, n: number): string[] {
  const base = nomeFile(nome);
  if (n === 1) return [`${base}.jpg`];
  const cifre = Math.max(2, String(n).length);
  return Array.from({ length: n }, (_, i) => `${base} - ${String(i + 1).padStart(cifre, '0')}.jpg`);
}
