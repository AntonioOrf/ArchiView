// ArchiView Scanner: validatore condiviso del lotto (src/shared/scannerLotto.ts, CONTRATTO.md v1).
const assert = require('assert');
const L = require('../out/shared/scannerLotto');

console.log('Running scannerLotto tests...');

const SHA = 'a'.repeat(64);
function lotto(extra) {
  return {
    formato: 'archiview-scanner/lotto',
    versione: 1,
    id: '20261005-143022-k3f9',
    creatoIl: '2026-10-05T14:30:22+02:00',
    destinazione: { tipo: 'nessuna' },
    pagine: [{ file: 'p0001.jpg', sha256: SHA, byte: 1234, modalita: 'documento' }],
    ...(extra || {})
  };
}
const codici = (esito) => esito.ok ? [] : esito.errori.map(e => e.codice + '@' + e.percorso);

// 1. Lotto minimo valido; la copia normalizzata non è lo stesso oggetto
{
  const sorgente = lotto();
  const e = L.valida(sorgente);
  assert.strictEqual(e.ok, true, JSON.stringify(e));
  assert.deepStrictEqual(e.lotto, sorgente);
  assert.notStrictEqual(e.lotto, sorgente);
  assert.notStrictEqual(e.lotto.pagine[0], sorgente.pagine[0]);
}

// 2. Chiavi sconosciute eliminate (radice, destinazione, pagina, doppia); ordine fisso
{
  const e = L.valida(lotto({
    extra: 1, titolo: '  Registro 12  ', nota: '',
    destinazione: { tipo: 'esistente', schedaId: 'a1', campi: { x: 'y' } },
    pagine: [{ file: 'p0001.jpg', sha256: SHA.toUpperCase(), byte: 1, modalita: 'raffica', percorso: 'C:/x', doppia: { lato: 'sx', x: 1 }, etichetta: ' 12v ' }]
  }));
  assert.strictEqual(e.ok, true, JSON.stringify(e));
  assert.deepStrictEqual(Object.keys(e.lotto), ['formato', 'versione', 'id', 'creatoIl', 'titolo', 'destinazione', 'pagine']);
  assert.strictEqual(e.lotto.titolo, 'Registro 12');
  assert.deepStrictEqual(e.lotto.destinazione, { tipo: 'esistente', schedaId: 'a1' });
  assert.deepStrictEqual(e.lotto.pagine[0], { file: 'p0001.jpg', sha256: SHA, byte: 1, modalita: 'raffica', etichetta: '12v', doppia: { lato: 'sx' } });
}

// 3. Formato e versione
assert.deepStrictEqual(codici(L.valida(null)), ['non_oggetto@']);
assert.deepStrictEqual(codici(L.valida([])), ['non_oggetto@']);
assert.deepStrictEqual(codici(L.valida(lotto({ formato: 'altro' }))), ['formato_sconosciuto@formato']);
assert.deepStrictEqual(codici(L.valida(lotto({ versione: 2 }))), ['versione_futura@versione']);
assert.deepStrictEqual(codici(L.valida(lotto({ versione: '1' }))), ['versione_non_valida@versione']);
assert.deepStrictEqual(codici(L.valida(lotto({ versione: 0 }))), ['versione_non_valida@versione']);

// 4. Id: forma, data e ora reali
for (const id of ['20261005-143022-K3F9', '20261005-143022-k3f', '2026105-143022-k3f9', '20261305-143022-k3f9',
  '20260230-143022-k3f9', '20261005-243022-k3f9', '20261005-146022-k3f9', '../20261005-143022-k3f9', 20261005]) {
  assert.strictEqual(L.idValido(id), false, 'id ' + id);
}
assert.strictEqual(L.idValido('20240229-000000-0000'), true);
assert.strictEqual(L.idValido('20250229-000000-0000'), false);
assert.deepStrictEqual(codici(L.valida(lotto({ id: 'x' }))), ['id_non_valido@id']);

// 5. creatoIl: ISO 8601 con fuso obbligatorio
assert.strictEqual(L.valida(lotto({ creatoIl: '2026-10-05T12:30:22Z' })).ok, true);
assert.strictEqual(L.valida(lotto({ creatoIl: '2026-10-05T12:30:22.123Z' })).ok, true);
for (const d of ['2026-10-05T14:30:22', '2026-10-05', 'ieri', 1728131422000, '2026-13-05T14:30:22Z']) {
  assert.deepStrictEqual(codici(L.valida(lotto({ creatoIl: d }))), ['data_non_valida@creatoIl'], String(d));
}

