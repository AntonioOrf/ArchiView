// Test della whitelist degli URL dei chunk Hub (N8): host Google soltanto, redirect compresi.
const assert = require('assert');
const { urlChunkAmmesso, fetchChunkGuardata, leggiConTetto } = require('../out/main/ipc/hubUrlChunk');

async function run() {
  console.log('Running hubUrlChunk tests...');

  // 1. Whitelist
  for (const u of [
    'https://www.googleapis.com/drive/v3/files/abc?alt=media&key=k',
    'https://drive.google.com/uc?export=download&id=abc',
    'https://drive.usercontent.google.com/download?id=abc',
    'https://DRIVE.GOOGLE.COM./uc?id=abc',
  ]) assert.strictEqual(urlChunkAmmesso(u), true, `${u} doveva essere ammesso`);
  for (const u of [
    'http://drive.google.com/uc?id=abc',           // non https
    'https://192.168.1.1/x',
    'https://127.0.0.1/x',
    'https://evil.com/drive.google.com',
    'https://drive.google.com.evil.com/x',
    'https://evilgoogleapis.com/x',
    'https://user:pw@drive.google.com/x',
    'https://drive.google.com:8443/x',
    'file:///C:/x',
    'non un url',
    '',
  ]) assert.strictEqual(urlChunkAmmesso(u), false, `${u} doveva essere rifiutato`);

  // 2. fetch: URL fuori whitelist → nessuna richiesta parte
  const chiamate = [];
  const finta = (tabella) => async (url, init) => {
    chiamate.push(url);
    assert.strictEqual(init.redirect, 'manual', 'i redirect vanno seguiti a mano');
    const r = tabella[url];
    if (!r) throw new Error('richiesta inattesa: ' + url);
    return new Response(r.body ?? null, { status: r.status, headers: r.headers || {} });
  };
  chiamate.length = 0;
  await assert.rejects(fetchChunkGuardata('http://10.0.0.1/chunk', finta({})), /host non ammesso/);
  assert.strictEqual(chiamate.length, 0, 'nessuna richiesta verso un host non ammesso');

  // 3. Redirect lecito (uc → usercontent) seguito
  chiamate.length = 0;
  const ok = await fetchChunkGuardata('https://drive.google.com/uc?id=a', finta({
    'https://drive.google.com/uc?id=a': { status: 303, headers: { location: 'https://drive.usercontent.google.com/download?id=a' } },
    'https://drive.usercontent.google.com/download?id=a': { status: 200, body: 'dati' },
  }));
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(await ok.text(), 'dati');
  assert.strictEqual(chiamate.length, 2);

  // 4. Redirect verso la LAN: fermato prima della richiesta
  chiamate.length = 0;
  await assert.rejects(fetchChunkGuardata('https://drive.google.com/uc?id=b', finta({
    'https://drive.google.com/uc?id=b': { status: 302, headers: { location: 'http://192.168.1.1/admin' } },
  })), /host non ammesso/);
  assert.deepStrictEqual(chiamate, ['https://drive.google.com/uc?id=b']);

  // 5. Location relativa risolta sull'host corrente
  chiamate.length = 0;
  const rel = await fetchChunkGuardata('https://drive.google.com/uc?id=c', finta({
    'https://drive.google.com/uc?id=c': { status: 302, headers: { location: '/uc?id=c&confirm=t' } },
    'https://drive.google.com/uc?id=c&confirm=t': { status: 200, body: 'x' },
  }));
  assert.strictEqual(rel.status, 200);

  // 6. Redirect senza Location e catene infinite
  await assert.rejects(fetchChunkGuardata('https://drive.google.com/uc?id=d', finta({
    'https://drive.google.com/uc?id=d': { status: 302 },
  })), /senza Location/);
  await assert.rejects(fetchChunkGuardata('https://drive.google.com/loop', finta({
    'https://drive.google.com/loop': { status: 302, headers: { location: 'https://drive.google.com/loop' } },
  })), /troppi redirect/);

  // 7. Risposte non-redirect restituite così come sono (il chiamante controlla ok/hash)
  const r404 = await fetchChunkGuardata('https://drive.google.com/uc?id=e', finta({
    'https://drive.google.com/uc?id=e': { status: 404 },
  }));
  assert.strictEqual(r404.status, 404);

  // 8. Tetto sul corpo: un URL dell'indice può puntare a un file pubblico qualsiasi.
  // Stream a pezzi da 1 KB senza Content-Length: il dichiarato non basta, conta il letto.
  let pezziLetti = 0;
  const flusso = (pezzi) => new Response(new ReadableStream({
    pull(c) { if (pezziLetti >= pezzi) { c.close(); return; } pezziLetti++; c.enqueue(new Uint8Array(1024)); }
  }));
  assert.strictEqual((await leggiConTetto(flusso(4), 4096)).length, 4096);
  pezziLetti = 0;
  assert.strictEqual(await leggiConTetto(flusso(1000), 4096), null);
  assert.ok(pezziLetti < 10, `lettura non interrotta al tetto: ${pezziLetti} pezzi`);
  const dichiaratoTroppo = new Response('x', { headers: { 'content-length': '999999999' } });
  assert.strictEqual(await leggiConTetto(dichiaratoTroppo, 4096), null);
  assert.strictEqual((await leggiConTetto(new Response('abc'), 4096)).toString(), 'abc');

  console.log('hubUrlChunk tests passed.');
}

run().catch((e) => { console.error(e); process.exit(1); });
