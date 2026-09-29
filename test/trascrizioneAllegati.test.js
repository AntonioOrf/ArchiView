// Fase 2.3-bis — trascrizione per allegato.
//
// Le quattro funzioni sono pure e vivono in utils.ts, quindi si esercitano con la stessa
// tecnica di searchNormalize.test.js: si ESTRAE il sorgente reale e lo si valuta contro un
// `window` finto, invece di riprodurne una copia che può divergere in silenzio.
//
// L'invariante che conta e' una sola: nessun testo deve poter sparire. Passare da una carta
// all'altra, migrare da un archivio vecchio, riordinare gli allegati — nessuna di queste
// operazioni puo' perdere una trascrizione, che e' ore di lavoro di lettura.
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

function carica() {
  const src = fs.readFileSync(UTILS, 'utf8');
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
    // `componiTrascrizioneRecord` usa escapeHTML per i nomi degli allegati, che sono dati
    // utente: qui basta la stessa semantica, non la stessa implementazione.
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

// --- Test 1: "ha testo" non e' "diverso da stringa vuota" --------------------
// Un contenteditable svuotato lascia <p><br></p>: con un confronto ingenuo ogni scheda mai
// aperta in trascrizione risulterebbe "con trascrizione", e la migrazione scriverebbe
// spazzatura sulla prima carta.
{
  assert.strictEqual(w.trascrizioneHaTesto('<p><br></p>'), false, 'paragrafo vuoto = niente testo');
  assert.strictEqual(w.trascrizioneHaTesto('<p>&nbsp;</p>'), false, 'solo spazio unificatore = niente testo');
  assert.strictEqual(w.trascrizioneHaTesto(''), false);
  assert.strictEqual(w.trascrizioneHaTesto(null), false);
  assert.strictEqual(w.trascrizioneHaTesto('<p>Instrumentum</p>'), true);
  ok('trascrizioneHaTesto ignora il markup vuoto');
}

// --- Test 2: senza allegati resta il campo della scheda ----------------------
// E' il comportamento storico e non deve cambiare: una scheda senza immagini continua ad
// avere una trascrizione sola.
{
  const m = { trascrizione: '<p>Testo</p>' };
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0), '<p>Testo</p>');
  w.scriviTrascrizioneAllegato(m, 0, '<p>Nuovo</p>');
  assert.strictEqual(m.trascrizione, '<p>Nuovo</p>', 'senza allegati si scrive sul record');
  assert.strictEqual(w.componiTrascrizioneRecord(m), '<p>Nuovo</p>', 'e la derivata coincide');
  ok('la scheda senza allegati conserva il comportamento di prima');
}

// --- Test 3: lettura e scrittura per carta ----------------------------------
{
  const m = { allegati: [carta('a.png', '<p>Uno</p>'), carta('b.png', '<p>Due</p>')] };
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0), '<p>Uno</p>');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 1), '<p>Due</p>');

  w.scriviTrascrizioneAllegato(m, 1, '<p>Due bis</p>');
  assert.strictEqual(m.allegati[1].trascrizione, '<p>Due bis</p>');
  // La carta accanto NON deve essere toccata: e' esattamente il difetto segnalato.
  assert.strictEqual(m.allegati[0].trascrizione, '<p>Uno</p>', 'la carta accanto resta intatta');

  // Indice fuori intervallo: non deve creare carte fantasma ne' esplodere.
  w.scriviTrascrizioneAllegato(m, 9, '<p>Nulla</p>');
  assert.strictEqual(m.allegati.length, 2, 'un indice inesistente non aggiunge allegati');
  ok('ogni carta ha il suo testo e non tocca le altre');
}

