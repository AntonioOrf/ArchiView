const assert = require('assert');

// Esercita il modulo REALE compilato (out/main/ipc/updateErrorClassifier.js).
// Prerequisito: `tsc` (gestito dallo script `pretest`).
const { classifyUpdateError } = require('../out/main/ipc/updateErrorClassifier.js');

function runTests() {
  console.log("Running updateErrorClassifier tests...");

  // 1) Errori di rete → 'offline'
  const offlineCases = [
    new Error('getaddrinfo ENOTFOUND api.github.com'),
    new Error('connect ECONNREFUSED 127.0.0.1:443'),
    new Error('read ECONNRESET'),
    new Error('net::ERR_INTERNET_DISCONNECTED'),
  ];
  for (const e of offlineCases) {
    assert.strictEqual(classifyUpdateError(e), 'offline', `"${e.message}" deve classificarsi 'offline'`);
  }
  console.log("✅ Test 1: errori di rete classificati come 'offline'.");

  // 2) Nessuna release pubblicata → 'no-release'
  const noReleaseCases = [
    new Error('HttpError: 404 Not Found'),
    new Error('Cannot find latest.yml'),
    new Error('no published versions on GitHub'),
  ];
  for (const e of noReleaseCases) {
    assert.strictEqual(classifyUpdateError(e), 'no-release', `"${e.message}" deve classificarsi 'no-release'`);
  }
  console.log("✅ Test 2: assenza di release classificata come 'no-release'.");

  // 3) Rate limit / permessi GitHub → 'rate-limited'
  const rateLimitedCases = [
    new Error('403 API rate limit exceeded'),
    new Error('rate limit exceeded for this IP'),
  ];
  for (const e of rateLimitedCases) {
    assert.strictEqual(classifyUpdateError(e), 'rate-limited', `"${e.message}" deve classificarsi 'rate-limited'`);
  }
  console.log("✅ Test 3: rate-limit GitHub classificato come 'rate-limited'.");

  // 4) Errore non riconosciuto → 'generic' (mai un crash, mai undefined)
  assert.strictEqual(classifyUpdateError(new Error('checksum mismatch')), 'generic');
  assert.strictEqual(classifyUpdateError('stringa semplice senza pattern noti'), 'generic');
  console.log("✅ Test 4: errori sconosciuti classificati come 'generic'.");

  // 5) Input degeneri → non deve mai lanciare
  assert.strictEqual(classifyUpdateError(null), 'generic');
  assert.strictEqual(classifyUpdateError(undefined), 'generic');
  assert.strictEqual(classifyUpdateError({}), 'generic');
  console.log("✅ Test 5: input null/undefined/oggetto vuoto gestiti senza throw.");

  console.log("Tutti i test updateErrorClassifier passati con successo!\n");
}

runTests();
