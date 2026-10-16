import { t } from './lingua';

export type Filtro = 'migliora' | 'grigi' | 'bn';
export const FILTRI: (Filtro | null)[] = [null, 'migliora', 'grigi', 'bn'];
export function nomeFiltro(f?: Filtro | null): string {
  switch (f) {
    case 'migliora': return t('Migliora');
    case 'grigi': return t('Grigi');
    case 'bn': return t('B/N');
    default: return t('Originale');
  }
}

export function canali(formato: string): { r: number; g: number; b: number; passo: number } {
  'worklet';
  switch (formato) {
    case 'RGBA': case 'RGBX': return { r: 0, g: 1, b: 2, passo: 4 };
    case 'BGRA': case 'BGRX': return { r: 2, g: 1, b: 0, passo: 4 };
    case 'ARGB': case 'XRGB': return { r: 1, g: 2, b: 3, passo: 4 };
    case 'ABGR': case 'XBGR': return { r: 3, g: 2, b: 1, passo: 4 };
    case 'RGB': return { r: 0, g: 1, b: 2, passo: 3 };
    case 'BGR': return { r: 2, g: 1, b: 0, passo: 3 };
    default: throw new Error(`formato_pixel_non_gestito: ${formato}`);
  }
}

function istogramma(px: Uint8Array, k: ReturnType<typeof canali>): Uint32Array {
  'worklet';
  const h = new Uint32Array(256);
  const { r, g, b, passo } = k;
  for (let i = 0, n = px.length; i < n; i += passo) h[(77 * px[i + r] + 150 * px[i + g] + 29 * px[i + b]) >> 8]++;
  return h;
}

export function percentile(h: Uint32Array, q: number): number {
  'worklet';
  let totale = 0;
  for (const n of h) totale += n;
  let somma = 0;
  for (let v = 0; v < 256; v++) { somma += h[v]; if (somma >= totale * q) return v; }
  return 255;
}

export function otsu(h: Uint32Array): number {
  'worklet';
  let totale = 0, sommaTot = 0;
  for (let v = 0; v < 256; v++) { totale += h[v]; sommaTot += v * h[v]; }
  let wB = 0, sommaB = 0, migliore = 0, soglia = 127;
  for (let v = 0; v < 256; v++) {
    wB += h[v];
    if (!wB) continue;
    const wF = totale - wB;
    if (!wF) break;
    sommaB += v * h[v];
    const mB = sommaB / wB, mF = (sommaTot - sommaB) / wF;
    const tra = wB * wF * (mB - mF) * (mB - mF);
    if (tra > migliore) { migliore = tra; soglia = v; }
  }
  return soglia;
}

export function lutLivelli(basso: number, alto: number): Uint8Array {
  'worklet';
  const lut = new Uint8Array(256);
  const ampiezza = Math.max(1, alto - basso);
  for (let v = 0; v < 256; v++) lut[v] = Math.min(255, Math.max(0, Math.round((v - basso) * 255 / ampiezza)));
  return lut;
}

export function applicaFiltro(filtro: Filtro, px: Uint8Array, formato: string): void {
  'worklet';
  const k = canali(formato);
  const { r, g, b, passo } = k;
  const n = px.length;
  const h = istogramma(px, k);
  if (filtro === 'migliora') {
    const lut = lutLivelli(percentile(h, 0.01), percentile(h, 0.95));
    for (let i = 0; i < n; i += passo) { px[i + r] = lut[px[i + r]]; px[i + g] = lut[px[i + g]]; px[i + b] = lut[px[i + b]]; }
    return;
  }
  // ponytail: soglia unica per tutta la pagina; con luce molto disuguale serve una soglia locale.
  // Grigi: la tabella è l'identità; B/N: 0 fino alla soglia di Otsu, poi 255.
  const lut = new Uint8Array(256);
  const soglia = filtro === 'bn' ? otsu(h) : -1;
  for (let v = 0; v < 256; v++) lut[v] = soglia < 0 ? v : v > soglia ? 255 : 0;
  for (let i = 0; i < n; i += passo) {
    const y = lut[(77 * px[i + r] + 150 * px[i + g] + 29 * px[i + b]) >> 8];
    px[i + r] = y; px[i + g] = y; px[i + b] = y;
  }
}

// ponytail: una pagina quasi bianca sembra sfocata: l'avviso dice «Sfocata?» e non blocca nulla.

export const SOGLIA_NITIDEZZA = 50;
export const LATO_MISURA = 1000;

export function nitidezza(px: Uint8Array, formato: string, w: number, h: number): number {
  'worklet';
  const { r, g, b, passo } = canali(formato);
  const riga = Math.floor(px.length / h);
  const y = new Uint8Array(w * h);
  for (let yy = 0; yy < h; yy++) {
    for (let x = 0, i = yy * riga, j = yy * w; x < w; x++, i += passo, j++) {
      y[j] = (77 * px[i + r] + 150 * px[i + g] + 29 * px[i + b]) >> 8;
    }
  }
  let s = 0, s2 = 0, n = 0;
  for (let yy = 1; yy < h - 1; yy++) {
    for (let x = 1, k = yy * w + 1; x < w - 1; x++, k++) {
      const l = y[k - 1] + y[k + 1] + y[k - w] + y[k + w] - 4 * y[k];
      s += l; s2 += l * l; n++;
    }
  }
  if (!n) return 0;
  const m = s / n;
  return s2 / n - m * m;
}

export function quadratoCentrale(w: number, h: number): [number, number, number, number] {
  const lw = Math.min(w, LATO_MISURA), lh = Math.min(h, LATO_MISURA);
  const x = Math.floor((w - lw) / 2), y = Math.floor((h - lh) / 2);
  return [x, y, x + lw, y + lh];
}
