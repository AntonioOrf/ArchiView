// Contrasto WCAG delle coppie di colori che i componenti di src/ui/ usano davvero, nei due temi:
// testo ≥ 4,5:1, bordi dei campi ≥ 3:1 (come e2e/a11y-contrast.spec.ts del desktop).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colori } from '../src/theme/colori.ts';

/** `#rrggbb` o `rgba(r, g, b, a)` → [r, g, b, a]. */
function rgba(s) {
  const h = /^#([0-9a-f]{6})$/i.exec(s);
  if (h) return [0, 2, 4].map(i => parseInt(h[1].slice(i, i + 2), 16)).concat(1);
  const m = /^rgba?\(([^)]+)\)$/.exec(s);
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return [r, g, b, a];
}
/** Colore semitrasparente steso sul fondo (opaco). */
const sopra = (c, fondo) => { const [r, g, b, a] = rgba(c); const f = rgba(fondo); return [r, g, b].map((v, i) => v * a + f[i] * (1 - a)); };
const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
  .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
function contrasto(primo, fondo, base) {
  const f = sopra(fondo, base);
  const fs = `rgba(${f.join(',')},1)`;
  const [a, b] = [lum(sopra(primo, fs)), lum(f)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

for (const [nome, c] of Object.entries(colori)) {
  test(`contrasto del tema ${nome}`, () => {
    const casi = [
      // [primo piano, fondo, minimo]
      ...['textMain', 'textMuted', 'textPlaceholder', 'primaryHover', 'dangerText'].flatMap(t =>
        ['bgBase', 'bgPanel', 'bgHover'].map(f => [t, f, 4.5])),
      // Il verde su bgHover (riga premuta) nel tema chiaro fa 4,07:1: l'app non ce lo mette mai.
      ['success', 'bgBase', 4.5], ['success', 'bgPanel', 4.5], ['success', 'successLight', 4.5],
      ['onPrimary', 'primary', 4.5], ['onPrimary', 'primaryHover', 4.5],
      ['onDanger', 'danger', 4.5], ['onDanger', 'dangerHover', 4.5],
      ['textMain', 'primaryLight', 4.5], ['dangerText', 'dangerLight', 4.5],
      ['textMain', 'infoLight', 4.5], ['textMain', 'successLight', 4.5], ['textMain', 'warningLight', 4.5],
      ['borderInput', 'bgPanel', 3], ['borderInput', 'bgBase', 3], ['primary', 'bgPanel', 3],
      // Testo d'accento sul fondo d'accento: «Da inviare», filtro scelto e «Filtri» attivo nel visore.
      ['primaryHover', 'primaryLight', 4.5], ['textMuted', 'primaryLight', 4.5]
    ];
    const sotto = casi
      .map(([p, f, min]) => [p, f, min, contrasto(c[p], c[f], c.bgPanel)])
      .filter(([, , min, r]) => r < min)
      .map(([p, f, min, r]) => `${p} su ${f}: ${r.toFixed(2)} < ${min}`);
    assert.deepEqual(sotto, []);
  });
}
