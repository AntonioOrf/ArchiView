import { test } from 'node:test';
import assert from 'node:assert/strict';
import { area, colonnaPiega, convesso, INTERI, spostamento } from '../src/scanner/bordi.ts';

test('area e convesso', () => {
  assert.equal(area(INTERI), 1);
  assert.ok(convesso(INTERI));
  assert.ok(!convesso([0, 0, 1, 1, 1, 0, 0, 1]));
  assert.ok(Math.abs(spostamento(INTERI, [0.1, 0, 1, 0, 1, 1, 0, 0.9]) - 0.1) < 1e-9);
});

test('colonnaPiega: la colonna più scura nel 40–60% centrale', () => {
  const w = 300, h = 50;
  const y = new Uint8Array(w * h).fill(200);
  for (let j = 0; j < h; j++) { y[j * w + 165] = 30; y[j * w + 166] = 30; y[j * w + 30] = 0; }
  assert.ok(Math.abs(colonnaPiega(y, w, h) - 0.55) < 0.01);
  assert.ok(Math.abs(colonnaPiega(new Uint8Array(w * h).fill(200), w, h) - 0.5) < 0.01);
});
