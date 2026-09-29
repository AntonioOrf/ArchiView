// Realtime Hub (S6 in REVIEW-SECURITY.md), a livello di protocollo Worker.
// Avvia da sé `wrangler dev` in locale (D1 locale, segreti di prova) e un finto Pusher che
// registra le pubblicazioni. Nessun account Cloudflare o Pusher richiesto.
// Uso:  npm run realtime
import { spawn, spawnSync } from 'node:child_process';
import { createHmac, createHash } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';

const SEGRETO = 'segreto-di-prova';
const CHIAVE_PUSHER = 'chiave-pubblica-di-prova';
const APP_ID = '4242';
const CREATE_SECRET = 'dev-secret';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.error('  ✗ ' + msg); }
}
const hmac = (msg) => createHmac('sha256', SEGRETO).update(msg).digest('hex');
const portaLibera = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Finto Pusher: registra le chiamate REST ---
const pubblicazioni = [];
const pusher = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const url = new URL(req.url, 'http://x');
    pubblicazioni.push({ path: url.pathname, query: url.searchParams, body });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
});

async function main() {
  const portaPusher = await portaLibera();
  await new Promise((r) => pusher.listen(portaPusher, '127.0.0.1', r));
  const porta = await portaLibera();
  const BASE = `http://127.0.0.1:${porta}`;

  const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
  const schema = spawnSync('npx', ['wrangler', 'd1', 'execute', 'archiview-hub', '--local', '--file=./src/schema.sql'],
    { env, shell: true, encoding: 'utf8' });
  if (schema.status !== 0) throw new Error('schema locale non applicato:\n' + schema.stderr);

  const vars = {
    CREATE_SECRET, PUSHER_APP_ID: APP_ID, PUSHER_KEY: CHIAVE_PUSHER, PUSHER_SECRET: SEGRETO,
    PUSHER_CLUSTER: 'eu', PUSHER_HOST: `http://127.0.0.1:${portaPusher}`,
  };
  const args = ['wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(porta),
    ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])];
  const worker = spawn('npx', args, { env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let logWorker = '';
  worker.stdout.on('data', (d) => { logWorker += d; });
  worker.stderr.on('data', (d) => { logWorker += d; });

  try {
    // Attesa dell'avvio (fino a 60 s)
    let pronto = false;
    for (let i = 0; i < 120 && !pronto; i++) {
      try { pronto = (await fetch(`${BASE}/`)).ok; } catch { await attendi(500); }
    }
    if (!pronto) throw new Error('wrangler dev non partito:\n' + logWorker);

    const auth = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
    const post = (path, key, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: auth(key), body: JSON.stringify(body) });

    console.log('\n── Relay aperto rimosso');
    let r = await fetch(`${BASE}/api/ping`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'qualsiasi', event: 'drive-updated', data: {} }) });
    ok(r.status === 404, 'POST /api/ping → 404');
    ok(pubblicazioni.length === 0, 'nessuna pubblicazione verso Pusher');

    console.log('\n── Repo, owner e membro');
    r = await fetch(`${BASE}/api/repos`, { method: 'POST',
      headers: { 'X-Create-Secret': CREATE_SECRET, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' }, body: '{}' });
    const { repoId, ownerKey } = await r.json();
    ok(r.status === 201 && repoId && ownerKey, 'repo creato');
    r = await post(`/api/repos/${repoId}/members`, ownerKey, { label: 'B' });
    const { memberKey, memberId } = await r.json();
    ok(!!memberKey, 'membro B creato');
    const canale = `private-repo-${repoId}`;

    console.log('\n── Autorizzazione dei canali privati');
    const socketId = '123456.7890123';
    r = await fetch(`${BASE}/api/repos/${repoId}/realtime-auth`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ socketId, channel: canale }) });
    ok(r.status === 401, 'senza chiave → 401');
    r = await post(`/api/repos/${repoId}/realtime-auth`, 'chiave-inventata', { socketId, channel: canale });
    ok(r.status === 401, 'chiave inventata → 401');
    r = await post(`/api/repos/${repoId}/realtime-auth`, memberKey, { socketId, channel: 'private-repo-repo_altro' });
    ok(r.status === 403, 'canale di un altro repo → 403');
    r = await post(`/api/repos/${repoId}/realtime-auth`, memberKey, { socketId, channel: 'repo-pubblico' });
    ok(r.status === 403, 'canale non privato → 403');
    r = await post(`/api/repos/${repoId}/realtime-auth`, memberKey, { socketId: '1.2:private-repo-x', channel: canale });
    ok(r.status === 400, 'socketId malformato → 400');
    r = await post(`/api/repos/${repoId}/realtime-auth`, memberKey, { socketId, channel: canale });
    const firma = await r.json();
    ok(r.status === 200 && firma.auth === `${CHIAVE_PUSHER}:${hmac(`${socketId}:${canale}`)}`, 'membro → firma Pusher corretta');
    r = await post(`/api/repos/${repoId}/realtime-auth`, ownerKey, { socketId, channel: canale });
    ok(r.status === 200, 'owner → 200');

    console.log('\n── Pubblicazione dopo il push');
    r = await post(`/api/repos/${repoId}/push`, ownerKey, { parentVersion: 0, database: { cifrato: true } });
    ok(r.status === 200, 'push v1 → 200');
    for (let i = 0; i < 20 && pubblicazioni.length < 1; i++) await attendi(100);
    ok(pubblicazioni.length === 1, 'una pubblicazione per il push riuscito');
    const p = pubblicazioni[0];
    if (p) {
      const ev = JSON.parse(p.body);
      ok(p.path === `/apps/${APP_ID}/events`, 'endpoint REST dell\'app');
      ok(ev.channel === canale && ev.name === 'hub-updated', 'canale privato del repo, evento hub-updated');
      ok(JSON.parse(ev.data).version === 1, 'dati: solo la nuova versione');
      ok(p.query.get('body_md5') === createHash('md5').update(p.body).digest('hex'), 'body_md5 corretto');
      const q = new URLSearchParams(p.query); q.delete('auth_signature');
      ok(p.query.get('auth_signature') === hmac(`POST\n${p.path}\n${q.toString()}`), 'firma REST corretta');
    }
    r = await post(`/api/repos/${repoId}/push`, memberKey, { parentVersion: 0, database: {} });
    ok(r.status === 409, 'push in conflitto → 409');
    await attendi(500);
    ok(pubblicazioni.length === 1, 'nessuna pubblicazione per un push in conflitto');

    console.log('\n── Revoca');
    r = await fetch(`${BASE}/api/repos/${repoId}/members/${memberId}`, { method: 'DELETE', headers: auth(ownerKey) });
    ok(r.status === 200, 'B revocato');
    r = await post(`/api/repos/${repoId}/realtime-auth`, memberKey, { socketId, channel: canale });
    ok(r.status === 401, 'B revocato non può più iscriversi → 401');
  } finally {
    worker.kill();
    if (process.platform === 'win32' && worker.pid) spawnSync('taskkill', ['/pid', String(worker.pid), '/T', '/F']);
    pusher.close();
  }

  console.log(`\n══ Risultato: ${passed} passati, ${failed} falliti`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
