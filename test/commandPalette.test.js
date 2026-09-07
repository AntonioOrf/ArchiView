const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Esercita la funzione REALE di ordinamento della command palette (Fase 1.4). Stesso
// metodo di queryFilters.test.js: il renderer non e' importabile (tutto vive su
// `window`), quindi si estrae il sorgente e lo si valuta contro un `window` finto. Se
// la forma della funzione cambia, l'estrazione fallisce in modo rumoroso invece di
// testare una copia divergente.
const PALETTE = path.join(__dirname, '..', 'src', 'renderer', 'js', 'components', 'commandPalette.ts');
const UTILS = path.join(__dirname, '..', 'src', 'renderer', 'js', 'logic', 'utils.ts');

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

function caricaFunzioni() {
  const codice = [
    // filtraComandi normalizza tramite normalizzaTesto: senza la funzione vera il test
    // proverebbe un confronto accento-sensibile che nell'app non esiste.
    estraiFunzione(fs.readFileSync(UTILS, 'utf8'), 'normalizzaTesto', 'utils.ts'),
    estraiFunzione(fs.readFileSync(PALETTE, 'utf8'), 'filtraComandi', 'commandPalette.ts')
  ].join('\n');

  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', codice)(window);
  assert.strictEqual(typeof window.filtraComandi, 'function', 'filtraComandi non caricata');
  return window;
}

/** Comandi finti, nell'ordine di registrazione dell'app: azioni, schede, cartelle. */
function comandi() {
  return [
    { id: 'nuova-scheda', label: 'Nuova scheda', gruppo: 'Azioni', chiavi: ['crea', 'inserisci'] },
    { id: 'cerca', label: 'Cerca nell’archivio', gruppo: 'Azioni', chiavi: ['trova'] },
    { id: 'impostazioni', label: 'Impostazioni', gruppo: 'Azioni', chiavi: ['opzioni', 'lingua'] },
    { id: 'esporta', label: 'Esporta Cartella', gruppo: 'Azioni', chiavi: ['zip', 'backup'] },
    { id: 'scheda-1', label: 'MS 12', gruppo: 'Vai alla scheda', sottotitolo: 'Perugia · Notarile' },
    { id: 'cartella-1', label: 'Notarile', gruppo: 'Vai alla cartella', sottotitolo: 'Archivio/Notarile' },
    { id: 'tipo-1', label: 'Nuova scheda di tipo: Imbreviature', gruppo: 'Nuova scheda di tipo', chiavi: ['crea'] }
  ];
}

const ids = (voci) => voci.map(v => v.id);

function runTests() {
  console.log('Running commandPalette tests...');
  const W = caricaFunzioni();

  // 1) Query vuota: nessun riordino. E' cio' che rende la palette prevedibile appena
  //    aperta, prima ancora di digitare.
  assert.deepStrictEqual(ids(W.filtraComandi(comandi(), '')), ids(comandi()));
  assert.deepStrictEqual(ids(W.filtraComandi(comandi(), '   ')), ids(comandi()));
  console.log('OK Test 1: query vuota = ordine di registrazione.');

  // 2) Il prefisso dell'etichetta batte tutto: "imp" deve dare "Impostazioni" per
  //    primo, non una voce che contiene "imp" a meta' parola.
  let r = W.filtraComandi(comandi().concat([
    { id: 'esca', label: 'Ricampionamento', gruppo: 'Azioni' }
  ]), 'imp');
  assert.strictEqual(r[0].id, 'impostazioni');
  console.log('OK Test 2: prefisso dell\'etichetta in testa.');

  // 3) Inizio di parola batte il semplice contenimento. Senza il gradino 1, "cartella"
  //    metterebbe in testa la voce in cui la parola compare per caso.
  r = W.filtraComandi([
    { id: 'contiene', label: 'Sottocartella nuova', gruppo: 'Azioni' },
    { id: 'parola', label: 'Esporta Cartella', gruppo: 'Azioni' }
  ], 'cartella');
  assert.deepStrictEqual(ids(r), ['parola', 'contiene']);
  console.log('OK Test 3: inizio di parola prima del contenimento.');

  // 4) Tutti i token devono comparire (AND), come nella griglia. "nuova archivio" non
  //    deve pescare ogni voce che contiene solo "nuova".
  r = W.filtraComandi(comandi().concat([
    { id: 'nuovo-archivio', label: 'Nuovo archivio', gruppo: 'Azioni', chiavi: ['cartella'] }
  ]), 'nuovo archivio');
  assert.deepStrictEqual(ids(r), ['nuovo-archivio']);
  console.log('OK Test 4: token in AND.');

  // 5) I sinonimi non mostrati (`chiavi`) trovano la voce, ma restano sotto le
  //    corrispondenze sull'etichetta: "backup" e' un alias di "Esporta Cartella".
  r = W.filtraComandi(comandi(), 'backup');
  assert.deepStrictEqual(ids(r), ['esporta']);
  console.log('OK Test 5: sinonimi non mostrati.');

  // 6) Il sottotitolo e' cercabile: il percorso completo di una cartella e la cartella
  //    di una scheda sono spesso l'unica cosa che l'utente ricorda.
  r = W.filtraComandi(comandi(), 'perugia');
  assert.deepStrictEqual(ids(r), ['scheda-1']);
  console.log('OK Test 6: ricerca nel sottotitolo.');

  // 7) Normalizzazione dei diacritici, come nella ricerca della griglia (Fase 0.1):
  //    "perugia" deve trovare "Perùgia" e viceversa.
  const conAccento = [{ id: 'x', label: 'Perùgia', gruppo: 'Azioni' }];
  assert.deepStrictEqual(ids(W.filtraComandi(conAccento, 'perugia')), ['x']);
  assert.deepStrictEqual(ids(W.filtraComandi([{ id: 'y', label: 'Perugia', gruppo: 'A' }], 'perù')), ['y']);
  console.log('OK Test 7: diacritici normalizzati.');

  // 8) A parita' di punteggio l'ordine di registrazione, e nessuna corrispondenza
  //    produce un elenco vuoto (la palette mostra allora il messaggio dedicato).
  r = W.filtraComandi([
    { id: 'a', label: 'Nuova scheda', gruppo: 'Azioni' },
    { id: 'b', label: 'Nuova cartella', gruppo: 'Azioni' }
  ], 'nuova');
  assert.deepStrictEqual(ids(r), ['a', 'b']);
  assert.deepStrictEqual(W.filtraComandi(comandi(), 'zzzz'), []);
  console.log('OK Test 8: stabilita\' e nessuna corrispondenza.');

  // 9) I metacaratteri di regex nella query non devono far esplodere il gradino 1:
  //    l'utente digita davvero parentesi e punti mentre cerca una segnatura.
  assert.doesNotThrow(() => W.filtraComandi(comandi(), 'ms (12'));
  r = W.filtraComandi([{ id: 'p', label: 'Dimensione reale (1:1)', gruppo: 'A' }], '(1:1)');
  assert.deepStrictEqual(ids(r), ['p']);
  console.log('OK Test 9: query con metacaratteri regex.');

  console.log('\nTutti i test commandPalette superati.');
}

runTests();
