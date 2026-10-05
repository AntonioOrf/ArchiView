// ArchiView Scanner — validatore del "lotto" (docs/scanner/CONTRATTO.md, versione 1).
//
// ⚠️ PERCHÉ È CONDIVISO
//
// Il lotto lo scrive il telefono e lo legge il desktop. Se ciascuno avesse il suo controllo,
// i due divergerebbero proprio sui casi storti (un nome file con una barra, un campo che si
// chiama `allegati`) e il desktop accetterebbe ciò che il telefono non avrebbe dovuto
// scrivere, o rifiuterebbe ciò che il telefono considera buono. Qui c'è UNA risposta.
// Lo usano il main del desktop (`require('../../shared/scannerLotto')`) e l'app Android
// (Metro con `watchFolders` su `../src/shared`, tipizzato in `mobile/src/contratto.ts`).
//
// Non ha `import`/`export` (è uno script, come gli altri file di `src/shared/`): espone
// `module.exports` sotto guardia e `window.ScannerLotto`. Nomi globali prefissati `avsl`.
// Niente dipendenze: né Node né DOM né `model.ts` (l'app lo carica da sola).
//
// NON contiene frasi: gli errori sono CODICI con il percorso del valore sbagliato. Con
// `ok: true` restituisce una copia NORMALIZZATA, con le sole chiavi note: è quella, e non
// il JSON ricevuto, che il desktop scrive su disco.

const AVSL_FORMATO = 'archiview-scanner/lotto';
const AVSL_VERSIONE = 1;

const AVSL_RE_ID = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-[0-9a-z]{4}$/;
/** Solo nomi piatti: niente barre, niente `..`, niente maiuscole (Windows non le distingue). */
const AVSL_RE_FILE = /^p\d{4}\.(jpg|jpeg|png)$/;
const AVSL_RE_SHA256 = /^[0-9a-f]{64}$/;
const AVSL_RE_CHIAVE = /^[A-Za-z][A-Za-z0-9_]*$/;
/** ISO 8601 con fuso esplicito (`Z` o `±hh:mm`): l'ora locale del telefono non è quella del PC. */
const AVSL_RE_DATA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

const AVSL_MODALITA = ['documento', 'grezza', 'raffica'];
const AVSL_LATI = ['sx', 'dx'];
/**
 * Chiavi di servizio della scheda (in `model.ts`: AV_CHIAVI_SERVIZIO, meno `segnatura`, che dal
 * telefono si compila) più i nomi che su un oggetto JS non sono dati. Un campo della bozza
 * con uno di questi nomi sovrascriverebbe la scheda quando il desktop la crea dal lotto.
 */
const AVSL_CHIAVI_RISERVATE = [
  'id', 'cartella', 'tipoDocumento', 'allegati', 'allegato', 'allegatoTipo', 'lastModified',
  'modificatoDa', 'creatoDa', 'trascrizione', 'schemaVersion', 'relazioni', 'campiPropri',
  'ordineCampi', 'provenienza', 'rimandiEsterni', 'tags', 'constructor', 'prototype'
];

const AVSL_LIMITI = {
  pagine: 2000,
  /** 200 MB: un JPEG a piena risoluzione sta sotto i 20; oltre è un file sbagliato. */
  byte: 200 * 1024 * 1024,
  lato: 30000,
  campi: 100,
  valoreCampo: 10000,
  titolo: 200,
  nota: 2000,
  dispositivo: 100,
  etichetta: 32,
  schedaId: 200,
  tipoDocumento: 200,
  cartella: 500
};

type AvslModalita = 'documento' | 'grezza' | 'raffica';

type AvslPagina = {
  file: string;
  sha256: string;
  byte: number;
  modalita: AvslModalita;
  larghezza?: number;
  altezza?: number;
  etichetta?: string;
  doppia?: { lato: 'sx' | 'dx' };
};

