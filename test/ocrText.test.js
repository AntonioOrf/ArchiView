const assert = require('assert');
const {
  SOGLIA_CONFIDENZA,
  normalizzaRiga,
  unisciSillabazione,
  righeNormalizzate,
  testoOcrPiano,
  testoOcrInHtml,
  confidenzaMedia,
  confidenzePerParola,
  unisciPagine
} = require('../out/main/ocr/ocrText');

let test = 0;
function ok(nome) { console.log(`  ok ${++test} — ${nome}`); }

{
  const conSoftHyphen = 'con­ven­zione';
  assert.strictEqual(normalizzaRiga(conSoftHyphen), 'convenzione', 'soft hyphen rimosso');

  assert.strictEqual(normalizzaRiga('abc'), 'abc', 'caratteri di controllo rimossi');
  assert.strictEqual(normalizzaRiga('  due   spazi unificati  '), 'due spazi unificati', 'spazi collassati e trim');
  assert.strictEqual(normalizzaRiga(null), '', 'null non fa esplodere nulla');
  assert.strictEqual(normalizzaRiga('Perùgia è città'), 'Perùgia è città', 'diacritici conservati');
  ok('normalizzaRiga toglie invisibili e conserva i diacritici');
}

{
  assert.deepStrictEqual(
    unisciSillabazione(['conven-', 'zione notarile']),
    ['convenzione notarile'],
    'parola sillabata ricomposta'
  );

  assert.deepStrictEqual(
    unisciSillabazione(['Rossi-', 'Bianchi']),
    ['Rossi-', 'Bianchi'],
    'trattino vero non unito davanti a maiuscola'
  );

  assert.deepStrictEqual(unisciSillabazione(['finale-']), ['finale-'], 'ultima riga conservata');
  ok('unisciSillabazione unisce solo davanti a minuscola');
}

{
  const righe = [
    { text: 'Prima riga del primo', confidence: 95 },
    { text: 'paragrafo.', confidence: 95 },
    { text: '~~', confidence: 20 },
    { text: 'Secondo paragrafo.', confidence: 90 }
  ];
  const piano = testoOcrPiano(righe);
  assert.strictEqual(piano, 'Prima riga del primo paragrafo.\n\nSecondo paragrafo.', 'due paragrafi separati');

  assert.ok(!piano.includes('~~'), 'riga di rumore scartata');
  ok('le righe di scarto separano i paragrafi invece di sparire');
}

{
  const righe = [{
    text: 'notarius scripsit',
    confidence: 70,
    words: [
      { text: 'notarius', confidence: 96 },
      { text: 'scripsit', confidence: 41 }
    ]
  }];
  const html = testoOcrInHtml(righe);
  assert.ok(html.includes('<span class="ocr-incerto"'), 'la parola sotto soglia e\' marcata');
  assert.ok(/notarius(?!<)/.test(html.replace(/<span[^>]*>scripsit<\/span>/, '')), 'la parola sicura non e\' marcata');
  assert.ok(html.includes('>scripsit<'), 'il testo della parola incerta e\' conservato');
  assert.strictEqual((html.match(/ocr-incerto/g) || []).length, 1, 'una sola parola marcata');
  ok('le parole sotto soglia sono marcate, le altre no');
}

{
  const html = testoOcrInHtml([{ text: '<script>alert(1)</script>', confidence: 99, words: [] }]);
  assert.ok(!html.includes('<script>'), 'il markup letto dalla pagina e\' neutralizzato');
  assert.ok(html.includes('&lt;script&gt;'), 'ed e\' conservato come testo');

  const conIntestazione = testoOcrInHtml([{ text: 'testo', confidence: 99, words: [] }], { intestazione: 'OCR ita' });
  assert.ok(conIntestazione.startsWith('<p class="ocr-origine">'), 'provenienza in testa');
  ok('escape dell\'HTML e riga di provenienza');
}

{
  const righe = [
    { text: 'a'.repeat(100), confidence: 90 },
    { text: 'xy', confidence: 10 }
  ];
  const media = confidenzaMedia(righe);
  assert.ok(media > 87 && media < 90, `media pesata attesa ~88.4, ottenuta ${media}`);

  assert.notStrictEqual(Math.round(media), 50, 'la media non e\' quella aritmetica semplice');
  assert.strictEqual(confidenzaMedia([]), 0, 'nessuna riga → 0');
  ok('confidenzaMedia pesa sulla lunghezza delle righe');
}

{
  const piano = testoOcrPiano(['Prima riga', 'seconda riga']);
  assert.strictEqual(piano, 'Prima riga seconda riga', 'stringhe nude accettate');

  const html = testoOcrInHtml(['testo semplice']);
  assert.ok(!html.includes('ocr-incerto'), 'senza confidenze non si marca nulla');
  ok('le stringhe nude sono una forma valida di ingresso');
}

{
  const esito = unisciPagine([
    { numero: 1, righe: [{ text: 'Carta prima', confidence: 90, words: [] }] },
    { numero: 2, righe: [{ text: 'Carta seconda', confidence: 90, words: [] }] }
  ]);
  assert.ok(esito.piano.includes('[p. 1]') && esito.piano.includes('[p. 2]'), 'numeri di pagina nel testo piano');
  assert.ok(esito.html.includes('ocr-pagina'), 'separatore di pagina nell\'HTML');
  assert.ok(esito.piano.indexOf('Carta prima') < esito.piano.indexOf('Carta seconda'), 'ordine conservato');

  const conVuota = unisciPagine([
    { numero: 1, righe: [] },
    { numero: 2, righe: [{ text: 'Solo questa', confidence: 90, words: [] }] }
  ]);
  assert.ok(!conVuota.piano.includes('[p. 1]'), 'la pagina senza testo non compare');
  ok('unisciPagine numera le pagine e salta quelle vuote');
}

{
  const mappa = confidenzePerParola([
    { text: 'x', confidence: 50, words: [{ text: 'notaio', confidence: 95 }] },
    { text: 'y', confidence: 50, words: [{ text: 'notaio', confidence: 32 }] }
  ]);
  assert.strictEqual(mappa.get('notaio'), 32, 'della stessa parola vince la confidenza peggiore');
  ok('confidenzePerParola tiene la confidenza peggiore');
}

{
  assert.strictEqual(typeof SOGLIA_CONFIDENZA, 'number', 'la soglia e\' esportata');
  const sopra = testoOcrInHtml([{ text: 'w', confidence: 99, words: [{ text: 'w', confidence: SOGLIA_CONFIDENZA }] }]);
  const sotto = testoOcrInHtml([{ text: 'w', confidence: 99, words: [{ text: 'w', confidence: SOGLIA_CONFIDENZA - 1 }] }]);
  assert.ok(!sopra.includes('ocr-incerto'), 'esattamente alla soglia non e\' incerto');
  assert.ok(sotto.includes('ocr-incerto'), 'appena sotto la soglia lo e\'');
  ok('la soglia e\' inclusiva verso l\'alto');
}

console.log(`\nocrText: ${test} test superati.`);
