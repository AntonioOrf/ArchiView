// Test delle guardie di rete IIIF: indirizzi privati (SSRF) e lettura del corpo con tetto.
// Non richiede Electron: `fetchGuardata` (l'unica parte che lo usa) non viene toccata.
const assert = require('assert');
const { ipPrivato, hostPrivato, urlPubblico, soloViaProxy, leggiCorpoLimitato, autorizzaOrigine, origineAutorizzata } =
  require('../out/main/iiif/reteSicura');

async function run() {
  console.log('Running iiifReteSicura tests...');

  // 1. IPv4
  for (const ip of ['127.0.0.1', '127.8.8.8', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '255.255.255.255']) {
    assert.strictEqual(ipPrivato(ip), true, `${ip} doveva essere privato`);
  }
  for (const ip of ['8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', '193.55.1.1', '100.128.0.1']) {
    assert.strictEqual(ipPrivato(ip), false, `${ip} doveva essere pubblico`);
  }

  // 2. IPv6, compreso IPv4 incapsulato
  for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1%eth0', '[::1]', '::ffff:127.0.0.1',
    '::ffff:10.0.0.1', '::ffff:a00:1', '::ffff:7f00:1', 'ff02::1']) {
    assert.strictEqual(ipPrivato(ip), true, `${ip} doveva essere privato`);
  }
  for (const ip of ['2001:4860:4860::8888', '::ffff:8.8.8.8', '2a00:1450::1']) {
    assert.strictEqual(ipPrivato(ip), false, `${ip} doveva essere pubblico`);
  }

  // 2b. L6: IPv4 compatibile, NAT64, 6to4, SIIT, Teredo e altri blocchi riservati
  for (const ip of [
    '::7f00:1', '::127.0.0.1', '::8.8.8.8', '::a00:1',           // ::/96 compatibile
    '64:ff9b::7f00:1', '64:ff9b::10.0.0.1', '64:ff9b::c0a8:101', // NAT64 verso privato
    '64:ff9b:1::8.8.8.8',                                         // NAT64 uso locale
    '2002:7f00:1::', '2002:c0a8:101::1',                          // 6to4 verso privato
    '::ffff:0:7f00:1', '::ffff:0:10.0.0.1',                       // SIIT
    '2001:0:4136:e378::1',                                        // Teredo
    '2001:db8::1', '100::1', 'fec0::1',
    '0:0:0:0:0:0:0:1', '0000:0000:0000:0000:0000:ffff:7f00:0001',
  ]) assert.strictEqual(ipPrivato(ip), true, `${ip} doveva essere privato`);
  for (const ip of ['64:ff9b::808:808', '64:ff9b::8.8.8.8', '2002:808:808::1', '::ffff:0:8.8.8.8',
    '2001:4860::8888', '2600::1']) {
    assert.strictEqual(ipPrivato(ip), false, `${ip} doveva essere pubblico`);
  }
  for (const ip of ['192.0.0.8', '198.18.0.1', '198.19.255.255']) {
    assert.strictEqual(ipPrivato(ip), true, `${ip} doveva essere privato`);
  }
  for (const ip of ['192.0.1.1', '198.20.0.1', '198.17.0.1']) {
    assert.strictEqual(ipPrivato(ip), false, `${ip} doveva essere pubblico`);
  }

  // 3. Non-IP: nel dubbio si nega
  assert.strictEqual(ipPrivato('non-un-ip'), true);
  assert.strictEqual(ipPrivato(''), true);

  // 4. Host risolti con un lookup finto
  const dnsFinto = (tabella) => async (host) => {
    if (!(host in tabella)) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    return tabella[host].map(address => ({ address, family: address.includes(':') ? 6 : 4 }));
  };
  const lookup = dnsFinto({
    'iiif.biblioteca.it': ['93.184.216.34'],
    'router.lan': ['192.168.1.1'],
    'misto.example': ['93.184.216.34', '10.0.0.5'],
    'v6locale.example': ['fd00::5'],
  });
  assert.strictEqual(await hostPrivato('iiif.biblioteca.it', lookup), false);
  assert.strictEqual(await hostPrivato('router.lan', lookup), true);
  assert.strictEqual(await hostPrivato('misto.example', lookup), true, 'basta un indirizzo privato');
  assert.strictEqual(await hostPrivato('v6locale.example', lookup), true);
  assert.strictEqual(await hostPrivato('localhost', lookup), true);
  assert.strictEqual(await hostPrivato('app.localhost', lookup), true);
  assert.strictEqual(await hostPrivato('[::1]', lookup), true);
  assert.strictEqual(await hostPrivato('', lookup), true);
  // L6: DNS che fallisce o non restituisce nulla → si nega; solo dietro proxy decide il proxy
  assert.strictEqual(await hostPrivato('sconosciuto.example', lookup), true, 'DNS fallito: si nega');
  assert.strictEqual(await hostPrivato('vuoto.example', async () => []), true, 'risposta vuota: si nega');
  assert.strictEqual(await hostPrivato('sconosciuto.example', lookup, { viaProxy: true }), false, 'dietro proxy risolve il proxy');
  assert.strictEqual(await hostPrivato('router.lan', lookup, { viaProxy: true }), true, 'risolto privato: negato anche via proxy');
  assert.strictEqual(await urlPubblico('https://sconosciuto.example/x.jpg', lookup), false);

  // Regole proxy (formato PAC di resolveProxy)
  assert.strictEqual(soloViaProxy('DIRECT'), false);
  assert.strictEqual(soloViaProxy(''), false);
  assert.strictEqual(soloViaProxy('PROXY proxy.bib.it:8080'), true);
  assert.strictEqual(soloViaProxy('PROXY a:1; HTTPS b:2'), true);
  assert.strictEqual(soloViaProxy('PROXY a:1; DIRECT'), false, 'con DIRECT di riserva Chromium può andare diretto');

  // 5. URL
  assert.strictEqual(await urlPubblico('https://iiif.biblioteca.it/iiif/1/full/max/0/default.jpg', lookup), true);
  assert.strictEqual(await urlPubblico('http://127.0.0.1:8080/x.jpg', lookup), false);
  assert.strictEqual(await urlPubblico('http://0x7f000001/x.jpg', lookup), false, 'IP esadecimale normalizzato da URL');
  assert.strictEqual(await urlPubblico('http://2130706433/x.jpg', lookup), false, 'IP decimale normalizzato da URL');
  assert.strictEqual(await urlPubblico('http://router.lan/admin', lookup), false);
  assert.strictEqual(await urlPubblico('file:///etc/passwd', lookup), false);
  assert.strictEqual(await urlPubblico('non un url', lookup), false);

  // 6. Origini autorizzate a mano: solo l'origine esatta
  autorizzaOrigine('http://192.168.1.20:8182/iiif/manifest.json');
  assert.strictEqual(origineAutorizzata('http://192.168.1.20:8182/iiif/2/c1/full/max/0/default.jpg'), true);
  assert.strictEqual(origineAutorizzata('http://192.168.1.20:8080/'), false, 'altra porta');
  assert.strictEqual(origineAutorizzata('http://192.168.1.21:8182/'), false, 'altro host');

  // 7. Corpo con tetto: sotto il limite passa intero, oltre si interrompe
  const corpo = (n) => new Response(new ReadableStream({
    start(c) { for (let i = 0; i < n; i++) c.enqueue(new Uint8Array(1024).fill(65)); c.close(); }
  }));
  const letto = await leggiCorpoLimitato(corpo(4), 8 * 1024);
  assert.ok(Buffer.isBuffer(letto) && letto.length === 4096);
  assert.strictEqual(await leggiCorpoLimitato(corpo(9), 8 * 1024), null);
  assert.strictEqual((await leggiCorpoLimitato(corpo(8), 8 * 1024)).length, 8192, 'esattamente al limite passa');

  // Flusso infinito senza Content-Length: deve fermarsi, non riempire la memoria
  let prodotti = 0;
  const infinito = new Response(new ReadableStream({
    pull(c) { prodotti++; c.enqueue(new Uint8Array(64 * 1024)); }
  }));
  assert.strictEqual(await leggiCorpoLimitato(infinito, 1024 * 1024), null);
  assert.ok(prodotti < 40, `letti ${prodotti} blocchi: il lettore non si è fermato`);

  assert.strictEqual((await leggiCorpoLimitato(new Response(null), 10)).length, 0);

  console.log('iiifReteSicura tests passed.');
}

run().catch((e) => { console.error(e); process.exit(1); });
