// ArchiView Scanner: ricezione dei lotti con una sorgente finta (src/main/scanner/arrivoLotti.ts).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { riceviLotti } = require('../out/main/scanner/arrivoLotti');

console.log('Running arrivoLotti tests...');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

/** Lotto remoto: pagine (Buffer per nome) + manifest coerente, modificabile da `ritocca`. */
function remoto(id, pagine, ritocca) {
  const files = {};
  const manifest = {
    formato: 'archiview-scanner/lotto', versione: 1, id, creatoIl: '2026-10-05T14:30:22+02:00',
    destinazione: { tipo: 'nessuna' }, extra: 'da togliere',
    pagine: Object.keys(pagine).map(f => ({ file: f, sha256: sha(pagine[f]), byte: pagine[f].length, modalita: 'documento' }))
  };
  Object.assign(files, pagine);
  if (ritocca) ritocca(manifest, files);
  if (manifest) files['lotto.json'] = Buffer.from(JSON.stringify(manifest));
  return files;
}

/** Sorgente in memoria che registra le chiamate e può fallire a comando. */
function sorgenteFinta(lotti, guasti) {
  const g = guasti || {};
  const chiamate = { scaricate: [], rimossi: [] };
  return {
    chiamate,
    lotti,
    async elenca() {
      return Object.keys(lotti).map(id => ({ id, completo: !!lotti[id]['lotto.json'] }));
    },
    async leggiManifest(id) {
      if (g.manifest === id) throw new Error('rete');
      return lotti[id]['lotto.json'].toString('utf8');
    },
    async scaricaPagina(id, pg, dest) {
      chiamate.scaricate.push(id + '/' + pg.file);
      if (g.pagina === id + '/' + pg.file) throw new Error('rete');
      const b = lotti[id][pg.file];
      if (!b) throw new Error('pagina_assente');
      fs.writeFileSync(dest, b);
    },
    async rimuovi(id) {
      if (g.rimuovi === id) throw new Error('rete');
      chiamate.rimossi.push(id);
      delete lotti[id];
    }
  };
}

function cartelle() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'av-arrivo-'));
  return { base, arrivo: path.join(base, 'arrivo'), temp: path.join(base, 'tmp') };
}

