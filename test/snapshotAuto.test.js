const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const OUT = path.join(__dirname, '..', 'out', 'main');
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'av-snapshot-'));
const ws2 = fs.mkdtempSync(path.join(os.tmpdir(), 'av-snapshot2-'));
const stato = { workspacePath: ws };
const id = require.resolve(path.join(OUT, 'workspaceManager.js'));
require.cache[id] = { id, filename: id, loaded: true,
  exports: { state: stato, getAllSettings: () => ({}) } };

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

  stato.workspacePath = ws2;
  await snapshots.forseCreaSnapshotAutomatico(payload);
  assert.strictEqual((await snapshots.elencaSnapshot()).length, 1, 'il secondo archivio ha il suo snapshot');
  console.log('✅ Test 2: cambiando archivio lo snapshot automatico non si salta.');
  console.log('Tutti i test snapshotAuto passati con successo!');
})().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => { for (const d of [ws, ws2]) fs.rmSync(d, { recursive: true, force: true }); });
