// L2 (PIANO-SICUREZZA-OTTIMIZZAZIONE.md): permessi concessi solo alla finestra principale e
// solo quelli che l'app usa. Senza handler Electron li concedeva tutti, a qualsiasi pagina.
const assert = require('assert');
const { permessoConcesso } = require('../out/main/guardieWebContents');

console.log('Running guardieWebContents tests...');

// 1. Finestra principale: solo appunti (scrittura) e schermo intero.
assert.strictEqual(permessoConcesso('clipboard-sanitized-write', true), true);
assert.strictEqual(permessoConcesso('fullscreen', true), true);
for (const p of ['media', 'notifications', 'geolocation', 'clipboard-read', 'openExternal', 'midi', 'midiSysex',
  'pointerLock', 'hid', 'serial', 'usb', 'display-capture', 'window-management', 'idle-detection', 'unknown']) {
  assert.strictEqual(permessoConcesso(p, true), false, p);
}

// 2. Qualsiasi altro webContents (host PDF, host stampa, sconosciuto): niente.
for (const p of ['clipboard-sanitized-write', 'fullscreen', 'media']) {
  assert.strictEqual(permessoConcesso(p, false), false, p);
}

// 2b. Iframe della finestra principale (visualizzatore PDF in local-asset): schermo intero sì,
//     appunti no.
assert.strictEqual(permessoConcesso('fullscreen', true, false), true);
assert.strictEqual(permessoConcesso('clipboard-sanitized-write', true, false), false);
assert.strictEqual(permessoConcesso('clipboard-sanitized-write', true, true), true);
assert.strictEqual(permessoConcesso('media', true, false), false);
assert.strictEqual(permessoConcesso('fullscreen', false, false), false);

// 3. Input strani: negati.
for (const p of [null, undefined, 42, {}, ['fullscreen']]) assert.strictEqual(permessoConcesso(p, true), false);
assert.strictEqual(permessoConcesso('fullscreen', 'true'), false);

console.log('guardieWebContents tests passed.');