// --- Test 4: migrazione dall'archivio vecchio -------------------------------
// Il testo unico va sulla PRIMA carta. Non si tenta di spezzarlo: non c'e' modo di sapere
// dove finisce una carta, e un taglio inventato sarebbe peggio di un blocco da smistare.
{
  const m = { trascrizione: '<p>Lettura di ore</p>', allegati: [carta('a.png'), carta('b.png')] };
  assert.strictEqual(w.migraTrascrizioneSuAllegati(m), true, 'la prima volta migra');
  assert.strictEqual(m.allegati[0].trascrizione, '<p>Lettura di ore</p>');
  assert.strictEqual(m.allegati[1].trascrizione, undefined, 'le altre carte restano vuote');

  // Idempotenza: e' il punto piu' pericoloso. Girando all'apertura della vista, una seconda
  // migrazione sovrascriverebbe il lavoro fatto dopo la prima.
  m.allegati[0].trascrizione = '<p>Rivista a mano</p>';
  assert.strictEqual(w.migraTrascrizioneSuAllegati(m), false, 'la seconda volta non fa nulla');
  assert.strictEqual(m.allegati[0].trascrizione, '<p>Rivista a mano</p>', 'il lavoro successivo sopravvive');
  ok('la migrazione e\' idempotente e non sovrascrive il lavoro fatto dopo');
}

// --- Test 5: la migrazione non inventa testo --------------------------------
{
  const vuota = { trascrizione: '<p><br></p>', allegati: [carta('a.png')] };
  assert.strictEqual(w.migraTrascrizioneSuAllegati(vuota), false, 'niente testo, niente migrazione');
  assert.strictEqual(vuota.allegati[0].trascrizione, undefined);

  const senzaAllegati = { trascrizione: '<p>Testo</p>', allegati: [] };
  assert.strictEqual(w.migraTrascrizioneSuAllegati(senzaAllegati), false);
  assert.strictEqual(senzaAllegati.trascrizione, '<p>Testo</p>', 'il campo storico resta dov\'e\'');
  ok('la migrazione non tocca schede vuote o senza allegati');
}

// --- Test 6: forma derivata --------------------------------------------------
// `m.trascrizione` continua a essere popolata: e' cio' che tiene in piedi senza modifiche
// l'indice di ricerca, il filtro "ha trascrizione" e il diff del merge — e cio' che fa
// vedere il testo a un collega con una versione precedente dell'app.
{
  const m = { allegati: [carta('recto.png', '<p>Uno</p>'), carta('verso.png', '<p>Due</p>')] };
  const derivata = w.componiTrascrizioneRecord(m);
  assert.ok(derivata.includes('<p>Uno</p>') && derivata.includes('<p>Due</p>'), 'contiene tutte le carte');
  assert.ok(derivata.indexOf('Uno') < derivata.indexOf('Due'), 'nell\'ordine degli allegati');
  assert.ok(derivata.includes('recto.png') && derivata.includes('verso.png'), 'con il nome di ogni carta');

  // Con UNA sola carta valorizzata l'intestazione sarebbe rumore.
  const singola = { allegati: [carta('a.png', '<p>Solo</p>'), carta('b.png')] };
  assert.strictEqual(w.componiTrascrizioneRecord(singola), '<p>Solo</p>', 'nessuna intestazione con una carta sola');

  // Nessuna carta scritta → derivata vuota, non una sfilza di intestazioni.
  assert.strictEqual(w.componiTrascrizioneRecord({ allegati: [carta('a.png'), carta('b.png')] }), '');
  ok('la derivata concatena in ordine e intesta solo quando serve');
}

// --- Test 7: il nome dell'allegato e' dato utente ---------------------------
// Finisce dentro l'HTML della derivata, che viene reso nell'editor: va passato per escape,
// altrimenti un file rinominato con un tag aprirebbe markup nella trascrizione.
{
  const m = {
    allegati: [carta('<img src=x onerror=alert(1)>', '<p>Uno</p>'), carta('b.png', '<p>Due</p>')]
  };
  const derivata = w.componiTrascrizioneRecord(m);
  assert.ok(!derivata.includes('<img src=x'), 'il nome ostile non entra come markup');
  assert.ok(derivata.includes('&lt;img'), 'ma resta leggibile come testo');
  ok('i nomi degli allegati sono passati per escape');
}

