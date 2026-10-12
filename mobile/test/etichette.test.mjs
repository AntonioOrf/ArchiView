// node --test test/ (Node >= 22.18: importa il .ts togliendo i tipi)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prossimaEtichetta } from '../src/etichette.ts';

test('recto, verso e numeri semplici', () => {
  assert.equal(prossimaEtichetta('12r'), '12v');
  assert.equal(prossimaEtichetta('12v'), '13r');
  assert.equal(prossimaEtichetta('12V'), '13R');
  assert.equal(prossimaEtichetta('5'), '6');
});

test('prefisso e zeri iniziali', () => {
  assert.equal(prossimaEtichetta('c. 009v'), 'c. 010r');
  assert.equal(prossimaEtichetta('p. 99'), 'p. 100');
  assert.equal(prossimaEtichetta(' f. 1r '), 'f. 1v');
});

test('non indovina', () => {
  assert.equal(prossimaEtichetta(undefined), undefined);
  assert.equal(prossimaEtichetta(''), undefined);
  assert.equal(prossimaEtichetta('piatto anteriore'), undefined);
  assert.equal(prossimaEtichetta('12rv'), undefined);
});
