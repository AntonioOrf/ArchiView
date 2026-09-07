const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Esercita la funzione REALE di adattamento del visualizzatore immagini (Fase 1.2).
// Stessa tecnica di searchNormalize/naturalSort: il renderer non è importabile (tutto vive
// su `window`, gli script hanno effetti collaterali al caricamento), quindi si estrae il
// sorgente da imageViewer.ts e lo si valuta contro un `window` finto. Se la forma della
// funzione cambia, l'estrazione fallisce in modo rumoroso invece di testare una copia
// divergente.
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

  // Test 1: adatta alla pagina, immagine già contenuta dal CSS → nessuna variazione.
  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 3200, rot: 0 }), 1);
  console.log('  ✓ Test 1: fit pagina su immagine già adattata = 1'); passed++;

  // Test 2: immagine più piccola del viewport → ingrandimento fino al limite minore.
  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 400, ch: 200, nw: 400, rot: 0 }), 2);
  console.log('  ✓ Test 2: fit pagina ingrandisce fino al vincolo più stretto'); passed++;

  // Test 3: LO SCAMBIO DELLE DIMENSIONI A 90°. È l'unica vera insidia del calcolo: senza
  // scambio verrebbe min(800/400, 600/800) = 0.75, cioè una carta ruotata rimpicciolita
  // invece che adattata. Con lo scambio: min(800/800, 600/400) = 1.
  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 400, ch: 800, nw: 400, rot: 90 }), 1);
  console.log('  ✓ Test 3: fit pagina scambia le dimensioni a 90°'); passed++;

  // Test 4: 270° e -90° si comportano come 90°; 180° come 0°.
  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 400, ch: 800, nw: 400, rot: 270 }), 1);
  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 400, ch: 800, nw: 400, rot: -90 }), 1);
  assert.strictEqual(fit('pagina', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 800, rot: 180 }), 1);
  console.log('  ✓ Test 4: 270°/-90° come 90°, 180° come 0°'); passed++;

  // Test 5: adatta alla larghezza — solo l'asse orizzontale, l'altezza può sbordare.
  assert.strictEqual(fit('larghezza', { vw: 800, vh: 600, cw: 400, ch: 2000, nw: 400, rot: 0 }), 2);
  assert.strictEqual(fit('larghezza', { vw: 800, vh: 600, cw: 400, ch: 200, nw: 400, rot: 90 }), 4);
  console.log('  ✓ Test 5: fit larghezza ignora l\'altezza (anche ruotato)'); passed++;

  // Test 6: 1:1 — un pixel dell'immagine per un pixel dello schermo, indipendente dalla
  // rotazione (che non cambia il numero di pixel).
  assert.strictEqual(fit('reale', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 1600, rot: 0 }), 2);
  assert.strictEqual(fit('reale', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 1600, rot: 90 }), 2);
  assert.strictEqual(fit('reale', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 400, rot: 0 }), 0.5);
  console.log('  ✓ Test 6: 1:1 = naturale/layout, indifferente alla rotazione'); passed++;

  // Test 7: dimensioni non ancora disponibili (viewport nascosto, immagine non caricata):
  // deve tornare 1 e non NaN/Infinity, o la transform manderebbe l'immagine fuori campo.
  assert.strictEqual(fit('pagina', { vw: 0, vh: 0, cw: 0, ch: 0, nw: 0, rot: 0 }), 1);
  assert.strictEqual(fit('larghezza', { vw: 800, vh: 600, cw: 0, ch: 0, nw: 0, rot: 0 }), 1);
  assert.strictEqual(fit('reale', { vw: 800, vh: 600, cw: 800, ch: 600, nw: 0, rot: 0 }), 1);
  console.log('  ✓ Test 7: dimensioni assenti → 1, mai NaN'); passed++;

  console.log(`\nAll imageViewerFit tests passed (${passed}/7).`);
}

runTests();
