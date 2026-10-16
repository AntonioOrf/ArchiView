import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EN } from '../src/lingua.en.ts';

const RADICE = join(import.meta.dirname, '..');

function sorgenti(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sorgenti(p);
    return /\.tsx?$/.test(n) && !/^lingua/.test(n) ? [p] : [];
  });
}

const file = [join(RADICE, 'App.tsx'), ...sorgenti(join(RADICE, 'src'))];
const LETTERALE = /(?<![\w.$])t\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")\s*[,)]/g;
const CHIAMATA = /(?<![\w.$])t\(/g;

const usate = new Map();
const nonLetterali = [];
for (const f of file) {
  const testo = readFileSync(f, 'utf8');
  let n = 0;
  for (const m of testo.matchAll(LETTERALE)) {
    usate.set(eval(m[1]), f);
    n++;
  }
  const chiamate = [...testo.matchAll(CHIAMATA)].length;
  if (chiamate !== n) nonLetterali.push(`${f}: ${chiamate - n} t(…) senza chiave letterale`);
}

test('ogni t(…) ha una chiave letterale', () => {
  assert.deepEqual(nonLetterali, []);
});

test('ogni testo tradotto ha la voce inglese', () => {
  const mancanti = [...usate].filter(([k]) => !(k in EN)).map(([k, f]) => `${f}: ${k}`);
  assert.deepEqual(mancanti, []);
});

test('nessuna voce inglese senza uso', () => {
  assert.deepEqual(Object.keys(EN).filter(k => !usate.has(k)), []);
});

test('le voci inglesi hanno gli stessi {segnaposto} dell\'italiano', () => {
  const segnaposti = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  assert.deepEqual(Object.entries(EN).filter(([k, v]) => segnaposti(k) !== segnaposti(v)).map(([k]) => k), []);
});