(async () => {
  const P1 = Buffer.from('pagina uno');
  const P2 = Buffer.from('pagina due, più lunga');

  // 1. Giro completo: valido, in caricamento, corrotto, cartella estranea
  {
    const c = cartelle();
    const lotti = {
      '20261005-100000-aaaa': remoto('20261005-100000-aaaa', { 'p0001.jpg': P1, 'p0002.jpg': P2 }),
      '20261005-110000-bbbb': { 'p0001.jpg': P1 },
      '20261005-120000-cccc': remoto('20261005-120000-cccc', { 'p0001.jpg': P1 }, (m, f) => { f['p0001.jpg'] = Buffer.from('pagina unO'); }),
      'Nuova cartella': { 'x.jpg': P1 }
    };
    const s = sorgenteFinta(lotti);
    const avanz = [];
    // Un residuo di un giro interrotto in tmp viene ripulito
    fs.mkdirSync(path.join(c.temp, 'vecchio'), { recursive: true });
    const e = await riceviLotti({ sorgente: s, cartellaArrivo: c.arrivo, cartellaTemp: c.temp, avanzamento: (x) => avanz.push(x) });

    assert.deepStrictEqual(e.ricevuti, ['20261005-100000-aaaa']);
    assert.deepStrictEqual(e.inCaricamento, ['20261005-110000-bbbb']);
    assert.deepStrictEqual(e.giaPresenti, []);
    assert.deepStrictEqual(e.nonRimossi, []);
    assert.deepStrictEqual(e.falliti.map(f => f.id + ':' + f.codice), ['20261005-120000-cccc:sha256_diverso', 'Nuova cartella:id_non_valido']);

    const dir = path.join(c.arrivo, '20261005-100000-aaaa');
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['lotto.json', 'p0001.jpg', 'p0002.jpg']);
    assert.ok(fs.readFileSync(path.join(dir, 'p0002.jpg')).equals(P2));
    const scritto = JSON.parse(fs.readFileSync(path.join(dir, 'lotto.json'), 'utf8'));
    assert.strictEqual(scritto.extra, undefined, 'manifest normalizzato');
    assert.strictEqual(scritto.pagine.length, 2);

    // Rimossi dal canale solo i lotti salvati; il corrotto e quello in caricamento restano
    assert.deepStrictEqual(s.chiamate.rimossi, ['20261005-100000-aaaa']);
    assert.ok(lotti['20261005-120000-cccc'] && lotti['20261005-110000-bbbb'] && lotti['Nuova cartella']);
    // Nessun lotto a metà in arrivo, nessun residuo in tmp
    assert.deepStrictEqual(fs.readdirSync(c.arrivo), ['20261005-100000-aaaa']);
    assert.deepStrictEqual(fs.readdirSync(c.temp), []);
    assert.deepStrictEqual(avanz.map(a => a.fatte + '/' + a.totali), ['1/2', '2/2']);
    fs.rmSync(c.base, { recursive: true, force: true });
  }

  // 2. Rimozione fallita: lotto salvato, al giro dopo già presente e non riscaricato
  {
    const c = cartelle();
    const id = '20261005-100000-dddd';
    const lotti = { [id]: remoto(id, { 'p0001.jpg': P1 }) };
    const o = { cartellaArrivo: c.arrivo, cartellaTemp: c.temp };
    const s1 = sorgenteFinta(lotti, { rimuovi: id });
    const e1 = await riceviLotti({ ...o, sorgente: s1 });
    assert.deepStrictEqual(e1.ricevuti, [id]);
    assert.deepStrictEqual(e1.nonRimossi, [id]);
    assert.ok(lotti[id]);

    const s2 = sorgenteFinta(lotti);
    const e2 = await riceviLotti({ ...o, sorgente: s2 });
    assert.deepStrictEqual(e2.ricevuti, []);
    assert.deepStrictEqual(e2.giaPresenti, [id]);
    assert.deepStrictEqual(s2.chiamate.scaricate, [], 'non riscaricato');
    assert.deepStrictEqual(s2.chiamate.rimossi, [id]);
    fs.rmSync(c.base, { recursive: true, force: true });
  }

  // 3. Manifest sbagliati: ogni lotto fallisce da solo, gli altri passano
  {
    const c = cartelle();
    const ok = '20261005-090000-zzzz';
    const lotti = {
      '20261005-100000-e001': remoto('20261005-100000-e001', { 'p0001.jpg': P1 }, (m) => { m.id = '20261005-100000-e999'; }),
      '20261005-100000-e002': remoto('20261005-100000-e002', { 'p0001.jpg': P1 }, (m) => { m.pagine[0].file = '../p0001.jpg'; }),
      '20261005-100000-e003': { 'p0001.jpg': P1, 'lotto.json': Buffer.from('{ non json') },
      '20261005-100000-e004': remoto('20261005-100000-e004', { 'p0001.jpg': P1 }, (m) => { m.pagine.push({ file: 'p0002.jpg', sha256: sha(P2), byte: P2.length, modalita: 'grezza' }); }),
      '20261005-100000-e005': remoto('20261005-100000-e005', { 'p0001.jpg': P1 }, (m) => { m.pagine[0].byte = P1.length + 1; }),
      '20261005-100000-e006': remoto('20261005-100000-e006', { 'p0001.jpg': P1 }),
      '20261005-100000-e007': remoto('20261005-100000-e007', { 'p0001.jpg': P1 }, (m) => { m.versione = 2; }),
      [ok]: remoto(ok, { 'p0001.jpg': P1 })
    };
    const s = sorgenteFinta(lotti, { manifest: '20261005-100000-e006' });
    const e = await riceviLotti({ sorgente: s, cartellaArrivo: c.arrivo, cartellaTemp: c.temp });
    assert.deepStrictEqual(e.ricevuti, [ok]);
    assert.deepStrictEqual(e.falliti.map(f => f.codice), [
      'id_diverso', 'manifest_non_valido', 'manifest_non_json', 'pagina_non_scaricata', 'byte_diversi',
      'manifest_non_leggibile', 'manifest_non_valido'
    ]);
    assert.deepStrictEqual(e.falliti[1].dettaglio, [{ codice: 'file_non_valido', percorso: 'pagine[0].file' }]);
    assert.deepStrictEqual(e.falliti[6].dettaglio, [{ codice: 'versione_futura', percorso: 'versione' }]);
    assert.deepStrictEqual(fs.readdirSync(c.arrivo), [ok]);
    assert.deepStrictEqual(fs.readdirSync(c.temp), []);
    assert.deepStrictEqual(s.chiamate.rimossi, [ok]);
    fs.rmSync(c.base, { recursive: true, force: true });
  }

  // 4. Una cartella in arrivo senza manifest non conta come ricevuta e viene sostituita
  {
    const c = cartelle();
    const id = '20261005-100000-ffff';
    fs.mkdirSync(path.join(c.arrivo, id), { recursive: true });
    fs.writeFileSync(path.join(c.arrivo, id, 'p0001.jpg'), 'mezza');
    const s = sorgenteFinta({ [id]: remoto(id, { 'p0001.jpg': P1 }) });
    const e = await riceviLotti({ sorgente: s, cartellaArrivo: c.arrivo, cartellaTemp: c.temp });
    assert.deepStrictEqual(e.ricevuti, [id]);
    assert.ok(fs.readFileSync(path.join(c.arrivo, id, 'p0001.jpg')).equals(P1));
    fs.rmSync(c.base, { recursive: true, force: true });
  }

  // 5. Id duplicato nel canale (due cartelle omonime): la seconda non si tocca
  {
    const c = cartelle();
    const id = '20261005-100000-gggg';
    const lotti = { [id]: remoto(id, { 'p0001.jpg': P1 }) };
    const s = sorgenteFinta(lotti);
    s.elenca = async () => [{ id, completo: true }, { id, completo: true }];
    const e = await riceviLotti({ sorgente: s, cartellaArrivo: c.arrivo, cartellaTemp: c.temp });
    assert.deepStrictEqual(e.ricevuti, [id]);
    assert.deepStrictEqual(e.falliti, [{ id, codice: 'id_duplicato' }]);
    fs.rmSync(c.base, { recursive: true, force: true });
  }

  // 6. Pagine scaricate in parallelo (al più 3) e tutte verificate
  {
    const c = cartelle();
    const id = '20261005-100000-hhhh';
    const pagine = {};
    for (let i = 1; i <= 10; i++) pagine['p' + String(i).padStart(4, '0') + '.jpg'] = Buffer.from('pagina ' + i);
    const s = sorgenteFinta({ [id]: remoto(id, pagine) });
    let attive = 0, massimo = 0;
    const scarica = s.scaricaPagina;
    s.scaricaPagina = async (...a) => {
      attive++; massimo = Math.max(massimo, attive);
      await new Promise(r => setTimeout(r, 5));
      try { return await scarica(...a); } finally { attive--; }
    };
    const e = await riceviLotti({ sorgente: s, cartellaArrivo: c.arrivo, cartellaTemp: c.temp });
    assert.deepStrictEqual(e.ricevuti, [id]);
    assert.strictEqual(massimo, 3);
    assert.strictEqual(fs.readdirSync(path.join(c.arrivo, id)).length, 11);
    fs.rmSync(c.base, { recursive: true, force: true });
  }

  console.log('✓ arrivoLotti: tutti i test superati');
})().catch((e) => { console.error(e); process.exit(1); });
