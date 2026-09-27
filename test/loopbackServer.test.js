// S3 (REVIEW-SECURITY.md): server di redirect OAuth e del Picker. Un callback vale solo sul
// path registrato e con lo `state` emesso per quel login; il server ascolta solo sul loopback.
const assert = require('assert');
const http = require('http');
const os = require('os');
const { avviaServerLoopback, leggiCallbackOAuth } = require('../out/main/ipc/loopbackServer');

console.log('Running loopbackServer tests...');

const atteso = { path: '/oauth2callback', stato: 'a'.repeat(48) };
const leggi = (u) => leggiCallbackOAuth(u, atteso);

// 1. Callback valido
assert.deepStrictEqual(leggi(`/oauth2callback?code=4/abc&state=${atteso.stato}&scope=x`), { tipo: 'codice', code: '4/abc' });

// 2. Codice iniettato senza state, con state sbagliato o troncato: rifiutato, non scambiato
assert.deepStrictEqual(leggi('/oauth2callback?code=ATTACCANTE'), { tipo: 'rifiutata' });
assert.deepStrictEqual(leggi('/oauth2callback?code=ATTACCANTE&state=' + 'b'.repeat(48)), { tipo: 'rifiutata' });
assert.deepStrictEqual(leggi('/oauth2callback?code=ATTACCANTE&state=' + 'a'.repeat(47)), { tipo: 'rifiutata' });
assert.deepStrictEqual(leggi('/oauth2callback?code=ATTACCANTE&state='), { tipo: 'rifiutata' });
// state giusto ma niente code né error
assert.deepStrictEqual(leggi(`/oauth2callback?state=${atteso.stato}`), { tipo: 'rifiutata' });

// 3. Path diversi (favicon, sonde, vecchio "/?code="): ignorati
assert.deepStrictEqual(leggi(`/?code=x&state=${atteso.stato}`), { tipo: 'estranea' });
assert.deepStrictEqual(leggi('/favicon.ico'), { tipo: 'estranea' });
assert.deepStrictEqual(leggi(`/oauth2callback/../x?code=x&state=${atteso.stato}`), { tipo: 'estranea' });

// 4. Consenso negato dall'utente: vale solo con lo state giusto
assert.deepStrictEqual(leggi(`/oauth2callback?error=access_denied&state=${atteso.stato}`), { tipo: 'negato', errore: 'access_denied' });
assert.deepStrictEqual(leggi('/oauth2callback?error=access_denied'), { tipo: 'rifiutata' });

// 5. Senza uno state atteso non passa niente
assert.deepStrictEqual(leggiCallbackOAuth('/oauth2callback?code=x&state=', { path: '/oauth2callback', stato: '' }), { tipo: 'rifiutata' });

function richiesta(host, porta) {
  return new Promise((resolve) => {
    const req = http.get({ host, port: porta, path: '/sonda', timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('timeout', () => { req.destroy(); resolve('timeout'); });
    req.on('error', (e) => resolve(e.code));
  });
}

(async () => {
  // Porta libera scelta dal sistema, poi riusata dal server loopback.
  const porta = await new Promise((resolve) => {
    const s = http.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });

  const server = await avviaServerLoopback(porta, (req, res) => { res.writeHead(204); res.end(); });
  try {
    // 6. Raggiungibile da 127.0.0.1 (e da ::1 se il sistema ha IPv6)
    assert.strictEqual(await richiesta('127.0.0.1', porta), 204);
    const v6 = await richiesta('::1', porta);
    assert.ok(v6 === 204 || v6 === 'EADDRNOTAVAIL' || v6 === 'ECONNREFUSED' || v6 === 'EAFNOSUPPORT', `::1 → ${v6}`);

    // 7. NON raggiungibile da un indirizzo di rete della macchina (prima: listen(porta) senza host)
    const lan = Object.values(os.networkInterfaces()).flat()
      .find((i) => i && i.family === 'IPv4' && !i.internal);
    if (lan) {
      const esito = await richiesta(lan.address, porta);
      assert.notStrictEqual(esito, 204, `il server risponde su ${lan.address}: non è solo loopback`);
    } else {
      console.log('  (nessuna interfaccia di rete non-loopback: controllo LAN saltato)');
    }

    // 8. Porta occupata: rifiuta, non resta mezzo aperto
    await assert.rejects(avviaServerLoopback(porta, () => {}));
  } finally {
    server.close();
  }
  console.log('loopbackServer tests passed.');
})().catch((e) => { console.error(e); process.exit(1); });
