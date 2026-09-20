// Import IIIF — normalizzazione del manifest. Il modulo e' puro e condiviso: si testa il
// build in out/, senza Electron e senza rete (stesso metodo di csvImport.test.js).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Iiif = require('../out/shared/iiifManifest');

function fixture(nome) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'iiif', nome), 'utf8'));
}

// --- Ripulitura del testo -----------------------------------------------------
{
  const t = Iiif.testoSemplice;
  assert.strictEqual(t('<a href="x">Gallica</a>'), 'Gallica', 'i tag spariscono');
  assert.strictEqual(t('Biblioth&egrave;que'), 'Bibliothèque', 'entita Latin-1 per nome');
  assert.strictEqual(t('M&uuml;nchen, &Auml;gypten'), 'München, Ägypten', 'entita Latin-1 maiuscole e minuscole');
  assert.strictEqual(t('caf&#233; &#xE9;'), 'café é', 'entita numeriche, decimali ed esadecimali');
  assert.strictEqual(t('e-codices &ndash; Fribourg'), 'e-codices – Fribourg', 'entita fuori dal blocco Latin-1');
  assert.strictEqual(t('a&nbsp;b   c\n d'), 'a b c d', 'spazi normalizzati');
  assert.strictEqual(t('&notaunaentita; &#xZZ;'), '&notaunaentita; &#xZZ;', 'cio che non e una entita resta tale');

  // ⚠️ I tag si tolgono due volte, prima e dopo la decodifica: `&lt;script&gt;` decodificato
  // diventa un `<script>` testuale, e una sola passata lo restituirebbe intatto a chi usa
  // questa funzione credendola sicura.
  assert.strictEqual(t('&lt;script&gt;alert(1)&lt;/script&gt;'), 'alert(1)', 'i tag ricostruiti dalle entita vengono tolti');
  assert.ok(!t('<script>alert(1)</script>').includes('<'), 'nessun tag sopravvive');
}

// --- Presentation 2 -----------------------------------------------------------
{
  const n = Iiif.normalizza(fixture('manifest-v2.json'));

  assert.strictEqual(n.versione, 2, 'v2: versione riconosciuta dal @context');
  assert.strictEqual(n.etichetta, 'Paris, BnF, Latin 1234', 'v2: label stringa');
  assert.strictEqual(n.carte.length, 3, 'v2: tre canvas, tre carte');

  // L'attribuzione arriva con dentro dell'HTML: si mostra come testo, quindi si conserva
  // come testo. Una stringa gia' ripulita non puo' diventare un innerHTML distratto.
  assert.strictEqual(n.attribuzione, 'Bibliothèque nationale de France', 'v2: attribution ripulita dal markup');
  assert.ok(n.licenza.includes('gallica.bnf.fr'), 'v2: license presente');

  assert.strictEqual(n.carte[0].etichetta, '1r', 'v2: label del canvas');
  assert.strictEqual(n.carte[0].serviceId, 'https://example.org/iiif/ark:12148:f1', 'v2: service @id');
  assert.strictEqual(n.carte[0].apiVersione, 2, 'v2: Image API 2 dal profile');
  assert.strictEqual(n.carte[0].larghezza, 2000, 'v2: dimensioni dalla resource');

  // Multilingua: si preferisce l'italiano quando c'e'.
  assert.strictEqual(n.carte[1].etichetta, '1v', 'v2: label multilingua, preferenza italiana');
  // Il service e' un array e l'@id finisce con una barra: la barra va tolta o l'URL
  // costruito avrebbe un doppio separatore, che diversi server rifiutano.
  assert.strictEqual(n.carte[1].serviceId, 'https://example.org/iiif/ark:12148:f2', 'v2: service in array, barra finale tolta');

  // Canvas senza servizio: resta l'immagine statica, e l'etichetta mancante NON viene
  // inventata qui (comporre "Carta 3" e' del renderer, che sa in che lingua parla).
  assert.strictEqual(n.carte[2].serviceId, null, 'v2: canvas senza service');
  assert.strictEqual(n.carte[2].urlStatico, 'https://example.org/statica/f3.jpg', 'v2: immagine statica');
  assert.strictEqual(n.carte[2].etichetta, '', 'v2: etichetta mancante resta vuota');
  assert.ok(!n.avvisi.includes('servizio_assente'), 'v2: avviso solo se NESSUNA carta ha il servizio');
}

