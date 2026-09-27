// jsArg — argomenti stringa negli handler inline (onclick="fn(${jsArg(v)})").
//
// Il valore attraversa DUE parser: prima l'HTML decodifica le entità dell'attributo, poi il
// JS legge il codice risultante. escapeHTML da solo protegge solo il primo: &#039; torna ' e
// chiude il letterale. Il test riproduce la stessa catena (decodifica a passaggio singolo,
// poi valutazione) su payload ostili, perché i valori arrivano dal vault condiviso.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const UTILS = path.join(__dirname, '..', 'src', 'renderer', 'js', 'logic', 'utils.ts');

function estraiFunzione(sorgente, nome) {
  const marker = 'window.' + nome + ' = function';
  const inizio = sorgente.indexOf(marker);
  assert.notStrictEqual(inizio, -1, `Funzione ${nome} non trovata in utils.ts: estrazione da aggiornare`);
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

const src = fs.readFileSync(UTILS, 'utf8');
const window = {};
// eslint-disable-next-line no-new-func
new Function('window', ['escapeHTML', 'jsArg'].map(n => estraiFunzione(src, n)).join('\n'))(window);

// Decodifica delle entità di un attributo HTML: un solo passaggio, come il tokenizer.
const ENTITA = { amp: '&', lt: '<', gt: '>', quot: '"', '#039': "'", '#39': "'" };
const decodificaAttributo = (s) => s.replace(/&(amp|lt|gt|quot|#039|#39);/g, (_, e) => ENTITA[e]);

// Simula onclick="cattura(${jsArg(v)})": HTML → JS, e restituisce ciò che la funzione riceve.
function attraversa(valore) {
  const attributo = `cattura(${window.jsArg(valore)})`;
  assert.ok(!attributo.includes('"'), 'nessun " grezzo: chiuderebbe l\'attributo');
  const codice = decodificaAttributo(attributo);
  let ricevuto;
  let effetti = 0;
  // eslint-disable-next-line no-new-func
  new Function('cattura', 'alert', codice)((v) => { ricevuto = v; }, () => { effetti++; });
  assert.strictEqual(effetti, 0, `payload eseguito: ${JSON.stringify(valore)}`);
  return ricevuto;
}

let test = 0;
function ok(nome) { console.log(`  ok ${++test} — ${nome}`); }

// --- Test 1: il vecchio schema è davvero vulnerabile ---------------------------
// Tiene onesto il test: se la simulazione non riproducesse il bug, i test sotto non
// dimostrerebbero nulla.
{
  const payload = "x');alert(1);//";
  const vecchio = decodificaAttributo(`cattura('${window.escapeHTML(payload)}')`);
  let effetti = 0;
  // eslint-disable-next-line no-new-func
  new Function('cattura', 'alert', vecchio)(() => {}, () => { effetti++; });
  assert.strictEqual(effetti, 1, 'con il solo escapeHTML il payload deve eseguire');
  ok("escapeHTML dentro '...' è aggirabile (baseline)");
}

// --- Test 2: payload ostili arrivano intatti come stringa ----------------------
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
    'riga separatore paragrafo\nnuova',
    'https://esempio.it/a?b=1&c=\'2\'',
  ];
  for (const p of payload) assert.strictEqual(attraversa(p), p, `valore alterato: ${JSON.stringify(p)}`);
  ok('payload ostili ricevuti identici, nessuna esecuzione');
}

// --- Test 3: valori ordinari e nulli -----------------------------------------
{
  assert.strictEqual(attraversa('ms-1718293847-ab12'), 'ms-1718293847-ab12');
  assert.strictEqual(attraversa('Cod. Vat. lat. 3225 — f. 12ʳ'), 'Cod. Vat. lat. 3225 — f. 12ʳ');
  assert.strictEqual(attraversa(42), '42', 'i numeri diventano stringa, come col vecchio schema');
  assert.strictEqual(attraversa(null), '');
  assert.strictEqual(attraversa(undefined), '');
  ok('id, segnature, numeri e nulli');
}

console.log(`jsArg: ${test} test superati`);
