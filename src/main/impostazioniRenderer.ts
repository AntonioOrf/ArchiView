// Cosa il renderer può scrivere in settings.json (N2 in PIANO-SICUREZZA-OTTIMIZZAZIONE.md).
//
// Prima `save-settings` univa al file qualsiasi oggetto arrivasse. Alcune chiavi però decidono
// quali cartelle il main legge, copia o cestina: `recentWorkspaces` (ricerca tra archivi,
// delete-vault-local), `customAttachmentsPath` (local-asset, sync allegati), `workspacePath`
// (archivio aperto all'avvio) e le chiavi del vault (dove sincronizza). Quelle le scrive solo il
// main, da flussi suoi (dialoghi, apertura di un archivio, join). Qui passano solo preferenze.
//
// Il renderer salva sempre l'oggetto intero letto con get-settings: le chiavi fuori elenco
// si scartano in silenzio, non è un errore.
//
// Puro (niente electron): testato in Node da test/impostazioniRenderer.test.js.

type Validatore = (v: unknown) => boolean;

const booleano: Validatore = (v) => typeof v === 'boolean';
const testo = (max: number): Validatore => (v) => typeof v === 'string' && v.length <= max;
const intero = (min: number, max: number): Validatore => (v) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const oggetto: Validatore = (v) => v === null || (typeof v === 'object' && !Array.isArray(v));
const numeroFinito: Validatore = (v) => typeof v === 'number' && Number.isFinite(v);

const AMMESSE: { [chiave: string]: Validatore } = {
  lang: (v) => v === 'it' || v === 'en',
  theme: testo(20),
  username: testo(200),
  appState: oggetto,
  lastSyncTime: (v) => numeroFinito(v) || testo(64)(v) || v === null,
  lastSeenVersion: testo(32),
  // Solo il valore iniziale del campo nel welcome: il percorso vero passa da un dialogo o
  // da safeChildDir nel main.
  lastVaultBasePath: testo(1024),
  syncAttachments: booleano,
  tutorialCompleted: booleano,
  promptCloudAuth: booleano,
  autofetchEnabled: booleano,
  autofetchInterval: intero(1, 24 * 60),
  autoStartCreaHub: booleano,
  autoStartTrasformaCondiviso: booleano,
  autoStartTrasformaPersonale: booleano,
  hubJustCreated: booleano,
  hubJustMigrated: booleano,
  snapshotAutomatici: booleano,
  snapshotRecenti: intero(0, 100),
  snapshotGiorni: intero(0, 3650),
  cestinoGiorni: intero(0, 3650),
  suggerimentiAltriArchivi: booleano,
  // Esclusioni della ricerca tra archivi: solo id, e possono solo restringere.
  crossArchiveEsclusi: Array.isArray
};

const MAX_ESCLUSI = 200;

/** Le sole preferenze ammesse e valide di `grezze`. Mai lancia. */
function filtraImpostazioniRenderer(grezze: unknown): { [chiave: string]: unknown } {
  const out: { [chiave: string]: unknown } = {};
  if (!grezze || typeof grezze !== 'object' || Array.isArray(grezze)) return out;
  for (const [chiave, valore] of Object.entries(grezze as object)) {
    if (!Object.prototype.hasOwnProperty.call(AMMESSE, chiave) || !AMMESSE[chiave](valore)) continue;
    out[chiave] = chiave === 'crossArchiveEsclusi'
      ? (valore as unknown[]).filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 128).slice(0, MAX_ESCLUSI)
      : valore;
  }
  return out;
}

module.exports = { filtraImpostazioniRenderer, CHIAVI_AMMESSE: Object.keys(AMMESSE) };
export {};