// --- Presentation 3 -----------------------------------------------------------
{
  const n = Iiif.normalizza(fixture('manifest-v3.json'));

  assert.strictEqual(n.versione, 3, 'v3: versione riconosciuta');
  // L'ordine di preferenza segue le lingue dell'applicazione (it, poi en), non l'ordine in
  // cui il manifest elenca le sue: qui c'e' sia `de` sia `en`, e vince l'inglese.
  assert.strictEqual(n.etichetta, 'St Gall, Cod. Sang. 18', 'v3: label mappa di lingue, preferenza en su de');
  assert.strictEqual(n.attribuzione, 'e-codices – Virtual Manuscript Library of Switzerland', 'v3: requiredStatement.value');
  assert.strictEqual(n.licenza, 'http://creativecommons.org/licenses/by-nc/4.0/', 'v3: rights');
  assert.strictEqual(n.carte.length, 2, 'v3: due canvas');

  assert.strictEqual(n.carte[0].etichetta, 'p. 1', 'v3: label del canvas dalla chiave none');
  assert.strictEqual(n.carte[0].serviceId, 'https://example.org/iiif/3/csg-0018_001', 'v3: service[].id');
  assert.strictEqual(n.carte[0].apiVersione, 3, 'v3: ImageService3');

  // Body `Choice` (stessa carta a luce visibile e in ultravioletto): la risorsa vera e'
  // annidata, prenderlo per buono cosi' com'e' darebbe una carta senza immagine.
  assert.strictEqual(n.carte[1].serviceId, 'https://example.org/iiif/2/csg-0018_002', 'v3: Choice risolta alla prima risorsa');
  // Un ImageService2 incapsulato in un manifest v3 usa @id e @type: la versione della
  // Image API non si deduce da quella del manifest.
  assert.strictEqual(n.carte[1].apiVersione, 2, 'v3: ImageService2 incapsulato resta API 2');
}

// --- Collection ---------------------------------------------------------------
{
  const n = Iiif.normalizza(fixture('collection-v3.json'));
  // Incollare l'URL di una collection e' l'inciampo piu' comune: deve essere un avviso
  // con un numero da mostrare, non un manifest vuoto ne' un'eccezione.
  assert.deepStrictEqual(n.avvisi, ['collection'], 'collection: avviso dedicato');
  assert.strictEqual(n.contenuti, 2, 'collection: quanti manifest contiene');
  assert.strictEqual(n.etichetta, 'Manoscritti medievali', 'collection: label tradotta');
  assert.strictEqual(n.carte.length, 0, 'collection: nessuna carta');
}

// --- Ingressi storti ----------------------------------------------------------
{
  for (const grezzo of [null, undefined, 42, 'testo', [], {}, { type: 'Manifest' }]) {
    const n = Iiif.normalizza(grezzo);
    assert.ok(Array.isArray(n.carte) && n.carte.length === 0, 'storto: nessuna carta, nessuna eccezione');
    assert.ok(n.avvisi.length > 0, 'storto: almeno un avviso');
  }

  // Manifest senza @context ma con `sequences`: la forma basta a riconoscerlo, con avviso.
  const dedotto = Iiif.normalizza({ sequences: [{ canvases: [] }] });
  assert.strictEqual(dedotto.versione, 2, 'senza @context: versione dedotta dalla forma');
  assert.ok(dedotto.avvisi.includes('versione_ignota'), 'senza @context: avviso');
  assert.ok(dedotto.avvisi.includes('nessuna_carta'), 'sequenza vuota: avviso');
}

