const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const archiver = require('archiver');
const { extractZipStreaming } = require('../out/main/ipc/zipStreaming');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-zip-'));

function creaZip(zipPath, entries) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    for (const [name, content] of Object.entries(entries)) archive.append(content, { name });
    archive.finalize();
  });
}

async function run() {
  console.log('Running zipStreaming tests...');

  const zip1 = path.join(tmpRoot, 'ok.zip');
  const db = { manoscritti: [{ id: '1', titolo: 'Codice' }] };
  await creaZip(zip1, {
    'schedatura.json': JSON.stringify(db),
    'allegati/foto.txt': 'contenuto-allegato'
  });
  const dest1 = path.join(tmpRoot, 'allegati1');
  const passi1 = [];
  const res1 = await extractZipStreaming(zip1, dest1, { avanzamento: (f, t) => passi1.push([f, t]) });
  assert.deepStrictEqual(passi1, [[1, 2], [2, 2]], 'una notifica per voce, col totale dello ZIP');
  assert.deepStrictEqual(JSON.parse(res1.json), db);
  assert.strictEqual(fs.readFileSync(path.join(dest1, 'foto.txt'), 'utf8'), 'contenuto-allegato');
  assert.deepStrictEqual(fs.readdirSync(dest1), ['foto.txt'], 'il file temporaneo deve essere rinominato');
  console.log('✅ Test 1: JSON e allegati estratti in streaming.');

  const zip2 = path.join(tmpRoot, 'nojson.zip');
  await creaZip(zip2, { 'allegati/x.txt': 'x' });
  const res2 = await extractZipStreaming(zip2, path.join(tmpRoot, 'allegati2'));
  assert.strictEqual(res2.json, null);
  console.log('✅ Test 2: archivio senza schedatura.json segnalato.');

  const zip3 = path.join(tmpRoot, 'slip.zip');
  await creaZip(zip3, {
    'schedatura.json': '{"manoscritti":[]}',
    'allegati/../../evil.txt': 'payload'
  });
  const dest3 = path.join(tmpRoot, 'allegati3');
  await assert.rejects(() => extractZipStreaming(zip3, dest3));
  assert.ok(!fs.existsSync(path.join(tmpRoot, 'evil.txt')), 'nessun file scritto fuori dalla cartella allegati');
  assert.ok(!fs.existsSync(path.join(path.dirname(tmpRoot), 'evil.txt')));
  console.log('✅ Test 3: zip-slip neutralizzato.');

  const dest4 = path.join(tmpRoot, 'allegati4');
  fs.mkdirSync(dest4, { recursive: true });
  fs.writeFileSync(path.join(dest4, 'foto.txt'), 'originale');
  const res4 = await extractZipStreaming(zip1, dest4);
  assert.strictEqual(fs.readFileSync(path.join(dest4, 'foto.txt'), 'utf8'), 'originale');
  assert.strictEqual(fs.readFileSync(path.join(dest4, 'foto_2.txt'), 'utf8'), 'contenuto-allegato');
  assert.deepStrictEqual(res4.rinominati, { 'foto.txt': 'foto_2.txt' });
  assert.strictEqual(res4.copiati, 1);
  const res4b = await extractZipStreaming(zip1, dest1);
  assert.deepStrictEqual(res4b.rinominati, {});
  assert.strictEqual(res4b.saltati, 1);
  assert.deepStrictEqual(fs.readdirSync(dest1), ['foto.txt']);
  console.log('✅ Test 4: allegato esistente preservato, omonimo diverso con nome libero.');

  const zip5 = path.join(tmpRoot, 'corrotto.zip');
  fs.writeFileSync(zip5, 'questo non è uno zip');
  await assert.rejects(() => extractZipStreaming(zip5, path.join(tmpRoot, 'allegati5')));
  console.log('✅ Test 5: archivio corrotto rifiutato.');

  const { MARGINE_DISCO_BYTES } = require('../out/main/ipc/zipStreaming');
  const zip6 = path.join(tmpRoot, 'grande.zip');
  await creaZip(zip6, {
    'schedatura.json': '{"manoscritti":[]}',
    'allegati/a.bin': Buffer.alloc(4000, 1),
    'allegati/b.bin': Buffer.alloc(4000, 2),
  });
  const dest6 = path.join(tmpRoot, 'allegati6');
  await assert.rejects(
    () => extractZipStreaming(zip6, dest6, { spazioLibero: () => MARGINE_DISCO_BYTES + 6000 }),
    /Spazio su disco insufficiente/);
  assert.ok(fs.existsSync(path.join(dest6, 'a.bin')), 'il primo allegato sta nel tetto');
  assert.ok(!fs.existsSync(path.join(dest6, 'b.bin')), 'il secondo supera il tetto e non si scrive');
  assert.deepStrictEqual(fs.readdirSync(dest6).filter(f => f.endsWith('.part')), []);
  const dest6b = path.join(tmpRoot, 'allegati6b');
  await extractZipStreaming(zip6, dest6b, { spazioLibero: () => null });
  assert.deepStrictEqual(fs.readdirSync(dest6b).sort(), ['a.bin', 'b.bin']);
  console.log('✅ Test 6: tetto sullo spazio disco.');

  const zip7 = path.join(tmpRoot, 'nomi.zip');
  await creaZip(zip7, {
    'schedatura.json': '{"manoscritti":[]}',
    'allegati/foto.jpg:Zone.Identifier': 'ads',
    'allegati/CON.txt': 'riservato',
    'allegati/buono.txt': 'ok',
  });
  const dest7 = path.join(tmpRoot, 'allegati7');
  await extractZipStreaming(zip7, dest7);
  assert.deepStrictEqual(fs.readdirSync(dest7), ['buono.txt']);
  console.log('✅ Test 7: nomi di allegato non validi saltati.');

  const zip8 = path.join(tmpRoot, 'doppio.zip');
  const voci8 = { 'schedatura.json': '{"manoscritti":[]}' };
  for (let i = 0; i < 10; i++) voci8[`allegati/f${i}.pdf`] = Buffer.alloc(2e6, i);
  await creaZip(zip8, voci8);
  const dest8 = path.join(tmpRoot, 'allegati8');
  await Promise.all([extractZipStreaming(zip8, dest8), extractZipStreaming(zip8, dest8)]);
  assert.strictEqual(fs.readdirSync(dest8).length, 10, 'dieci allegati, nessun .part residuo');
  assert.ok(fs.readFileSync(path.join(dest8, 'f3.pdf')).equals(Buffer.alloc(2e6, 3)));
  console.log('✅ Test 8: estrazioni parallele nella stessa cartella.');

  console.log('Tutti i test zipStreaming passati con successo!');
}

run()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {} });