// --- Test 8: il riordino non perde il testo ---------------------------------
// Il testo viaggia con l'oggetto allegato, quindi uno splice lo porta con se'. E' cio' che
// permette al riordino delle miniature di essere una riga sola.
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

// --- Trascrizione per pagina nei PDF -----------------------------------------
const pdf = (nome, trascrizione) => {
  const a = { nome, originalName: nome, tipo: 'pdf' };
  if (trascrizione !== undefined) a.trascrizione = trascrizione;
  return a;
};
const MARCA = (n) => `<p class="ocr-pagina"><strong>[p. ${n}]</strong></p>`;

// --- Test 9: ogni pagina ha il suo testo -------------------------------------
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

// --- Test 10: sfogliare non sporca il record ----------------------------------
// Il travaso scrive l'editor a ogni cambio pagina, anche vuoto.
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

// --- Test 11: la vecchia trascrizione OCR si divide esattamente --------------
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

// --- Test 12: senza marcatori tutto sulla p. 1 --------------------------------
{
  const a = pdf('a.pdf', '<p>Blocco unico</p>');
  const m = { allegati: [a] };
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 1), '<p>Blocco unico</p>');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 2), '');
  assert.strictEqual(w.migraTrascrizionePdfSuPagine(pdf('b.pdf', '<p><br></p>')), false, 'niente testo, niente pagine');
  assert.strictEqual(w.migraTrascrizionePdfSuPagine(carta('c.png', '<p>x</p>')), false, 'le immagini non si toccano');
  ok('PDF: una trascrizione senza marcatori finisce sulla prima pagina');
}

// --- Test 13: andata e ritorno senza perdite -----------------------------------
{
  const pagine = ['<p>Uno</p>', '', '<p>Tre</p>\n<p>ancora</p>', '<ul><li>Quattro</li></ul>'];
  const d = w.componiPagineAllegato(pagine);
  const back = w.dividiTrascrizionePerPagine(d);
  assert.deepStrictEqual(back, pagine, 'dividi(componi(x)) === x');
  // Due OCR accodati sulla stessa pagina: si sommano.
  const doppio = MARCA(2) + '\n<p>A</p>\n' + MARCA(2) + '\n<p>B</p>';
  assert.deepStrictEqual(w.dividiTrascrizionePerPagine(doppio), ['', '<p>A</p>\n<p>B</p>']);
  ok('PDF: componi e dividi sono l\'una l\'inversa dell\'altra');
}

// --- Test 14: una modifica da versione vecchia vince sulle pagine ------------
// Il collega senza le pagine modifica la derivata: al ritorno le pagine vanno rifatte da
// lì, altrimenti il suo lavoro sparisce dietro un array che non ha mai visto.
{
  const m = { allegati: [pdf('a.pdf')] };
  w.scriviTrascrizioneAllegato(m, 0, '<p>Uno</p>', 1);
  w.scriviTrascrizioneAllegato(m, 0, '<p>Due</p>', 2);
  m.allegati[0].trascrizione = m.allegati[0].trascrizione.replace('Due', 'Due corretto');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 2), '<p>Due corretto</p>');
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0, 1), '<p>Uno</p>');
  ok('PDF: la derivata modificata altrove ricostruisce le pagine');
}

// --- Test 15: senza pagina, un PDF si comporta come prima --------------------
{
  const m = { allegati: [pdf('a.pdf', '<p>Tutto</p>')] };
  assert.strictEqual(w.leggiTrascrizioneAllegato(m, 0), '<p>Tutto</p>');
  w.scriviTrascrizioneAllegato(m, 0, '<p>Nuovo</p>');
  assert.strictEqual(m.allegati[0].trascrizione, '<p>Nuovo</p>');
  ok('PDF: senza numero di pagina resta il testo dell\'allegato');
}

console.log(`\ntrascrizioneAllegati: ${test} test superati.`);
