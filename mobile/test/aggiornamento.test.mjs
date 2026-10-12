import { test } from 'node:test';
import assert from 'node:assert/strict';
import { piuNuova, ultimaApk } from '../src/aggiornamento.ts';

const rel = (tag, apk = true, draft = false) => ({
  tag_name: tag, draft,
  assets: apk ? [{ name: `ArchiView-Scanner-${tag}.apk`, browser_download_url: `https://x/${tag}.apk` }] : []
});

test('confronto di versioni numerico, non alfabetico', () => {
  assert.ok(piuNuova('0.10.0', '0.9.9'));
  assert.ok(piuNuova('1.0.0', '0.99.0'));
  assert.ok(!piuNuova('0.2.0', '0.2.0'));
  assert.ok(!piuNuova('0.1.9', '0.2.0'));
});

test('sceglie la release scanner più nuova con APK, ignorando desktop, bozze e release senza APK', () => {
  const r = [rel('v3.3.0'), rel('scanner-v0.4.0', false), rel('scanner-v0.5.0', true, true), rel('scanner-v0.2.1'), rel('scanner-v0.3.0')];
  assert.deepEqual(ultimaApk(r, '0.2.0'), { versione: '0.3.0', url: 'https://x/scanner-v0.3.0.apk' });
});

test('nessun aggiornamento se la versione installata è già la più nuova', () => {
  assert.equal(ultimaApk([rel('scanner-v0.2.0'), rel('scanner-v0.1.0')], '0.2.0'), null);
  assert.equal(ultimaApk([], '0.2.0'), null);
});