// --- URL della Image API ------------------------------------------------------
{
  const conServizio2 = { serviceId: 'https://example.org/iiif/x', apiVersione: 2, urlStatico: null };
  const conServizio3 = { serviceId: 'https://example.org/iiif/y', apiVersione: 3, urlStatico: null };

  // ⚠️ La size e' `w,` e NON `!w,h`. Sembrano equivalenti, ma `!w,h` e' livello 2 delle
  // specifiche: su iiif.bodleian.ox.ac.uk risponde 504 dopo cinquanta secondi, mentre `w,`
  // (livello 1, cioe' il minimo che ogni server implementa) risponde in un secondo. Era il
  // motivo per cui le miniature comparivano e il visualizzatore restava vuoto.
  assert.strictEqual(
    Iiif.urlImmagine(conServizio2, { lato: 200 }),
    'https://example.org/iiif/x/full/200,/0/default.jpg',
    'URL con larghezza richiesta, API 2'
  );
  assert.strictEqual(
    Iiif.urlImmagine(conServizio3, { lato: 200 }),
    'https://example.org/iiif/y/full/200,/0/default.jpg',
    'URL con larghezza richiesta, API 3: identico'
  );

  // Senza lato le due versioni divergono, ed e' l'unico punto in cui apiVersione conta.
  assert.strictEqual(Iiif.urlImmagine(conServizio2), 'https://example.org/iiif/x/full/full/0/default.jpg', 'size massima API 2 = full');
  assert.strictEqual(Iiif.urlImmagine(conServizio3), 'https://example.org/iiif/y/full/max/0/default.jpg', 'size massima API 3 = max');

  // Senza servizio non si puo' chiedere una misura: resta l'immagine dichiarata.
  const statica = { serviceId: null, urlStatico: 'https://example.org/f.jpg' };
  assert.strictEqual(Iiif.urlImmagine(statica, { lato: 200 }), 'https://example.org/f.jpg', 'statica: il lato viene ignorato');
  assert.strictEqual(Iiif.urlImmagine(null), '', 'carta assente: stringa vuota');
}

// --- Catena di ripieghi -------------------------------------------------------
{
  // Un solo URL non basta: i server che non sanno servire una misura rispondono 400, 501 o
  // 504, mai "ecco l'immagine piu' vicina". L'ordine e': misura chiesta, dimensione massima,
  // immagine statica del manifest (l'unica che un servizio di livello 0 sa dare).
  const completa = { serviceId: 'https://example.org/iiif/x', apiVersione: 2, urlStatico: 'https://example.org/f.jpg' };
  assert.deepStrictEqual(Iiif.candidati(completa, { lato: 800 }), [
    'https://example.org/iiif/x/full/800,/0/default.jpg',
    'https://example.org/iiif/x/full/full/0/default.jpg',
    'https://example.org/f.jpg'
  ], 'catena completa in ordine');

  // Senza lato, la misura chiesta E la massima sono lo stesso URL: non va tentato due volte.
  assert.deepStrictEqual(Iiif.candidati(completa), [
    'https://example.org/iiif/x/full/full/0/default.jpg',
    'https://example.org/f.jpg'
  ], 'nessun doppione nella catena');

  assert.deepStrictEqual(
    Iiif.candidati({ serviceId: null, urlStatico: 'https://example.org/f.jpg' }, { lato: 800 }),
    ['https://example.org/f.jpg'],
    'livello 0: resta solo la statica'
  );
  assert.deepStrictEqual(Iiif.candidati(null), [], 'carta assente: nessun candidato');
}

// --- Selezione delle carte da importare ---------------------------------------
{
  const r = (t, n) => Iiif.indiciDaIntervallo(t, n);

  // L'utente conta da 1 (e' la numerazione che vede), il modello da 0.
  assert.deepStrictEqual(r('1-3', 10), [0, 1, 2], 'intervallo semplice, estremi inclusi');
  assert.deepStrictEqual(r('1-3, 7, 9-10', 10), [0, 1, 2, 6, 8, 9], 'pezzi misti');
  assert.deepStrictEqual(r('5-', 7), [4, 5, 6], "intervallo aperto: dalla quinta in poi");
  assert.deepStrictEqual(r('3-1', 10), [0, 1, 2], 'estremi invertiti: e\' un lapsus, non una richiesta vuota');
  assert.deepStrictEqual(r('2, 2, 2-3', 10), [1, 2], 'nessun doppione, ordine crescente');
  assert.deepStrictEqual(r('8-99', 10), [7, 8, 9], 'oltre il totale si taglia');

  // Tollerante per scelta: il campo si digita mentre lo si guarda, e uno che si svuota a
  // meta' digitazione e' inutilizzabile.
  assert.deepStrictEqual(r('abc, 2, ,', 10), [1], 'i pezzi incomprensibili si ignorano');
  assert.deepStrictEqual(r('', 10), [], 'vuoto: nessun indice (il chiamante decide che vuol dire)');
  assert.deepStrictEqual(r('1-3', 0), [], 'nessuna carta: nessun indice');
  assert.deepStrictEqual(r('0, -1', 10), [], 'sotto il minimo: scartati');
}

