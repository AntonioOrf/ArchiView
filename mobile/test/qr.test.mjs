import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leggiQr } from '../src/qr.ts';

const T = 'a'.repeat(64);

test('QR valido del desktop', () => {
  assert.deepEqual(leggiQr(`archiview-scanner://abbina?h=192.168.1.20&p=53211&t=${T}`), { host: '192.168.1.20', porta: 53211, token: T });
  assert.deepEqual(leggiQr(` archiview-scanner://abbina?h=10.0.0.2&p=80&t=${T} `)?.host, '10.0.0.2');
  assert.equal(leggiQr(`archiview-scanner://abbina?h=172.20.1.1&p=80&t=${T}`)?.host, '172.20.1.1');
});

test('rifiuta host fuori dalla rete locale e campi storti', () => {
  for (const h of ['8.8.8.8', '172.32.0.1', '192.168.1', '192.168.1.300', 'evil.com', '192.168.1.1.5', '']) {
    assert.equal(leggiQr(`archiview-scanner://abbina?h=${h}&p=80&t=${T}`), null, h);
  }
  assert.equal(leggiQr(`archiview-scanner://abbina?h=192.168.1.2&p=0&t=${T}`), null);
  assert.equal(leggiQr(`archiview-scanner://abbina?h=192.168.1.2&p=80&t=corto`), null);
  assert.equal(leggiQr(`https://example.com/?h=192.168.1.2&p=80&t=${T}`), null);
});
