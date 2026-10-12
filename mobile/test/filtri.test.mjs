// node --test test/ (Node >= 22.18: importa il .ts togliendo i tipi)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicaFiltro, canali, lutLivelli, nomeFiltro, otsu, percentile } from '../src/filtri.ts';

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
