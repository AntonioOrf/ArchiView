const assert = require('assert');
const fs = require('fs');
const path = require('path');

const UTILS = path.join(__dirname, '..', 'out', 'renderer', 'js', 'logic', 'utils.js');

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

function carica() {
  const src = (fs.readFileSync(UTILS, 'utf8') + '\n' + fs.readFileSync(UTILS.replace('utils.js', 'trascrizioneLogic.js'), 'utf8'));
  const nomi = [
    'trascrizioneHaTesto',
    'leggiTrascrizioneAllegato',
    'scriviTrascrizioneAllegato',
    'migraTrascrizioneSuAllegati',
    'componiTrascrizioneRecord',
    'componiPagineAllegato',
    'dividiTrascrizionePerPagine',
    'migraTrascrizionePdfSuPagine'
  ];
  const codice = nomi.map(n => estraiFunzione(src, n)).join('\n');
  const window = {
    escapeHTML: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  };
  // eslint-disable-next-line no-new-func
  new Function('window', codice)(window);
  for (const n of nomi) assert.strictEqual(typeof window[n], 'function', `${n} non caricata`);
  return window;
}

const w = carica();
let test = 0;
function ok(nome) { console.log(`  ok ${++test} — ${nome}`); }

const carta = (nome, trascrizione) => ({ nome, originalName: nome, tipo: 'immagine', trascrizione });

{
  assert.strictEqual(w.trascrizioneHaTesto('<p><br></p>'), false, 'paragrafo vuoto = niente testo');
  assert.strictEqual(w.trascrizioneHaTesto('<p>&nbsp;</p>'), false, 'solo spazio unificatore = niente testo');
  assert.strictEqual(w.trascrizioneHaTesto(''), false);
  assert.strictEqual(w.trascrizioneHaTesto(null), false);
  assert.strictEqual(w.trascrizioneHaTesto('<p>Instrumentum</p>'), true);
  ok('trascrizioneHaTesto ignora il markup vuoto');
}

{
  const m = { trascrizione: '<p>Testo</p>' };
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0), '<p>Testo</p>');
  w.scriviTrascrizioneAllegato(m, 0, '<p>Nuovo</p>');
  assert.strictEqual(m.trascrizione, '<p>Nuovo</p>', 'senza allegati si scrive sul record');
  assert.strictEqual(w.componiTrascrizioneRecord(m), '<p>Nuovo</p>', 'e la derivata coincide');
  ok('la scheda senza allegati conserva il comportamento di prima');
}

{
  const m = { allegati: [carta('a.png', '<p>Uno</p>'), carta('b.png', '<p>Due</p>')] };
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0), '<p>Uno</p>');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 1), '<p>Due</p>');

  w.scriviTrascrizioneAllegato(m, 1, '<p>Due bis</p>');
  assert.strictEqual(m.allegati[1].trascrizione, '<p>Due bis</p>');
  assert.strictEqual(m.allegati[0].trascrizione, '<p>Uno</p>', 'la carta accanto resta intatta');

  w.scriviTrascrizioneAllegato(m, 9, '<p>Nulla</p>');
  assert.strictEqual(m.allegati.length, 2, 'un indice inesistente non aggiunge allegati');
  ok('ogni carta ha il suo testo e non tocca le altre');
}

{
  const m = { trascrizione: '<p>Lettura di ore</p>', allegati: [carta('a.png'), carta('b.png')] };
  assert.strictEqual(w.migraTrascrizioneSuAllegati(m), true, 'la prima volta migra');
  assert.strictEqual(m.allegati[0].trascrizione, '<p>Lettura di ore</p>');
  assert.strictEqual(m.allegati[1].trascrizione, undefined, 'le altre carte restano vuote');

  m.allegati[0].trascrizione = '<p>Rivista a mano</p>';
  assert.strictEqual(w.migraTrascrizioneSuAllegati(m), false, 'la seconda volta non fa nulla');
  assert.strictEqual(m.allegati[0].trascrizione, '<p>Rivista a mano</p>', 'il lavoro successivo sopravvive');
  ok('la migrazione e\' idempotente e non sovrascrive il lavoro fatto dopo');
}

