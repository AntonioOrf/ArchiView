// S2/P5: il log OAuth stava in `<archivio>/.archiview-chunks/auth_debug.log` (cartella che può
// essere sincronizzata) con l'email dell'account, scritto con `appendFileSync` a ogni lettura dei
// token. Ora: userData/logs/auth.log, email tolte, scrittura asincrona in coda, rotazione a 1 MB.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scriviLogAuth, rimuoviLogVecchi, LOG_AUTH_MAX_BYTES } = require('../out/main/logAuth');

(async () => {
  console.log('Running logAuth tests...');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-logauth-'));
  try {
    const file = path.join(dir, 'logs', 'auth.log');
    const p = scriviLogAuth(file, 'ACCESSO_NEGATO_VAULT: account mario.rossi@example.org non autorizzato');
    assert.ok(p instanceof Promise, 'scrittura asincrona');
    await Promise.all([p, scriviLogAuth(file, 'secondo'), scriviLogAuth(file, 'terzo')]);
    const righe = fs.readFileSync(file, 'utf8').trim().split('\n');
    assert.strictEqual(righe.length, 3);
    assert.ok(!righe[0].includes('mario.rossi@example.org'), 'email tolta');
    assert.ok(righe[0].includes('<email>'));
    assert.ok(righe[1].endsWith('secondo') && righe[2].endsWith('terzo'), 'in ordine');
    console.log('✅ Test 1: email tolte, scritture in coda e in ordine.');

    fs.writeFileSync(file, 'x'.repeat(LOG_AUTH_MAX_BYTES + 1));
    await scriviLogAuth(file, 'dopo la rotazione');
    assert.ok(fs.existsSync(file + '.old'));
    assert.ok(fs.readFileSync(file, 'utf8').endsWith('dopo la rotazione\n'));
    console.log('✅ Test 2: rotazione oltre 1 MB.');

    // Il vecchio file dentro l'archivio (e quello in userData) si toglie.
    const ws = path.join(dir, 'ws');
    fs.mkdirSync(path.join(ws, '.archiview-chunks'), { recursive: true });
    fs.writeFileSync(path.join(ws, '.archiview-chunks', 'auth_debug.log'), 'email@x.it');
    fs.writeFileSync(path.join(dir, 'auth_debug.log'), 'email@x.it');
    await rimuoviLogVecchi(ws, dir);
    assert.ok(!fs.existsSync(path.join(ws, '.archiview-chunks', 'auth_debug.log')));
    assert.ok(!fs.existsSync(path.join(dir, 'auth_debug.log')));
    await rimuoviLogVecchi(ws, dir); // già tolti: nessun errore
    console.log('✅ Test 3: vecchi auth_debug.log rimossi.');
    console.log('Tutti i test logAuth passati con successo!');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
