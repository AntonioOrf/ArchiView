const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'build-changelog.js');
const GENERATO = path.join(ROOT, 'out', 'renderer', 'js', 'changelogContent.js');

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

  const haSezione = new RegExp('^##\\s+ArchiView\\s+' + versione.replace(/\./g, '\\.') + '\\b', 'm').test(note);
  assert.ok(haSezione,
    `RELEASE_NOTES.md non ha una sezione per la versione ${versione} di package.json: ` +
    'il changelog in-app resterebbe vuoto. Aggiungi le note prima di rilasciare.');
  console.log(`✅ Test 1: RELEASE_NOTES.md copre la versione corrente (${versione}).`);

  execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, stdio: 'pipe' });
  assert.ok(fs.existsSync(GENERATO), 'il generatore deve scrivere changelogContent.js');
  const dati = leggiGenerato();
  assert.strictEqual(dati.versione, versione);
  assert.strictEqual(dati.disponibile, true);
  assert.ok(dati.html.length > 0, 'il corpo del changelog non deve essere vuoto');
  console.log('✅ Test 2: il generatore emette i dati della versione corrente.');

  assert.ok(!/^ArchiView\s/.test(dati.titolo),
    `il titolo non deve conservare il prefisso ArchiView (trovato: "${dati.titolo}")`);
  assert.ok(dati.titolo.length > 0, 'il titolo non deve essere vuoto');
  console.log(`✅ Test 3: titolo ripulito dal prefisso ("${dati.titolo}").`);

  assert.ok(dati.html.includes('<li>'), 'le voci puntate devono diventare <li>');
  assert.ok(dati.html.includes('<strong'), 'il **grassetto** deve diventare <strong>');
  assert.ok(dati.html.includes('<h4'), 'le sezioni ### devono diventare <h4>');
  assert.ok(!dati.html.includes('**'), 'non devono restare marcatori markdown grezzi');
  console.log('✅ Test 4: markdown convertito in HTML (strong, li, h4).');

  const tagAmmessi = new Set(['p', 'div', 'h4', 'ul', 'li', 'strong', 'code']);
  const tagTrovati = new Set([...dati.html.matchAll(/<\/?([a-zA-Z0-9]+)/g)].map(m => m[1].toLowerCase()));
  for (const t of tagTrovati) {
    assert.ok(tagAmmessi.has(t), `tag inatteso nel changelog generato: <${t}>`);
  }
  console.log('✅ Test 5: solo i tag previsti compaiono nell HTML generato.');

  console.log('Tutti i test buildChangelog passati con successo!\n');
}

runTests();