type AvslDestinazione =
  | { tipo: 'nessuna' }
  | { tipo: 'esistente'; schedaId: string }
  | { tipo: 'nuova'; tipoDocumento: string; cartella?: string; campi: { [chiave: string]: string } };

type AvslLotto = {
  formato: string;
  versione: number;
  id: string;
  creatoIl: string;
  dispositivo?: string;
  titolo?: string;
  nota?: string;
  destinazione: AvslDestinazione;
  pagine: AvslPagina[];
};

type AvslErrore = { codice: string; percorso: string };

type AvslEsito = { ok: true; lotto: AvslLotto } | { ok: false; errori: AvslErrore[] };

function avslOggetto(v: any): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function avslIntero(v: any, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

/** L'id è anche il nome della cartella: oltre alla forma, una data e un'ora che esistono. */
function avslIdValido(id: any): boolean {
  if (typeof id !== 'string') return false;
  const m = AVSL_RE_ID.exec(id);
  if (!m) return false;
  const [a, me, g, h, mi, s] = m.slice(1, 7).map(Number);
  if (me < 1 || me > 12 || g < 1 || h > 23 || mi > 59 || s > 59) return false;
  return g <= new Date(Date.UTC(a, me, 0)).getUTCDate();
}

function avslNomeFileValido(nome: any): boolean {
  return typeof nome === 'string' && AVSL_RE_FILE.test(nome);
}

function avslDue(n: number): string {
  return (n < 10 ? '0' : '') + n;
}

/** `AAAAMMGG-hhmmss-xxxx` nell'ora locale di `data`; `suffisso` = 4 caratteri [0-9a-z] casuali. */
function avslNuovoId(data: Date, suffisso: string): string {
  const s = String(suffisso || '').toLowerCase();
  if (!/^[0-9a-z]{4}$/.test(s)) throw new Error('suffisso_non_valido');
  return String(data.getFullYear()) + avslDue(data.getMonth() + 1) + avslDue(data.getDate()) + '-' +
    avslDue(data.getHours()) + avslDue(data.getMinutes()) + avslDue(data.getSeconds()) + '-' + s;
}

/** Nome della pagina `n` (da 1): `p0001.jpg`. */
function avslNomePagina(n: number, estensione?: string): string {
  if (!avslIntero(n, 1, 9999)) throw new Error('numero_pagina_non_valido');
  const est = estensione || 'jpg';
  if (['jpg', 'jpeg', 'png'].indexOf(est) === -1) throw new Error('estensione_non_valida');
  return 'p' + String(n).padStart(4, '0') + '.' + est;
}

/** Testo facoltativo: assente, oppure stringa entro `max`. Vuoto dopo il trim = assente. */
function avslTesto(v: any, max: number, percorso: string, errori: AvslErrore[]): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' || v.length > max) { errori.push({ codice: 'testo_non_valido', percorso }); return undefined; }
  const t = v.trim();
  return t ? t : undefined;
}

/** Testo obbligatorio e non vuoto. */
function avslTestoObbligatorio(v: any, max: number, codice: string, percorso: string, errori: AvslErrore[]): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) { errori.push({ codice, percorso }); return ''; }
  return v.trim();
}

