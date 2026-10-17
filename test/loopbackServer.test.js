const assert = require('assert');
const http = require('http');
const os = require('os');
const { avviaServerLoopback, leggiCallbackOAuth } = require('../out/main/ipc/loopbackServer');

console.log('Running loopbackServer tests...');

const atteso = { path: '/oauth2callback', stato: 'a'.repeat(48) };
const leggi = (u) => leggiCallbackOAuth(u, atteso);

assert.deepStrictEqual(leggi(`/oauth2callback?code=4/abc&state=${atteso.stato}&scope=x`), { tipo: 'codice', code: '4/abc' });

assert.deepStrictEqual(leggi('/oauth2callback?code=ATTACCANTE'), { tipo: 'rifiutata' });
assert.deepStrictEqual(leggi('/oauth2callback?code=ATTACCANTE&state=' + 'b'.repeat(48)), { tipo: 'rifiutata' });
assert.deepStrictEqual(leggi('/oauth2callback?code=ATTACCANTE&state=' + 'a'.repeat(47)), { tipo: 'rifiutata' });
assert.deepStrictEqual(leggi('/oauth2callback?code=ATTACCANTE&state='), { tipo: 'rifiutata' });
assert.deepStrictEqual(leggi(`/oauth2callback?state=${atteso.stato}`), { tipo: 'rifiutata' });

assert.deepStrictEqual(leggi(`/?code=x&state=${atteso.stato}`), { tipo: 'estranea' });
assert.deepStrictEqual(leggi('/favicon.ico'), { tipo: 'estranea' });
assert.deepStrictEqual(leggi(`/oauth2callback/../x?code=x&state=${atteso.stato}`), { tipo: 'estranea' });

assert.deepStrictEqual(leggi(`/oauth2callback?error=access_denied&state=${atteso.stato}`), { tipo: 'negato', errore: 'access_denied' });
assert.deepStrictEqual(leggi('/oauth2callback?error=access_denied'), { tipo: 'rifiutata' });

assert.deepStrictEqual(leggiCallbackOAuth('/oauth2callback?code=x&state=', { path: '/oauth2callback', stato: '' }), { tipo: 'rifiutata' });

function richiesta(host, porta) {
  return new Promise((resolve) => {
    const req = http.get({ host, port: porta, path: '/sonda', timeout: 1500, agent: false }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('timeout', () => { req.destroy(); resolve('timeout'); });
    req.on('error', (e) => resolve(e.code));
  });
}

(async () => {
  const porta = await new Promise((resolve) => {
    const s = http.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });

  const server = await avviaServerLoopback(porta, (req, res) => { res.writeHead(204); res.end(); });
  try {
    assert.strictEqual(await richiesta('127.0.0.1', porta), 204);
    const v6 = await richiesta('::1', porta);
    assert.ok(v6 === 204 || v6 === 'EADDRNOTAVAIL' || v6 === 'ECONNREFUSED' || v6 === 'EAFNOSUPPORT', `::1 → ${v6}`);

    const lan = Object.values(os.networkInterfaces()).flat()
      .find((i) => i && i.family === 'IPv4' && !i.internal);
    if (lan) {
      const esito = await richiesta(lan.address, porta);
      assert.notStrictEqual(esito, 204, `il server risponde su ${lan.address}: non è solo loopback`);
    } else {
      console.log('  (nessuna interfaccia di rete non-loopback: controllo LAN saltato)');
    }

    await assert.rejects(avviaServerLoopback(porta, () => {}));
  } finally {
    server.close();
  }

  let scaduto = 0;
  await avviaServerLoopback(porta, (req, res) => { res.writeHead(204); res.end(); }, { scadenzaMs: 150, alloScadere: () => scaduto++ });
  assert.strictEqual(await richiesta('127.0.0.1', porta), 204);
  await new Promise(r => setTimeout(r, 400));
  assert.strictEqual(scaduto, 1, 'alla scadenza si avvisa una volta');
  assert.notStrictEqual(await richiesta('127.0.0.1', porta), 204, 'alla scadenza il server si chiude');
  const chiuso = await avviaServerLoopback(porta, () => {}, { scadenzaMs: 150, alloScadere: () => scaduto++ });
  chiuso.close();
  await new Promise(r => setTimeout(r, 300));
  assert.strictEqual(scaduto, 1, 'chiuso prima della scadenza: nessun avviso');
  console.log('loopbackServer tests passed.');
})().catch((e) => { console.error(e); process.exit(1); });
