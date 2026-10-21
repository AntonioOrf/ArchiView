const BASE = (process.argv[2] || '').replace(/\/$/, '');
const CREATE_SECRET = process.argv[3] || '';

if (!BASE || !CREATE_SECRET) {
  console.error('Uso: node test/produzione.mjs <HUB_URL> <CREATE_SECRET>');
  process.exit(2);
}

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.error('  ✗ ' + msg); }
}
async function j(res) { try { return await res.json(); } catch { return null; } }
const auth = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });

async function main() {
  let r = await fetch(`${BASE}/`);
  ok(r.status === 200 && (await j(r))?.service === 'archiview-hub', 'Hub raggiungibile');

  r = await fetch(`${BASE}/api/repos`, {
    method: 'POST',
    headers: { 'X-Create-Secret': CREATE_SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `ci-smoke-${Date.now()}` }),
  });
  const creato = await j(r);
  ok(r.status === 201 && creato?.repoId && creato?.ownerKey, `creazione repository → 201 (${r.status})`);
  if (!creato?.repoId || !creato?.ownerKey) return;
  const { repoId, ownerKey } = creato;

  try {
    r = await fetch(`${BASE}/api/repos/${repoId}/members`, {
      method: 'POST', headers: auth(ownerKey), body: JSON.stringify({ label: 'ci' }),
    });
    const memberKey = (await j(r))?.memberKey;
    ok(r.status === 201 && !!memberKey, 'invito membro → 201');

    r = await fetch(`${BASE}/api/repos/${repoId}/push`, {
      method: 'POST', headers: auth(ownerKey),
      body: JSON.stringify({ parentVersion: 0, database: { manoscritti: [{ id: 'ci-1', segnatura: 'CI', lastModified: 1 }] } }),
    });
    ok(r.status === 200 && (await j(r))?.version === 1, 'push → versione 1');

    r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(memberKey) });
    const d = await j(r);
    ok(r.status === 200 && d?.version === 1 && d?.database?.manoscritti?.[0]?.id === 'ci-1', 'pull del membro → dati del push');

    r = await fetch(`${BASE}/api/repos/${repoId}/versions`, { headers: auth(ownerKey) });
    ok(r.status === 200, 'storico versioni → 200');
  } finally {
    r = await fetch(`${BASE}/api/repos/${repoId}`, { method: 'DELETE', headers: auth(ownerKey) });
    ok(r.status === 200, `cancellazione repository → 200 (${r.status})`);
    r = await fetch(`${BASE}/api/repos/${repoId}/pull`, { headers: auth(ownerKey) });
    ok(r.status === 401, 'dopo la cancellazione il repository non esiste più');
  }
}

main()
  .catch((e) => { failed++; console.error(e && e.message ? e.message : e); })
  .finally(() => {
    console.log(`\nRisultato: ${passed} passati, ${failed} falliti`);
    process.exit(failed ? 1 : 0);
  });