// 6. Nomi di file: solo piatti, minuscoli, estensioni ammesse
for (const f of ['../p0001.jpg', 'a/p0001.jpg', 'p0001.JPG', 'P0001.jpg', 'p001.jpg', 'p00001.jpg', 'p0001.tif',
  'p0001.jpg ', 'p0001.jpg\u0000', 'lotto.json', '']) {
  assert.strictEqual(L.nomeFileValido(f), false, JSON.stringify(f));
}
for (const f of ['p0001.jpg', 'p9999.jpeg', 'p0042.png']) assert.strictEqual(L.nomeFileValido(f), true, f);

// 7. Pagine: elenco, duplicati, hash, byte, modalità, dimensioni, doppia
assert.deepStrictEqual(codici(L.valida(lotto({ pagine: [] }))), ['pagine_vuote@pagine']);
assert.deepStrictEqual(codici(L.valida(lotto({ pagine: {} }))), ['pagine_non_valide@pagine']);
{
  const pg = (x) => ({ file: 'p0001.jpg', sha256: SHA, byte: 10, modalita: 'grezza', ...x });
  const e = L.valida(lotto({ pagine: [
    pg(), pg(), pg({ file: 'p0003.jpg', sha256: 'zz' }), pg({ file: 'p0004.jpg', byte: 0 }),
    pg({ file: 'p0005.jpg', byte: 1.5 }), pg({ file: 'p0006.jpg', modalita: 'ocr' }),
    pg({ file: 'p0007.jpg', larghezza: 0 }), pg({ file: 'p0008.jpg', doppia: { lato: 'su' } }),
    pg({ file: 'p0009.jpg', etichetta: 'x'.repeat(33) }), 'p0010.jpg', pg({ file: 'p0011.jpg', byte: 200 * 1024 * 1024 + 1 })
  ] }));
  assert.deepStrictEqual(codici(e), [
    'file_duplicato@pagine[1].file', 'sha256_non_valido@pagine[2].sha256', 'byte_non_validi@pagine[3].byte',
    'byte_non_validi@pagine[4].byte', 'modalita_non_valida@pagine[5].modalita', 'dimensione_non_valida@pagine[6].larghezza',
    'doppia_non_valida@pagine[7].doppia', 'testo_non_valido@pagine[8].etichetta', 'pagina_non_valida@pagine[9]',
    'byte_non_validi@pagine[10].byte'
  ]);
}
{
  const molte = Array.from({ length: 2001 }, (_, i) => ({ file: L.nomePagina(i + 1), sha256: SHA, byte: 1, modalita: 'documento' }));
  assert.deepStrictEqual(codici(L.valida(lotto({ pagine: molte }))), ['troppe_pagine@pagine']);
  assert.strictEqual(L.valida(lotto({ pagine: molte.slice(0, 2000) })).ok, true);
}

