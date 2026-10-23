const path = require('path');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');
const drive = { files: {} };
const authId = require.resolve(path.join(OUT, 'ipc', 'drive', 'auth.js'));
require.cache[authId] = { id: authId, filename: authId, loaded: true, exports: { driveState: { drive } } };
const { withDriveRetry, uploadFileReturningId } = require(path.join(OUT, 'ipc', 'drive', 'fileOps.js'));

const errore = (status, reason, headers) => Object.assign(new Error('drive ' + status), {
  response: { status, headers: headers || {}, data: reason ? { error: { errors: [{ reason }] } } : {} }
});

function cheFallisce(errori, valore) {
  let chiamate = 0;
  const fn = async () => { chiamate++; if (errori.length) throw errori.shift(); return valore; };
  return { fn, chiamate: () => chiamate };
}

(async () => {
  console.log('Running driveRetry tests...');
  const limite = cheFallisce([errore(403, 'userRateLimitExceeded'), errore(403, 'rateLimitExceeded')], 'ok');
  assert.strictEqual(await withDriveRetry(limite.fn, 3, 1), 'ok');
  assert.strictEqual(limite.chiamate(), 3);
  console.log('✅ Test 1: i 403 di rate limit si riprovano.');

  const vietato = cheFallisce([errore(403, 'insufficientFilePermissions')], 'ok');
  await assert.rejects(withDriveRetry(vietato.fn, 3, 1), /drive 403/);
  assert.strictEqual(vietato.chiamate(), 1);
  console.log('✅ Test 2: un 403 di permessi non si riprova.');

  const gateway = cheFallisce([errore(502), errore(504)], 'ok');
  assert.strictEqual(await withDriveRetry(gateway.fn, 3, 1), 'ok');
  console.log('✅ Test 3: 502 e 504 si riprovano.');

  const inizio = Date.now();
  const attendi = cheFallisce([errore(429, null, { 'retry-after': '1' })], 'ok');
  assert.strictEqual(await withDriveRetry(attendi.fn, 3, 1), 'ok');
  assert.ok(Date.now() - inizio >= 900, 'Retry-After rispettato');
  console.log('✅ Test 4: Retry-After rispettato.');

  let tentativi = 0;
  drive.files.create = async () => { if (++tentativi === 1) throw errore(503); return { data: { id: 'f1' } }; };
  assert.strictEqual(await uploadFileReturningId(__filename, 'x', 'p'), 'f1');
  console.log('✅ Test 5: l\'upload dei chunk riprova da sé.');

  const { uploadFile } = require(path.join(OUT, 'ipc', 'drive', 'fileOps.js'));
  const aggiornati = [];
  let eliminati = 0;
  drive.files.list = async () => ({ data: { files: [{ id: 'nuovo', modifiedTime: new Date().toISOString() }, { id: 'doppione' }] } });
  drive.files.delete = async () => { eliminati++; };
  drive.files.update = async (p) => { aggiornati.push(p); return { data: { modifiedTime: new Date().toISOString() } }; };
  await uploadFile(__filename, 'database_manoscritti.json', 'p');
  assert.strictEqual(eliminati, 0, 'nessuna eliminazione definitiva');
  assert.ok(aggiornati.some(p => p.fileId === 'doppione' && p.requestBody && p.requestBody.trashed === true), 'il doppione va nel cestino di Drive');
  console.log('✅ Test 6: i duplicati Drive vanno nel cestino.');

  const { getOrCreateFolder } = require(path.join(OUT, 'ipc', 'drive', 'fileOps.js'));
  let query = 0;
  drive.files.list = async () => { query++; return { data: { files: [] } }; };
  const ostile = "x' in parents or name='database_manoscritti.json";
  await assert.rejects(uploadFile(__filename, 'database_manoscritti.json', ostile), /Id Drive non valido/);
  await assert.rejects(getOrCreateFolder('ArchiView', ostile), /Id Drive non valido/);
  assert.strictEqual(query, 0, 'nessuna query con un id ostile');
  console.log('✅ Test 7: id di cartella Drive validati prima delle query.');

  const { asyncPool } = require(path.join(OUT, 'ipc', 'drive', 'fileOps.js'));
  const finiti = [];
  const avviati = [];
  await assert.rejects(asyncPool(3, [1, 2, 3, 4, 5, 6], async (n) => {
    avviati.push(n);
    if (n === 1) throw errore(403, 'storageQuotaExceeded');
    await new Promise(r => setTimeout(r, 30));
    finiti.push(n);
  }), /drive 403/);
  assert.deepStrictEqual(finiti.sort(), avviati.filter(n => n !== 1).sort(), 'al rifiuto nessun task è ancora in corso');
  assert.ok(!avviati.includes(6), 'dopo un errore non partono altri task');
  console.log('✅ Test 8: asyncPool rifiuta solo dopo che i task avviati sono finiti.');

  const pieno = cheFallisce([errore(403, 'storageQuotaExceeded')], 'ok');
  await assert.rejects(withDriveRetry(pieno.fn, 3, 1), /Spazio Google Drive esaurito/);
  assert.strictEqual(pieno.chiamate(), 1);
  console.log('✅ Test 9: Drive pieno dà un messaggio chiaro senza riprovare.');
  console.log('Tutti i test driveRetry passati con successo!');
})().catch((e) => { console.error(e); process.exitCode = 1; });
