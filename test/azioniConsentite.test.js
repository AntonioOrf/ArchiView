// S2 (REVIEW-SECURITY.md): il dispatcher di logic/azioni.ts chiama per nome solo le funzioni di
// logic/azioniConsentite.ts. Il test tiene il registro allineato ai template (un pulsante nuovo
// con un nome fuori registro sarebbe muto) e verifica che non ci entrino funzioni distruttive
// senza conferma, che nessun pulsante dovrebbe chiamare direttamente.
const assert = require('assert');
const fs = require('fs');
const { estraiNomi, generaRegistro, FILE_REGISTRO } = require('../scripts/azioni-consentite');

console.log('Running azioniConsentite tests...');

const nomi = estraiNomi();

// 1. Il file generato coincide con quello che i template richiedono oggi
assert.strictEqual(
  fs.readFileSync(FILE_REGISTRO, 'utf8'),
  generaRegistro(nomi),
  'azioniConsentite.ts non allineato ai template: node scripts/azioni-consentite.js --scrivi'
);

// 2. L'estrazione vede davvero i tre modi di scrivere un'azione
assert.ok(nomi.has('confermaRinomina'), 'suInvio con data-args scritto a mano');           // renameModal.ts
assert.ok(nomi.has('chiudiImpostazioni') && nomi.has('apriCestino'), 'inSequenza');       // settingsModal.ts
assert.ok(nomi.has('selectItem'), 'fermaEChiama via window.azione');                       // mainView.ts
assert.ok(nomi.has('renderHistoryList'), 'seEsiste in un .html');                          // sidebar.html
assert.ok(nomi.size > 100, `estrazione sospetta: solo ${nomi.size} nomi`);

// 3. Funzioni che agiscono senza conferma, o primitive del browser: mai nel registro.
//    Se un pulsante ne ha davvero bisogno, passi da un wrapper con conferma.
const VIETATE = [
  'svuotaCestino', 'eliminaDefinitivo', 'ripristinaVersioneHub', 'revocaMembroHub',
  'salvaTutto', 'handleInviteCode', 'apriLinkEsternoSicuro',
  'fetch', 'open', 'eval', 'Function', 'setTimeout', 'setInterval', 'postMessage', 'close', 'print',
];
for (const v of VIETATE) assert.ok(!nomi.has(v), `"${v}" non deve essere chiamabile da un attributo data-on-*`);

// 4. Solo identificatori semplici: niente percorsi tipo "apiSicurezza.cestinoSvuota"
for (const n of nomi.keys()) assert.ok(/^[A-Za-z_$][\w$]*$/.test(n), `nome non valido nel registro: ${n}`);

console.log(`azioniConsentite tests passed (${nomi.size} nomi).`);