// --- Sottoinsiemi e collisioni di nome ----------------------------------------
{
  const n = Iiif.normalizza(fixture('manifest-v2.json'));

  // Importare solo alcune carte NON rinumera: la carta 3 del manifest resta `_0003`, o due
  // colleghi che importano sottoinsiemi diversi darebbero due nomi alla stessa carta e la
  // deduplicazione della sincronizzazione caricherebbe lo stesso file due volte.
  const parziale = Iiif.costruisciAllegati(n.carte, 'abc', { indici: [2] });
  assert.strictEqual(parziale.length, 1, 'una sola carta importata');
  assert.strictEqual(parziale[0].nome, 'abc_iiif_0003.jpg', 'la numerazione resta quella del manifest');

  // Reimportare una carta gia' presente e' legittimo; prendersi il suo nome no.
  const doppia = Iiif.costruisciAllegati(n.carte, 'abc', { indici: [0], nomiEsistenti: ['abc_iiif_0001.jpg'] });
  assert.strictEqual(doppia[0].nome, 'abc_iiif_0001-2.jpg', 'nome libero al posto della collisione');

  const indiciStorti = Iiif.costruisciAllegati(n.carte, 'abc', { indici: [99, -1, 1] });
  assert.deepStrictEqual(indiciStorti.map(a => a.nome), ['abc_iiif_0002.jpg'], 'indici fuori intervallo ignorati');
}

// --- Allegati remoti ----------------------------------------------------------
{
  const n = Iiif.normalizza(fixture('manifest-v2.json'));
  const allegati = Iiif.costruisciAllegati(n.carte, 'abc-123');

  assert.strictEqual(allegati.length, 3, 'un allegato per carta, nello stesso ordine');
  assert.strictEqual(allegati[0].nome, 'abc-123_iiif_0001.jpg', 'nome deterministico, forma di salva-allegato');
  assert.strictEqual(allegati[0].tipo, 'immagine', 'tipo immagine');
  assert.strictEqual(allegati[0].remoto, true, 'la carta nasce remota');
  // Nessun hash finche' il file non esiste: e' anche il segnale con cui il resto
  // dell'applicazione distingue una carta scaricata da un riferimento.
  assert.strictEqual(allegati[0].hash, undefined, 'nessun hash prima della materializzazione');
  assert.strictEqual(allegati[0].originalName, '1r', "originalName dall'etichetta della carta");

  // Deterministico davvero: due collaboratori che importano lo stesso manifest nella stessa
  // scheda ottengono gli stessi nomi, quindi la sync non carica due copie della carta.
  const bis = Iiif.costruisciAllegati(n.carte, 'abc-123');
  assert.deepStrictEqual(bis.map(a => a.nome), allegati.map(a => a.nome), 'nomi stabili fra due import');

  // Un id di scheda con caratteri strani non deve poter uscire dalla cartella allegati.
  const sporco = Iiif.costruisciAllegati(n.carte, '../../etc/pass');
  assert.ok(!sporco[0].nome.includes('/') && !sporco[0].nome.includes('.' + '.'), 'id sanificato nel nome file');

  assert.strictEqual(
    Iiif.urlAllegato(allegati[0], { lato: 1600 }),
    'https://example.org/iiif/ark:12148:f1/full/1600,/0/default.jpg',
    "l'URL si ricava dall'allegato salvato, non solo dal manifest"
  );
  assert.strictEqual(Iiif.urlAllegato({ nome: 'x.jpg' }), '', 'allegato non IIIF: nessun URL');
  assert.strictEqual(
    Iiif.candidatiAllegato(allegati[0], { lato: 1600 })[1],
    'https://example.org/iiif/ark:12148:f1/full/full/0/default.jpg',
    "anche l'allegato salvato ha i suoi ripieghi"
  );
  assert.deepStrictEqual(Iiif.candidatiAllegato({ nome: 'x.jpg' }), [], 'allegato non IIIF: nessun candidato');
  assert.strictEqual(Iiif.costruisciAllegati(null, 'id').length, 0, 'carte assenti: nessun allegato');
}

console.log('iiifManifest.test.js: OK');
