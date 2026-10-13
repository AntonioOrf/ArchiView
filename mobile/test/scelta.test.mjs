import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { alternaCartella, chiaveDestinazione, configDaDatabase, destinazioneDi, nomeArchivioValido, perArchivio, righeAlbero, tutteLeCartelle } from '../src/scelta.ts';

const ScannerLotto = createRequire(import.meta.url)('../../src/shared/scannerLotto.ts');

test('nome di archivio: le regole della cartella sul computer', () => {
  for (const n of ['Podestà', 'Notai di Bologna', 'Fondo 1500-1600', 'a'.repeat(200)]) assert.ok(nomeArchivioValido(n), n);
  for (const n of ['', '  ', '.', '..', 'Fondo.','a/b', 'a\\b', 'a:b', 'con', 'COM1', 'lpt3.txt', 'a'.repeat(201), 'x\u0001']) {
    assert.equal(nomeArchivioValido(n), false, JSON.stringify(n));
  }
});

test('schede dal database di un archivio sincronizzato su Drive', () => {
  const db = { cartelle: [], manoscritti: [
    { id: 'a1', segnatura: ' Reg. 12 ', cartella: 'Serie/1', trascrizione: 'lunga' },
    { id: 17, segnatura: 3 },
    { id: '', segnatura: 'senza id' },
    { id: 'x'.repeat(201) },
    null,
    { id: 'a2', segnatura: 's'.repeat(600), cartella: { storta: true } }
  ] };
  const e = ScannerLotto.validaConfig(configDaDatabase('Podestà', db, '2026-10-11T10:00:00.000Z'));
  assert.ok(e.ok, JSON.stringify(e));
  assert.deepEqual(e.config.schede.map(s => [s.id, s.segnatura.length, s.cartella]), [['a1', 7, 'Serie/1'], ['17', 1, ''], ['a2', 500, '']]);
  assert.ok(ScannerLotto.validaConfig(configDaDatabase('Vuoto', {}, '2026-10-11T10:00:00Z')).ok);
});

test('destinazione dei lotti di una scheda, valida per il contratto', () => {
  const uuid = '3f2a9c1e-0b7d-4e55-9a10-2c4d6e8f0a1b';
  const casi = [
    [{ tipo: 'smistare' }, ''],
    [{ tipo: 'esistente', id: 'dest-1', segnatura: 'Reg. 7' }, 'dest-1'],
    [{ tipo: 'nuova', id: uuid, segnatura: ' Reg. 40 ', nota: 'x' }, uuid],
    [{ tipo: 'nuova', id: uuid, segnatura: 'Reg. 41', cartella: 'Registri affitti/Badia di Cava' }, uuid]
  ];
  for (const [scelta, chiave] of casi) {
    const d = destinazioneDi(scelta);
    assert.equal(chiaveDestinazione(d), chiave);
    const e = ScannerLotto.valida({
      formato: ScannerLotto.FORMATO, versione: 1, id: '20261011-100000-abcd', creatoIl: '2026-10-11T10:00:00+02:00',
      archivio: 'Podestà', destinazione: d,
      pagine: [{ file: 'p0001.jpg', sha256: 'a'.repeat(64), byte: 1, modalita: 'documento' }]
    });
    assert.ok(e.ok, JSON.stringify(e));
  }
  assert.deepEqual(destinazioneDi({ tipo: 'nuova', id: uuid, segnatura: ' Reg. 40 ' }).campi, { segnatura: 'Reg. 40' });
  assert.equal(destinazioneDi({ tipo: 'nuova', id: uuid, segnatura: 'x', cartella: 'A/B' }).cartella, 'A/B');
  assert.equal('cartella' in destinazioneDi({ tipo: 'nuova', id: uuid, segnatura: 'x' }), false);
});

test('titolo e cartelle dal database, come la sidebar del desktop', () => {
  const db = { cartelle: ['Mappe', '', 7, 'Serie/1'], manoscritti: [
    { id: 'a1', titolo: 'Censi', autore: '  Not. <b>Rossi</b> ' },
    { id: 'a2', attori_dinamici: [{ nome: '' }, { ruolo: 'teste', nome: 'Bianchi' }], titolo: 'dopo' },
    { id: 'a3', Notaio: ['', 'Verdi'] },
    { id: 'a4' }
  ] };
  const e = ScannerLotto.validaConfig(configDaDatabase('Podestà', db, '2026-10-11T10:00:00Z'));
  assert.ok(e.ok, JSON.stringify(e));
  assert.deepEqual(e.config.schede.map(s => s.titolo), ['Not. Rossi', 'Bianchi', 'Verdi', '']);
  assert.deepEqual(e.config.cartelle, ['Mappe', '7', 'Serie/1']);
});

const sch = (id, segnatura, cartella, titolo = '') => ({ id, segnatura, cartella, titolo, nuova: false });
const forma = righe => righe.map(r => r.tipo === 'cartella' ? `${'  '.repeat(r.livello)}${r.aperta ? '▾' : '▸'} ${r.nome} (${r.conta})` : `${'  '.repeat(r.livello)}· ${r.scheda.segnatura}`);

