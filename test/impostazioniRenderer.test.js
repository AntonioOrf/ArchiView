const assert = require('assert');
const { filtraImpostazioniRenderer: filtra, chiaviDaRimuovere, esaminaPatch } = require('../out/main/impostazioniRenderer');

console.log('Running impostazioniRenderer tests...');

const ostile = filtra({
  recentWorkspaces: ['C:\\Users\\me'],
  workspacePath: 'C:\\Users\\me',
  customAttachmentsPath: 'C:\\Users\\me\\AppData\\Roaming\\archiview',
  isSharedVault: true, sharedVaultId: 'altrui', isPersonalCloud: true, driveAutofetch: true,
  pusherKey: 'k', pusherCluster: 'eu', pusherWebhook: 'https://evil.example',
  cloudProvider: 'onedrive', __proto__: { lang: 'en' }, constructor: 'x'
});
assert.deepStrictEqual(ostile, {});

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
assert.deepStrictEqual(filtra({ lastSyncTime: '2026-10-07T10:00:00.000Z' }), { lastSyncTime: '2026-10-07T10:00:00.000Z' });

assert.deepStrictEqual(filtra({
  lang: 'de', theme: 'x'.repeat(21), username: 3, appState: [1], autofetchInterval: 0,
  snapshotRecenti: 101, cestinoGiorni: 1.5, syncAttachments: 'true', lastSyncTime: NaN
}), {});

const esclusi = filtra({ crossArchiveEsclusi: ['a', 7, '', null, 'x'.repeat(129), ...Array.from({ length: 300 }, (_, i) => 'id' + i)] });
assert.strictEqual(esclusi.crossArchiveEsclusi[0], 'a');
assert.strictEqual(esclusi.crossArchiveEsclusi.length, 200);
assert.ok(esclusi.crossArchiveEsclusi.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 128));

for (const v of [null, undefined, 'stringa', 42, ['lang']]) assert.deepStrictEqual(filtra(v), {});

assert.deepStrictEqual(chiaviDaRimuovere({ snapshotRecenti: null, cestinoGiorni: null, snapshotGiorni: 5 }).sort(), ['cestinoGiorni', 'snapshotRecenti']);
assert.deepStrictEqual(chiaviDaRimuovere({ recentWorkspaces: null, customAttachmentsPath: null, workspacePath: null }), []);
assert.deepStrictEqual(chiaviDaRimuovere({ lang: null, ocrLingue: null, appState: null, lastSyncTime: null }).sort(), ['lang', 'ocrLingue']);
assert.deepStrictEqual(filtra({ snapshotRecenti: null }), {});
for (const v of [null, undefined, 'x', ['snapshotRecenti']]) assert.deepStrictEqual(chiaviDaRimuovere(v), []);

assert.deepStrictEqual(esaminaPatch({ lang: 'en', cestinoGiorni: null, workspacePath: 'C:\\x', theme: 5, constructor: 1 }), {
  valori: { lang: 'en' }, daRimuovere: ['cestinoGiorni'], rifiutate: ['workspacePath', 'theme', 'constructor']
});
assert.deepStrictEqual(esaminaPatch('x'), { valori: {}, daRimuovere: [], rifiutate: [] });

assert.deepStrictEqual(filtra({ ocrLingue: ['ita', 'lat', 'chi_sim'] }), { ocrLingue: ['ita', 'lat', 'chi_sim'] });
for (const v of [['../x'], ['ita+lat'], 'ita', [1], Array(33).fill('ita')]) assert.deepStrictEqual(filtra({ ocrLingue: v }), {});

console.log('impostazioniRenderer tests OK');
