// Schema app:// della finestra principale (PIANO-SICUREZZA-OTTIMIZZAZIONE.md, O3): si serve
// solo la cartella del renderer, e solo i tipi di file in elenco.
const assert = require('assert');
const path = require('path');
const { percorsoRichiesto, URL_INDEX } = require('../out/main/schemaApp');

function runTests() {
  console.log('Running schemaApp tests...');
  const radice = path.resolve(__dirname, '..', 'out', 'renderer');
  const dentro = (...p) => path.join(radice, ...p);

  // Richieste legittime.
  assert.strictEqual(percorsoRichiesto(radice, URL_INDEX), dentro('index.html'));
  assert.strictEqual(percorsoRichiesto(radice, 'app://archiview/js/app.bundle.js'), dentro('js', 'app.bundle.js'));
  assert.strictEqual(percorsoRichiesto(radice, 'app://archiview/pdf/pdf.worker.min.mjs?v=1#x'), dentro('pdf', 'pdf.worker.min.mjs'));
  assert.strictEqual(percorsoRichiesto(radice, 'app://archiview/css/nome%20con%20spazi.css'), dentro('css', 'nome con spazi.css'));
  console.log('✅ Test 1: file del renderer serviti dal percorso giusto.');

  // Nessuna via d'uscita dalla radice: ogni forma di risalita resta dentro (o è rifiutata).
  const ostili = [
    'app://archiview/../main/main.js',
    'app://archiview/%2e%2e/%2e%2e/package.json',
    'app://archiview/..%5c..%5cmain%5cmain.js',
    'app://archiview/js/..%2f..%2f..%2fpackage.json',
    'app://archiview//server/share/x.png',
    'app://archiview/C:/Windows/x.png',
    'app://archiview/%5c%5cserver%5cshare%5cx.png'
  ];
  for (const url of ostili) {
    const p = percorsoRichiesto(radice, url);
    assert.ok(p === null || p.startsWith(radice + path.sep), `${url} esce dalla radice: ${p}`);
  }
  console.log('✅ Test 2: nessun percorso fuori da out/renderer.');

  // Altre autorità, altri schemi, tipi non serviti, byte nulli, URL malformati.
  for (const url of [
    'app://altro/index.html',
    'file:///C:/Windows/win.ini',
    'local-asset://index.html',
    'app://archiview/main.exe',
    'app://archiview/settings',
    'app://archiview/',
    'app://archiview/x%00.js',
    'app://archiview/%E0%A4%A.js',
    'non è un url'
  ]) {
    assert.strictEqual(percorsoRichiesto(radice, url), null, url);
  }
  console.log('✅ Test 3: autorità, schemi e tipi fuori elenco rifiutati.');

  console.log('Tutti i test schemaApp passati con successo!');
}

runTests();
