const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const UTILS = path.join(RADICE, 'src', 'renderer', 'js', 'logic', 'utils.ts');
const AZIONI = path.join(RADICE, 'out', 'renderer', 'js', 'logic', 'azioni.js');

function estraiFunzione(sorgente, nome, file) {
  const marker = 'window.' + nome + ' = function';
  const inizio = sorgente.indexOf(marker);
  assert.notStrictEqual(inizio, -1, `Funzione ${nome} non trovata in ${file}: estrazione da aggiornare`);
  let i = sorgente.indexOf('{', inizio);
  let livello = 0;
  for (; i < sorgente.length; i++) {
    if (sorgente[i] === '{') livello++;
    else if (sorgente[i] === '}') {
      livello--;
      if (livello === 0) break;
    }
  }
  assert.ok(livello === 0 && i < sorgente.length, `Corpo di ${nome} non bilanciato`);
  return sorgente.substring(inizio, i + 1) + ';';
}

const window = {};
// eslint-disable-next-line no-new-func
new Function('window', [
  estraiFunzione(fs.readFileSync(UTILS, 'utf8'), 'escapeHTML', 'utils.ts'),
  estraiFunzione(fs.readFileSync(AZIONI, 'utf8'), 'azione', 'azioni.js'),
].join('\n'))(window);

const ENTITA = { amp: '&', lt: '<', gt: '>', quot: '"', '#039': "'", '#39': "'" };
const decodificaAttributo = (s) => s.replace(/&(amp|lt|gt|quot|#039|#39);/g, (_, e) => ENTITA[e]);

function attributi(markup) {
  const out = {};
  const re = /([a-z-]+)="([^"]*)"/g;
  let m;
  let letto = '';
  while ((m = re.exec(markup))) { out[m[1]] = decodificaAttributo(m[2]); letto += m[0] + ' '; }
  assert.strictEqual(letto.trim(), markup.trim(), `markup non ben formato: ${markup}`);
  return out;
}

function attraversa(...args) {
  const a = attributi(window.azione('click', 'cattura', ...args));
  assert.strictEqual(a['data-on-click'], 'cattura');
  return JSON.parse(a['data-args-click']);
}

let test = 0;
function ok(nome) { console.log(`  ok ${++test} — ${nome}`); }

{
  const payload = [
    "x');alert(1);//",
    'x");alert(1);//',
    '"><img src=x onerror=alert(1)>',
    '\\\');alert(1);//',
    '&#039;);alert(1);//',
    '&amp;#039;',
    '</script><script>alert(1)</script>',
    '${alert(1)}',
    'riga separatore paragrafo\nnuova',
    'https://esempio.it/a?b=1&c=\'2\'',
  ];
  for (const p of payload) assert.deepStrictEqual(attraversa(p), [p], `valore alterato: ${JSON.stringify(p)}`);
  ok('payload ostili ricevuti identici, attributo mai spezzato');
}

{
  assert.deepStrictEqual(attraversa('ms-1718293847-ab12', 3, -1, true, null), ['ms-1718293847-ab12', 3, -1, true, null]);
  assert.deepStrictEqual(attraversa('Cod. Vat. lat. 3225 — f. 12ʳ'), ['Cod. Vat. lat. 3225 — f. 12ʳ']);
  ok('stringhe, numeri, booleani e null');
}

{
  const a = attributi(window.azione('change', 'aggiorna'));
  assert.deepStrictEqual(a, { 'data-on-change': 'aggiorna' });
  const b = attributi(window.azione('click', 'x" onclick="alert(1)'));
  assert.strictEqual(b['data-on-click'], 'x" onclick="alert(1)', 'il nome resta un valore, non diventa un attributo');
  assert.ok(!('onclick' in b));
  ok('nessun argomento; nome ostile contenuto');
}

console.log(`azioni: ${test} test superati`);