{
  const vuota = { trascrizione: '<p><br></p>', allegati: [carta('a.png')] };
  assert.strictEqual(w.migraTrascrizioneSuAllegati(vuota), false, 'niente testo, niente migrazione');
  assert.strictEqual(vuota.allegati[0].trascrizione, undefined);

  const senzaAllegati = { trascrizione: '<p>Testo</p>', allegati: [] };
  assert.strictEqual(w.migraTrascrizioneSuAllegati(senzaAllegati), false);
  assert.strictEqual(senzaAllegati.trascrizione, '<p>Testo</p>', 'il campo storico resta dov\'e\'');
  ok('la migrazione non tocca schede vuote o senza allegati');
}

{
  const m = { allegati: [carta('recto.png', '<p>Uno</p>'), carta('verso.png', '<p>Due</p>')] };
  const derivata = w.componiTrascrizioneRecord(m);
  assert.ok(derivata.includes('<p>Uno</p>') && derivata.includes('<p>Due</p>'), 'contiene tutte le carte');
  assert.ok(derivata.indexOf('Uno') < derivata.indexOf('Due'), 'nell\'ordine degli allegati');
  assert.ok(derivata.includes('recto.png') && derivata.includes('verso.png'), 'con il nome di ogni carta');

  const singola = { allegati: [carta('a.png', '<p>Solo</p>'), carta('b.png')] };
  assert.strictEqual(w.componiTrascrizioneRecord(singola), '<p>Solo</p>', 'nessuna intestazione con una carta sola');

  assert.strictEqual(w.componiTrascrizioneRecord({ allegati: [carta('a.png'), carta('b.png')] }), '');
  ok('la derivata concatena in ordine e intesta solo quando serve');
}

{
  const m = {
    allegati: [carta('<img src=x onerror=alert(1)>', '<p>Uno</p>'), carta('b.png', '<p>Due</p>')]
  };
  const derivata = w.componiTrascrizioneRecord(m);
  assert.ok(!derivata.includes('<img src=x'), 'il nome ostile non entra come markup');
  assert.ok(derivata.includes('&lt;img'), 'ma resta leggibile come testo');
  ok('i nomi degli allegati sono passati per escape');
}

{
  const m = { allegati: [carta('a.png', '<p>Uno</p>'), carta('b.png', '<p>Due</p>'), carta('c.png', '<p>Tre</p>')] };
  const spostata = m.allegati.splice(2, 1)[0];
  m.allegati.splice(0, 0, spostata);
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0), '<p>Tre</p>', 'il testo segue la carta spostata');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 1), '<p>Uno</p>');
  const derivata = w.componiTrascrizioneRecord(m);
  assert.ok(derivata.indexOf('Tre') < derivata.indexOf('Uno'), 'e la derivata segue il nuovo ordine');
  ok('il riordino delle carte porta con se\' le trascrizioni');
}

const pdf = (nome, trascrizione) => {
  const a = { nome, originalName: nome, tipo: 'pdf' };
  if (trascrizione !== undefined) a.trascrizione = trascrizione;
  return a;
};
const MARCA = (n) => `<p class="ocr-pagina"><strong>[p. ${n}]</strong></p>`;

{
  const m = { allegati: [pdf('a.pdf')] };
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 1), '', 'PDF nuovo: pagina vuota');
  w.scriviTrascrizioneAllegato(m, 0, '<p>Uno</p>', 1);
  w.scriviTrascrizioneAllegato(m, 0, '<p>Tre</p>', 3);
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 1), '<p>Uno</p>');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 2), '', 'la pagina saltata resta vuota');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 3), '<p>Tre</p>');
  const d = m.allegati[0].trascrizione;
  assert.ok(d.includes(MARCA(1)) && d.includes(MARCA(3)) && !d.includes(MARCA(2)), 'la derivata porta i numeri delle pagine con testo');
  assert.ok(w.componiTrascrizioneRecord(m).includes('<p>Tre</p>'), 'e arriva alla derivata della scheda');
  ok('PDF: il testo segue la pagina');
}

{
  const m = { allegati: [pdf('a.pdf')] };
  w.scriviTrascrizioneAllegato(m, 0, '<p>Uno</p>', 1);
  for (let p = 2; p <= 50; p++) w.scriviTrascrizioneAllegato(m, 0, '<p><br></p>', p);
  assert.deepStrictEqual(m.allegati[0].pagine, ['<p>Uno</p>'], 'nessuna pagina vuota accumulata');
  assert.strictEqual(m.allegati[0].trascrizione, '<p>Uno</p>', 'solo p. 1: derivata senza marcatore');
  w.scriviTrascrizioneAllegato(m, 0, '<p><br></p>', 1);
  assert.deepStrictEqual(m.allegati[0].pagine, [], 'cancellare l\'unica pagina svuota tutto');
  assert.strictEqual(m.allegati[0].trascrizione, '');
  ok('PDF: le pagine solo sfogliate non entrano nel database');
}

