// Fase 2.1 — Esportazione CSV/TSV. Modulo PURO (nessun accesso a fs/Electron) così da
// essere testabile senza avviare l'app: l'IPC in exportImportIpc.ts si limita al dialog
// e alla scrittura su disco.

type Tipo = { id: string; nome?: string; campi?: string[] };
type Record_ = { [k: string]: any };

// Chiavi di servizio: non diventano mai colonne "campo del tipo". L'elenco e' quello
// condiviso di `shared/model.ts` (Fase 3.0): era duplicato qui, nella stampa e nell'export
// del testo, e il primo dei tre a divergere avrebbe fatto comparire `lastModified` come
// colonna in un export solo.
const Model = require('../../shared/model');
const META = new Set(Model.CHIAVI_SERVIZIO);

// L'ID e' in CODA, non in testa: e' un UUID che nessuno legge, e in prima colonna
// spingeva la segnatura — l'unica chiave che l'utente riconosce — fuori dallo schermo.
// Resta comunque nel file perche' e' cio' che permette di riportare i dati nell'app.
const COLONNE_BASE = [
  { chiave: 'segnatura', etichetta: 'Segnatura' },
  { chiave: 'tipoDocumento', etichetta: 'Tipo documento' },
  { chiave: 'cartella', etichetta: 'Archivio' },
  { chiave: 'tags', etichetta: 'Tag' },
  { chiave: 'allegati', etichetta: 'Allegati' },
  { chiave: 'lastModified', etichetta: 'Ultima modifica' },
  { chiave: 'modificatoDa', etichetta: 'Modificato da' },
  { chiave: 'creatoDa', etichetta: 'Creato da' }
];

/** Liste dinamiche (`attori_dinamici` & co.): [{k,v}] oppure [{ruolo,nome}]. */
function formattaListaDinamica(valore: any[]): string {
  return valore.map(el => {
    if (el === null || typeof el !== 'object') return String(el ?? '');
    const k = el.k ?? el.ruolo ?? '';
    const v = el.v ?? el.nome ?? '';
    if (k && v) return `${k}: ${v}`;
    return String(k || v || '');
  }).filter(Boolean).join('; ');
}

function formattaAllegati(valore: any): string {
  if (!valore) return '';
  const lista = Array.isArray(valore) ? valore : [valore];
  return lista.map(a => (typeof a === 'string' ? a : (a && (a.originalName || a.nome || a.name)) || '')).filter(Boolean).join('; ');
}

/**
 * Cella normalizzata a stringa. Le date epoch diventano ISO (ordinabili in Excel e in R,
 * cosa che il formato locale `gg/mm/aaaa` non garantisce).
 */
function formattaValore(chiave: string, valore: any, testi: { [k: string]: string } = {}): string {
  if (valore === null || valore === undefined) return '';
  // Fase 3.1: i campi `boolean` arrivano come booleani veri. `true`/`false` in una cella di
  // Excel sono gergo — e in italiano non sono nemmeno riconosciuti come valori logici.
  if (typeof valore === 'boolean') return valore ? (testi.si || 'Sì') : (testi.no || 'No');
  if (chiave === 'allegati') return formattaAllegati(valore);
  // Fase 3.4: la cella Tag esce normalizzata — niente voci vuote, niente spazi doppi, niente
  // duplicati di sola maiuscola — come la vede l'utente nella griglia.
  if (chiave === 'tags') return Model.tags({ tags: valore }).join(', ');
  if (chiave === 'lastModified') {
    const n = Number(valore);
    return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : '';
  }
  if (Array.isArray(valore)) return formattaListaDinamica(valore);
  if (typeof valore === 'object') return JSON.stringify(valore);
  // I newline restano: il quoting RFC4180 li preserva dentro la cella.
  return String(valore);
}

/**
 * Neutralizza la formula injection: un valore che inizia per = + @ - o per un controllo
 * verrebbe eseguito da Excel/LibreOffice all'apertura. Il trattino è escapato solo quando
 * non introduce un numero, altrimenti ogni importo negativo diventerebbe testo.
 */
function neutralizzaFormula(cella: string): string {
  if (!cella) return cella;
  const c = cella[0];
  if (c === '=' || c === '+' || c === '@' || c === '\t' || c === '\r') return "'" + cella;
  if (c === '-' && !/^-\d/.test(cella)) return "'" + cella;
  return cella;
}

