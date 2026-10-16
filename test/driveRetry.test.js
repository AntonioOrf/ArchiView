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
  console.log('Tutti i test driveRetry passati con successo!');
})().catch((e) => { console.error(e); process.exitCode = 1; });
