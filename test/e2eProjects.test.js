const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { PROJECTS } = require('../e2e/projects');

const e2eDir = path.join(__dirname, '..', 'e2e');

function specEsistenti() {
  return fs.readdirSync(e2eDir)
    .filter(f => f.endsWith('.spec.ts'))
    .map(f => f.replace(/\.spec\.ts$/, ''))
    .sort();
}

function specRaggruppati() {
  return Object.values(PROJECTS).flat();
}

function runTests() {
  console.log('Running e2eProjects (copertura dei progetti Playwright) tests...');

  const suDisco = specEsistenti();
  const neiGruppi = specRaggruppati();

  const orfani = suDisco.filter(s => !neiGruppi.includes(s));
  assert.deepStrictEqual(
    orfani, [],
    `Spec E2E non assegnati a nessun progetto (non verrebbero MAI eseguiti): ${orfani.join(', ')}. ` +
    `Aggiungili a un gruppo in e2e/projects.js.`
  );
  console.log('✅ Test 1: ogni spec E2E appartiene a un progetto.');

  const fantasmi = neiGruppi.filter(s => !suDisco.includes(s));
  assert.deepStrictEqual(
    fantasmi, [],
    `e2e/projects.js cita spec che non esistono più: ${fantasmi.join(', ')}.`
  );
  console.log('✅ Test 2: nessun gruppo punta a spec inesistenti.');

  const duplicati = neiGruppi.filter((s, i) => neiGruppi.indexOf(s) !== i);
  assert.deepStrictEqual(
    duplicati, [],
    `Spec presenti in più progetti (verrebbero eseguiti più volte): ${duplicati.join(', ')}.`
  );
  console.log('✅ Test 3: nessuno spec duplicato tra i progetti.');

  console.log('Tutti i test e2eProjects passati con successo!');
}

runTests();
