const assert = require('assert');
const fs = require('fs');
const path = require('path');

const VIEWER = path.join(__dirname, '..', 'src', 'renderer', 'js', 'components', 'imageViewer.ts');

function estraiFunzione(sorgente, nome) {
  const marker = 'window.' + nome + ' = function';
  const inizio = sorgente.indexOf(marker);
  assert.notStrictEqual(inizio, -1, `Funzione ${nome} non trovata in imageViewer.ts: estrazione da aggiornare`);

  let i = sorgente.indexOf('{', inizio);
  let livello = 0;
  for (; i < sorgente.length; i++) {
    if (sorgente[i] === '{') livello++;
    else if (sorgente[i] === '}') {
      livello--;
      if (livello === 0) break;
    }
  }
  assert.ok(livello === 0 && i < sorgente.length, `Corpo di ${nome} non bilanciato`);
  return sorgente.substring(inizio, i + 1) + ';';
}

function caricaFunzione() {
  const src = fs.readFileSync(VIEWER, 'utf8');
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', estraiFunzione(src, 'calcolaScalaFit'))(window);
  assert.strictEqual(typeof window.calcolaScalaFit, 'function');
  return window.calcolaScalaFit;
}

function runTests() {
  console.log('Running imageViewerFit tests...');
  const fit = caricaFunzione();
  let passed = 0;

  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 3200, rot: 0 }), 1);
  console.log('  ✓ Test 1: fit pagina su immagine già adattata = 1'); passed++;

  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 400, ch: 200, nw: 400, rot: 0 }), 2);
  console.log('  ✓ Test 2: fit pagina ingrandisce fino al vincolo più stretto'); passed++;

  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 400, ch: 800, nw: 400, rot: 90 }), 1);
  console.log('  ✓ Test 3: fit pagina scambia le dimensioni a 90°'); passed++;

  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 400, ch: 800, nw: 400, rot: 270 }), 1);
  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 400, ch: 800, nw: 400, rot: -90 }), 1);
  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 800, rot: 180 }), 1);
  console.log('  ✓ Test 4: 270°/-90° come 90°, 180° come 0°'); passed++;

  assert.strictEqual(fit('larghezza', { vw: 800, vh: 600, cw: 400, ch: 2000, nw: 400, rot: 0 }), 2);
  assert.strictEqual(fit('larghezza', { vw: 800, vh: 600, cw: 400, ch: 200, nw: 400, rot: 90 }), 4);
  console.log('  ✓ Test 5: fit larghezza ignora l\'altezza (anche ruotato)'); passed++;

  assert.strictEqual(fit('reale', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 1600, rot: 0 }), 2);
  assert.strictEqual(fit('reale', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 1600, rot: 90 }), 2);
  assert.strictEqual(fit('reale', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 400, rot: 0 }), 0.5);
  console.log('  ✓ Test 6: 1:1 = naturale/layout, indifferente alla rotazione'); passed++;

  assert.strictEqual(fit('pagina', { vw: 0, vh: 0, cw: 0, ch: 0, nw: 0, rot: 0 }), 1);
  assert.strictEqual(fit('larghezza', { vw: 800, vh: 600, cw: 0, ch: 0, nw: 0, rot: 0 }), 1);
  assert.strictEqual(fit('reale', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 0, rot: 0 }), 1);
  console.log('  ✓ Test 7: dimensioni assenti → 1, mai NaN'); passed++;

  console.log(`\nAll imageViewerFit tests passed (${passed}/7).`);
}

function testPuntoInCarta() {
  const window = {};
  new Function('window', estraiFunzione(fs.readFileSync(VIEWER, 'utf8'), 'puntoInCarta'))(window);
  const p = window.puntoInCarta;
  const vicino = (a, b) => assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, JSON.stringify(a) + ' ≠ ' + JSON.stringify(b));
  const d = { ox: 100, oy: 50, cw: 400, ch: 200, tx: 0, ty: 0, rot: 0, scala: 1 };
  vicino(p(100, 50, d), { x: 0, y: 0 });
  vicino(p(500, 250, d), { x: 1, y: 1 });
  vicino(p(300 + 30, 150 - 20, { ...d, scala: 2, tx: 30, ty: -20 }), { x: 0.5, y: 0.5 });
  vicino(p(300 + 200, 150, { ...d, scala: 2 }), { x: 0.75, y: 0.5 });
  vicino(p(300 + 100, 150 - 200, { ...d, rot: 90 }), { x: 0, y: 0 });
  vicino(p(300 - 100, 150 + 200, { ...d, rot: 90 }), { x: 1, y: 1 });
  console.log('  ✓ puntoInCarta: scala, traslazione e rotazione invertite');
}

runTests();
testPuntoInCarta();
