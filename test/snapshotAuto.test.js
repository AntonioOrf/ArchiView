const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'av-snapshot-'));
const id = require.resolve(path.join(OUT, 'workspaceManager.js'));
require.cache[id] = { id, filename: id, loaded: true,
  exports: { state: { workspacePath: ws }, getAllSettings: () => ({}) } };

const snapshots = require(path.join(OUT, 'snapshots.js'));
const payload = JSON.stringify({ manoscritti: [{ id: 'm1', testo: 'x'.repeat(200000) }], cartelle: [] });

(async () => {
  console.log('Running snapshotAuto tests...');
  const veroNow = Date.now;
  let t = veroNow();
  Date.now = () => (t += 1500);
  try {
    await Promise.all([1, 2, 3].map(() => snapshots.forseCreaSnapshotAutomatico(payload)));
  } finally {
    Date.now = veroNow;
  }
  const voci = await snapshots.elencaSnapshot();
  assert.strictEqual(voci.length, 1, 'tre salvataggi sovrapposti → uno snapshot solo, non ' + voci.length);
  console.log('✅ Test 1: salvataggi sovrapposti creano un solo snapshot automatico.');
  console.log('Tutti i test snapshotAuto passati con successo!');
})().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => fs.rmSync(ws, { recursive: true, force: true }));
