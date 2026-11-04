const assert = require('assert');

const Model = require('../out/shared/model');

console.log('Running fondiNote tests...');

const f = Model.fondiNote;
assert.strictEqual(f('a', 'b', 'a'), 'b', 'scheda viva invariata: vale il form');
assert.strictEqual(f('a', 'a', 'c'), 'c', 'form invariato: vale la scheda viva');
assert.strictEqual(f('a', 'a modificata', 'a\n\ntelefono'), 'a modificata\n\ntelefono', 'aggiunta in coda al testo base');
assert.strictEqual(f('a', 'a modificata\n\ntelefono', 'a\n\ntelefono'), 'a modificata\n\ntelefono', 'aggiunta già presente');
assert.strictEqual(f('a', 'x', 'y'), 'x', 'modifiche incompatibili: vale il form');
assert.strictEqual(f(undefined, null, undefined), '', 'undefined e null come stringa vuota');
assert.strictEqual(f('', 'mio', 'telefono'), 'mio\n\ntelefono', 'base vuota, aggiunta in coda con separatore');
assert.strictEqual(f('', 'mio\n\ntelefono', 'telefono'), 'mio\n\ntelefono', 'base vuota, aggiunta già presente');
assert.strictEqual(f('', '', 'telefono'), 'telefono', 'form vuoto e invariato');
console.log('✅ Tutti i test fondiNote passati con successo!');
