// node --test test/ (Node >= 22.18: importa il .ts togliendo i tipi)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartelleConConta, documentiDi, fileFiltrato, fileOcr, fileValido, nomeAutomatico, nomeFile, nomiImmagini, nomeValido, prossimoFile, quando, spostata } from '../src/elencoDocumenti.ts';

test('spostata: avanti, indietro, oltre i bordi, invariato', () => {
  const a = ['p1', 'p2', 'p3', 'p4'];
  assert.deepEqual(spostata(a, 0, 2), ['p2', 'p3', 'p1', 'p4']);
  assert.deepEqual(spostata(a, 3, 0), ['p4', 'p1', 'p2', 'p3']);
  assert.deepEqual(spostata(a, 1, 99), ['p1', 'p3', 'p4', 'p2']);
  assert.deepEqual(spostata(a, 2, -5), ['p3', 'p1', 'p2', 'p4']);
  assert.equal(spostata(a, 2, 2), a);
  assert.equal(spostata(a, 9, 0), a);
  assert.deepEqual(a, ['p1', 'p2', 'p3', 'p4']);
});

test('nomeFile: niente caratteri vietati, punti ai bordi, mai vuoto', () => {
  assert.equal(nomeFile('Ricevuta 12/10: "Feltrinelli"?'), 'Ricevuta 12_10_ _Feltrinelli__');
  assert.equal(nomeFile('  ..  '), 'Documento');
  assert.equal(nomeFile('a\nb'), 'a b');
  assert.equal(nomeFile('x'.repeat(200)).length, 80);
});

test('nomiImmagini: una sola senza numero, più con numeri a due cifre', () => {
  assert.deepEqual(nomiImmagini('Doc', 1), ['Doc.jpg']);
  assert.deepEqual(nomiImmagini('Doc', 3), ['Doc - 01.jpg', 'Doc - 02.jpg', 'Doc - 03.jpg']);
  assert.equal(nomiImmagini('Doc', 120)[0], 'Doc - 001.jpg');
});

const doc = (id, nome, creatoIl, cartella) => ({ id, nome, creatoIl, pagine: [], ...(cartella ? { cartella } : {}) });
const docs = [
  doc('a', 'Ricevuta Feltrinelli', '2026-10-11T14:32:00', 'Ricevute'),
  doc('b', 'Toubert, Les structures', '2026-10-10T09:00:00'),
  doc('c', 'Città e contado', '2026-10-09T18:05:00'),
  doc('d', 'Scontrino', '2026-10-08T10:00:00', 'Ricevute')
];

test('nomeAutomatico: giorno, mese breve e ora', () => {
  assert.equal(nomeAutomatico(new Date(2026, 9, 9, 18, 5)), 'Documento 9 ott 18:05');
});

test('quando: oggi, ieri, data, anno diverso', () => {
  const adesso = new Date(2026, 9, 11, 20, 0);
  assert.equal(quando(new Date(2026, 9, 11, 14, 32).toISOString(), adesso), 'Oggi 14:32');
  assert.equal(quando(new Date(2026, 9, 10, 9, 5).toISOString(), adesso), 'Ieri 09:05');
  assert.equal(quando(new Date(2026, 9, 1, 9, 5).toISOString(), adesso), '1 ott');
  assert.equal(quando(new Date(2025, 11, 31).toISOString(), adesso), '31 dic 2025');
  assert.equal(quando('rotto', adesso), '');
});

test('nomeValido: vuoto, lungo, «/» solo per le cartelle', () => {
  assert.equal(nomeValido('  '), false);
  assert.equal(nomeValido('x'.repeat(101)), false);
  assert.equal(nomeValido('a/b'), true);
  assert.equal(nomeValido('a/b', true), false);
  assert.equal(nomeValido(' Ricevute ', true), true);
});

test('documentiDi: per cartella dal più recente, la ricerca vale ovunque e ignora accenti', () => {
  assert.deepEqual(documentiDi(docs, '').map(d => d.id), ['b', 'c']);
  assert.deepEqual(documentiDi(docs, 'Ricevute').map(d => d.id), ['a', 'd']);
  assert.deepEqual(documentiDi(docs, '', 'citta').map(d => d.id), ['c']);
  assert.deepEqual(documentiDi(docs, 'Altro', 'SCONTR').map(d => d.id), ['d']);
  const conTesto = { ...doc('e', 'Fotocopia', '2026-10-07T10:00:00'), pagine: [{ file: 'p0001.jpg', v: 0, ocr: { v: 0, testo: "L'incastellamento nel Lazio" } }] };
  assert.deepEqual(documentiDi([...docs, conTesto], '', 'INCASTELL').map(d => d.id), ['e']);
});

test('cartelleConConta: anche le vuote e quelle usate ma non salvate', () => {
  assert.deepEqual(cartelleConConta(['Vuota', 'Ricevute'], [...docs, doc('e', 'x', '2026-01-01', 'Articoli')]), [
    { nome: 'Articoli', conta: 1 }, { nome: 'Ricevute', conta: 2 }, { nome: 'Vuota', conta: 0 }
  ]);
});

test('prossimoFile dopo il più alto; fileValido', () => {
  assert.equal(prossimoFile([]), 'p0001.jpg');
  assert.equal(prossimoFile([{ file: 'p0001.jpg', v: 0 }, { file: 'p0007.jpg', v: 2 }]), 'p0008.jpg');
  assert.equal(fileValido('p0008.jpg'), true);
  assert.equal(fileValido('../p0008.jpg'), false);
  assert.equal(fileValido(fileFiltrato('p0008.jpg')), true);
  assert.equal(fileFiltrato('p0008.jpg'), 'p0008.f.jpg');
  assert.equal(fileOcr('p0008.jpg'), 'p0008.ocr.json');
  assert.equal(fileValido('p0008.ocr.json'), true);
  assert.equal(fileValido('p0008.json'), false);
});