function avslDestinazione(d: any, errori: AvslErrore[]): AvslDestinazione {
  const p = 'destinazione';
  if (!avslOggetto(d)) { errori.push({ codice: 'destinazione_non_valida', percorso: p }); return { tipo: 'nessuna' }; }
  if (d.tipo === 'nessuna') return { tipo: 'nessuna' };
  if (d.tipo === 'esistente') {
    return { tipo: 'esistente', schedaId: avslTestoObbligatorio(d.schedaId, AVSL_LIMITI.schedaId, 'scheda_id_non_valido', p + '.schedaId', errori) };
  }
  if (d.tipo !== 'nuova') { errori.push({ codice: 'destinazione_tipo_sconosciuto', percorso: p + '.tipo' }); return { tipo: 'nessuna' }; }

  const out: AvslDestinazione = {
    tipo: 'nuova',
    tipoDocumento: avslTestoObbligatorio(d.tipoDocumento, AVSL_LIMITI.tipoDocumento, 'tipo_documento_non_valido', p + '.tipoDocumento', errori),
    campi: {}
  };
  const cartella = avslTesto(d.cartella, AVSL_LIMITI.cartella, p + '.cartella', errori);
  if (cartella !== undefined) out.cartella = cartella;

  if (d.campi === undefined) return out;
  if (!avslOggetto(d.campi)) { errori.push({ codice: 'campi_non_validi', percorso: p + '.campi' }); return out; }
  const chiavi = Object.keys(d.campi);
  if (chiavi.length > AVSL_LIMITI.campi) { errori.push({ codice: 'troppi_campi', percorso: p + '.campi' }); return out; }
  for (const k of chiavi) {
    const pk = p + '.campi.' + k;
    if (!AVSL_RE_CHIAVE.test(k)) { errori.push({ codice: 'campo_chiave_non_valida', percorso: pk }); continue; }
    if (AVSL_CHIAVI_RISERVATE.indexOf(k) !== -1) { errori.push({ codice: 'campo_riservato', percorso: pk }); continue; }
    const v = d.campi[k];
    if (typeof v !== 'string' || v.length > AVSL_LIMITI.valoreCampo) { errori.push({ codice: 'campo_valore_non_valido', percorso: pk }); continue; }
    // Un campo lasciato vuoto nel form non è un dato.
    if (v.trim()) out.campi[k] = v;
  }
  return out;
}

function avslPagina(x: any, i: number, visti: Set<string>, errori: AvslErrore[]): AvslPagina | null {
  const p = 'pagine[' + i + ']';
  if (!avslOggetto(x)) { errori.push({ codice: 'pagina_non_valida', percorso: p }); return null; }
  const n0 = errori.length;
  if (!avslNomeFileValido(x.file)) errori.push({ codice: 'file_non_valido', percorso: p + '.file' });
  else if (visti.has(x.file)) errori.push({ codice: 'file_duplicato', percorso: p + '.file' });
  else visti.add(x.file);
  const sha = typeof x.sha256 === 'string' ? x.sha256.toLowerCase() : '';
  if (!AVSL_RE_SHA256.test(sha)) errori.push({ codice: 'sha256_non_valido', percorso: p + '.sha256' });
  if (!avslIntero(x.byte, 1, AVSL_LIMITI.byte)) errori.push({ codice: 'byte_non_validi', percorso: p + '.byte' });
  if (AVSL_MODALITA.indexOf(x.modalita) === -1) errori.push({ codice: 'modalita_non_valida', percorso: p + '.modalita' });
  for (const lato of ['larghezza', 'altezza']) {
    if (x[lato] !== undefined && !avslIntero(x[lato], 1, AVSL_LIMITI.lato)) errori.push({ codice: 'dimensione_non_valida', percorso: p + '.' + lato });
  }
  const etichetta = avslTesto(x.etichetta, AVSL_LIMITI.etichetta, p + '.etichetta', errori);
  if (x.doppia !== undefined && !(avslOggetto(x.doppia) && AVSL_LATI.indexOf(x.doppia.lato) !== -1)) {
    errori.push({ codice: 'doppia_non_valida', percorso: p + '.doppia' });
  }
  if (errori.length > n0) return null;

  const out: AvslPagina = { file: x.file, sha256: sha, byte: x.byte, modalita: x.modalita };
  if (x.larghezza !== undefined) out.larghezza = x.larghezza;
  if (x.altezza !== undefined) out.altezza = x.altezza;
  if (etichetta !== undefined) out.etichetta = etichetta;
  if (x.doppia !== undefined) out.doppia = { lato: x.doppia.lato };
  return out;
}

