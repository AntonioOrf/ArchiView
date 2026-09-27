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

// --- Cartella di un nuovo workspace (S5): nome da Picker Drive, invito, repository Hub ---
const { safeChildDir, nomeCartellaSicuro } = require('../out/main/ipc/pathSafety');
const base = path.resolve('/utente/Documenti');
const figliaDiretta = (p) => path.dirname(p) === base;

// Tabella unica dei nomi ostili, valida per ogni funzione che costruisce percorsi da dati remoti.
const NOMI_OSTILI = [
  ...malevoli,
  '..', '.', '...', ' ', '',
  'a/../../fuori', 'a\\..\\..\\fuori',
  'CON', 'con.txt', 'NUL', 'COM1', 'LPT9.log',
  'dati:flusso', 'nome.', 'nome ',
  'a\u0000b', 'tab\tin', 'x'.repeat(300),
];

// 5. safeChildDir: o rifiuta o restituisce una figlia diretta di base
for (const nome of NOMI_OSTILI) {
  let esito = null;
  try { esito = safeChildDir(base, nome); } catch { /* rifiutato: va bene */ }
  assert.ok(esito === null || figliaDiretta(esito), `safeChildDir("${nome}") esce da base: ${esito}`);
}
assert.strictEqual(safeChildDir(base, 'Archivio 2026'), path.join(base, 'Archivio 2026'));
for (const nome of ['..', 'a/b', 'a\\b', 'CON', 'x:y', '']) assert.throws(() => safeChildDir(base, nome), `"${nome}" doveva essere rifiutato`);

// 6. nomeCartellaSicuro: qualunque nome diventa un segmento accettato da safeChildDir
for (const nome of [...NOMI_OSTILI, null, undefined, 42, {}]) {
  const pulito = nomeCartellaSicuro(nome);
  assert.ok(figliaDiretta(safeChildDir(base, pulito)), `nomeCartellaSicuro(${JSON.stringify(nome)}) → "${pulito}" non accettato`);
}
// Nomi Drive legittimi restano riconoscibili invece di essere rifiutati
assert.strictEqual(nomeCartellaSicuro('Fondo: Carte / 1500'), 'Fondo_ Carte _ 1500');
assert.strictEqual(nomeCartellaSicuro('Archivio Rossi'), 'Archivio Rossi');
assert.strictEqual(nomeCartellaSicuro('../../Startup'), '.._.._Startup');
assert.strictEqual(nomeCartellaSicuro('..'), 'Vault_Condiviso');
assert.strictEqual(nomeCartellaSicuro('CON'), '_CON');

console.log('pathSafety tests passed.');
