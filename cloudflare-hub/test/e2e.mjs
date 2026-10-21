const BASE = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');
const CREATE_SECRET = process.argv[3] || 'dev-secret';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.error('  ✗ ' + msg); }
}
async function j(res) { try { return await res.json(); } catch { return null; } }
const auth = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });

function section(title) { console.log(`\n── ${title}`); }

async function main() {
  console.log('BASE =', BASE);

  section('Scenario 1 — Crea Hub (owner A)');
  let r = await fetch(`${BASE}/api/repos`, {
    method: 'POST',
    headers: { 'X-Create-Secret': CREATE_SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e-manoscritti' }),
  });
  let d = await j(r);
  ok(r.status === 201 && d?.repoId?.startsWith('repo_') && d?.ownerKey, 'A crea repo → 201 {repoId, ownerKey}');
  const repoId = d.repoId, ownerKey = d.ownerKey;

  r = await fetch(`${BASE}/api/repos`, {
    method: 'POST', headers: { 'X-Create-Secret': 'sbagliato', 'Content-Type': 'application/json' }, body: '{}',
  });
  ok(r.status === 403, 'create con secret errato → 403');

  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(ownerKey) });
  d = await j(r);
  ok(r.status === 200 && d.version === 0, 'pull iniziale → version 0 (DB vuoto)');

  section('Scenario 2 — Push A, pull B');
  r = await fetch(`${BASE}/api/repos/${repoId}/push`, {
    method: 'POST', headers: auth(ownerKey),
    body: JSON.stringify({ parentVersion: 0, database: { manoscritti: [{ id: 'ms-1', titolo: 'Beatus', lastModified: 100 }] } }),
  });
  d = await j(r);
  ok(r.status === 200 && d.version === 1, 'A push v1 → version 1');

  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(ownerKey) });
  d = await j(r);
  ok(r.status === 200 && d.version === 1 && d.database?.manoscritti?.[0]?.id === 'ms-1', 'pull v1 → database corretto');

  r = await fetch(`${BASE}/api/repos/${repoId}/pull?ifVersionNot=1`, { headers: auth(ownerKey) });
  d = await j(r);
  ok(r.status === 200 && d.unchanged === true, 'pull ?ifVersionNot=1 → unchanged (fast-path free-tier)');

  section('Scenario 3 — Indice allegati (upsert/get)');
  const hash = 'b'.repeat(64);
  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, {
    method: 'POST', headers: auth(ownerKey),
    body: JSON.stringify({
      chunks: [{ hash, url: 'https://drive.google.com/uc?export=download&id=FILEID', driveFileId: 'FILEID', sizeBytes: 4096 }],
      files: [{ fileName: 'scan-01.pdf', hashes: [hash], lastModified: 200 }],
    }),
  });
  ok(r.status === 200, 'A upsert indice allegati → 200');

  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, {
    method: 'POST', headers: auth(ownerKey),
    body: JSON.stringify({ chunks: [{ hash, url: 'https://evil.example.com/x' }] }),
  });
  ok(r.status === 400, 'chunk con URL non-Drive → 400 (allowlist)');

  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, { headers: auth(ownerKey) });
  d = await j(r);
  ok(r.status === 200 && d.chunks?.length === 1 && d.files?.[0]?.fileName === 'scan-01.pdf', 'get indice → chunk+file');

  section('Scenario 4 — Invita membro B, pull con chiave membro');
  r = await fetch(`${BASE}/api/repos/${repoId}/members`, {
    method: 'POST', headers: auth(ownerKey), body: JSON.stringify({ label: 'Utente B' }),
  });
  d = await j(r);
  ok(r.status === 201 && d?.memberKey && d?.memberId, 'A invita B → 201 {memberId, memberKey}');
  const memberId = d.memberId, memberKey = d.memberKey;

  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(memberKey) });
  d = await j(r);
  ok(r.status === 200 && d.database?.manoscritti?.[0]?.id === 'ms-1', 'B pull con chiave membro → 200 + dati');

  r = await fetch(`${BASE}/api/repos/${repoId}/members`, { headers: auth(memberKey) });
  ok(r.status === 403, 'B (non owner) su GET members → 403');

  section('Scenario 4b — Chunk e file di un altro membro');
  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, {
    method: 'POST', headers: auth(memberKey),
    body: JSON.stringify({
      chunks: [{ hash, url: 'https://drive.google.com/uc?export=download&id=RUBATO', driveFileId: 'RUBATO' }],
      files: [{ fileName: 'scan-01.pdf', hashes: [hash], lastModified: 250, deleted: true }],
    }),
  });
  ok(r.status === 200, 'B invia l\'indice → 200');
  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, { headers: auth(ownerKey) });
  d = await j(r);
  const chunkA = d.chunks?.find((c) => c.hash === hash);
  ok(chunkA?.driveFileId === 'FILEID', 'il chunk di A resta di A (link non riassegnato)');
  ok(d.files?.find((f) => f.fileName === 'scan-01.pdf')?.deleted === false, 'B non marca deleted un file di A');
  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/chunks/${hash}`, { method: 'DELETE', headers: auth(memberKey) });
  ok(r.status === 403, 'B non cancella il chunk di A → 403');
  const hashB = 'c'.repeat(64);
  for (const id of ['PRIMO', 'SECONDO']) {
    await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, {
      method: 'POST', headers: auth(memberKey),
      body: JSON.stringify({ chunks: [{ hash: hashB, url: `https://drive.google.com/uc?export=download&id=${id}`, driveFileId: id }] }),
    });
  }
  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, { headers: auth(memberKey) });
  d = await j(r);
  ok(d.chunks?.find((c) => c.hash === hashB)?.driveFileId === 'SECONDO', 'B aggiorna il proprio chunk');

  section('Scenario 5 — Conflitto concorrente');
  r = await fetch(`${BASE}/api/repos/${repoId}/push`, {
    method: 'POST', headers: auth(memberKey),
    body: JSON.stringify({ parentVersion: 1, database: { manoscritti: [{ id: 'ms-1', titolo: 'Beatus', lastModified: 100 }, { id: 'ms-2', titolo: 'Salterio', lastModified: 300 }] } }),
  });
  d = await j(r);
  ok(r.status === 200 && d.version === 2, 'B push da v1 → version 2');

  r = await fetch(`${BASE}/api/repos/${repoId}/push`, {
    method: 'POST', headers: auth(ownerKey),
    body: JSON.stringify({ parentVersion: 1, database: { manoscritti: [] } }),
  });
  ok(r.status === 409, 'A push da v1 stantio → 409 (nessun overwrite)');

  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(ownerKey) });
  d = await j(r);
  ok(r.status === 200 && d.version === 2 && d.database?.manoscritti?.length === 2, 'A ri-pull → v2 con entrambi i record');

  const pushDa2 = (key, id) => fetch(`${BASE}/api/repos/${repoId}/push`, {
    method: 'POST', headers: auth(key),
    body: JSON.stringify({ parentVersion: 2, database: { manoscritti: [{ id, lastModified: 400 }] } }),
  });
  const [ra, rb] = await Promise.all([pushDa2(ownerKey, 'conc-A'), pushDa2(memberKey, 'conc-B')]);
  const stati = [ra.status, rb.status].sort();
  ok(stati[0] === 200 && stati[1] === 409, `push concorrenti da v2 → un 200 e un 409 (${stati})`);
  const vincitore = ra.status === 200 ? 'conc-A' : 'conc-B';
  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(ownerKey) });
  d = await j(r);
  ok(r.status === 200 && d.version === 3 && d.database?.manoscritti?.[0]?.id === vincitore, 'pull dopo i push concorrenti → v3 con i dati del vincitore');

  section('Scenario 6 — Revoca membro B');
  r = await fetch(`${BASE}/api/repos/${repoId}/members/${memberId}`, { method: 'DELETE', headers: auth(ownerKey) });
  ok(r.status === 200, 'A revoca B → 200');

  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(memberKey) });
  ok(r.status === 403, 'B pull con chiave revocata → 403');
  r = await fetch(`${BASE}/api/repos/${repoId}/push`, { method: 'POST', headers: auth(memberKey), body: JSON.stringify({ parentVersion: 3, database: {} }) });
  ok(r.status === 403, 'B push con chiave revocata → 403');
  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth('chiave-mai-esistita') });
  ok(r.status === 401, 'chiave inventata → 401');

  section('Scenario 7 — Cancellazione del repository');
  r = await fetch(`${BASE}/api/repos/${repoId}/members`, {
    method: 'POST', headers: auth(ownerKey), body: JSON.stringify({ label: 'Utente C' }),
  });
  const memberKeyC = (await j(r))?.memberKey;
  r = await fetch(`${BASE}/api/repos/${repoId}`, { method: 'DELETE', headers: auth(memberKeyC) });
  ok(r.status === 403, 'membro C cancella il repo → 403');
  r = await fetch(`${BASE}/api/repos/${repoId}`, { method: 'DELETE', headers: auth('chiave-mai-esistita') });
  ok(r.status === 401, 'chiave inventata cancella il repo → 401');
  r = await fetch(`${BASE}/api/repos/${repoId}`, { method: 'DELETE', headers: auth(ownerKey) });
  ok(r.status === 200, 'A cancella il repo → 200');
  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(ownerKey) });
  ok(r.status === 401, 'pull dopo la cancellazione → 401');
  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(memberKeyC) });
  ok(r.status === 401, 'pull del membro dopo la cancellazione → 401');
  r = await fetch(`${BASE}/api/repos/${repoId}`, { method: 'DELETE', headers: auth(ownerKey) });
  ok(r.status === 401, 'seconda cancellazione → 401');

  section('Extra — Rate-limit creazione (Fase 5)');
  const rlIp = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  const createAs = () => fetch(`${BASE}/api/repos`, {
    method: 'POST',
    headers: { 'X-Create-Secret': CREATE_SECRET, 'Content-Type': 'application/json', 'CF-Connecting-IP': rlIp },
    body: '{}',
  });
  let rl = { status: 0 };
  for (let i = 0; i < 5; i++) rl = await createAs();
  ok(rl.status === 201, '5 create/min stesso IP → tutte 201');
  rl = await createAs();
  ok(rl.status === 429 && rl.headers.get('Retry-After'), '6ª create/min stesso IP → 429 + Retry-After');

  console.log(`\n══ Risultato: ${passed} passati, ${failed} falliti`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
