import { t } from './lingua';
import { area, convesso, INTERI, spostamento, type Angoli } from './scanner/bordi';

export const LATO_MINIMO = 0.1;

const tra = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function spostaPunto(q: Angoli, k: number, dx: number, dy: number): Angoli {
  const n = [...q];
  n[2 * k] = tra(q[2 * k] + dx, 0, 1);
  n[2 * k + 1] = tra(q[2 * k + 1] + dy, 0, 1);
  return n;
}

export const ritaglioValido = (q: Angoli) => convesso(q) && area(q) >= LATO_MINIMO * LATO_MINIMO;

export const eIntera = (q: Angoli) => spostamento(q, INTERI) < 1e-6;

function orientamento(b: Uint8Array, t: number, fine: number): number {
  const le = b[t] === 0x49;
  const u16 = (o: number) => (o + 2 <= fine ? (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]) : 0);
  const u32 = (o: number) => u16(le ? o + 2 : o) * 65536 + u16(le ? o : o + 2);
  const ifd = t + u32(t + 4);
  for (let k = 0, n = u16(ifd); k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (u16(e) === 0x0112) return u16(e + 8) || 1;
  }
  return 1;
}

export function misureJpeg(b: Uint8Array): { w: number; h: number; orientamento: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 1;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    const lun = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xe1 && String.fromCharCode(...b.subarray(i + 4, i + 8)) === 'Exif') o = orientamento(b, i + 10, Math.min(b.length, i + 2 + lun));
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const h = (b[i + 5] << 8) | b[i + 6], w = (b[i + 7] << 8) | b[i + 8];
      return o >= 5 && o <= 8 ? { w: h, h: w, orientamento: o } : { w, h, orientamento: o };
    }
    i += 2 + lun;
  }
  return null;
}

export type DopoInvio = { modo: 'subito' | 'giorni' | 'sempre'; giorni: number };

export const DOPO_INVIO_PREDEFINITO: DopoInvio = { modo: 'subito', giorni: 7 };

const GIORNO = 86_400_000;

export function inviatiScaduti(lotti: { id: string; stato: string; inviatoIl?: string }[], regola: DopoInvio, ora: Date): string[] {
  const inviati = lotti.filter(l => l.stato === 'inviato');
  if (regola.modo === 'sempre') return [];
  if (regola.modo === 'subito') return inviati.map(l => l.id);
  const limite = ora.getTime() - Math.max(1, regola.giorni) * GIORNO;
  return inviati.filter(l => !(Date.parse(l.inviatoIl || '') > limite)).map(l => l.id);
}

export const quantiGiorni = (n: number) => (n === 1 ? t('1 giorno') : t('{n} giorni', { n }));

export function giorniRimasti(inviatoIl: string | undefined, giorni: number, ora: Date): number {
  const t = Date.parse(inviatoIl || '');
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t + giorni * GIORNO - ora.getTime()) / GIORNO));
}