// 8. Destinazione
assert.deepStrictEqual(codici(L.valida(lotto({ destinazione: undefined }))), ['destinazione_non_valida@destinazione']);
assert.deepStrictEqual(codici(L.valida(lotto({ destinazione: 'nessuna' }))), ['destinazione_non_valida@destinazione']);
assert.deepStrictEqual(codici(L.valida(lotto({ destinazione: { tipo: 'altro' } }))), ['destinazione_tipo_sconosciuto@destinazione.tipo']);
assert.deepStrictEqual(codici(L.valida(lotto({ destinazione: { tipo: 'esistente', schedaId: '  ' } }))), ['scheda_id_non_valido@destinazione.schedaId']);
assert.deepStrictEqual(codici(L.valida(lotto({ destinazione: { tipo: 'esistente', schedaId: 5 } }))), ['scheda_id_non_valido@destinazione.schedaId']);
assert.deepStrictEqual(codici(L.valida(lotto({ destinazione: { tipo: 'nuova' } }))), ['tipo_documento_non_valido@destinazione.tipoDocumento']);
{
  const e = L.valida(lotto({ destinazione: { tipo: 'nuova', tipoDocumento: 'giudiziario', cartella: ' Podestà/1371 ', campi: { segnatura: 'Podestà 12', note: 'testo', vuoto: '  ' } } }));
  assert.strictEqual(e.ok, true, JSON.stringify(e));
  assert.deepStrictEqual(e.lotto.destinazione, { tipo: 'nuova', tipoDocumento: 'giudiziario', cartella: 'Podestà/1371', campi: { segnatura: 'Podestà 12', note: 'testo' } });
}
{
  const campi = { '1x': 'a', 'a-b': 'a', _x: 'a', id: 'a', cartella: 'a', allegati: 'a', tags: 'a', constructor: 'a', n: 3, lungo: 'x'.repeat(10001) };
  const e = L.valida(lotto({ destinazione: { tipo: 'nuova', tipoDocumento: 't', campi } }));
  assert.deepStrictEqual(codici(e), [
    'campo_chiave_non_valida@destinazione.campi.1x', 'campo_chiave_non_valida@destinazione.campi.a-b',
    'campo_chiave_non_valida@destinazione.campi._x', 'campo_riservato@destinazione.campi.id',
    'campo_riservato@destinazione.campi.cartella', 'campo_riservato@destinazione.campi.allegati',
    'campo_riservato@destinazione.campi.tags', 'campo_riservato@destinazione.campi.constructor',
    'campo_valore_non_valido@destinazione.campi.n', 'campo_valore_non_valido@destinazione.campi.lungo'
  ]);
}
{
  // __proto__ da JSON.parse è una chiave propria: non deve inquinare la copia normalizzata
  const e = L.valida(JSON.parse('{"formato":"archiview-scanner/lotto","versione":1,"id":"20261005-143022-k3f9","creatoIl":"2026-10-05T14:30:22Z","destinazione":{"tipo":"nuova","tipoDocumento":"t","campi":{"__proto__":"x"}},"pagine":[{"file":"p0001.jpg","sha256":"' + SHA + '","byte":1,"modalita":"documento"}]}'));
  assert.deepStrictEqual(codici(e), ['campo_chiave_non_valida@destinazione.campi.__proto__']);
}
// Ogni chiave riservata esportata è davvero rifiutata
for (const k of L.CHIAVI_RISERVATE) {
  if (!/^[A-Za-z]/.test(k)) continue;
  const e = L.valida(lotto({ destinazione: { tipo: 'nuova', tipoDocumento: 't', campi: { [k]: 'x' } } }));
  assert.strictEqual(e.ok, false, k);
}
assert.ok(L.CHIAVI_RISERVATE.indexOf('segnatura') === -1, 'la segnatura si compila dal telefono');

// 9. Testi facoltativi
assert.deepStrictEqual(codici(L.valida(lotto({ titolo: 5 }))), ['testo_non_valido@titolo']);
assert.deepStrictEqual(codici(L.valida(lotto({ nota: 'x'.repeat(2001) }))), ['testo_non_valido@nota']);
assert.strictEqual(L.valida(lotto({ dispositivo: null })).ok, true);

// 10. Errori raccolti tutti insieme (non solo il primo)
assert.deepStrictEqual(codici(L.valida(lotto({ id: 'x', creatoIl: 'x', pagine: [] }))), ['id_non_valido@id', 'data_non_valida@creatoIl', 'pagine_vuote@pagine']);

// 11. Utilità per il telefono
assert.strictEqual(L.nuovoId(new Date(2026, 9, 5, 9, 3, 7), 'K3F9'), '20261005-090307-k3f9');
assert.ok(L.idValido(L.nuovoId(new Date(), '0a0a')));
assert.throws(() => L.nuovoId(new Date(), 'k3f'), /suffisso_non_valido/);
assert.throws(() => L.nuovoId(new Date(), 'k3-9'), /suffisso_non_valido/);
assert.strictEqual(L.nomePagina(1), 'p0001.jpg');
assert.strictEqual(L.nomePagina(42, 'png'), 'p0042.png');
assert.throws(() => L.nomePagina(0), /numero_pagina_non_valido/);
assert.throws(() => L.nomePagina(10000), /numero_pagina_non_valido/);
assert.throws(() => L.nomePagina(1, 'tif'), /estensione_non_valida/);
assert.ok(L.nomeFileValido(L.nomePagina(9999)));

console.log('✓ scannerLotto: tutti i test superati');
