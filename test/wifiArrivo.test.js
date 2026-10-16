const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { avviaServerWifi, urlAbbinamento, indirizziLan } = require('../out/main/scanner/wifiArrivo');

console.log('Running wifiArrivo tests...');

{
  const v4 = (address, internal = false) => ({ family: 'IPv4', address, internal });
  const schede = {
    'Radmin VPN': [v4('26.109.160.170')],
    'vEthernet (WSL)': [v4('172.20.16.1')],
    'Loopback': [v4('127.0.0.1', true)],
    'Wi-Fi': [{ family: 'IPv6', address: 'fe80::1', internal: false }, v4('192.168.1.3')],
    'Ethernet': [v4('10.0.0.5')],
  };
  assert.deepStrictEqual(indirizziLan(schede), ['192.168.1.3', '10.0.0.5', '172.20.16.1', '26.109.160.170']);
  assert.deepStrictEqual(indirizziLan({}), []);
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

function richiesta(porta, metodo, percorso, corpo, token) {
  return new Promise((ok, ko) => {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (corpo) headers['Content-Length'] = corpo.length;
    const req = http.request({ host: '127.0.0.1', port: porta, method: metodo, path: percorso, headers }, res => {
      const parti = [];
      res.on('data', d => parti.push(d));
      res.on('end', () => ok({ stato: res.statusCode, corpo: Buffer.concat(parti).toString('utf8') }));
    });
    req.on('error', ko);
    if (corpo) req.write(corpo);
    req.end();
  });
}

(async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'av-wifi-'));
  const arrivati = [];
  const o = {
    cartellaArrivo: path.join(base, 'arrivo'),
    cartellaTemp: path.join(base, 'tmp-wifi'),
    cartellaAssegnati: path.join(base, 'assegnati'),
    cartellaStaging: path.join(base, 'staging'),
    archivio: 'Prova',
    onLotto: id => arrivati.push(id)
  };
  const s = await avviaServerWifi(o);
  const t = s.token;
  try {
    assert.match(urlAbbinamento('192.168.1.5', s.porta, t), /^archiview-scanner:\/\/abbina\?h=192\.168\.1\.5&p=\d+&t=[0-9a-f]{64}$/);

    assert.strictEqual((await richiesta(s.porta, 'GET', '/ping')).stato, 401);
    assert.strictEqual((await richiesta(s.porta, 'GET', '/ping', null, 'x'.repeat(64))).stato, 401);
    const ping = await richiesta(s.porta, 'GET', '/ping', null, t);
    assert.deepStrictEqual([ping.stato, JSON.parse(ping.corpo).archivio], [200, 'Prova']);

    const id = '20261009-140000-wifi';
    const pagina = Buffer.from('foto finta');
    assert.strictEqual((await richiesta(s.porta, 'PUT', `/lotti/..%2F..%2Fx/p0001.jpg`, pagina, t)).stato, 400);
    assert.strictEqual((await richiesta(s.porta, 'PUT', `/lotti/${id}/evil.exe`, pagina, t)).stato, 400);
    assert.strictEqual((await richiesta(s.porta, 'DELETE', `/lotti/${id}/p0001.jpg`, null, t)).stato, 404);
    assert.strictEqual((await richiesta(s.porta, 'PUT', `/lotti/${id}/p0001.jpg`, null, t)).stato, 411);

    assert.strictEqual((await richiesta(s.porta, 'PUT', `/lotti/${id}/p0001.jpg`, pagina, t)).stato, 204);
    const manifest = (hash) => Buffer.from(JSON.stringify({
      formato: 'archiview-scanner/lotto', versione: 1, id, creatoIl: '2026-10-09T14:00:00+02:00',
      destinazione: { tipo: 'nessuna' }, pagine: [{ file: 'p0001.jpg', sha256: hash, byte: pagina.length, modalita: 'raffica' }]
    }));
    const male = await richiesta(s.porta, 'PUT', `/lotti/${id}/lotto.json`, manifest('0'.repeat(64)), t);
    assert.strictEqual(male.stato, 422);
    assert.deepStrictEqual(JSON.parse(male.corpo).falliti, ['sha256_diverso']);
    assert.ok(!fs.existsSync(path.join(o.cartellaArrivo, id)));

    assert.strictEqual((await richiesta(s.porta, 'PUT', `/lotti/${id}/p0001.jpg`, pagina, t)).stato, 204);
    assert.strictEqual((await richiesta(s.porta, 'PUT', `/lotti/${id}/lotto.json`, manifest(sha(pagina)), t)).stato, 201);
    assert.ok(fs.existsSync(path.join(o.cartellaArrivo, id, 'p0001.jpg')));
    assert.ok(!fs.existsSync(path.join(o.cartellaStaging, id)));
    assert.deepStrictEqual(arrivati, [id]);
  } finally {
    await s.ferma();
  }
  await assert.rejects(richiesta(s.porta, 'GET', '/ping', null, t));

  console.log('✓ wifiArrivo: token, URL, verifica e arrivo');
})().catch(e => { console.error(e); process.exit(1); });
