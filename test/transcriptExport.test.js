const assert = require('assert');
const {
  generaEsportazioneTrascrizione, analizzaHtml, corpoMd, corpoRtf, escapeRtf, carteDiRecord, daOcr
} = require('../out/main/export/transcriptExport');

const testi = {};

function scheda(extra) {
  return Object.assign({
    id: '1', segnatura: 'ASP, Notarile 12', cartella: 'Fondo/1340',
    tipoDocumento: 'manoscritto', dataCronica: '12 maggio 1340', dataTopica: 'Perùgia',
    tags: 'notaio,vendita', allegati: [], trascrizione: ''
  }, extra);
}

{
  const m = scheda({ trascrizione: '<p>In nomine Domini</p><p>amen.</p>' });
  const html = generaEsportazioneTrascrizione([m], { formato: 'html' });
  assert.strictEqual(html.estensione, 'html');
  assert.ok(html.contenuto.startsWith('<!DOCTYPE html>'), 'documento HTML autonomo');
  assert.ok(html.contenuto.includes("default-src 'none'"), 'CSP presente');
  assert.ok(html.contenuto.includes('ASP, Notarile 12'), 'segnatura in intestazione');
  assert.ok(html.contenuto.includes('In nomine Domini'), 'testo presente');
  assert.ok(html.contenuto.includes('Fondo/1340'), 'archivio nei metadati');
}

{
  const out = generaEsportazioneTrascrizione(
    [scheda({ segnatura: 'A' }), scheda({ id: '2', segnatura: 'B', trascrizione: '<p>x</p>' })],
    { formato: 'md', testi: { tx_empty: 'Nessuna trascrizione.' } }
  );
  assert.ok(out.contenuto.includes('## A'), 'la scheda vuota compare comunque');
  assert.ok(out.contenuto.includes('Nessuna trascrizione.'), 'e lo dichiara');
  assert.ok(out.contenuto.includes('## B'), 'la scheda con testo pure');
}

{
  const m = scheda({
    allegati: [
      { originalName: 'c1r.jpg', trascrizione: '<p>recto</p>' },
      { originalName: 'c1v.jpg', trascrizione: '<p>verso</p>' },
      { originalName: 'c2r.jpg', trascrizione: '' }
    ],
    trascrizione: '<p class="trasc-carta"><strong>c1r.jpg</strong></p><p>recto</p>'
  });
  const carte = carteDiRecord(m);
  assert.strictEqual(carte.length, 2, 'solo le carte con testo');
  assert.deepStrictEqual(carte.map(c => c.nome), ['c1r.jpg', 'c1v.jpg']);
  const md = generaEsportazioneTrascrizione([m], { formato: 'md' }).contenuto;
  assert.ok(md.includes('### c1r.jpg') && md.includes('### c1v.jpg'), 'un titolo per carta');
  assert.strictEqual(md.split('recto').length - 1, 1, 'il testo della carta non è duplicato');
  assert.ok(!md.includes('trasc-carta'), 'la forma derivata non viene letta');
}

{
  const m = scheda({ allegati: [{ originalName: 'unica.jpg', trascrizione: '<p>solo</p>' }] });
  const md = generaEsportazioneTrascrizione([m], { formato: 'md' }).contenuto;
  assert.ok(!md.includes('### unica.jpg'), 'una carta sola non porta intestazione');
}

{
  const html = '<h1>Titolo</h1><p><strong>Grassetto</strong> e <em>corsivo</em>.</p>' +
    '<ul><li>uno</li><li>due</li></ul><ol><li>primo</li></ol>' +
    '<blockquote>citato</blockquote><p>a<br>capo</p><hr>';
  const md = corpoMd(html);
  assert.ok(md.includes('### Titolo'), 'h1 scende sotto la segnatura (##)');
  assert.ok(md.includes('**Grassetto**'), 'grassetto');
  assert.ok(md.includes('*corsivo*'), 'corsivo');
  assert.ok(md.includes('- uno\n- due'), 'lista puntata compatta');
  assert.ok(md.includes('1. primo'), 'lista numerata');
  assert.ok(md.includes('> citato'), 'citazione');
  assert.ok(md.includes('a  \ncapo'), '<br> diventa interruzione di riga Markdown');
  assert.ok(md.includes('---'), 'riga orizzontale');
  assert.ok(!corpoMd('<p>una\n   frase\n   sola</p>').includes('\n'), 'gli a capo del sorgente valgono uno spazio');
}

{
  const html = '<p class="ocr-origine"><em>OCR ita</em></p><p>Chiaro <span class="ocr-incerto">dubbio</span> fine</p>';
  const md = corpoMd(html);
  assert.ok(md.includes('dubbio\\[?\\]'), 'la parola incerta è marcata [?] in Markdown');
  const rtf = corpoRtf(html);
  assert.ok(rtf.includes('\\ulwave'), 'la parola incerta è ondulata in RTF');
  assert.strictEqual(daOcr(html), true, 'la provenienza OCR è riconosciuta');
  const doc = generaEsportazioneTrascrizione([scheda({ trascrizione: html })], {
    formato: 'md', testi: { tx_ocr_notice: 'Bozza OCR' }
  }).contenuto;
  assert.ok(doc.includes('> Bozza OCR'), 'la nota di provenienza è nel documento');
  const senzaOcr = generaEsportazioneTrascrizione([scheda({ trascrizione: '<p>riletto</p>' })], {
    formato: 'md', testi: { tx_ocr_notice: 'Bozza OCR' }
  }).contenuto;
  assert.ok(!senzaOcr.includes('Bozza OCR'), 'una trascrizione riletta non viene marcata');
}

