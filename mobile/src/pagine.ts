// Fase 13: conti puri sulle pagine (ritaglio, pulizia delle inviate), senza moduli Expo così
// si provano con `node --test`.

import { t } from './lingua';

/** Riquadro di ritaglio in frazioni dell'immagine (0–1), dall'angolo in alto a sinistra. */
export type Riquadro = { x0: number; y0: number; x1: number; y1: number };

export const INTERA: Riquadro = { x0: 0, y0: 0, x1: 1, y1: 1 };

/** Lato minimo del riquadro, in frazione: sotto non resta una pagina leggibile. */
export const LATO_MINIMO = 0.1;

const tra = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Sposta un angolo del riquadro (`dx`/`dy` in frazioni) tenendolo dentro l'immagine e con il
 * lato minimo. `angolo`: quali lati muove (`x0`/`x1`, `y0`/`y1`).
 */
export function spostaAngolo(r: Riquadro, angolo: { x: 'x0' | 'x1'; y: 'y0' | 'y1' }, dx: number, dy: number): Riquadro {
  const n = { ...r };
  n[angolo.x] = angolo.x === 'x0' ? tra(r.x0 + dx, 0, r.x1 - LATO_MINIMO) : tra(r.x1 + dx, r.x0 + LATO_MINIMO, 1);
  n[angolo.y] = angolo.y === 'y0' ? tra(r.y0 + dy, 0, r.y1 - LATO_MINIMO) : tra(r.y1 + dy, r.y0 + LATO_MINIMO, 1);
  return n;
}

/** Il riquadro in pixel interi per `crop` di expo-image-manipulator, sempre dentro l'immagine. */
export function rettangoloRitaglio(r: Riquadro, larghezza: number, altezza: number) {
  const x0 = Math.round(tra(r.x0, 0, 1) * larghezza);
  const y0 = Math.round(tra(r.y0, 0, 1) * altezza);
  const x1 = Math.round(tra(r.x1, 0, 1) * larghezza);
  const y1 = Math.round(tra(r.y1, 0, 1) * altezza);
  return { originX: x0, originY: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

export const eIntera = (r: Riquadro) => r.x0 <= 0 && r.y0 <= 0 && r.x1 >= 1 && r.y1 >= 1;

/** Orientamento EXIF (tag 0x0112) dal blocco TIFF che parte a `t`; 1 se manca o è illeggibile. */
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

/**
 * Misure di un JPEG dall'intestazione, senza decodificarlo: larghezza e altezza come si vede
 * (già scambiate se l'EXIF dice 90°/270°) e l'orientamento EXIF (1 = dritta). `null` se `b`
 * non è un JPEG o l'intestazione non arriva al SOF.
 */
export function misureJpeg(b: Uint8Array): { w: number; h: number; orientamento: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 1;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    const lun = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xe1 && String.fromCharCode(...b.subarray(i + 4, i + 8)) === 'Exif') o = orientamento(b, i + 10, Math.min(b.length, i + 2 + lun));
    // SOF0–SOF15 tranne DHT (C4), JPG (C8), DAC (CC)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const h = (b[i + 5] << 8) | b[i + 6], w = (b[i + 7] << 8) | b[i + 8];
      return o >= 5 && o <= 8 ? { w: h, h: w, orientamento: o } : { w, h, orientamento: o };
    }
    i += 2 + lun;
  }
  return null;
}

/** Impostazione «Dopo l'invio»: cosa resta sul telefono delle pagine partite. */
export type DopoInvio = { modo: 'subito' | 'giorni' | 'sempre'; giorni: number };

export const DOPO_INVIO_PREDEFINITO: DopoInvio = { modo: 'subito', giorni: 7 };

/** Ms in un giorno. */
const GIORNO = 86_400_000;

/** Lotti inviati da cancellare ora secondo la regola (`inviatoIl` ISO; illeggibile = da cancellare). */
export function inviatiScaduti(inviati: { id: string; inviatoIl?: string }[], regola: DopoInvio, ora: Date): string[] {
  if (regola.modo === 'sempre') return [];
  if (regola.modo === 'subito') return inviati.map(l => l.id);
  const limite = ora.getTime() - Math.max(1, regola.giorni) * GIORNO;
  return inviati.filter(l => !(Date.parse(l.inviatoIl || '') > limite)).map(l => l.id);
}

/** «1 giorno», «7 giorni». */
export const quantiGiorni = (n: number) => (n === 1 ? t('1 giorno') : t('{n} giorni', { n }));

/** Giorni interi che restano a una pagina inviata prima della pulizia (mai sotto 0). */
export function giorniRimasti(inviatoIl: string | undefined, giorni: number, ora: Date): number {
  const t = Date.parse(inviatoIl || '');
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t + giorni * GIORNO - ora.getTime()) / GIORNO));
}
