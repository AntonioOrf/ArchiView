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
    'componiTrascrizioneRecord'
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

console.log(`\ntrascrizioneAllegati: ${test} test superati.`);
