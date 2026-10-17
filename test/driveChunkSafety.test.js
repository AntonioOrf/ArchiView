const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const assert = require('assert');
const { filtraIndiceChunk, isChunkHash, safeChunkPath, hashFile, assembleFileFromChunks } = require('../out/main/chunkingLogic');

console.log('Running driveChunkSafety tests...');

const H1 = 'a'.repeat(64);
const H2 = '0123456789abcdef'.repeat(4);

const ostili = [
  '../../../AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/x.bat',
  '..\\..\\..\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\x.bat',
  'C:\\Windows\\Temp\\x.bat',
  '/etc/cron.d/x',
  '\\\\server\\share\\x',
  H1 + '/../x',
  H1.toUpperCase(),
  H1 + ':ads',
  H1.slice(1),
  '',
  null,
  42,
];

assert.ok(isChunkHash(H1));
assert.ok(isChunkHash(H2));
for (const h of ostili) assert.ok(!isChunkHash(h), `accettato come hash: ${String(h)}`);

{
  const { indice, scartate } = filtraIndiceChunk({
    'buono.pdf': [H1, H2],
    'misto.pdf': [H1, ostili[0]],
    'non-lista.pdf': ostili[0],
    'vuoto.pdf': [],
  });
  assert.deepStrictEqual(indice, { 'buono.pdf': [H1, H2], 'vuoto.pdf': [] });
  assert.deepStrictEqual(scartate.sort(), ['misto.pdf', 'non-lista.pdf']);
}

for (const x of [null, undefined, 'x', 3, [H1]]) {
  assert.deepStrictEqual(filtraIndiceChunk(x).indice, {});
}

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-chunks-'));
assert.strictEqual(safeChunkPath(cacheDir, H1), path.join(path.resolve(cacheDir), H1));
for (const h of ostili) {
  assert.throws(() => safeChunkPath(cacheDir, h), `safeChunkPath non ha lanciato per: ${String(h)}`);
}

(async () => {
  try {
    const dati = Buffer.from('carta 12r');
    const h = crypto.createHash('sha256').update(dati).digest('hex');
    fs.writeFileSync(path.join(cacheDir, h), dati);
    assert.strictEqual(await hashFile(path.join(cacheDir, h)), h);
    fs.writeFileSync(path.join(cacheDir, H1), dati);
    assert.notStrictEqual(await hashFile(path.join(cacheDir, H1)), H1);

    const dest = path.join(cacheDir, 'out', 'ricomposto.pdf');
    await assert.rejects(assembleFileFromChunks([h, H2], cacheDir, dest));
    assert.ok(!fs.existsSync(dest), 'destinazione creata nonostante il chunk mancante');

    fs.mkdirSync(path.join(cacheDir, H2));
    await assert.rejects(assembleFileFromChunks([h, H2], cacheDir, dest));
    assert.ok(!fs.existsSync(dest), 'file troncato lasciato al nome finale');
    assert.deepStrictEqual(fs.readdirSync(path.dirname(dest)), [], 'temporaneo rimasto');

    await assembleFileFromChunks([h, h], cacheDir, dest);
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), 'carta 12rcarta 12r');

    console.log('driveChunkSafety tests passed.');
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
