// N1 (PIANO-SICUREZZA-OTTIMIZZAZIONE.md): richieste file: verso un host di rete bloccate nel
// main (hash NTLM via SMB), tranne dentro l'archivio aperto o la sua cartella allegati.
const assert = require('assert');
const { richiestaFileBloccata: bloccata } = require('../out/main/guardiaFile');

console.log('Running guardiaFile tests...');

// 1. Altri schemi e file locali: non sono affar suo.
for (const url of [
  'https://example.org/x.png',
  'local-asset://foto.jpg',
  'file:///C:/Program%20Files/ArchiView/resources/app.asar/out/renderer/index.html',
  'file:///C:/Users/me/Documents/Fondo/allegati_manoscritti/50%25.jpg',
  'file://localhost/C:/x.png',
  'file:///C:/x%ZZ.png'
]) {
  assert.strictEqual(bloccata(url), false, url);
}

// 2. Host di rete, in tutte le forme che Chromium accetta.
for (const url of [
  'file://192.0.2.1/s/x.png',
  'FILE://attaccante.example/s/x.png',
  'file:////192.0.2.1/s/x.png',
  'file:///%5C%5C192.0.2.1%5Cs%5Cx.png',
  'file://[::1]/s/x.png',
  'file://192.0.2.1/C$/x.png'
]) {
  assert.strictEqual(bloccata(url), true, url);
}

// 3. Archivio su un NAS: i suoi file restano raggiungibili, il resto dello stesso server no.
const radici = ['\\\\nas\\fondo', '\\\\nas\\fondo\\allegati_manoscritti', 'C:\\locale'];
assert.strictEqual(bloccata('file://nas/fondo/allegati_manoscritti/a.jpg', radici), false);
assert.strictEqual(bloccata('file:////NAS/Fondo/database_manoscritti.json', radici), false);
assert.strictEqual(bloccata('file://nas/altro/a.jpg', radici), true);
assert.strictEqual(bloccata('file://nas/fondo/../altro/a.jpg', radici), true);
assert.strictEqual(bloccata('file://nas/fondo-bis/a.jpg', radici), true);
// Una radice locale non autorizza nessun host di rete.
assert.strictEqual(bloccata('file://192.0.2.1/locale/x.png', ['C:\\locale']), true);
// Radici non valorizzate (nessun archivio aperto) non rompono nulla.
assert.strictEqual(bloccata('file://192.0.2.1/s/x.png', ['', null, undefined]), true);

console.log('guardiaFile tests OK');
