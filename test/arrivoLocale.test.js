// ArchiScanner: lotti già ricevuti → allegati, PDF, registro (src/main/scanner/arrivoLocale.ts).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const arrivo = require('../out/main/scanner/arrivoLocale');
const { riceviLotti } = require('../out/main/scanner/arrivoLotti');

console.log('Running arrivoLocale tests...');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

/** PNG 1×1 valido: basta a pdf-lib, nessuna dipendenza. */
function png() {
  const blocco = (tipo, dati) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dati.length);
    const td = Buffer.concat([Buffer.from(tipo), dati]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco('IHDR', ihdr), blocco('IDAT', zlib.deflateSync(Buffer.from([0, 200, 100, 50]))), blocco('IEND', Buffer.alloc(0))
  ]);
}

function preparaArrivo(id, etichette) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'av-locale-'));
  const c = { arrivo: path.join(base, 'arrivo'), assegnati: path.join(base, 'assegnati') };
  const allegati = path.join(base, 'allegati');
  fs.mkdirSync(allegati);
  const dir = path.join(c.arrivo, id);
  fs.mkdirSync(dir, { recursive: true });
  const b = png();
  const pagine = etichette.map((et, i) => {
    const file = `p000${i + 1}.png`;
    fs.writeFileSync(path.join(dir, file), b);
    const pg = { file, sha256: sha(b), byte: b.length, modalita: 'documento' };
    if (et) pg.etichetta = et;
    return pg;
  });
  fs.writeFileSync(path.join(dir, 'lotto.json'), JSON.stringify({
    formato: 'archiview-scanner/lotto', versione: 1, id, creatoIl: '2026-10-09T10:00:00+02:00',
    titolo: 'Reg. 12', nota: 'cc. 1-2', destinazione: { tipo: 'nessuna' }, pagine
  }));
  return { base, c, allegati };
}

(async () => {
  const id = '20261009-100000-abcd';

  // Elenco: lotto valido incluso, cartella estranea ignorata.
  {
    const { c } = preparaArrivo(id, ['1r', '']);
    fs.mkdirSync(path.join(c.arrivo, 'estranea'));
    const lotti = await arrivo.elencaArrivo(c);
    assert.deepStrictEqual(lotti.map(l => l.id), [id]);
    assert.strictEqual(lotti[0].titolo, 'Reg. 12');
    assert.deepStrictEqual(await arrivo.elencaArrivo({ arrivo: path.join(c.arrivo, 'manca'), assegnati: c.assegnati }), []);
  }

  // Copia fra gli allegati: nomi, etichette, hash del manifest; mai sovrascrivere.
  {
    const { c, allegati } = preparaArrivo(id, ['1r', '']);
    const voci = await arrivo.copiaInAllegati(c, id, 'sch-1', allegati);
    assert.deepStrictEqual(voci.map(v => [v.nome, v.originalName, v.tipo]), [
      [`sch-1_${id}_p0001.png`, '1r', 'immagine'],
      [`sch-1_${id}_p0002.png`, 'p0002.png', 'immagine']
    ]);
    assert.strictEqual(voci[0].hash, sha(png()));
    assert.ok(fs.existsSync(path.join(allegati, voci[1].nome)));
    await assert.rejects(arrivo.copiaInAllegati(c, id, 'sch-1', allegati), e => e.code === 'EEXIST');
    // L'id della scheda non porta fuori dalla cartella allegati.
    const v2 = await arrivo.copiaInAllegati(c, id, '..\\..\\x', allegati);
    assert.ok(v2.every(v => !v.nome.includes('\\') && !v.nome.includes('/')));
  }

  // Copia a metà che fallisce: nessun file lasciato.
  {
    const { c, allegati } = preparaArrivo(id, ['', '']);
    fs.rmSync(path.join(c.arrivo, id, 'p0002.png'));
    await assert.rejects(arrivo.copiaInAllegati(c, id, 'sch-2', allegati));
    assert.deepStrictEqual(fs.readdirSync(allegati), []);
  }

  // Id e nomi dal renderer: solo quelli del contratto.
  {
    const { c, allegati } = preparaArrivo(id, ['']);
    await assert.rejects(arrivo.copiaInAllegati(c, '..', 'x', allegati), /id_non_valido/);
    assert.throws(() => arrivo.percorsoPagina(c, id, '../lotto.json'), /file_non_valido/);
    await assert.rejects(arrivo.togliDaArrivo(c, '../../x'), /id_non_valido/);
    await assert.rejects(arrivo.copiaInAllegati(c, id, '', allegati), /scheda_non_valida/);
  }

  // PDF unico: un file, valido, una pagina per foto.
  {
    const { c, allegati } = preparaArrivo(id, ['1r', '1v', '2r']);
    const v = await arrivo.unisciInPdf(c, id, 'sch-3', allegati);
    assert.strictEqual(v.tipo, 'pdf');
    assert.strictEqual(v.originalName, 'Reg. 12');
    const byte = fs.readFileSync(path.join(allegati, v.nome));
    assert.strictEqual(v.hash, sha(byte));
    const { PDFDocument } = require('pdf-lib');
    assert.strictEqual((await PDFDocument.load(byte)).getPageCount(), 3);
  }

  // Togli + registro: il lotto ancora su Drive non si riscarica.
  {
    const { c } = preparaArrivo(id, ['']);
    await arrivo.togliDaArrivo(c, id);
    assert.ok(!fs.existsSync(path.join(c.arrivo, id)));
    assert.ok(fs.existsSync(path.join(c.assegnati, id)));
    const chiamate = { scaricate: 0, rimossi: [] };
    const esito = await riceviLotti({
      sorgente: {
        async elenca() { return [{ id, completo: true }]; },
        async leggiManifest() { throw new Error('non deve leggere'); },
        async scaricaPagina() { chiamate.scaricate++; },
        async rimuovi(x) { chiamate.rimossi.push(x); }
      },
      cartellaArrivo: c.arrivo,
      cartellaTemp: path.join(c.arrivo, '..', 'tmp'),
      cartellaAssegnati: c.assegnati
    });
    assert.deepStrictEqual(esito.giaPresenti, [id]);
    assert.strictEqual(chiamate.scaricate, 0);
    assert.deepStrictEqual(chiamate.rimossi, [id]);
  }

  console.log('✓ arrivoLocale: elenco, copia, PDF, registro');
})().catch(e => { console.error(e); process.exit(1); });