function avslValida(json: any): AvslEsito {
  const errori: AvslErrore[] = [];
  if (!avslOggetto(json)) return { ok: false, errori: [{ codice: 'non_oggetto', percorso: '' }] };
  if (json.formato !== AVSL_FORMATO) return { ok: false, errori: [{ codice: 'formato_sconosciuto', percorso: 'formato' }] };
  // Una versione futura può cambiare il significato di campi che qui sembrerebbero validi:
  // meglio rifiutarla che leggerla a metà. Il desktop dirà "aggiorna ArchiView".
  if (json.versione !== AVSL_VERSIONE) {
    const codice = avslIntero(json.versione, AVSL_VERSIONE + 1, Number.MAX_SAFE_INTEGER) ? 'versione_futura' : 'versione_non_valida';
    return { ok: false, errori: [{ codice, percorso: 'versione' }] };
  }

  if (!avslIdValido(json.id)) errori.push({ codice: 'id_non_valido', percorso: 'id' });
  if (typeof json.creatoIl !== 'string' || !AVSL_RE_DATA.test(json.creatoIl) || isNaN(Date.parse(json.creatoIl))) {
    errori.push({ codice: 'data_non_valida', percorso: 'creatoIl' });
  }
  const dispositivo = avslTesto(json.dispositivo, AVSL_LIMITI.dispositivo, 'dispositivo', errori);
  const titolo = avslTesto(json.titolo, AVSL_LIMITI.titolo, 'titolo', errori);
  const nota = avslTesto(json.nota, AVSL_LIMITI.nota, 'nota', errori);
  const destinazione = avslDestinazione(json.destinazione, errori);

  const pagine: AvslPagina[] = [];
  if (!Array.isArray(json.pagine)) errori.push({ codice: 'pagine_non_valide', percorso: 'pagine' });
  else if (json.pagine.length === 0) errori.push({ codice: 'pagine_vuote', percorso: 'pagine' });
  else if (json.pagine.length > AVSL_LIMITI.pagine) errori.push({ codice: 'troppe_pagine', percorso: 'pagine' });
  else {
    const visti = new Set<string>();
    json.pagine.forEach((x: any, i: number) => {
      const pg = avslPagina(x, i, visti, errori);
      if (pg) pagine.push(pg);
    });
  }

  if (errori.length) return { ok: false, errori };
  // Ordine delle chiavi fisso: il manifest scritto dal desktop è leggibile e confrontabile.
  const lotto = { formato: AVSL_FORMATO, versione: AVSL_VERSIONE, id: json.id, creatoIl: json.creatoIl } as AvslLotto;
  if (dispositivo !== undefined) lotto.dispositivo = dispositivo;
  if (titolo !== undefined) lotto.titolo = titolo;
  if (nota !== undefined) lotto.nota = nota;
  lotto.destinazione = destinazione;
  lotto.pagine = pagine;
  return { ok: true, lotto };
}

const ArchiViewScannerLotto = {
  FORMATO: AVSL_FORMATO,
  VERSIONE: AVSL_VERSIONE,
  NOME_MANIFEST: 'lotto.json',
  MODALITA: AVSL_MODALITA.slice(),
  CHIAVI_RISERVATE: AVSL_CHIAVI_RISERVATE.slice(),
  LIMITI: Object.assign({}, AVSL_LIMITI),
  valida: avslValida,
  idValido: avslIdValido,
  nomeFileValido: avslNomeFileValido,
  nuovoId: avslNuovoId,
  nomePagina: avslNomePagina
};

const avModuloCjsScanner = typeof module !== 'undefined' ? module : null;
if (avModuloCjsScanner && avModuloCjsScanner.exports) avModuloCjsScanner.exports = ArchiViewScannerLotto;
if (typeof window !== 'undefined') (window as any).ScannerLotto = ArchiViewScannerLotto;
