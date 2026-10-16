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
  crossArchiveEsclusi: Array.isArray,
  ocrLingue: (v) => Array.isArray(v) && v.length <= 32 && v.every((c) => typeof c === 'string' && /^[a-z_]{3,24}$/.test(c)),
  zoomInterfaccia: (v) => intero(80, 150)(v) && (v as number) % 10 === 0,
  fontTrascrizione: (v) => v === 'serif' || v === 'sans' || v === 'mono' || v === 'junicode',
  dimensioneTrascrizione: intero(12, 32),
  pdfRisoluzione: intero(1600, 3200),
  pdfZoomIniziale: (v) => v === 'pagina' || v === 'larghezza',
  aggiornamentiAutomatici: booleano,
  scannerPdf: booleano,
  scannerImportaSempre: booleano,
  scannerRimandato: testo(8000)
};

const MAX_ESCLUSI = 200;

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

function chiaviDaRimuovere(grezze: unknown): string[] {
  if (!grezze || typeof grezze !== 'object' || Array.isArray(grezze)) return [];
  return Object.keys(AMMESSE).filter((k) =>
    Object.prototype.hasOwnProperty.call(grezze, k) && (grezze as any)[k] === null && !AMMESSE[k](null));
}

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
