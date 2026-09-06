const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Esercita il REALE wrapper di serializzazione di syncHubAttachments.
// Il modulo non è importabile (tira dentro electron e lo state del main), quindi si estrae
// il sorgente del wrapper da hubAttachments.ts, si spogliano le annotazioni di tipo e lo si
// valuta contro un'implementazione finta. Se la forma cambia, l'estrazione fallisce in modo
// rumoroso invece di testare una copia divergente.
const SRC = path.join(__dirname, '..', 'src', 'main', 'ipc', 'hubAttachments.ts');

function estraiWrapper() {
  const src = fs.readFileSync(SRC, 'utf8');

  const marker = 'function syncHubAttachments(';
  const inizio = src.indexOf(marker);
  assert.notStrictEqual(inizio, -1, 'wrapper syncHubAttachments non trovato: estrazione da aggiornare');

  let i = src.indexOf('{', inizio);
  let livello = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') livello++;
    else if (src[i] === '}') {
      livello--;
      if (livello === 0) break;
    }
  }
  assert.ok(livello === 0, 'corpo del wrapper non bilanciato');

  const corpo = src.substring(inizio, i + 1);

  // Le due variabili di stato che il wrapper usa devono esistere nel sorgente.
  assert.ok(src.includes('let runInCorso'), 'runInCorso non trovato');
  assert.ok(src.includes('let runAccodato'), 'runAccodato non trovato');

  // Spoglia le annotazioni di tipo TS: il wrapper è JS puro a parte queste.
  const codice = ('let runInCorso = null; let runAccodato = null;\n' + corpo)
    .replace(/: Promise<SyncAttachmentsResult> \| null/g, '')
    .replace(/: Promise<SyncAttachmentsResult>/g, '');
  assert.ok(!codice.includes('SyncAttachmentsResult'), 'restano annotazioni di tipo non spogliate');

  return codice;
}

function carica(impl) {
  const codice = estraiWrapper() + '\nreturn syncHubAttachments;';
  // eslint-disable-next-line no-new-func
  return new Function('syncHubAttachmentsImpl', codice)(impl);
}

/** Impl finta: traccia chiamate e concorrenza massima osservata. */
function implTracciante({ ritardoMs = 20, falliscoAllaChiamata = -1 } = {}) {
  const stato = { chiamate: 0, attive: 0, maxAttive: 0 };
  const impl = () => {
    stato.chiamate++;
    const nChiamata = stato.chiamate;
    stato.attive++;
    stato.maxAttive = Math.max(stato.maxAttive, stato.attive);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        stato.attive--;
        if (nChiamata === falliscoAllaChiamata) reject(new Error('boom'));
        else resolve({ uploaded: nChiamata, errors: [] });
      }, ritardoMs);
    });
  };
  return { impl, stato };
}

async function runTests() {
  console.log('Running hubAttachmentsSerial tests...');

  // 1) Chiamata singola: passa dritta all'implementazione.
  {
    const { impl, stato } = implTracciante();
    const sync = carica(impl);
    const r = await sync();
    assert.strictEqual(stato.chiamate, 1);
    assert.strictEqual(r.uploaded, 1);
    console.log('✅ Test 1: la chiamata singola esegue una sola sync.');
  }

  // 2) Due chiamate sovrapposte: MAI due run insieme. È l'invariante che protegge
  //    plainCache/encCache dal cleanup di un run concorrente (ENOENT sui chunk cifrati).
  {
    const { impl, stato } = implTracciante();
    const sync = carica(impl);
    await Promise.all([sync(), sync()]);
    assert.strictEqual(stato.maxAttive, 1, 'due run non devono mai sovrapporsi');
    assert.strictEqual(stato.chiamate, 2, 'la seconda richiesta non va persa');
    console.log('✅ Test 2: due chiamate sovrapposte vengono serializzate, nessuna persa.');
  }

  // 3) Raffica di chiamate: al più una accodata, il lavoro non si moltiplica.
  {
    const { impl, stato } = implTracciante();
    const sync = carica(impl);
    await Promise.all([sync(), sync(), sync(), sync(), sync()]);
    assert.strictEqual(stato.maxAttive, 1, 'nessuna sovrapposizione neanche in raffica');
    assert.strictEqual(stato.chiamate, 2, '5 trigger ravvicinati = 1 run + 1 accodato');
    console.log('✅ Test 3: una raffica di 5 trigger produce 2 run, non 5.');
  }

  // 4) Il fallimento del run in corso non deve impedire quello accodato: gli allegati
  //    arrivati nel frattempo verrebbero altrimenti ignorati fino al riavvio.
  {
    const { impl, stato } = implTracciante({ falliscoAllaChiamata: 1 });
    const sync = carica(impl);
    const primo = sync();
    const secondo = sync();
    await assert.rejects(() => primo, /boom/);
    const r = await secondo;
    assert.strictEqual(stato.chiamate, 2);
    assert.strictEqual(r.uploaded, 2);
    assert.strictEqual(stato.maxAttive, 1);
    console.log('✅ Test 4: un run fallito non blocca quello accodato.');
  }

  // 5) Dopo che tutto si è esaurito, lo stato torna pulito: una nuova chiamata riparte.
  {
    const { impl, stato } = implTracciante();
    const sync = carica(impl);
    await sync();
    await sync();
    assert.strictEqual(stato.chiamate, 2);
    assert.strictEqual(stato.maxAttive, 1);
    console.log('✅ Test 5: chiamate sequenziali non restano bloccate dallo stato residuo.');
  }

  console.log('Tutti i test hubAttachmentsSerial passati con successo!\n');
}

runTests().catch(err => { console.error(err); process.exit(1); });
