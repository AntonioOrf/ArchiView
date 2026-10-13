// node --test test/ (Node >= 22.18: importa il .ts togliendo i tipi)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicaFiltro, canali, lutLivelli, nitidezza, nomeFiltro, otsu, percentile, quadratoCentrale, SOGLIA_NITIDEZZA } from '../src/filtri.ts';

/** Pixel RGBA da terne [r, g, b] (alfa 200, per vedere che non si tocca). */
const rgba = terne => new Uint8Array(terne.flatMap(([r, g, b]) => [r, g, b, 200]));
const terne = px => Array.from({ length: px.length / 4 }, (_, i) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);

test('canali: RGBA e BGRA, formato sconosciuto rifiutato', () => {
  assert.deepEqual(canali('RGBA'), { r: 0, g: 1, b: 2, passo: 4 });
  assert.deepEqual(canali('BGRA'), { r: 2, g: 1, b: 0, passo: 4 });
  assert.throws(() => canali('unknown'), /formato_pixel_non_gestito/);
});

test('percentile e otsu su un istogramma a due picchi', () => {
  const h = new Uint32Array(256);
  h[30] = 100; h[220] = 300;
  assert.equal(percentile(h, 0.01), 30);
  assert.equal(percentile(h, 0.95), 220);
  const s = otsu(h);
  assert.ok(s >= 30 && s < 220, `soglia ${s}`);
});

test('lutLivelli: estremi a 0 e 255, mai fuori', () => {
  const lut = lutLivelli(40, 200);
  assert.equal(lut[40], 0);
  assert.equal(lut[200], 255);
  assert.equal(lut[0], 0);
  assert.equal(lut[255], 255);
});

test('grigi: tre canali uguali, alfa intatto', () => {
  const px = rgba([[255, 0, 0], [0, 255, 0], [10, 10, 10]]);
  applicaFiltro('grigi', px, 'RGBA');
  for (const [r, g, b] of terne(px)) assert.ok(r === g && g === b);
  assert.equal(px[3], 200);
  assert.deepEqual(terne(px)[2], [10, 10, 10]);
  assert.deepEqual(terne(px).map(t => t[0]), [76, 149, 10]); // BT.601 su 256: (77·255)>>8, (150·255)>>8
});

test('bn: carta bianca e inchiostro nero', () => {
  const carta = Array.from({ length: 90 }, () => [200, 190, 170]);
  const inchiostro = Array.from({ length: 10 }, () => [60, 50, 40]);
  const px = rgba([...carta, ...inchiostro]);
  applicaFiltro('bn', px, 'RGBA');
  const t = terne(px);
  assert.deepEqual(t[0], [255, 255, 255]);
  assert.deepEqual(t[99], [0, 0, 0]);
});

test('migliora: la carta diventa bianca, l\'inchiostro più scuro, il colore resta', () => {
  const carta = Array.from({ length: 96 }, () => [200, 190, 170]);
  const inchiostro = Array.from({ length: 4 }, () => [80, 40, 40]);
  const px = rgba([...carta, ...inchiostro]);
  applicaFiltro('migliora', px, 'RGBA');
  const t = terne(px);
  assert.ok(t[0][0] === 255, `carta ${t[0]}`);
  assert.ok(t[99][0] < 80 && t[99][0] > t[99][1], `inchiostro ${t[99]}`);
});

test('nomeFiltro: assente = Originale', () => {
  assert.equal(nomeFiltro(undefined), 'Originale');
  assert.equal(nomeFiltro('bn'), 'B/N');
});

/** «Scrittura» finta: tratti neri di 2 px ogni 6 su carta chiara, RGBA. `sfoca` = media 5×5 ripetuta. */
function pagina(w, h, sfoca = 0) {
  let y = Array.from({ length: w * h }, (_, k) => ((k % w) % 6 < 2 && Math.floor(k / w) % 9 < 7 ? 20 : 235));
  for (let giro = 0; giro < sfoca; giro++) {
    y = y.map((_, k) => {
      const x0 = k % w, y0 = Math.floor(k / w);
      let s = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = x0 + dx, yy = y0 + dy;
        if (x >= 0 && x < w && yy >= 0 && yy < h) { s += y[yy * w + x]; n++; }
      }
      return Math.round(s / n);
    });
  }
  return new Uint8Array(y.flatMap(v => [v, v, v, 255]));
}

test('nitidezza: scrittura netta sopra la soglia, sfocata e carta bianca sotto', () => {
  assert.ok(nitidezza(pagina(60, 60), 'RGBA', 60, 60) > SOGLIA_NITIDEZZA);
  assert.ok(nitidezza(pagina(60, 60, 2), 'RGBA', 60, 60) < SOGLIA_NITIDEZZA);
  assert.equal(nitidezza(new Uint8Array(40 * 40 * 4).fill(230), 'RGBA', 40, 40), 0);
});

test('nitidezza: righe con riempimento e BGRA danno lo stesso valore', () => {
  const w = 30, h = 30, px = pagina(w, h);
  const conRiempimento = new Uint8Array((w * 4 + 8) * h);
  for (let y = 0; y < h; y++) conRiempimento.set(px.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 8));
  assert.equal(nitidezza(conRiempimento, 'RGBA', w, h), nitidezza(px, 'RGBA', w, h));
  assert.equal(nitidezza(px, 'BGRA', w, h), nitidezza(px, 'RGBA', w, h));
});

test('quadratoCentrale: 1000 px al centro, o tutta l\'immagine se più piccola', () => {
  assert.deepEqual(quadratoCentrale(3000, 4000), [1000, 1500, 2000, 2500]);
  assert.deepEqual(quadratoCentrale(800, 4000), [0, 1500, 800, 2500]);
});
