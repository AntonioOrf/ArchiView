// Test della sanitizzazione dei nomi di allegato provenienti da fonti non fidate
// (vault condivisi, Hub, listing Drive/OneDrive). Non richiede Electron.
const path = require('path');
const assert = require('assert');
const { safeAttachmentPath, safeAttachmentPathOrNull } = require('../out/main/ipc/pathSafety');

const dir = path.resolve('/vault/allegati_manoscritti');

function dentro(p) {
  const rel = path.relative(dir, p);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

console.log('Running pathSafety tests...');

// 1. Nome normale: resta dentro la cartella con lo stesso nome
assert.strictEqual(safeAttachmentPath(dir, 'foto.jpg'), path.join(dir, 'foto.jpg'));
assert.strictEqual(safeAttachmentPath(dir, 'carta 12r.tif'), path.join(dir, 'carta 12r.tif'));

// 2. Traversal relativo, POSIX e Windows: il risultato non esce mai da `dir`
const malevoli = [
  '../segreto.txt',
  '../../etc/passwd',
  '..\..\Windows\System32\config\SAM',
  'sub/../../fuori.txt',
  './../fuori.txt',
  '/etc/passwd',
  'C:\Windows\win.ini',
  '\\server\share\file.txt',
];
for (const nome of malevoli) {
  const esito = safeAttachmentPathOrNull(dir, nome);
  assert.ok(esito === null || dentro(esito), `"${nome}" esce dalla cartella: ${esito}`);
}

// 3. Il path assoluto viene ridotto al solo nome file
assert.strictEqual(safeAttachmentPath(dir, '/etc/passwd'), path.join(dir, 'passwd'));

// 4. Nomi vuoti o speciali: errore
for (const nome of ['', '.', '..', '/', null, undefined, 42, {}]) {
  assert.throws(() => safeAttachmentPath(dir, nome), `"${String(nome)}" doveva essere rifiutato`);
  assert.strictEqual(safeAttachmentPathOrNull(dir, nome), null);
}

console.log('pathSafety tests passed.');