function quota(cella: string, delimitatore: string): string {
  const serve = cella.includes(delimitatore) || cella.includes('"') || /[\r\n]/.test(cella) || /^\s|\s$/.test(cella);
  return serve ? '"' + cella.replace(/"/g, '""') + '"' : cella;
}

/**
 * Colonne = base + unione dei campi dei tipi presenti nella selezione, nell'ordine in cui
 * i tipi compaiono in `tipiDocumento` (stabile fra due export dello stesso archivio).
 * `etichette` arriva dal renderer (CONFIG_CAMPI tradotto): il main non conosce la i18n.
 */
function costruisciColonne(records: Record_[], tipiDocumento: Tipo[], etichetteIn: { [k: string]: string } = {}) {
  // Copia: le etichette dei campi propri si aggiungono qui, e scriverle nell'oggetto del
  // chiamante vorrebbe dire un catalogo che cresce a ogni export.
  const etichette: { [k: string]: string } = Object.assign({}, etichetteIn);
  const presenti = new Set(records.map(m => m.tipoDocumento || 'manoscritto'));
  const campi: string[] = [];
  const visti = new Set<string>();
  for (const t of tipiDocumento || []) {
    if (!presenti.has(t.id)) continue;
    for (const c of t.campi || []) {
      if (!META.has(c) && !visti.has(c)) { visti.add(c); campi.push(c); }
    }
  }
  // Fase 3.7 — i campi propri delle schede, dopo quelli dei modelli e nell'ordine in cui le
  // schede compaiono. Senza, finirebbero comunque nel file per la rete di sicurezza qui
  // sotto, ma con l'id grezzo al posto dell'etichetta: `propri` le raccoglie perche' un
  // export destinato a un altro strumento non deve chiamare le cose come il database.
  for (const m of records) {
    for (const d of Model.campiPropri(m)) {
      if (META.has(d.id) || visti.has(d.id)) continue;
      visti.add(d.id); campi.push(d.id);
      if (!etichette[d.id] && d.label) etichette[d.id] = d.label;
    }
  }
  // Rete di sicurezza: campi valorizzati su record il cui tipo non esiste più (o è stato
  // modificato dopo la compilazione) sparirebbero silenziosamente dall'export.
  for (const m of records) {
    for (const k of Object.keys(m)) {
      if (META.has(k) || visti.has(k)) continue;
      if (m[k] === '' || m[k] === null || m[k] === undefined) continue;
      if (Array.isArray(m[k]) && m[k].length === 0) continue;
      visti.add(k); campi.push(k);
    }
  }
  return [
    ...COLONNE_BASE.map(c => ({ chiave: c.chiave, etichetta: etichette[c.chiave] || c.etichetta })),
    ...campi.map(c => ({ chiave: c, etichetta: etichette[c] || c })),
    { chiave: 'id', etichetta: etichette['id'] || 'ID' }
  ];
}

/**
 * Genera il contenuto del file. `nomiTipi` mappa id→nome leggibile del tipo.
 *
 * Due righe tecniche in testa, entrambe necessarie su Windows:
 * - **BOM UTF-8**, senza il quale Excel legge le diacritiche medievali come mojibake;
 * - **`sep=,`**, senza il quale Excel con impostazioni italiane (separatore di lista `;`)
 *   non spezza affatto le colonne e riversa l'intera riga nella prima cella. È una
 *   direttiva che Excel e LibreOffice riconoscono a prescindere dal locale, quindi vale
 *   più di qualunque tentativo di indovinare le impostazioni della macchina.
 *   Chi legge il file con pandas/R salta la prima riga (`skiprows=1` / `skip=1`), oppure
 *   usa il TSV, che non ha preambolo perché il tab non è mai ambiguo.
 */
function generaCsv(
  records: Record_[],
  tipiDocumento: Tipo[],
  opzioni: { formato?: 'csv' | 'tsv'; etichette?: { [k: string]: string }; nomiTipi?: { [k: string]: string }; testi?: { [k: string]: string }; bom?: boolean; preambolo?: boolean } = {}
): string {
  const delimitatore = opzioni.formato === 'tsv' ? '\t' : ',';
  const colonne = costruisciColonne(records, tipiDocumento, opzioni.etichette);
  const nomiTipi = opzioni.nomiTipi || {};

  const righe = [colonne.map(c => quota(c.etichetta, delimitatore)).join(delimitatore)];
  for (const m of records) {
    const cells = colonne.map(c => {
      let v = formattaValore(c.chiave, m[c.chiave], opzioni.testi || {});
      if (c.chiave === 'tipoDocumento') v = nomiTipi[v] || v;
      // Nel TSV i tab dentro la cella romperebbero le colonne anche con le virgolette:
      // molti parser TSV (Excel incluso) ignorano il quoting.
      if (delimitatore === '\t') v = v.replace(/\t/g, ' ');
      return quota(neutralizzaFormula(v), delimitatore);
    });
    righe.push(cells.join(delimitatore));
  }
  const preambolo = opzioni.preambolo !== undefined ? opzioni.preambolo : delimitatore === ',';
  const testo = (preambolo ? 'sep=' + delimitatore + '\r\n' : '') + righe.join('\r\n') + '\r\n';
  return opzioni.bom === false ? testo : '﻿' + testo;
}

module.exports = { generaCsv, costruisciColonne, formattaValore, neutralizzaFormula };
export {};