test('albero: cartelle anche vuote, ordine naturale, solo le aperte si espandono', () => {
  const schede = [sch('1', 'Reg. 10', 'Registri/Badia'), sch('2', 'Reg. 9', 'Registri/Badia'), sch('3', 'Reg. 2', 'Registri'), sch('4', 'Sciolta', ''), sch('5', 'App. 1', 'Apprezzi')];
  const cartelle = ['Mappe', 'Registri', 'Registri/Badia', 'Registri/Vuota'];
  assert.deepEqual(forma(righeAlbero(schede, cartelle, new Set())), ['▸ Apprezzi (1)', '▸ Mappe (0)', '▸ Registri (3)', '· Sciolta']);
  assert.deepEqual(forma(righeAlbero(schede, cartelle, new Set(['Registri', 'Registri/Badia']))), [
    '▸ Apprezzi (1)', '▸ Mappe (0)', '▾ Registri (3)', '  ▾ Badia (2)', '    · Reg. 9', '    · Reg. 10', '  ▸ Vuota (0)', '  · Reg. 2', '· Sciolta'
  ]);
  // Una sottocartella aperta sotto una chiusa resta nascosta.
  assert.deepEqual(forma(righeAlbero(schede, cartelle, new Set(['Registri/Badia']))).length, 4);
});

test('albero: la ricerca tiene solo i risultati e apre le loro cartelle', () => {
  const schede = [sch('1', 'Reg. 39', 'Registri/Badia di Cava', 'Affitti della Badìa'), sch('2', 'Reg. 38', 'Registri/Badia di Cava', 'Not. Ruggiero'), sch('3', 'App. 7', 'Apprezzi', 'Terre della badia'), sch('4', 'Reg. 1', 'Registri')];
  assert.deepEqual(forma(righeAlbero(schede, ['Mappe'], new Set(), ' BADIA ')), [
    '▾ Apprezzi (1)', '  · App. 7', '▾ Registri (2)', '  ▾ Badia di Cava (2)', '    · Reg. 38', '    · Reg. 39'
  ]);
  assert.deepEqual(righeAlbero(schede, ['Mappe'], new Set(), 'nulla'), []);
});

test('albero: «Da vedere» tiene solo le schede segnate, anche insieme alla ricerca (F9)', () => {
  const schede = [{ ...sch('1', 'Reg. 1', 'Registri'), daVedere: true }, sch('2', 'Reg. 2', 'Registri'), { ...sch('3', 'App. 1', 'Apprezzi'), daVedere: true }];
  assert.deepEqual(forma(righeAlbero(schede, ['Mappe'], new Set(), '', true)), ['▾ Apprezzi (1)', '  · App. 1', '▾ Registri (1)', '  · Reg. 1']);
  assert.deepEqual(forma(righeAlbero(schede, ['Mappe'], new Set(), 'reg', true)), ['▾ Registri (1)', '  · Reg. 1']);
});

test('elenco dal database: «da vedere» dai tag, con la regola del contratto (F9)', () => {
  const db = { manoscritti: [{ id: 'a1', tags: 'fondo, da vedere' }, { id: 'a2', tags: 'fondo' }] };
  const e = ScannerLotto.validaConfig(configDaDatabase('Podestà', db, '2026-10-11T10:00:00Z', ScannerLotto.daVedere));
  assert.deepEqual(e.config.schede.map(s => s.daVedere), [true, undefined]);
  assert.equal(configDaDatabase('Podestà', db, '2026-10-11T10:00:00Z').schede.some(s => s.daVedere), false);
});

test('cartelle aperte: l\'ultima aperta è quella corrente, chiudere toglie le figlie', () => {
  let a = alternaCartella([], 'Registri');
  a = alternaCartella(a, 'Registri/Badia');
  a = alternaCartella(a, 'Mappe');
  assert.deepEqual(a, ['Registri', 'Registri/Badia', 'Mappe']);
  assert.deepEqual(alternaCartella(a, 'Registri'), ['Mappe']);
  assert.deepEqual(alternaCartella(['Reg', 'Registri/x'], 'Reg'), ['Registri/x']);
  assert.deepEqual(tutteLeCartelle(['A/B/C', '', 'A', 'D']), ['A', 'A/B', 'A/B/C', 'D']);
});

test("Wi-Fi: solo i lotti dell'archivio abbinato, nome normalizzato; senza archivio passano", () => {
  const passa = perArchivio('Notai_ArchiView', ScannerLotto.nomeArchivio);
  assert.ok(passa({ archivio: 'Notai' }));
  assert.ok(passa({ archivio: ' Notai_ArchiView ' }));
  assert.ok(passa({}));
  assert.equal(passa({ archivio: 'Podestà' }), false);
  assert.equal(passa({ archivio: 'notai' }), false);
});
