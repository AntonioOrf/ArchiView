export type Angoli = number[];

export const INTERI: Angoli = [0, 0, 1, 0, 1, 1, 0, 1];

export function area(q: Angoli): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    s += q[2 * i] * q[2 * j + 1] - q[2 * j] * q[2 * i + 1];
  }
  return Math.abs(s) / 2;
}

export function convesso(q: Angoli): boolean {
  let segno = 0;
  for (let i = 0; i < 4; i++) {
    const a = 2 * i, b = 2 * ((i + 1) % 4), c = 2 * ((i + 2) % 4);
    const z = (q[b] - q[a]) * (q[c + 1] - q[b + 1]) - (q[b + 1] - q[a + 1]) * (q[c] - q[b]);
    if (z === 0) return false;
    const s = z > 0 ? 1 : -1;
    if (segno && s !== segno) return false;
    segno = s;
  }
  return true;
}

export function spostamento(a: Angoli, b: Angoli): number {
  let m = 0;
  for (let i = 0; i < 8; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

// ponytail: piega dritta e verticale, nessuna correzione della curvatura delle pagine.
export function colonnaPiega(y: Uint8Array, w: number, h: number): number {
  'worklet';
  const profilo = new Float64Array(w);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) profilo[i] += y[j * w + i];
  const r = Math.max(1, Math.round(w * 0.01));
  const da = Math.floor(w * 0.4), a = Math.ceil(w * 0.6);
  const centro = Math.floor(w / 2);
  let migliore = centro, minimo = Infinity;
  for (let i = da; i <= a && i < w; i++) {
    let s = 0, c = 0;
    for (let k = Math.max(0, i - r); k <= Math.min(w - 1, i + r); k++) { s += profilo[k]; c++; }
    const m = s / c;
    if (m < minimo || (m === minimo && Math.abs(i - centro) < Math.abs(migliore - centro))) { minimo = m; migliore = i; }
  }
  return (migliore + 0.5) / w;
}