{
  assert.strictEqual(escapeRtf('a{b}c\\d'), 'a\\{b\\}c\\\\d', 'graffe e backslash neutralizzati');
  assert.strictEqual(escapeRtf('àè'), '\\u224?\\u232?', 'i caratteri accentati diventano \\uN?');
  assert.strictEqual(escapeRtf('𝔄'), '\\u-10187?\\u-8956?', 'surrogati emessi come interi con segno');
  const rtf = generaEsportazioneTrascrizione([scheda({ trascrizione: '<p>Perùgia</p>' })], { formato: 'rtf' });
  assert.strictEqual(rtf.estensione, 'rtf');
  assert.ok(rtf.contenuto.startsWith('{\\rtf1\\ansi'), 'intestazione RTF');
  assert.ok(rtf.contenuto.trim().endsWith('}'), 'gruppo chiuso');
  assert.ok(rtf.contenuto.includes('\\u249?'), 'la ù è codificata, non troncata');
  assert.ok(rtf.contenuto.includes('ASP, Notarile 12'), 'segnatura nel documento');
}

{
  const cattivo = '<p onclick="alert(1)">testo</p><script>alert(2)</script><img src=x onerror=alert(3)>';
  const html = generaEsportazioneTrascrizione([scheda({ trascrizione: cattivo })], { formato: 'html' }).contenuto;
  assert.ok(!html.includes('onclick'), 'attributi non previsti riscritti via');
  assert.ok(!html.includes('alert(2)'), 'il contenuto dello script è buttato con il tag');
  assert.ok(!html.includes('<img'), 'i tag fuori whitelist non sopravvivono');
  assert.ok(html.includes('testo'), 'il testo resta');
  assert.ok(!corpoMd(cattivo).includes('alert'), 'Markdown pulito');
  assert.ok(!corpoRtf(cattivo).includes('alert'), 'RTF pulito');
}

{
  const blocchi = analizzaHtml('<p><b>a<i>b</i></b>c</p><ul><li>x<ul><li>y</li></ul></li></ul>');
  assert.strictEqual(blocchi[0].tipo, 'p');
  assert.deepStrictEqual(blocchi[0].pezzi.map(p => [p.testo, !!p.b, !!p.i]),
    [['a', true, false], ['b', true, true], ['c', false, false]], 'stili annidati per pezzo');
  const li = blocchi.filter(b => b.tipo === 'li');
  assert.strictEqual(li.length, 2, 'due voci di lista');
  assert.strictEqual(li[1].livello, 1, 'la lista annidata rientra');
  assert.strictEqual(analizzaHtml('<p><br></p>').length, 0, 'il paragrafo vuoto sparisce');
}

{
  const m = scheda({ trascrizione: '<p>testo</p>' });
  const con = generaEsportazioneTrascrizione([m], { formato: 'md', intestazione: true }).contenuto;
  const senza = generaEsportazioneTrascrizione([m], { formato: 'md', intestazione: false }).contenuto;
  assert.ok(con.includes('Perùgia'), 'con intestazione i metadati ci sono');
  assert.ok(!senza.includes('Perùgia'), 'senza intestazione spariscono');
  assert.ok(senza.includes('## ASP, Notarile 12'), 'la segnatura resta comunque: è il titolo');
  const tradotto = generaEsportazioneTrascrizione([m], {
    formato: 'md', etichette: { dataTopica: 'Place of issue' }
  }).contenuto;
  assert.ok(tradotto.includes('**Place of issue:** Perùgia'), 'etichette dal renderer');
}

{
  const m = scheda({
    oggetto: 'Compravendita terreno',
    note: 'In buone condizioni di conservazione',
    attori_dinamici: [{ ruolo: 'Venditore', nome: 'Giovanni' }],
    campiPropri: [{ id: 'filigrana', tipo: 'text', label: 'Filigrana carta' }],
    filigrana: 'Corona ducale',
    allegati: [
      { originalName: 'carta_1.jpg', nome: 'c1.jpg' },
      { originalName: 'carta_2.jpg', nome: 'c2.jpg', remoto: true }
    ]
  });
  const md = generaEsportazioneTrascrizione([m], { formato: 'md' }).contenuto;
  assert.ok(md.includes('Compravendita terreno'), 'campo oggetto presente');
  assert.ok(md.includes('In buone condizioni di conservazione'), 'campo note presente');
  assert.ok(md.includes('Venditore: Giovanni'), 'attori_dinamici formattati');
  assert.ok(md.includes('Filigrana carta:'), 'etichetta campo proprio presente');
  assert.ok(md.includes('Corona ducale'), 'valore campo proprio presente');
  assert.ok(md.includes('carta_1.jpg') && md.includes('carta_2.jpg (IIIF)'), 'elenco allegati presente');
}

console.log('transcriptExport: 11 gruppi di test OK');

