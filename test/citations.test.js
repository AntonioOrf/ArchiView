const assert = require('assert');
const { generaCitazioni, anno, chiaveCitazione, escapeBibtex } = require('../out/main/export/citations');

function scheda(extra) {
  return Object.assign({
    id: '1', segnatura: 'ASP, Notarile 12', cartella: 'Fondo/1340',
    tipoDocumento: 'imbreviature', dataCronica: '12 maggio 1340', dataTopica: 'Perugia',
    autore: 'Bartolo da Sassoferrato', titolo: 'Vendita di una casa', tags: 'notaio,vendita'
  }, extra);
}

{
  assert.strictEqual(anno('12 maggio 1340'), '1340');
  assert.strictEqual(anno('1340 aprile 3'), '1340');
  assert.strictEqual(anno('sec. XIV'), '', 'i numeri romani non danno un anno');
  assert.strictEqual(anno('12 maggio'), '', 'un giorno da solo non è un anno (servono 3-4 cifre)');
  assert.strictEqual(anno('reg. 4520'), '', 'un numero fuori intervallo non è un anno');
  assert.strictEqual(anno('reg. 4520, anno 1348'), '1348', 'si prende il primo plausibile');
  assert.strictEqual(anno(''), '');
  assert.strictEqual(anno('c. 892'), '892', 'tre cifre sono un anno valido');
}

{
  const out = generaCitazioni([scheda()], { formato: 'bibtex', fondo: 'ASP', nomiTipi: { imbreviature: 'Imbreviatura notarile' } });
  assert.strictEqual(out.estensione, 'bib');
  const t = out.contenuto;
  assert.ok(t.startsWith('@misc{'), 'voce @misc (materiale d\'archivio inedito)');
  assert.ok(t.includes('Sassoferrato1340'), 'chiave = cognome + anno');
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

{
  const t = generaCitazioni([{ id: '1', segnatura: 'X-1' }], { formato: 'bibtex' }).contenuto;
  assert.ok(!t.includes('author ='), 'niente autore, niente riga');
  assert.ok(!t.includes('year ='), 'niente anno, niente riga');
  assert.ok(t.includes('title = {{X-1}}'), 'senza titolo si ricade sulla segnatura');
}

{
  const due = [scheda(), scheda({ id: '2', segnatura: 'ASP, Notarile 13' })];
  const t = generaCitazioni(due, { formato: 'bibtex' }).contenuto;
  const chiavi = t.match(/@misc\{([^,]+),/g);
  assert.strictEqual(chiavi.length, 2);
  assert.notStrictEqual(chiavi[0], chiavi[1], 'chiavi distinte');
  const usate = new Set();
  assert.strictEqual(chiaveCitazione({ autore: 'Perùgia, Anònimo', dataCronica: '1300' }, usate), 'Perugia1300');
  assert.strictEqual(chiaveCitazione({ segnatura: 'ASP, 12' }, new Set()), 'ASP12', 'senza autore si usa la segnatura');
}

{
  assert.strictEqual(escapeBibtex('Perùgia & C. 50% {vero}'), 'Perùgia \\& C. 50\\% \\{vero\\}');
  const t = generaCitazioni([scheda({ titolo: 'Casa & bottega {del} 100%' })], { formato: 'bibtex' }).contenuto;
  assert.ok(t.includes('Casa \\& bottega \\{del\\} 100\\%'), 'caratteri speciali neutralizzati');
  const conACapo = generaCitazioni([scheda({ titolo: 'prima\nseconda' })], { formato: 'bibtex' }).contenuto;
  assert.ok(conACapo.includes('{{prima seconda}}'), 'gli a capo non spezzano il campo');
}

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
  const multi = generaCitazioni([scheda({ autore: 'Tizio; Caio' })], { formato: 'ris' }).contenuto;
  assert.ok(multi.includes('AU  - Tizio\r\nAU  - Caio'), 'un autore per riga');
  const doppio = generaCitazioni([scheda(), scheda({ id: '2' })], { formato: 'ris' }).contenuto;
  assert.strictEqual(doppio.split('TY  - MANSCPT').length - 1, 2);
}

{
  assert.strictEqual(generaCitazioni([], { formato: 'ris' }).contenuto, '');
  assert.strictEqual(generaCitazioni([scheda()], { formato: 'inventato' }).estensione, 'bib', 'ricade su BibTeX');
}

console.log('citations: 7 gruppi di test OK');
