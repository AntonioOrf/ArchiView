// Smoke test end-to-end contro un'istanza `wrangler dev`.
// Uso: node test/smoke.mjs http://localhost:8787 <CREATE_SECRET>
// Richiede: schema applicato con `npm run migrate:local`.

const BASE = process.argv[2] || 'http://localhost:8787';
const CREATE_SECRET = process.argv[3] || 'dev-secret';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.error('  ✗ ' + msg); }
}
async function j(res) { try { return await res.json(); } catch { return null; } }

const H = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });

async function main() {
  console.log('BASE =', BASE);

  // 1. create repo
  let r = await fetch(`${BASE}/api/repos`, {
    method: 'POST',
    headers: { 'X-Create-Secret': CREATE_SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'smoke' }),
  });
  const created = await j(r);
  assert(r.status === 201 && created?.repoId?.startsWith('repo_') && created?.ownerKey, 'create repo → 201 {repoId, ownerKey}');
  const { repoId, ownerKey } = created;

  // create con secret errato → 403
  r = await fetch(`${BASE}/api/repos`, {
    method: 'POST', headers: { 'X-Create-Secret': 'wrong', 'Content-Type': 'application/json' }, body: '{}',
  });
  assert(r.status === 403, 'create con secret errato → 403');

  // 2. pull iniziale (v0, db vuoto)
  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: H(ownerKey) });
  let d = await j(r);
  assert(r.status === 200 && d.version === 0, 'pull iniziale → version 0');

  // pull con chiave errata → 401
  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: H('chiave-fasulla') });
  assert(r.status === 401, 'pull con chiave errata → 401');

  // 3. push v1
  r = await fetch(`${BASE}/api/repos/${repoId}/push`, {
    method: 'POST', headers: H(ownerKey),
    body: JSON.stringify({ parentVersion: 0, database: { manoscritti: [{ id: 'a', lastModified: 1 }] } }),
  });
  d = await j(r);
  assert(r.status === 200 && d.version === 1, 'push v1 → version 1');

  // 4. pull v1 ritorna il db
  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: H(ownerKey) });
  d = await j(r);
  assert(r.status === 200 && d.version === 1 && d.database?.manoscritti?.[0]?.id === 'a', 'pull v1 → database corretto');

  // ifVersionNot fast-path
  r = await fetch(`${BASE}/api/repos/${repoId}/pull?ifVersionNot=1`, { headers: H(ownerKey) });
  d = await j(r);
  assert(r.status === 200 && d.unchanged === true, 'pull ?ifVersionNot=1 → unchanged');

  // 5. push concorrente con parentVersion superato → 409
  r = await fetch(`${BASE}/api/repos/${repoId}/push`, {
    method: 'POST', headers: H(ownerKey),
    body: JSON.stringify({ parentVersion: 0, database: {} }),
  });
  assert(r.status === 409, 'push con parentVersion stantio → 409');

  // 6. membri: add + pull con chiave membro
  r = await fetch(`${BASE}/api/repos/${repoId}/members`, {
    method: 'POST', headers: H(ownerKey), body: JSON.stringify({ label: 'Mario' }),
  });
  d = await j(r);
  assert(r.status === 201 && d?.memberKey && d?.memberId, 'add member → 201 {memberId, memberKey}');
  const { memberId, memberKey } = d;

  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: H(memberKey) });
  assert(r.status === 200, 'pull con chiave membro → 200');

  // 6b. push v2 come membro + cronologia versioni
  r = await fetch(`${BASE}/api/repos/${repoId}/push`, {
    method: 'POST', headers: H(memberKey),
    body: JSON.stringify({ parentVersion: 1, database: { manoscritti: [{ id: 'a', lastModified: 1 }, { id: 'b', lastModified: 2 }] } }),
  });
  d = await j(r);
  assert(r.status === 200 && d.version === 2, 'push v2 come membro → version 2');

  r = await fetch(`${BASE}/api/repos/${repoId}/versions`, { headers: H(memberKey) });
  d = await j(r);
  assert(r.status === 200 && d.currentVersion === 2 && d.versions?.length === 2, 'GET /versions → currentVersion 2, 2 voci');
  assert(d.versions?.[0]?.version === 2 && d.versions[0].authorLabel === 'Mario', 'versions[0] = v2, autore Mario');
  assert(d.versions?.[1]?.version === 1 && d.versions[1].authorMemberId === null, 'versions[1] = v1, autore owner (null)');

  r = await fetch(`${BASE}/api/repos/${repoId}/versions/1`, { headers: H(memberKey) });
  d = await j(r);
  assert(r.status === 200 && d.database?.manoscritti?.length === 1, 'GET /versions/1 → snapshot v1');

  r = await fetch(`${BASE}/api/repos/${repoId}/versions/99`, { headers: H(memberKey) });
  assert(r.status === 404, 'GET /versions/99 (inesistente) → 404');

  r = await fetch(`${BASE}/api/repos/${repoId}/versions/0`, { headers: H(memberKey) });
  assert(r.status === 400, 'GET /versions/0 → 400');

  r = await fetch(`${BASE}/api/repos/${repoId}/versions`, { headers: H('chiave-fasulla') });
  assert(r.status === 401, 'GET /versions con chiave fasulla → 401');

  // membro NON è owner: list members → 403
  r = await fetch(`${BASE}/api/repos/${repoId}/members`, { headers: H(memberKey) });
  assert(r.status === 403, 'membro su GET members → 403');

  // revoca → chiave membro non funziona più
  r = await fetch(`${BASE}/api/repos/${repoId}/members/${memberId}`, { method: 'DELETE', headers: H(ownerKey) });
  assert(r.status === 200, 'revoke member → 200');
  r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: H(memberKey) });
  assert(r.status === 401, 'pull con chiave revocata → 401');

  // /versions con chiave revocata → 401; ma la label del membro resta nello storico (revoca soft)
  r = await fetch(`${BASE}/api/repos/${repoId}/versions`, { headers: H(memberKey) });
  assert(r.status === 401, 'GET /versions con chiave revocata → 401');
  r = await fetch(`${BASE}/api/repos/${repoId}/versions`, { headers: H(ownerKey) });
  d = await j(r);
  assert(d.versions?.find(v => v.version === 2)?.authorLabel === 'Mario', 'label "Mario" ancora presente su v2 dopo la revoca');

  // 7. indice allegati
  const hash = 'a'.repeat(64);
  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, {
    method: 'POST', headers: H(ownerKey),
    body: JSON.stringify({
      chunks: [{ hash, url: `https://drive.google.com/uc?export=download&id=X`, driveFileId: 'X', sizeBytes: 123 }],
      files: [{ fileName: 'scan.pdf', hashes: [hash], lastModified: 2 }],
    }),
  });
  assert(r.status === 200, 'upsert indice allegati → 200');

  // URL non consentito → 400
  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, {
    method: 'POST', headers: H(ownerKey),
    body: JSON.stringify({ chunks: [{ hash, url: 'https://evil.example.com/x' }] }),
  });
  assert(r.status === 400, 'chunk con URL non consentito → 400');

  r = await fetch(`${BASE}/api/repos/${repoId}/attachments/index`, { headers: H(ownerKey) });
  d = await j(r);
  assert(r.status === 200 && d.chunks?.length === 1 && d.files?.[0]?.fileName === 'scan.pdf', 'get indice → chunk+file');

  // 8. rate-limit creazione: bucket IP isolato (CF-Connecting-IP dedicato) per non
  // inquinare il flusso principale. Default CREATE_MAX_PER_IP_MIN=5 → il 6° → 429.
  const rlIp = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
  const createAs = () => fetch(`${BASE}/api/repos`, {
    method: 'POST',
    headers: { 'X-Create-Secret': CREATE_SECRET, 'Content-Type': 'application/json', 'CF-Connecting-IP': rlIp },
    body: '{}',
  });
  let rl = { status: 0 };
  for (let i = 0; i < 5; i++) rl = await createAs();
  assert(rl.status === 201, 'rate-limit: 5 create/min stesso IP → tutte 201');
  rl = await createAs();
  assert(rl.status === 429 && rl.headers.get('Retry-After'), '6ª create/min stesso IP → 429 + Retry-After');

  console.log(`\nRisultato: ${passed} passati, ${failed} falliti`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
