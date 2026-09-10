// Fase 2.6 — Citazioni bibliografiche. Modulo puro nel main: si testa il build in out/.
const assert = require('assert');
const { generaCitazioni, anno, chiaveCitazione, escapeBibtex } = require('../out/main/export/citations');

function scheda(extra) {
  return Object.assign({
    id: '1', segnatura: 'ASP, Notarile 12', cartella: 'Fondo/1340',
    tipoDocumento: 'imbreviature', dataCronica: '12 maggio 1340', dataTopica: 'Perugia',
    autore: 'Bartolo da Sassoferrato', titolo: 'Vendita di una casa', tags: 'notaio,vendita'
  }, extra);
}

// --- Test 1: l'anno si estrae, ma solo se è un anno ---------------------------
{
  assert.strictEqual(anno('12 maggio 1340'), '1340');
  assert.strictEqual(anno('1340 aprile 3'), '1340');
  assert.strictEqual(anno('sec. XIV'), '', 'i numeri romani non danno un anno');
  assert.strictEqual(anno('12 maggio'), '', 'un giorno da solo non è un anno (servono 3-4 cifre)');
  // Il controllo di plausibilità: senza, un numero di registro finirebbe in `year`, e una
  // bibliografia che data un atto al 4520 la corregge solo un revisore.
  assert.strictEqual(anno('reg. 4520'), '', 'un numero fuori intervallo non è un anno');
  assert.strictEqual(anno('reg. 4520, anno 1348'), '1348', 'si prende il primo plausibile');
  assert.strictEqual(anno(''), '');
  assert.strictEqual(anno('c. 892'), '892', 'tre cifre sono un anno valido');
}

// --- Test 2: BibTeX, forma e mappatura ----------------------------------------
{
  const out = generaCitazioni([scheda()], { formato: 'bibtex', fondo: 'ASP', nomiTipi: { imbreviature: 'Imbreviatura notarile' } });
  assert.strictEqual(out.estensione, 'bib');
  const t = out.contenuto;
  assert.ok(t.startsWith('@misc{'), 'voce @misc (materiale d\'archivio inedito)');
  assert.ok(t.includes('Sassoferrato1340'), 'chiave = cognome + anno');
  // Doppie graffe: senza, gli stili in sentence case scrivono "Vendita di una casa" minuscolo.
  assert.ok(t.includes('title = {{Vendita di una casa}}'), 'titolo protetto dalle doppie graffe');
  assert.ok(t.includes('author = {Bartolo da Sassoferrato}'), 'autore');
  assert.ok(t.includes('year = {1340}'), 'anno');
  assert.ok(t.includes('number = {ASP, Notarile 12}'), 'segnatura');
  assert.ok(t.includes('organization = {ASP}'), 'fondo conservatore');
  assert.ok(t.includes('series = {Fondo/1340}'), 'archivio interno');
  assert.ok(t.includes('address = {Perugia}'), 'data topica come luogo');
  assert.ok(t.includes('type = {Imbreviatura notarile}'), 'il nome del tipo arriva dal renderer');
  assert.ok(t.includes('keywords = {notaio, vendita}'), 'tag');
  assert.ok(t.trim().endsWith('}'), 'voce chiusa');
  assert.ok(!/,\n}/.test(t), 'nessuna virgola pendente prima della graffa');
}

// --- Test 3: i campi vuoti non diventano righe vuote ---------------------------
{
  const t = generaCitazioni([{ id: '1', segnatura: 'X-1' }], { formato: 'bibtex' }).contenuto;
  assert.ok(!t.includes('author ='), 'niente autore, niente riga');
  assert.ok(!t.includes('year ='), 'niente anno, niente riga');
  assert.ok(t.includes('title = {{X-1}}'), 'senza titolo si ricade sulla segnatura');
}

