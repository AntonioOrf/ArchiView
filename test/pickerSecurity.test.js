// Test della guardia del server HTTP effimero del Google Picker: la pagina (che contiene
// l'access token) va servita solo a chi presenta il sessionSecret. Non richiede Electron.
const assert = require('assert');
const { pickerGetSecretOk } = require('../out/main/ipc/drive/pickerSecurity');

console.log('Running pickerSecurity tests...');

const secret = 'a3f9c2e1b7d04f6a8e5c9b2d1f0e7a6c';

// 1. Richiesta legittima
assert.strictEqual(pickerGetSecretOk(`/?s=${secret}`, secret), true);
assert.strictEqual(pickerGetSecretOk(`/picker?x=1&s=${secret}`, secret), true);

// 2. Secret assente, errato, troncato o con suffisso
assert.strictEqual(pickerGetSecretOk('/', secret), false);
assert.strictEqual(pickerGetSecretOk('/?s=', secret), false);
assert.strictEqual(pickerGetSecretOk('/?s=sbagliato', secret), false);
assert.strictEqual(pickerGetSecretOk(`/?s=${secret.slice(0, -1)}`, secret), false);
assert.strictEqual(pickerGetSecretOk(`/?s=${secret}x`, secret), false);
assert.strictEqual(pickerGetSecretOk(`/?S=${secret}`, secret), false);

// 3. Secret non configurato lato server: sempre negato, anche con ?s= vuoto
assert.strictEqual(pickerGetSecretOk('/?s=', ''), false);
assert.strictEqual(pickerGetSecretOk('/', ''), false);
assert.strictEqual(pickerGetSecretOk('/?s=undefined', undefined), false);

// 4. Parametro duplicato: conta il primo (URLSearchParams.get)
assert.strictEqual(pickerGetSecretOk(`/?s=sbagliato&s=${secret}`, secret), false);

// 5. URL malformati non lanciano
assert.strictEqual(pickerGetSecretOk('http://[::1', secret), false);
assert.strictEqual(pickerGetSecretOk(undefined, secret), false);

console.log('pickerSecurity tests passed.');
