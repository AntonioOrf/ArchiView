// P10 — lettura delle risposte Wikidata (main/ipc/authorityIpc.ts). Niente rete: risposte finte.
const assert = require('assert');
const A = require('../out/main/ipc/authorityIpc');

// L'URL è sempre verso l'unico host ammesso, con i parametri codificati.
{
  const u = new URL(A.urlApi({ action: 'wbsearchentities', search: 'Bartolo & co/../x' }));
  assert.strictEqual(u.origin, 'https://www.wikidata.org');
  assert.strictEqual(u.pathname, '/w/api.php');
  assert.strictEqual(u.searchParams.get('search'), 'Bartolo & co/../x');
  assert.strictEqual(u.searchParams.get('format'), 'json');
}

// Candidati: id non validi scartati, testi accorciati, campi mancanti = stringa vuota.
{
  const c = A.leggiCandidati({ search: [
    { id: 'Q312599', label: 'Bartolo da Sassoferrato', description: 'giurista italiano' },
    { id: 'javascript:alert(1)', label: 'x' },
    { id: 'Q1', label: 'a'.repeat(1000) },
    null
  ] });
  assert.deepStrictEqual(c.map(x => x.id), ['Q312599', 'Q1']);
  assert.strictEqual(c[1].descrizione, '');
  assert.strictEqual(c[1].etichetta.length, 300);
  assert.deepStrictEqual(A.leggiCandidati(null), []);
}

// Varianti: etichette e alias delle lingue utili, senza doppioni.
{
  const v = A.leggiVarianti({ entities: { Q312599: {
    labels: { it: { value: 'Bartolo da Sassoferrato' }, la: { value: 'Bartolus de Saxoferrato' }, ja: { value: 'バルトルス' } },
    aliases: { it: [{ value: 'Bartolo' }, { value: 'bartolo' }], en: [{ value: 'Bartolus' }] }
  } } }, 'Q312599');
  assert.deepStrictEqual(v, ['Bartolo da Sassoferrato', 'Bartolo', 'Bartolus de Saxoferrato', 'Bartolus']);
  assert.deepStrictEqual(A.leggiVarianti({}, 'Q1'), []);
}

// VIAF: il primo valore numerico di P214.
{
  assert.strictEqual(A.leggiViaf({ claims: { P214: [{ mainsnak: { datavalue: { value: 'abc' } } }, { mainsnak: { datavalue: { value: '100185495' } } }] } }), '100185495');
  assert.strictEqual(A.leggiViaf({ claims: {} }), '');
}

console.log('authorityWikidata tests passed.');
