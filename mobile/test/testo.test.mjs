// node --test test/ (Node >= 22.18: importa il .ts togliendo i tipi)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daRisultato, parolaVicina, soloCaratteri, stratoTesto, testoDiPiuPagine, testoSelezionato } from '../src/testo.ts';

const el = (text, left, top, right, bottom) => ({ text, frame: { left, top, right, bottom } });
const risultato = {
  blocks: [
    { lines: [{ text: 'Les chartes', elements: [el('Les', 10, 10, 40, 30), el('chartes', 50, 10, 120, 30)] }, { text: 'de Farfa', elements: [el('de', 10, 40, 30, 60), el('Farfa', 40, 40, 90, 60)] }] },
    { lines: [{ text: 'IXe siècle', elements: [el('IXe', 10, 100, 40, 120), el('siècle', 50, 100, 110, 120)] }] }
  ]
};

test('daRisultato: righe a capo, blocchi separati, parole con la cornice', () => {
  const r = daRisultato(risultato);
  assert.equal(r.testo, 'Les chartes\nde Farfa\n\nIXe siècle');
  assert.equal(r.parole.length, 6);
  assert.deepEqual(r.parole[1], { t: 'chartes', x0: 50, y0: 10, x1: 120, y1: 30 });
  assert.deepEqual(daRisultato({ blocks: [] }), { testo: '', parole: [] });
});

test('parolaVicina: dentro la cornice o la più vicina; nessuna parola → -1', () => {
  const { parole } = daRisultato(risultato);
  assert.equal(parolaVicina(parole, 60, 20), 1);
  assert.equal(parolaVicina(parole, 95, 45), 3);
  assert.equal(parolaVicina(parole, 200, 115), 5);
  assert.equal(parolaVicina([], 0, 0), -1);
});

test('testoSelezionato: in ordine di lettura, a capo fra le righe, estremi in qualunque ordine', () => {
  const { parole } = daRisultato(risultato);
  assert.equal(testoSelezionato(parole, 1, 4), 'chartes\nde Farfa\nIXe');
  assert.equal(testoSelezionato(parole, 4, 1), 'chartes\nde Farfa\nIXe');
  assert.equal(testoSelezionato(parole, 2, 2), 'de');
});

test('soloCaratteri: fuori dal font diventa «?»', () => {
  const ammessi = new Set(Array.from('abcè ', c => c.codePointAt(0)));
  assert.equal(soloCaratteri('abè ž', ammessi), 'abè ?');
});

test('testoDiPiuPagine salta le pagine vuote', () => {
  assert.equal(testoDiPiuPagine(['uno', undefined, '  ', 'due ']), 'uno\n\ndue');
});

test('stratoTesto: scala foto → pagina, origine in basso, larghezza uguale alla parola', () => {
  const larghezza1 = t => t.length * 0.5; // finto font: mezzo punto per carattere a corpo 1
  const [w] = stratoTesto([{ t: 'abcd', x0: 100, y0: 200, x1: 300, y1: 300 }], { w: 1000, h: 2000 }, { w: 500, h: 1000 }, larghezza1);
  assert.equal(w.x, 50);
  assert.equal(w.size * larghezza1('abcd'), 100); // 200 px di foto = 100 pt di pagina
  assert.equal(w.y, 1000 - 150 + 10); // fondo della parola (150 pt dall'alto) più un quinto dell'altezza
  // Parola bassa e larga (lettere spaziate): il corpo non supera il doppio dell'altezza.
  const [b] = stratoTesto([{ t: 'ab', x0: 0, y0: 0, x1: 400, y1: 10 }], { w: 1000, h: 1000 }, { w: 1000, h: 1000 }, larghezza1);
  assert.equal(b.size, 20);
  assert.equal(stratoTesto([{ t: ' ', x0: 0, y0: 0, x1: 5, y1: 5 }, { t: 'x', x0: 5, y0: 5, x1: 5, y1: 9 }], { w: 10, h: 10 }, { w: 10, h: 10 }, larghezza1).length, 0);
});
