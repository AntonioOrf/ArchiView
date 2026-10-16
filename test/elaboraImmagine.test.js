const assert = require('assert');
const { avElabora, avJacobi3 } = require('../out/renderer/js/workers/elaboraImmagine');

function immagine(n, colore) {
  const px = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = colore(i);
    px.set([r, g, b, 255], i * 4);
  }
  return px;
}

let px = immagine(2, () => [10, 20, 30]);
avElabora(px, 'b', 0);
assert.deepStrictEqual(Array.from(px.slice(0, 4)), [30, 30, 30, 255]);
console.log('ok  canale singolo');

px = immagine(2, i => (i ? [200, 200, 200] : [40, 40, 40]));
avElabora(px, 'soglia', 128);
assert.deepStrictEqual([px[0], px[4]], [0, 255]);
console.log('ok  soglia');

px = immagine(1000, i => { const v = 100 + (i % 51); return [v, v, v]; });
avElabora(px, 'livelli', 0);
let min = 255, max = 0;
for (let i = 0; i < px.length; i += 4) { min = Math.min(min, px[i]); max = Math.max(max, px[i]); }
assert.ok(min <= 5 && max >= 250, `livelli: ${min}–${max}`);
console.log('ok  livelli automatici');

const a = [[4, 1, 0.5], [1, 3, 0.2], [0.5, 0.2, 2]];
const { l, v } = avJacobi3(a);
for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
  let s = 0, o = 0;
  for (let k = 0; k < 3; k++) { s += v[r][k] * l[k] * v[c][k]; o += v[k][r] * v[k][c]; }
  assert.ok(Math.abs(s - a[r][c]) < 1e-6, `ricostruzione ${r},${c}`);
  assert.ok(Math.abs(o - (r === c ? 1 : 0)) < 1e-6, `ortogonalità ${r},${c}`);
}
console.log('ok  autovalori 3×3');

px = immagine(2000, i => (i % 10 === 0 ? [180, 160, 130] : [190, 170, 135]));
const distanza = (p) => Math.hypot(p[0] - p[4], p[1] - p[5], p[2] - p[6]);
const prima = distanza(px);
avElabora(px, 'dstretch', 0);
assert.ok(distanza(px) > prima * 3, `dstretch: ${prima} → ${distanza(px)}`);
console.log('ok  decorrelation stretch');

assert.throws(() => avElabora(immagine(1, () => [0, 0, 0]), 'boh', 0), /sconosciuta/);
console.log('ok  modo sconosciuto rifiutato');

console.log('elaboraImmagine: tutti i test passati');
