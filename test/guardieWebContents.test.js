const assert = require('assert');
const { permessoConcesso } = require('../out/main/guardieWebContents');

console.log('Running guardieWebContents tests...');

assert.strictEqual(permessoConcesso('clipboard-sanitized-write', true), true);
assert.strictEqual(permessoConcesso('fullscreen', true), true);
for (const p of ['media', 'notifications', 'geolocation', 'clipboard-read', 'openExternal', 'midi', 'midiSysex',
  'pointerLock', 'hid', 'serial', 'usb', 'display-capture', 'window-management', 'idle-detection', 'unknown']) {
  assert.strictEqual(permessoConcesso(p, true), false, p);
}

for (const p of ['clipboard-sanitized-write', 'fullscreen', 'media']) {
  assert.strictEqual(permessoConcesso(p, false), false, p);
}

assert.strictEqual(permessoConcesso('fullscreen', true, false), true);
assert.strictEqual(permessoConcesso('clipboard-sanitized-write', true, false), false);
assert.strictEqual(permessoConcesso('clipboard-sanitized-write', true, true), true);
assert.strictEqual(permessoConcesso('media', true, false), false);
assert.strictEqual(permessoConcesso('fullscreen', false, false), false);

for (const p of [null, undefined, 42, {}, ['fullscreen']]) assert.strictEqual(permessoConcesso(p, true), false);
assert.strictEqual(permessoConcesso('fullscreen', 'true'), false);

console.log('guardieWebContents tests passed.');
