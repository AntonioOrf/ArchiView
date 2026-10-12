// Fase 15d — filtri dei Documenti sui pixel grezzi (react-native-nitro-image li dà come buffer),
// puri così si provano con `node --test`. Reversibili perché l'originale resta sul disco: il
// filtro produce una copia. Tre filtri, tutti con tabelle (LUT) per restare veloci su 12 MP:
// - `migliora`: stira i livelli (1° → nero, 95° percentile → bianco) canale per canale, colori tenuti;
// - `grigi`: luminanza;
// - `bn`: luminanza e soglia di Otsu.

export type Filtro = 'migliora' | 'grigi' | 'bn';
export const FILTRI: { valore: Filtro | null; nome: string }[] = [
  { valore: null, nome: 'Originale' },
  { valore: 'migliora', nome: 'Migliora' },
  { valore: 'grigi', nome: 'Grigi' },
  { valore: 'bn', nome: 'B/N' }
];
export const nomeFiltro = (f?: Filtro | null) => FILTRI.find(x => x.valore === (f ?? null))!.nome;

/** Posizione di R, G, B in un pixel e byte per pixel, dai formati di nitro-image. */
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

// Le funzioni con 'worklet' girano anche nel runtime dei filtri (immagini.ts), fuori dal thread JS.
// Nei cicli sui pixel indici in variabili locali e luminanza scritta per esteso: 12 M di giri.
// Luminanza intera: BT.601, pesi su 256 → (77 r + 150 g + 29 b) >> 8.

function istogramma(px: Uint8Array, k: ReturnType<typeof canali>): Uint32Array {
  'worklet';
  const h = new Uint32Array(256);
  const { r, g, b, passo } = k;
  for (let i = 0, n = px.length; i < n; i += passo) h[(77 * px[i + r] + 150 * px[i + g] + 29 * px[i + b]) >> 8]++;
  return h;
}

/** Il valore sotto cui sta la frazione `q` dei pixel. */
export function percentile(h: Uint32Array, q: number): number {
  'worklet';
  let totale = 0;
  for (const n of h) totale += n;
  let somma = 0;
  for (let v = 0; v < 256; v++) { somma += h[v]; if (somma >= totale * q) return v; }
  return 255;
}

/** Soglia di Otsu: separa al meglio inchiostro e carta nell'istogramma. */
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

/** Tabella che porta `basso` a 0 e `alto` a 255 (lineare in mezzo). */
export function lutLivelli(basso: number, alto: number): Uint8Array {
  'worklet';
  const lut = new Uint8Array(256);
  const ampiezza = Math.max(1, alto - basso);
  for (let v = 0; v < 256; v++) lut[v] = Math.min(255, Math.max(0, Math.round((v - basso) * 255 / ampiezza)));
  return lut;
}

/** Applica il filtro ai pixel, sul posto (alfa e byte di riempimento non si toccano). */
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