// --- Test 4: chiavi uniche -----------------------------------------------------
{
  const due = [scheda(), scheda({ id: '2', segnatura: 'ASP, Notarile 13' })];
  const t = generaCitazioni(due, { formato: 'bibtex' }).contenuto;
  const chiavi = t.match(/@misc\{([^,]+),/g);
  assert.strictEqual(chiavi.length, 2);
  // Due carte dello stesso notaio nello stesso anno esistono: senza suffisso BibTeX
  // terrebbe solo la prima e la seconda citazione punterebbe al documento sbagliato.
  assert.notStrictEqual(chiavi[0], chiavi[1], 'chiavi distinte');
  // La chiave è un identificatore LaTeX: solo ASCII.
  const usate = new Set();
  assert.strictEqual(chiaveCitazione({ autore: 'Perùgia, Anònimo', dataCronica: '1300' }, usate), 'Perugia1300');
  assert.strictEqual(chiaveCitazione({ segnatura: 'ASP, 12' }, new Set()), 'ASP12', 'senza autore si usa la segnatura');
}

// --- Test 5: escaping BibTeX ---------------------------------------------------
{
  // Gli accenti restano UTF-8 (biblatex e Zotero li leggono); si neutralizza ciò che
  // romperebbe il parser o che LaTeX interpreta come comando.
  assert.strictEqual(escapeBibtex('Perùgia & C. 50% {vero}'), 'Perùgia \\& C. 50\\% \\{vero\\}');
  const t = generaCitazioni([scheda({ titolo: 'Casa & bottega {del} 100%' })], { formato: 'bibtex' }).contenuto;
  assert.ok(t.includes('Casa \\& bottega \\{del\\} 100\\%'), 'caratteri speciali neutralizzati');
  // Un a capo dentro un campo spezzerebbe la voce: diventa uno spazio.
  const conACapo = generaCitazioni([scheda({ titolo: 'prima\nseconda' })], { formato: 'bibtex' }).contenuto;
  assert.ok(conACapo.includes('{{prima seconda}}'), 'gli a capo non spezzano il campo');
}

// --- Test 6: RIS ---------------------------------------------------------------
{
  const out = generaCitazioni([scheda()], { formato: 'ris', fondo: 'ASP' });
  assert.strictEqual(out.estensione, 'ris');
  const righe = out.contenuto.split('\r\n');
  assert.strictEqual(righe[0], 'TY  - MANSCPT', 'tipo manoscritto in prima riga');
  assert.ok(righe.includes('TI  - Vendita di una casa'));
  assert.ok(righe.includes('AU  - Bartolo da Sassoferrato'));
  assert.ok(righe.includes('PY  - 1340'));
  assert.ok(righe.includes('DA  - 12 maggio 1340'));
  assert.ok(righe.includes('CY  - Perugia'));
  assert.ok(righe.includes('PB  - ASP'));
  assert.ok(righe.includes('AN  - ASP, Notarile 12'));
  assert.ok(righe.includes('KW  - notaio') && righe.includes('KW  - vendita'), 'un tag per riga');
  assert.ok(out.contenuto.includes('ER  - \r\n'), 'voce chiusa da ER');
  // Un `AU` con dentro tre nomi diventa in Zotero un unico autore che si chiama come tutti e tre.
  const multi = generaCitazioni([scheda({ autore: 'Tizio; Caio' })], { formato: 'ris' }).contenuto;
  assert.ok(multi.includes('AU  - Tizio\r\nAU  - Caio'), 'un autore per riga');
  // Due record, due voci separate da riga bianca.
  const doppio = generaCitazioni([scheda(), scheda({ id: '2' })], { formato: 'ris' }).contenuto;
  assert.strictEqual(doppio.split('TY  - MANSCPT').length - 1, 2);
}

// --- Test 7: formato ignoto e lista vuota --------------------------------------
{
  assert.strictEqual(generaCitazioni([], { formato: 'ris' }).contenuto, '');
  assert.strictEqual(generaCitazioni([scheda()], { formato: 'inventato' }).estensione, 'bib', 'ricade su BibTeX');
}

console.log('citations: 7 gruppi di test OK');
