// node --test test/ (Node >= 22.18: importa il .ts togliendo i tipi)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avvisoSpazio, fotoRimaste, PESO_FOTO, SOGLIA_FOTO } from '../src/spazio.ts';

test('foto rimaste: arrotonda per difetto, mai negativo', () => {
  assert.equal(fotoRimaste(PESO_FOTO * 10 + 1), 10);
  assert.equal(fotoRimaste(PESO_FOTO - 1), 0);
  assert.equal(fotoRimaste(-5), 0);
});

test('avviso solo sotto soglia', () => {
  assert.equal(avvisoSpazio(PESO_FOTO * SOGLIA_FOTO), null);
  assert.match(avvisoSpazio(PESO_FOTO * 40), /circa 40 foto/);
  assert.match(avvisoSpazio(0), /pieno/);
});

test('spazio sconosciuto: nessun avviso', () => {
  assert.equal(avvisoSpazio(NaN), null);
  assert.equal(avvisoSpazio(undefined), null);
});
