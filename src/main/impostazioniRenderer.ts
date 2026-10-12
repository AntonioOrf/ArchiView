// Cosa il renderer può scrivere in settings.json.
//
// Prima `save-settings` univa al file qualsiasi oggetto arrivasse. Alcune chiavi però decidono
// quali cartelle il main legge, copia o cestina: `recentWorkspaces` (ricerca tra archivi,
// delete-vault-local), `customAttachmentsPath` (local-asset, sync allegati), `workspacePath`
// (archivio aperto all'avvio) e le chiavi del vault (dove sincronizza). Quelle le scrive solo il
// main, da flussi suoi (dialoghi, apertura di un archivio, join). Qui passano solo preferenze.
//
// Il renderer manda solo le chiavi che cambia (`apiSettings.patch`): quelle fuori elenco o
// con valore non valido tornano in `rifiutate`, e chi chiama lo segnala.
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
  crossArchiveEsclusi: Array.isArray,
  // Lingue OCR preselezionate (codici Tesseract): dipendono da cosa è installato su questo
  // computer, per questo non stanno in appData.
  ocrLingue: (v) => Array.isArray(v) && v.length <= 32 && v.every((c) => typeof c === 'string' && /^[a-z_]{3,24}$/.test(c)),
  // Aspetto e documenti (predefiniti in PREDEFINITI_IMPOSTAZIONI, settingsLogic.ts).
  zoomInterfaccia: (v) => intero(80, 150)(v) && (v as number) % 10 === 0,
  fontTrascrizione: (v) => v === 'serif' || v === 'sans' || v === 'mono' || v === 'junicode',
  dimensioneTrascrizione: intero(12, 32),
  pdfRisoluzione: intero(1600, 3200),
  pdfZoomIniziale: (v) => v === 'pagina' || v === 'larghezza',
  aggiornamentiAutomatici: booleano,
  // Scansioni dal telefono: PDF unico all'importazione, import all'apertura senza chiedere,
  // e l'impronta dell'ultimo avviso rimandato (non si ripropone per le stesse scansioni).
  scannerPdf: booleano,
  scannerImportaSempre: booleano,
  scannerRimandato: testo(8000)
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

/**
 * Chiavi di `grezze` da togliere da settings.json per tornare al predefinito: una preferenza
 * ammessa inviata a `null`. Non vale per le chiavi dove `null` è un valore (appState,
 * lastSyncTime): `saveAllSettings` unisce e non può cancellare.
 */
function chiaviDaRimuovere(grezze: unknown): string[] {
  if (!grezze || typeof grezze !== 'object' || Array.isArray(grezze)) return [];
  return Object.keys(AMMESSE).filter((k) =>
    Object.prototype.hasOwnProperty.call(grezze, k) && (grezze as any)[k] === null && !AMMESSE[k](null));
}

/** Una patch del renderer divisa in valori da scrivere, chiavi da togliere e chiavi rifiutate. */
function esaminaPatch(grezze: unknown): { valori: { [chiave: string]: unknown }; daRimuovere: string[]; rifiutate: string[] } {
  const valori = filtraImpostazioniRenderer(grezze);
  const daRimuovere = chiaviDaRimuovere(grezze);
  const rifiutate = grezze && typeof grezze === 'object' && !Array.isArray(grezze)
    ? Object.keys(grezze).filter((k) => !Object.prototype.hasOwnProperty.call(valori, k) &&!daRimuovere.includes(k))
    : [];
  return { valori, daRimuovere, rifiutate };
}

module.exports = { filtraImpostazioniRenderer, chiaviDaRimuovere, esaminaPatch, CHIAVI_AMMESSE: Object.keys(AMMESSE) };
export {};
