// S8 (REVIEW-SECURITY.md): client Hub nel main. La repoKey va solo all'Hub configurato, su
// HTTPS (o loopback), mai seguendo un redirect; gli inviti restano compatibili col formato
// generato finora dal renderer.
const assert = require('assert');
const http = require('http');
const { chiamataHub, hubUrlValido, generaEncKey, codificaInvito, decodificaInvito } = require('../out/main/ipc/hubClient');

console.log('Running hubClient tests...');

// 1. URL dell'Hub: HTTPS, oppure http solo verso la macchina stessa
assert.strictEqual(hubUrlValido('https://hub.example.workers.dev'), 'https://hub.example.workers.dev');
assert.strictEqual(hubUrlValido('https://hub.example/base/'), 'https://hub.example/base');
assert.strictEqual(hubUrlValido('http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
for (const u of ['http://hub.example', 'ftp://x', 'javascript:alert(1)', 'https://u:p@hub.example',
  'https://hub.example/?x=1', 'https://hub.example/#a', '', null, 42, 'non un url']) {
  assert.strictEqual(hubUrlValido(u), null, `accettato: ${u}`);
}

// 2. Invito: andata e ritorno, e compatibilità col codice prodotto dal vecchio renderer
const inv = { hubUrl: 'https://hub.example', repoId: 'repo_1', memberKey: 'mk-segreta', encKey: generaEncKey(),
  pusherKey: 'pk', pusherCluster: 'eu', name: 'Fondo Àngelo | "prova"' };
assert.deepStrictEqual(decodificaInvito(codificaInvito(inv)), inv);
assert.deepStrictEqual(decodificaInvito('archiview://join/' + codificaInvito(inv)), inv);
const vecchioRenderer = (str) => Buffer.from(unescape(encodeURIComponent(str)), 'binary').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const raw = ['HUB1', inv.hubUrl, inv.repoId, inv.memberKey, inv.encKey, inv.pusherKey, inv.pusherCluster, encodeURIComponent(inv.name)].join('|');
assert.deepStrictEqual(decodificaInvito(vecchioRenderer(raw)), inv);
assert.strictEqual(Buffer.from(generaEncKey(), 'base64url').length, 32);

// 3. Inviti ostili: rifiutati
const enc = (s) => Buffer.from(s, 'utf8').toString('base64url');
for (const c of [
  enc('HUB1|http://evil.example|r|k'),          // chiave in chiaro verso un host remoto
  enc('HUB1|https://hub.example|../x|k'),        // repoId che cambia la rotta
  enc('HUB1|https://hub.example|a/b|k'),
  enc('HUB1|https://hub.example|r|'),            // senza chiave
  enc('HUB2|https://hub.example|r|k'),
  'non-base64!!', '', null, 'A'.repeat(9000),
]) assert.strictEqual(decodificaInvito(c), null, `accettato: ${c}`);

(async () => {
  // 4. Config non valida: nessuna richiesta, status 0
  for (const cfg of [null, {}, { hubUrl: 'http://evil.example', repoId: 'r', repoKey: 'k' },
    { hubUrl: 'https://hub.example', repoId: '../x', repoKey: 'k' }, { hubUrl: 'https://hub.example', repoId: 'r', repoKey: '' }]) {
    const r = await chiamataHub(cfg, 'GET', '/pull');
    assert.strictEqual(r.ok, false); assert.strictEqual(r.status, 0);
  }

  // 5. Server locale: Bearer inviato, esiti ed errori riportati senza eccezioni, redirect non seguiti
  const visti = [];
  const server = http.createServer((req, res) => {
    visti.push({ url: req.url, auth: req.headers.authorization || null });
    if (req.url.startsWith('/api/repos/r1/pull')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"version":4}'); return; }
    if (req.url === '/api/repos/r1/members') { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end('{"error":"solo owner"}'); return; }
    if (req.url === '/api/repos/r1/redir') { res.writeHead(302, { Location: '/altrove' }); res.end(); return; }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const cfg = { hubUrl: `http://127.0.0.1:${server.address().port}`, repoId: 'r1', repoKey: 'CHIAVE' };
  try {
    assert.deepStrictEqual(await chiamataHub(cfg, 'GET', '/pull?ifVersionNot=3'), { ok: true, status: 200, data: { version: 4 } });
    assert.strictEqual(visti[0].auth, 'Bearer CHIAVE');
    assert.deepStrictEqual(await chiamataHub(cfg, 'GET', '/members'), { ok: false, status: 403, error: 'solo owner' });
    const redir = await chiamataHub(cfg, 'GET', '/redir');
    assert.strictEqual(redir.ok, false);
    assert.ok(!visti.some((v) => v.url === '/altrove'), 'redirect seguito con la repoKey');
  } finally {
    server.close();
  }

  // 6. Hub irraggiungibile: status 0, nessuna eccezione
  const giu = await chiamataHub({ ...cfg, hubUrl: 'http://127.0.0.1:1' }, 'GET', '/pull', { timeoutMs: 2000 });
  assert.strictEqual(giu.ok, false); assert.strictEqual(giu.status, 0);

  console.log('hubClient tests passed.');
})().catch((e) => { console.error(e); process.exit(1); });
