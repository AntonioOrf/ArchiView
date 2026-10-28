import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NESSUN_INVIO, arrivati, daControllare, recenti, registra } from '../src/invii.ts';

const ora = new Date('2026-10-28T10:00:00Z');
const lotto = (id, account = 'a@x', archivio = 'Fondo') => ({ id, archivio, account, destinazione: { tipo: 'nessuna' }, pagine: 3 });

test('registra: via Drive resta in attesa, via Wi-Fi è già arrivato e segna l\'archivio', () => {
  let s = registra(NESSUN_INVIO, lotto('L1'), ora, false);
  assert.equal(s.lotti[0].arrivatoIl, undefined);
  assert.deepEqual(s.archivi, []);
  s = registra(s, lotto('L2'), ora, true);
  assert.equal(s.lotti[1].arrivatoIl, ora.toISOString());
  assert.deepEqual(s.archivi, ['Fondo']);
  assert.equal(registra(s, lotto('L1'), ora, false).lotti.length, 2);
});

test('arrivati: sparito da Drive → arrivato; ancora su Drive → in attesa', () => {
  const s = registra(registra(NESSUN_INVIO, lotto('L1'), ora, false), lotto('L2'), ora, false);
  const dopo = arrivati(s, new Set(['L2']), 'a@x', ora);
  assert.equal(dopo.lotti.find(l => l.id === 'L1').arrivatoIl, ora.toISOString());
  assert.equal(dopo.lotti.find(l => l.id === 'L2').arrivatoIl, undefined);
  assert.deepEqual(dopo.archivi, ['Fondo']);
});

test('arrivati: i lotti di un altro account non si toccano', () => {
  const s = registra(NESSUN_INVIO, lotto('L1', 'b@x'), ora, false);
  const dopo = arrivati(s, new Set(), 'a@x', ora);
  assert.equal(dopo.lotti[0].arrivatoIl, undefined);
  assert.equal(daControllare(dopo, 'a@x'), false);
  assert.equal(daControllare(dopo, 'b@x'), true);
});

test('recenti: gli arrivati spariscono dopo un giorno, quelli in attesa restano', () => {
  const s = registra(registra(NESSUN_INVIO, lotto('L1'), ora, true), lotto('L2'), ora, false);
  const domani = new Date(ora.getTime() + 86_400_000);
  assert.deepEqual(recenti(s, domani).lotti.map(l => l.id), ['L2']);
  assert.equal(recenti(s, ora).lotti.length, 2);
});
