const assert = require('assert');
const { pickerGetSecretOk } = require('../out/main/ipc/drive/pickerSecurity');

console.log('Running pickerSecurity tests...');

const secret = 'a3f9c2e1b7d04f6a8e5c9b2d1f0e7a6c';

assert.strictEqual(pickerGetSecretOk(`/?s=${secret}`, secret), true);
assert.strictEqual(pickerGetSecretOk(`/picker?x=1&s=${secret}`, secret), true);

assert.strictEqual(pickerGetSecretOk('/', secret), false);
assert.strictEqual(pickerGetSecretOk('/?s=', secret), false);
assert.strictEqual(pickerGetSecretOk('/?s=sbagliato', secret), false);
assert.strictEqual(pickerGetSecretOk(`/?s=${secret.slice(0, -1)}`, secret), false);
assert.strictEqual(pickerGetSecretOk(`/?s=${secret}x`, secret), false);
assert.strictEqual(pickerGetSecretOk(`/?S=${secret}`, secret), false);

assert.strictEqual(pickerGetSecretOk('/?s=', ''), false);
assert.strictEqual(pickerGetSecretOk('/', ''), false);
assert.strictEqual(pickerGetSecretOk('/?s=undefined', undefined), false);

assert.strictEqual(pickerGetSecretOk(`/?s=sbagliato&s=${secret}`, secret), false);

assert.strictEqual(pickerGetSecretOk('http://[::1', secret), false);
assert.strictEqual(pickerGetSecretOk(undefined, secret), false);

const { idDriveValido, idDrive } = require('../out/main/ipc/drive/pickerSecurity');
for (const buono of ['1AbC-dEf_GhIjKlMnOpQrStUvWxYz0123', 'root']) assert.strictEqual(idDriveValido(buono), true, buono);
for (const ostile of ["x' in parents or name='database_manoscritti.json", "a'b", 'a b', '', 'x'.repeat(201), null, 42, {}, 'id\\']) {
  assert.strictEqual(idDriveValido(ostile), false, String(ostile));
  assert.throws(() => idDrive(ostile), /Id Drive non valido/);
}
assert.strictEqual(idDrive('abc_DEF-123'), 'abc_DEF-123');

console.log('pickerSecurity tests passed.');
