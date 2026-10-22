import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tipo } from '../src/theme/tipo.ts';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(readFileSync(join(RADICE, 'app.json'), 'utf8'));
const plugin = app.expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-font');
const famiglie = plugin?.[1]?.android?.fonts || [];

test('ogni carattere dichiarato in app.json esiste in TTF', () => {
  const mancanti = famiglie.flatMap(f => f.fontDefinitions.map(d => d.path)).filter(p => !/\.ttf$/.test(p) || !existsSync(join(RADICE, p)));
  assert.ok(famiglie.length);
  assert.deepEqual(mancanti, []);
});

test('tipo usa solo famiglie incorporate, coi pesi dichiarati', () => {
  const pesi = new Map(famiglie.map(f => [f.fontFamily, new Set(f.fontDefinitions.map(d => String(d.weight)))]));
  const fuori = Object.entries(tipo)
    .filter(([, s]) => !pesi.get(s.fontFamily)?.has(s.fontWeight || '400'))
    .map(([nome, s]) => `${nome}: ${s.fontFamily} ${s.fontWeight || '400'}`);
  assert.deepEqual(fuori, []);
});
