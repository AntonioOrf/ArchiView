// N2 (PIANO-SICUREZZA-OTTIMIZZAZIONE.md): dal renderer passano solo preferenze. Percorsi
// (archivi recenti, cartella allegati, archivio aperto) e chiavi del vault li scrive il main.
const assert = require('assert');
const { filtraImpostazioniRenderer: filtra, chiaviDaRimuovere } = require('../out/main/impostazioniRenderer');

console.log('Running impostazioniRenderer tests...');

// 1. Le chiavi che decidono quali cartelle il main legge, copia o cestina non passano.
const ostile = filtra({
  recentWorkspaces: ['C:\\Users\\me'],
  workspacePath: 'C:\\Users\\me',
  customAttachmentsPath: 'C:\\Users\\me\\AppData\\Roaming\\archiview',
  isSharedVault: true, sharedVaultId: 'altrui', isPersonalCloud: true, driveAutofetch: true,
  pusherKey: 'k', pusherCluster: 'eu', pusherWebhook: 'https://evil.example',
  cloudProvider: 'onedrive', __proto__: { lang: 'en' }, constructor: 'x'
});
assert.deepStrictEqual(ostile, {});

// 2. Le preferenze del renderer passano così come sono.
const prefs = {
  lang: 'en', theme: 'dark', username: 'Maria', appState: { vista: 'tabella' },
  lastSyncTime: 1730000000000, lastSeenVersion: '3.2.2', lastVaultBasePath: 'D:\\Archivi',
  syncAttachments: true, tutorialCompleted: true, promptCloudAuth: false,
  autofetchEnabled: true, autofetchInterval: 5, autoStartCreaHub: true,
  autoStartTrasformaCondiviso: false, autoStartTrasformaPersonale: false,
  hubJustCreated: false, hubJustMigrated: false, snapshotAutomatici: true,
  snapshotRecenti: 10, snapshotGiorni: 30, cestinoGiorni: 60, suggerimentiAltriArchivi: false,
  crossArchiveEsclusi: ['abc', 'percorso:0123456789abcdef']
};
assert.deepStrictEqual(filtra(prefs), prefs);
// Data di Drive come stringa ISO.
assert.deepStrictEqual(filtra({ lastSyncTime: '2026-10-07T10:00:00.000Z' }), { lastSyncTime: '2026-10-07T10:00:00.000Z' });

// 3. Valori del tipo sbagliato o fuori misura: scartati, non corretti.
assert.deepStrictEqual(filtra({
  lang: 'de', theme: 'x'.repeat(21), username: 3, appState: [1], autofetchInterval: 0,
  snapshotRecenti: 101, cestinoGiorni: 1.5, syncAttachments: 'true', lastSyncTime: NaN
}), {});

// 4. Esclusioni: solo id stringa, lunghezza e numero limitati.
const esclusi = filtra({ crossArchiveEsclusi: ['a', 7, '', null, 'x'.repeat(129), ...Array.from({ length: 300 }, (_, i) => 'id' + i)] });
assert.strictEqual(esclusi.crossArchiveEsclusi[0], 'a');
assert.strictEqual(esclusi.crossArchiveEsclusi.length, 200);
assert.ok(esclusi.crossArchiveEsclusi.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 128));

// 5. Input che non è un oggetto.
for (const v of [null, undefined, 'stringa', 42, ['lang']]) assert.deepStrictEqual(filtra(v), {});

// 6. Preferenze svuotate: solo quelle cancellabili, solo con null esplicito.
assert.deepStrictEqual(chiaviDaRimuovere({ snapshotRecenti: null, cestinoGiorni: null, snapshotGiorni: 5 }), ['snapshotRecenti', 'cestinoGiorni']);
assert.deepStrictEqual(chiaviDaRimuovere({ recentWorkspaces: null, customAttachmentsPath: null, workspacePath: null, lang: null }), []);
assert.deepStrictEqual(filtra({ snapshotRecenti: null }), {});
for (const v of [null, undefined, 'x', ['snapshotRecenti']]) assert.deepStrictEqual(chiaviDaRimuovere(v), []);

console.log('impostazioniRenderer tests OK');
