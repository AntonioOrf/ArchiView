const path = require('path');
const assert = require('assert');
const { safeAttachmentPath, safeAttachmentPathOrNull } = require('../out/main/ipc/pathSafety');

const dir = path.resolve('/vault/allegati_manoscritti');

function dentro(p) {
  const rel = path.relative(dir, p);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

console.log('Running pathSafety tests...');

assert.strictEqual(safeAttachmentPath(dir, 'foto.jpg'), path.join(dir, 'foto.jpg'));
assert.strictEqual(safeAttachmentPath(dir, 'carta 12r.tif'), path.join(dir, 'carta 12r.tif'));

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

assert.strictEqual(safeAttachmentPath(dir, '/etc/passwd'), path.join(dir, 'passwd'));

for (const nome of ['', '.', '..', '/', null, undefined, 42, {}]) {
  assert.throws(() => safeAttachmentPath(dir, nome), `"${String(nome)}" doveva essere rifiutato`);
  assert.strictEqual(safeAttachmentPathOrNull(dir, nome), null);
}

const { safeChildDir, nomeCartellaSicuro } = require('../out/main/ipc/pathSafety');
const base = path.resolve('/utente/Documenti');
const figliaDiretta = (p) => path.dirname(p) === base;

const NOMI_OSTILI = [
  ...malevoli,
  '..', '.', '...', ' ', '',
  'a/../../fuori', 'a\\..\\..\\fuori',
  'CON', 'con.txt', 'NUL', 'COM1', 'LPT9.log',
  'dati:flusso', 'nome.', 'nome ',
  'a\u0000b', 'tab\tin', 'x'.repeat(300),
];

for (const nome of NOMI_OSTILI) {
  let esito = null;
  try { esito = safeChildDir(base, nome); } catch {}
  assert.ok(esito === null || figliaDiretta(esito), `safeChildDir("${nome}") esce da base: ${esito}`);
}
assert.strictEqual(safeChildDir(base, 'Archivio 2026'), path.join(base, 'Archivio 2026'));
for (const nome of ['..', 'a/b', 'a\\b', 'CON', 'x:y', '']) assert.throws(() => safeChildDir(base, nome), `"${nome}" doveva essere rifiutato`);

for (const nome of [...NOMI_OSTILI, null, undefined, 42, {}]) {
  const pulito = nomeCartellaSicuro(nome);
  assert.ok(figliaDiretta(safeChildDir(base, pulito)), `nomeCartellaSicuro(${JSON.stringify(nome)}) → "${pulito}" non accettato`);
}
assert.strictEqual(nomeCartellaSicuro('Fondo: Carte / 1500'), 'Fondo_ Carte _ 1500');
assert.strictEqual(nomeCartellaSicuro('Archivio Rossi'), 'Archivio Rossi');
assert.strictEqual(nomeCartellaSicuro('../../Startup'), '.._.._Startup');
assert.strictEqual(nomeCartellaSicuro('..'), 'Vault_Condiviso');
assert.strictEqual(nomeCartellaSicuro('CON'), '_CON');

for (const nome of NOMI_OSTILI) {
  const esito = safeAttachmentPathOrNull(dir, nome);
  assert.ok(esito === null || path.dirname(esito) === dir, `safeAttachmentPath("${nome}") esce da dir: ${esito}`);
}
for (const nome of ['x.txt:ads', 'foto.jpg:Zone.Identifier', 'dati:flusso', 'CON', 'nul.txt', 'Com1.jpg', 'lpt9',
  'x.', 'x ', 'a\u0000b', 'tab\tin', 'a<b.png', 'a|b.png', 'a?.png', 'a*.png', 'a".png', 'x'.repeat(256)]) {
  assert.strictEqual(safeAttachmentPathOrNull(dir, nome), null, `"${nome}" doveva essere rifiutato`);
}
for (const nome of ['carta 12r.tif', 'Fondo (1500) – c. 3v.jpg', 'perché.pdf', 'p0001.jpg', '.archiview-x.png', 'console.png', 'x'.repeat(255)]) {
  assert.strictEqual(safeAttachmentPath(dir, nome), path.join(dir, nome));
}

{
  const fs = require('fs');
  const os = require('os');
  const { dentroCartellaReale } = require('../out/main/ipc/pathSafety');
  const radice = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-alias-'));
  try {
    const vera = path.join(radice, 'dati-veri');
    fs.mkdirSync(vera);
    const file = path.join(vera, 'segreto.json');
    fs.writeFileSync(file, '{}');
    const reale = fs.realpathSync.native(file);

    assert.strictEqual(dentroCartellaReale(reale, vera), true);
    assert.strictEqual(dentroCartellaReale(reale, radice), true);
    assert.strictEqual(dentroCartellaReale(reale, path.join(radice, 'altra')), false);
    assert.strictEqual(dentroCartellaReale(reale, path.join(radice, 'dati-veri-bis')), false);

    const alias = path.join(radice, 'alias');
    fs.symlinkSync(vera, alias, 'junction');
    assert.strictEqual(dentroCartellaReale(reale, alias), true, 'cartella raggiunta via junction');

    if (process.platform === 'win32') {
      const lungo = path.join(radice, 'nome molto lungo della cartella');
      fs.mkdirSync(lungo);
      fs.writeFileSync(path.join(lungo, 'x.json'), '{}');
      const breve = require('child_process').execSync(`cmd /c for %I in ("${lungo}") do @echo %~sI`, { encoding: 'utf8' }).trim();
      if (breve && breve !== lungo && breve.includes('~')) {
        assert.strictEqual(dentroCartellaReale(fs.realpathSync.native(path.join(lungo, 'x.json')), breve), true, 'cartella raggiunta via nome 8.3');
      } else {
        console.log('  (nomi 8.3 non attivi su questo volume: controllo saltato)');
      }
    }

    for (const [f, d] of [[reale, ''], [null, vera], [reale, null]]) assert.strictEqual(dentroCartellaReale(f, d), false);
  } finally {
    fs.rmSync(radice, { recursive: true, force: true });
  }
}

console.log('pathSafety tests passed.');
