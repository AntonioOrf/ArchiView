import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messaggioErrore } from '../src/errori.ts';

test('errori della coda: frasi leggibili, mai il testo grezzo', () => {
  const casi = [
    ['drive_401: {"error":…}', /Accesso a Google scaduto/],
    ['token_assente', /Accesso a Google scaduto/],
    ['drive_403: {"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}', /Drive è pieno/],
    ['upload_403: {"reason":"storageQuotaExceeded"}', /Drive è pieno/],
    ['drive_403: {"reason":"insufficientPermissions"}', /rifiutato/],
    ['drive_404: File not found', /Cartella sparita/],
    ['drive_429: rate', /non risponde/],
    ['upload_503: ', /non risponde/],
    ['wifi_401: p0001.jpg', /riabbina/],
    ['wifi_rete: Network request failed', /Il computer non risponde/],
    ['wifi_422: {"falliti":["altro_archivio"]}', /rifiutato le pagine/],
    ['lotto_non_valido: pagina_sha256@pagine[0]', /bug/],
    ['dimensione_diversa: p0001.jpg 10/20', /incompleta/],
    ['Network request failed', /Senza rete/],
    ['qualcosa di strano', /Invio non riuscito/]
  ];
  for (const [grezzo, atteso] of casi) {
    const m = messaggioErrore(grezzo);
    assert.match(m, atteso, grezzo);
    assert.ok(!m.includes('{') && !m.includes('_'), m);
  }
});
