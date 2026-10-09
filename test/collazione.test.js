// P9 — collazione tra testimoni (shared/collazione.ts).
const assert = require('assert');
const C = require('../out/shared/collazione');

// Stessa forma di window.normalizzaTesto (P3), quanto basta per u/v.
const grafica = (s) => s.toLowerCase().replace(/v/g, 'u');
const testi = (tok, da, a) => tok.slice(da, a).map(t => t.testo);

// Tokenizzazione: punteggiatura ai bordi fuori dal confronto, ⁊ e lettere MUFI dentro.
{
  const t = C.tokenizza('In principio, ⁊ ꝑ «verbum». — ');
  assert.deepStrictEqual(t.map(x => x.chiave), ['in', 'principio', '⁊', 'ꝑ', 'verbum']);
  assert.strictEqual(t[1].testo, 'principio,');
}

// Testi identici: un solo tratto uguale.
{
  const a = C.tokenizza('arma virumque cano');
  assert.deepStrictEqual(C.confronta(a, a).map(s => s.tipo), ['uguale']);
  assert.deepStrictEqual(C.confronta([], []), []);
}

// Sostituzione, omissione e aggiunta.
{
  const a = C.tokenizza('arma virumque cano troiae qui primus');
  const b = C.tokenizza('arma virum cano qui primus ab oris');
  const s = C.confronta(a, b);
  const varianti = s.filter(x => x.tipo === 'variante').map(x => [testi(a, x.daA, x.aA), testi(b, x.daB, x.aB)]);
  assert.deepStrictEqual(varianti, [
    [['virumque'], ['virum']],
    [['troiae'], []],
    [[], ['ab', 'oris']]
  ]);
  // I segmenti coprono i due testi senza buchi.
  assert.strictEqual(s[0].daA, 0);
  for (let i = 1; i < s.length; i++) {
    assert.strictEqual(s[i].daA, s[i - 1].aA);
    assert.strictEqual(s[i].daB, s[i - 1].aB);
  }
  assert.strictEqual(s[s.length - 1].aA, a.length);
  assert.strictEqual(s[s.length - 1].aB, b.length);
}

// Varianti grafiche: visibili senza normalizzazione, ignorate con.
{
  const a = 'uita nostra breuis est';
  const b = 'vita nostra brevis est';
  assert.strictEqual(C.apparato(a, [{ sigla: 'B', testo: b }]).voci.length, 2);
  assert.strictEqual(C.apparato(a, [{ sigla: 'B', testo: b }], grafica).voci.length, 0);
}

// Più testimoni: stesso luogo, lezioni raccolte sotto un lemma.
{
  const app = C.apparato('in principio erat verbum', [
    { sigla: 'B', testo: 'in principio fuit verbum' },
    { sigla: 'C', testo: 'in principio fuit verbum' },
    { sigla: 'D', testo: 'in principio erat verbum' }
  ]);
  assert.strictEqual(app.voci.length, 1);
  assert.strictEqual(app.voci[0].lemma, 'erat');
  assert.deepStrictEqual(app.voci[0].lezioni.map(l => l.sigla + '=' + l.testo), ['B=fuit', 'C=fuit']);
}

// Testi senza nulla in comune oltre il tetto: niente allineamento, non un blocco della UI.
{
  const n = C.MAX_DIFFERENZE;
  const a = Array.from({ length: n }, (_, i) => 'a' + i).join(' ');
  const b = Array.from({ length: n }, (_, i) => 'b' + i).join(' ');
  assert.deepStrictEqual(C.apparato(a, [{ sigla: 'B', testo: b }]).troppoDiversi, ['B']);
}

// Testo lungo con poche differenze: veloce.
{
  const parole = Array.from({ length: 20000 }, (_, i) => 'w' + (i % 500));
  const b = parole.slice();
  b[100] = 'x'; b.splice(9000, 3); b.splice(15000, 0, 'y', 'z');
  const t0 = Date.now();
  const app = C.apparato(parole.join(' '), [{ sigla: 'B', testo: b.join(' ') }]);
  assert.strictEqual(app.voci.length, 3);
  assert.ok(Date.now() - t0 < 1000, 'collazione lenta: ' + (Date.now() - t0) + ' ms');
}

console.log('collazione tests passed.');