{
  const vecchia = '<p class="ocr-origine"><em>OCR</em></p>\n' + MARCA(1) + '\n<p>Alfa</p>\n' + MARCA(2) + '\n<p>Beta</p>';
  const a = pdf('a.pdf', vecchia);
  assert.strictEqual(w.migraTrascrizionePdfSuPagine(a), true, 'la prima volta divide');
  assert.strictEqual(a.pagine.length, 2);
  assert.ok(a.pagine[0].includes('OCR') && a.pagine[0].includes('Alfa'), 'l\'intestazione resta sulla p. 1');
  assert.strictEqual(a.pagine[1], '<p>Beta</p>');
  a.trascrizione = w.componiPagineAllegato(a.pagine);
  assert.strictEqual(w.migraTrascrizionePdfSuPagine(a), false, 'la seconda volta non fa nulla');
  ok('PDF: la trascrizione OCR multipagina si divide sui marcatori');
}

{
  const a = pdf('a.pdf', '<p>Blocco unico</p>');
  const m = { allegati: [a] };
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 1), '<p>Blocco unico</p>');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 2), '');
  assert.strictEqual(w.migraTrascrizionePdfSuPagine(pdf('b.pdf', '<p><br></p>')), false, 'niente testo, niente pagine');
  assert.strictEqual(w.migraTrascrizionePdfSuPagine(carta('c.png', '<p>x</p>')), false, 'le immagini non si toccano');
  ok('PDF: una trascrizione senza marcatori finisce sulla prima pagina');
}

{
  const pagine = ['<p>Uno</p>', '', '<p>Tre</p>\n<p>ancora</p>', '<ul><li>Quattro</li></ul>'];
  const d = w.componiPagineAllegato(pagine);
  const back = w.dividiTrascrizionePerPagine(d);
  assert.deepStrictEqual(back, pagine, 'dividi(componi(x)) === x');
  const doppio = MARCA(2) + '\n<p>A</p>\n' + MARCA(2) + '\n<p>B</p>';
  assert.deepStrictEqual(w.dividiTrascrizionePerPagine(doppio), ['', '<p>A</p>\n<p>B</p>']);
  ok('PDF: componi e dividi sono l\'una l\'inversa dell\'altra');
}

{
  const m = { allegati: [pdf('a.pdf')] };
  w.scriviTrascrizioneAllegato(m, 0, '<p>Uno</p>', 1);
  w.scriviTrascrizioneAllegato(m, 0, '<p>Due</p>', 2);
  m.allegati[0].trascrizione = m.allegati[0].trascrizione.replace('Due', 'Due corretto');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 2), '<p>Due corretto</p>');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 1), '<p>Uno</p>');
  ok('PDF: la derivata modificata altrove ricostruisce le pagine');
}

{
  const m = { allegati: [pdf('a.pdf', '<p>Tutto</p>')] };
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0), '<p>Tutto</p>');
  w.scriviTrascrizioneAllegato(m, 0, '<p>Nuovo</p>');
  assert.strictEqual(m.allegati[0].trascrizione, '<p>Nuovo</p>');
  ok('PDF: senza numero di pagina resta il testo dell\'allegato');
}

{
  const { unisciPagine, testoOcrInHtml } = require('../out/main/ocr/ocrText');
  const riga = (t) => [{ text: t, confidence: 90, words: [] }];
  const { html } = unisciPagine([
    { numero: 1, righe: riga('Carta prima') },
    { numero: 3, righe: riga('Carta terza') }
  ]);
  const pagine = w.dividiTrascrizionePerPagine(html);
  assert.strictEqual(pagine.length, 3, 'una voce per pagina fino all\'ultima con testo');
  assert.strictEqual(pagine[0], testoOcrInHtml(riga('Carta prima')), 'la prima pagina è il suo HTML, intero');
  assert.strictEqual(pagine[1], '', 'la pagina senza testo resta vuota');
  assert.ok(pagine[2].includes('Carta terza') && !pagine[2].includes('[p.'), 'la terza ha il suo testo, senza marcatore');
  ok('OCR multipagina: unisciPagine (main) e dividiTrascrizionePerPagine (renderer) si capiscono');
}

console.log(`\ntrascrizioneAllegati: ${test} test superati.`);
