// PIANO-OTTIMIZZAZIONE, Fase 4: i dizionari di i18n.ts sono l'unica fonte delle traduzioni.
// Guardie: nessuna chiave doppia (in un letterale vince l'ultima, in silenzio) e nessun avanzo
// di file .po incollato in un valore (il catalogo Lingui ne aveva uno: l'inglese mostrava mezzo
// file .po come segnaposto di un campo).
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const righe = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/js/logic/i18n.ts'), 'utf8').split(/\r?\n/);
const voci = (nome) => {
  const i = righe.findIndex(r => r.startsWith('const ' + nome + ' = {'));
  assert.ok(i !== -1, nome + ' non trovato');
  const f = i + righe.slice(i).findIndex(r => r === '};');
  return righe.slice(i + 1, f).map(r => /^\s*"([^"]+)":\s*(".*")\s*,?\s*$/.exec(r)).filter(Boolean)
    .map(m => [m[1], JSON.parse(m[2])]);
};

console.log('Running i18nDizionari tests...');
for (const nome of ['customEn', 'customIt']) {
  const elenco = voci(nome);
  const viste = new Set();
  const doppie = [];
  for (const [k] of elenco) { if (viste.has(k)) doppie.push(k); viste.add(k); }
  assert.deepStrictEqual(doppie, [], nome + ': chiavi doppie');
  const sporche = elenco.filter(([, v]) => /msgid|msgstr|js-lingui/.test(v)).map(([k]) => k);
  assert.deepStrictEqual(sporche, [], nome + ': valori con avanzi di .po');
  console.log(`✅ ${nome}: ${elenco.length} voci, nessuna doppia né sporca.`);
}
console.log('Tutti i test i18nDizionari passati con successo!');
