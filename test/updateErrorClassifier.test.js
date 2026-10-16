const assert = require('assert');

const { classifyUpdateError } = require('../out/main/ipc/updateErrorClassifier.js');

function runTests() {
  console.log("Running updateErrorClassifier tests...");

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

  const noReleaseCases = [
    new Error('HttpError: 404 Not Found'),
    new Error('Cannot find latest.yml'),
    new Error('no published versions on GitHub'),
  ];
  for (const e of noReleaseCases) {
    assert.strictEqual(classifyUpdateError(e), 'no-release', `"${e.message}" deve classificarsi 'no-release'`);
  }
  console.log("✅ Test 2: assenza di release classificata come 'no-release'.");

  assert.strictEqual(classifyUpdateError(new Error(
    'Cannot find latest.yml in the latest release artifacts (https://github.com/AntonioOrf/ArchiView/releases/download/v3.2.1/latest.yml): HttpError: 404 \n"method: GET url: https://github.com/AntonioOrf/ArchiView/releases/download/v3.2.1/latest.yml"'
  )), 'release-incomplete');
  console.log("✅ Test 2-bis: release senza latest.yml classificata come 'release-incomplete'.");

  const rateLimitedCases = [
    new Error('403 API rate limit exceeded'),
    new Error('rate limit exceeded for this IP'),
  ];
  for (const e of rateLimitedCases) {
    assert.strictEqual(classifyUpdateError(e), 'rate-limited', `"${e.message}" deve classificarsi 'rate-limited'`);
  }
  console.log("✅ Test 3: rate-limit GitHub classificato come 'rate-limited'.");

  assert.strictEqual(classifyUpdateError(new Error('checksum mismatch')), 'generic');
  assert.strictEqual(classifyUpdateError('stringa semplice senza pattern noti'), 'generic');
  console.log("✅ Test 4: errori sconosciuti classificati come 'generic'.");

  assert.strictEqual(classifyUpdateError(null), 'generic');
  assert.strictEqual(classifyUpdateError(undefined), 'generic');
  assert.strictEqual(classifyUpdateError({}), 'generic');
  console.log("✅ Test 5: input null/undefined/oggetto vuoto gestiti senza throw.");

  console.log("Tutti i test updateErrorClassifier passati con successo!\n");
}

runTests();
