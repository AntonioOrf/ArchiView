// Test dell'estrazione ZIP in streaming (sostituisce AdmZip, che caricava l'intero
// archivio in RAM). Non richiede Electron: il modulo è isolato dall'IPC.
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

  // Test 1: estrae schedatura.json e gli allegati
  const zip1 = path.join(tmpRoot, 'ok.zip');
  const db = { manoscritti: [{ id: '1', titolo: 'Codice' }] };
  await creaZip(zip1, {
    'schedatura.json': JSON.stringify(db),
    'allegati/foto.txt': 'contenuto-allegato'
  });
  const dest1 = path.join(tmpRoot, 'allegati1');
  const res1 = await extractZipStreaming(zip1, dest1);
  assert.deepStrictEqual(JSON.parse(res1.json), db);
  assert.strictEqual(fs.readFileSync(path.join(dest1, 'foto.txt'), 'utf8'), 'contenuto-allegato');
  assert.ok(!fs.existsSync(path.join(dest1, 'foto.txt.part')), 'il file temporaneo deve essere rinominato');
  console.log('✅ Test 1: JSON e allegati estratti in streaming.');

  // Test 2: zip senza schedatura.json → json null (l'IPC lo traduce in errore utente)
  const zip2 = path.join(tmpRoot, 'nojson.zip');
  await creaZip(zip2, { 'allegati/x.txt': 'x' });
  const res2 = await extractZipStreaming(zip2, path.join(tmpRoot, 'allegati2'));
  assert.strictEqual(res2.json, null);
  console.log('✅ Test 2: archivio senza schedatura.json segnalato.');

  // Test 3: zip-slip — yauzl rifiuta i nomi relativi e l'estrazione fallisce senza
  // scrivere nulla; in più il codice normalizza comunque con path.basename.
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

  // Test 4: allegato già presente → non viene sovrascritto
  const dest4 = path.join(tmpRoot, 'allegati4');
  fs.mkdirSync(dest4, { recursive: true });
  fs.writeFileSync(path.join(dest4, 'foto.txt'), 'originale');
  await extractZipStreaming(zip1, dest4);
  assert.strictEqual(fs.readFileSync(path.join(dest4, 'foto.txt'), 'utf8'), 'originale');
  console.log('✅ Test 4: allegato esistente preservato.');

  // Test 5: file non zip → rifiutato con errore
  const zip5 = path.join(tmpRoot, 'corrotto.zip');
  fs.writeFileSync(zip5, 'questo non è uno zip');
  await assert.rejects(() => extractZipStreaming(zip5, path.join(tmpRoot, 'allegati5')));
  console.log('✅ Test 5: archivio corrotto rifiutato.');

  console.log('Tutti i test zipStreaming passati con successo!');
}

run()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {} });
