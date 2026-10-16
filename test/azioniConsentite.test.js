const assert = require('assert');
const fs = require('fs');
const { estraiNomi, generaRegistro, FILE_REGISTRO } = require('../scripts/azioni-consentite');

console.log('Running azioniConsentite tests...');

const nomi = estraiNomi();

assert.strictEqual(
  fs.readFileSync(FILE_REGISTRO, 'utf8'),
  generaRegistro(nomi),
  'azioniConsentite.ts non allineato ai template: node scripts/azioni-consentite.js --scrivi'
);

assert.ok(nomi.has('confermaRinomina'), 'suInvio con data-args scritto a mano');
assert.ok(nomi.has('chiudiImpostazioni') && nomi.has('apriCestino'), 'inSequenza');
assert.ok(nomi.has('selectItem'), 'fermaEChiama via window.azione');
assert.ok(nomi.has('renderHistoryList'), 'seEsiste in un .html');
assert.ok(nomi.size > 100, `estrazione sospetta: solo ${nomi.size} nomi`);

const VIETATE = [
  'svuotaCestino', 'eliminaDefinitivo', 'ripristinaVersioneHub', 'revocaMembroHub',
  'salvaTutto', 'handleInviteCode', 'apriLinkEsternoSicuro',
  'fetch', 'open', 'eval', 'Function', 'setTimeout', 'setInterval', 'postMessage', 'close', 'print',
];
for (const v of VIETATE) assert.ok(!nomi.has(v), `"${v}" non deve essere chiamabile da un attributo data-on-*`);

for (const n of nomi.keys()) assert.ok(/^[A-Za-z_$][\w$]*$/.test(n), `nome non valido nel registro: ${n}`);

console.log(`azioniConsentite tests passed (${nomi.size} nomi).`);
