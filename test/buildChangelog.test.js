const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Verifica il generatore del changelog in-app (scripts/build-changelog.js).
// Il changelog era HTML scritto a mano ed era rimasto indietro di due versioni: il punto
// di questi test è che la generazione da RELEASE_NOTES.md non possa più divergere in
// silenzio, e che l'assenza di note per la versione corrente sia un caso gestito.
const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'build-changelog.js');
const GENERATO = path.join(ROOT, 'out', 'renderer', 'js', 'changelogContent.js');

/** Carica il file generato valutandolo contro un `window` finto. */
function leggiGenerato() {
  const codice = fs.readFileSync(GENERATO, 'utf8');
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', codice)(window);
  return window.changelogData;
}

function runTests() {
  console.log('Running buildChangelog tests...');

  const versione = require(path.join(ROOT, 'package.json')).version;
  const note = fs.readFileSync(path.join(ROOT, 'RELEASE_NOTES.md'), 'utf8');

  // 1) RELEASE_NOTES deve coprire la versione che si sta per rilasciare. È la guardia che
  //    impedisce il ritorno del bug originale: app a una versione, changelog a un'altra.
  const haSezione = new RegExp('^##\\s+ArchiView\\s+' + versione.replace(/\./g, '\\.') + '\\b', 'm').test(note);
  assert.ok(haSezione,
    `RELEASE_NOTES.md non ha una sezione per la versione ${versione} di package.json: ` +
    'il changelog in-app resterebbe vuoto. Aggiungi le note prima di rilasciare.');
  console.log(`✅ Test 1: RELEASE_NOTES.md copre la versione corrente (${versione}).`);

  // 2) Il generatore produce un file valido per la versione corrente.
  execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, stdio: 'pipe' });
  assert.ok(fs.existsSync(GENERATO), 'il generatore deve scrivere changelogContent.js');
  const dati = leggiGenerato();
  assert.strictEqual(dati.versione, versione);
  assert.strictEqual(dati.disponibile, true);
  assert.ok(dati.html.length > 0, 'il corpo del changelog non deve essere vuoto');
  console.log('✅ Test 2: il generatore emette i dati della versione corrente.');

  // 3) Il titolo non ripete "ArchiView <versione>": l'intestazione del modal lo dice già.
  assert.ok(!/^ArchiView\s/.test(dati.titolo),
    `il titolo non deve conservare il prefisso ArchiView (trovato: "${dati.titolo}")`);
  assert.ok(dati.titolo.length > 0, 'il titolo non deve essere vuoto');
  console.log(`✅ Test 3: titolo ripulito dal prefisso ("${dati.titolo}").`);

  // 4) Markdown convertito: grassetto in <strong>, elenchi in <ul>/<li>, sezioni in <h4>.
  assert.ok(dati.html.includes('<li>'), 'le voci puntate devono diventare <li>');
  assert.ok(dati.html.includes('<strong'), 'il **grassetto** deve diventare <strong>');
  assert.ok(dati.html.includes('<h4'), 'le sezioni ### devono diventare <h4>');
  assert.ok(!dati.html.includes('**'), 'non devono restare marcatori markdown grezzi');
  console.log('✅ Test 4: markdown convertito in HTML (strong, li, h4).');

  // 5) Nessun HTML non voluto: il testo delle note è escapato prima della conversione,
  //    quindi gli unici tag presenti sono quelli generati da noi.
  const tagAmmessi = new Set(['p', 'div', 'h4', 'ul', 'li', 'strong', 'code']);
  const tagTrovati = new Set([...dati.html.matchAll(/<\/?([a-zA-Z0-9]+)/g)].map(m => m[1].toLowerCase()));
  for (const t of tagTrovati) {
    assert.ok(tagAmmessi.has(t), `tag inatteso nel changelog generato: <${t}>`);
  }
  console.log('✅ Test 5: solo i tag previsti compaiono nell HTML generato.');

  console.log('Tutti i test buildChangelog passati con successo!\n');
}

runTests();
