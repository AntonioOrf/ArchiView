import type { Filtro } from './filtri';
import { lingua, t } from './lingua';

export type OcrPagina = { v: number; testo: string; corretto?: boolean };
export type PaginaDoc = { file: string; v: number; filtro?: Filtro; ocr?: OcrPagina };

export const ocrAggiornato = (p: PaginaDoc) => p.ocr?.v === p.v;
export type Documento = { id: string; nome: string; cartella?: string; creatoIl: string; pagine: PaginaDoc[] };

const MESI = { it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
const mese = (d: Date) => MESI[lingua()][d.getMonth()];
export const LUNGHEZZA_NOME = 100;

const due = (n: number) => String(n).padStart(2, '0');
const ora = (d: Date) => `${due(d.getHours())}:${due(d.getMinutes())}`;

export function nomeAutomatico(d: Date): string {
  return t('Documento {data}', { data: `${d.getDate()} ${mese(d)} ${ora(d)}` });
}

export function quando(iso: string, adesso: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const giorno = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((giorno(adesso) - giorno(d)) / 86_400_000);
  if (diff === 0) return t('Oggi {ora}', { ora: ora(d) });
  if (diff === 1) return t('Ieri {ora}', { ora: ora(d) });
  return `${d.getDate()} ${mese(d)}${d.getFullYear() === adesso.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

export function nomeValido(nome: string, cartella = false): boolean {
  const n = nome.trim();
  return !!n && n.length <= LUNGHEZZA_NOME && !(cartella && n.includes('/'));
}

const normalizza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ponytail: normalizza i testi a ogni ricerca; con migliaia di pagine riconosciute, tenere un indice.
 */
export function documentiDi(docs: Documento[], cartella: string, cerca = ''): Documento[] {
  const q = normalizza(cerca.trim());
  const trova = (d: Documento) => normalizza(d.nome).includes(q) || d.pagine.some(p => !!p.ocr && normalizza(p.ocr.testo).includes(q));
  const scelti = q ? docs.filter(trova) : docs.filter(d => (d.cartella || '') === cartella);
  return [...scelti].sort((a, b) => b.creatoIl.localeCompare(a.creatoIl));
}

export function cartelleConConta(cartelle: string[], docs: Documento[]): { nome: string; conta: number }[] {
  const conta = new Map(cartelle.map(c => [c, 0]));
  for (const d of docs) if (d.cartella) conta.set(d.cartella, (conta.get(d.cartella) || 0) + 1);
  return [...conta].map(([nome, n]) => ({ nome, conta: n })).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

export function prossimoFile(pagine: PaginaDoc[]): string {
  const max = pagine.reduce((m, p) => Math.max(m, Number(p.file.slice(1, 5)) || 0), 0);
  return `p${String(max + 1).padStart(4, '0')}.jpg`;
}

export function nomeSeguito(nome: string): string {
  const m = /^(.*) \((\d+)\)$/.exec(nome.trim());
  const base = m ? m[1] : nome.trim();
  const suffisso = ` (${m ? Number(m[2]) + 1 : 2})`;
  return base.slice(0, LUNGHEZZA_NOME - suffisso.length).trimEnd() + suffisso;
}

export function inizioGruppo(n: number, da: number, a: number, insieme: number[]): number {
  const dove = Math.min(n - 1, Math.max(0, a));
  const prima = dove > da ? dove + 1 : dove;
  return prima - insieme.filter(j => j < prima).length;
}

export function spostata<T>(elenco: T[], da: number, a: number, insieme: number[] = [da]): T[] {
  if (da < 0 || da >= elenco.length) return elenco;
  const dentro = new Set([da, ...insieme.filter(j => j >= 0 && j < elenco.length)]);
  const resto = elenco.filter((_, j) => !dentro.has(j));
  const k = inizioGruppo(elenco.length, da, a, [...dentro]);
  const copia = [...resto.slice(0, k), ...elenco.filter((_, j) => dentro.has(j)), ...resto.slice(k)];
  return copia.every((x, j) => x === elenco[j]) ? elenco : copia;
}

export const fileValido =(f: string) => /^p\d{4}(\.jpg|\.f\.jpg|\.ocr\.json)$/.test(f);
export const fileFiltrato = (f: string) => f.replace(/\.jpg$/, '.f.jpg');
export const fileOcr = (f: string) => f.replace(/\.jpg$/, '.ocr.json');

export function nomeFile(nome: string): string {
  const pulito = nome.replace(/\s+/g, ' ').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().replace(/^\.+|\.+$/g, '').slice(0, 80).trim();
  return pulito || 'Documento';
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function daCopiare(ore: { id: string; ora: number }[], copiati: Record<string, number>): { id: string; ora: number }[] {
  return ore.filter(o => copiati[o.id] !== o.ora);
}

export function daRipristinare<F extends { nome: string }>(copie: { nome: string; file: F[] }[], qui: string[]): { nome: string; file: F[] }[] {
  return copie
    .filter(c => UUID.test(c.nome) && !qui.includes(c.nome) && c.file.some(f => f.nome === 'documento.json'))
    .map(c => ({
      nome: c.nome,
      file: [...c.file.filter(f => fileValido(f.nome)), c.file.find(f => f.nome === 'documento.json')!]
    }));
}

export function nomiImmagini(nome: string, n: number): string[] {
  const base = nomeFile(nome);
  if (n === 1) return [`${base}.jpg`];
  const cifre = Math.max(2, String(n).length);
  return Array.from({ length: n }, (_, i) => `${base} - ${String(i + 1).padStart(cifre, '0')}.jpg`);
}
