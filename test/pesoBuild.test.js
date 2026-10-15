// Guardia di PIANO-PESO: le esclusioni dall'installer valgono solo nell'exe impacchettato,
// quindi né la build né gli e2e (che girano su out/) si accorgerebbero se sparissero.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const pkg = require('../package.json');

function sorgentiTs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sorgentiTs(p);
    return /\.(ts|mjs|js)$/.test(e.name) ? [p] : [];
  });
}

function runTests() {
  console.log('Running pesoBuild (esclusioni dall\'installer) tests...');

  // Test 1 — pdfjs-dist serve solo alla build (copy-ocr-host.js): fra le dependencies
  // tirerebbe dentro anche @napi-rs/canvas, ~70 MB in tutto.
  assert.ok(!pkg.dependencies['pdfjs-dist'], 'pdfjs-dist deve stare fra le devDependencies.');
  assert.ok(pkg.devDependencies['pdfjs-dist'], 'pdfjs-dist manca dalle devDependencies.');
  console.log('✅ Test 1: pdfjs-dist solo fra le devDependencies.');

  // Test 2 — di Google solo il client Drive: googleapis intero sono ~34 MB.
  assert.ok(!pkg.dependencies.googleapis, 'googleapis non va fra le dependencies: usare @googleapis/drive.');
  const colpevoli = sorgentiTs(path.join(radice, 'src'))
    .filter(f => /require\(\s*['"]googleapis[/'"]|from\s+['"]googleapis[/'"]/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(radice, f));
  assert.deepStrictEqual(colpevoli, [], `src/ richiede googleapis: ${colpevoli.join(', ')}.`);
  console.log('✅ Test 2: src/ non richiede googleapis.');

  // Test 3 — le esclusioni di build.files e le lingue di Chromium.
  const files = pkg.build.files;
  for (const voce of [
    '!**/*.map',
    '!**/node_modules/tesseract.js-core/*.wasm.js',
    '!**/node_modules/pdf-lib/{es,dist,src,ts3.4}/**',
    '!out/renderer/js/**',
    'out/renderer/js/app.bundle.js',
    'out/renderer/js/temaIniziale.js',
    'out/renderer/js/workers/**',
    'assets/tutorial_workspace/**/*'
  ]) {
    assert.ok(files.includes(voce), `build.files deve contenere "${voce}".`);
  }
  assert.ok(!files.includes('assets/**/*'), 'build.files: di assets/ nell\'asar serve solo il tutorial.');
  assert.deepStrictEqual(pkg.build.electronLanguages, ['it', 'en-US'], 'build.electronLanguages deve essere ["it", "en-US"].');
  console.log('✅ Test 3: esclusioni di build.files ed electronLanguages presenti.');

  // Test 4 — pdf.js una volta sola: il visualizzatore usa la copia dell'host OCR.
  const copia = fs.readFileSync(path.join(radice, 'scripts', 'copy-pdf-viewer.js'), 'utf8');
  assert.ok(!/sorgentePdfjs|pdfjs-dist/.test(copia), 'copy-pdf-viewer.js non deve copiare pdf.js.');
  console.log('✅ Test 4: pdf.js non duplicato in out/renderer/pdf.');

  console.log('Tutti i test pesoBuild passati con successo!');
}

runTests();
