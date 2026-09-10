// Fase 2.6 — Citazioni bibliografiche (BibTeX e RIS).
//
// Modulo PURO, come tutti gli export di questa fase. Poche decine di righe di logica vera:
// il valore sta nella MAPPATURA, non nel formato — decidere che cosa di una scheda
// archivistica è l'autore, che cosa il titolo e dove finisce la segnatura è ciò che
// distingue una voce citabile da una che va riscritta a mano in Zotero.

type Record_ = { [k: string]: any };

const Model = require('../../shared/model');

type Opzioni = {
  formato?: 'bibtex' | 'ris';
  /** Nome del fondo/archivio conservatore: sta nelle impostazioni di stampa (2.2). */
  fondo?: string;
  nomiTipi?: { [k: string]: string };
  testi?: { [k: string]: string };
};

const TESTI_DEFAULT: { [k: string]: string } = {
  cit_type: 'Manoscritto',
  cit_shelfmark: 'Segnatura',
  cit_chronic_date: 'Data cronica',
  cit_untitled: 'Senza titolo'
};

/** Il primo campo valorizzato della scala: è l'ordine in cui un archivista cerca il titolo. */
const CAMPI_TITOLO = ['titolo', 'oggetto', 'tipo_di_atto', 'motivazione_processo'];
const CAMPI_AUTORE = ['autore', 'Notaio', 'dichiarante'];
const CAMPI_SINTESI = ['oggetto', 'note', 'motivazione_processo'];

function primoValorizzato(m: Record_, campi: string[]): string {
  for (const c of campi) {
    const v = m[c];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * L'anno da una data cronica scritta a mano ("12 maggio 1340", "1340 aprile 3", "sec. XIV").
 * Si accetta solo un numero di 3 o 4 cifre in un intervallo plausibile: senza il controllo,
 * "12 maggio" darebbe l'anno 12, e una bibliografia con `year = {12}` è peggio di una senza
 * anno — l'errore non si vede finché non lo vede un revisore.
 */
function anno(valore: any): string {
  const testo = String(valore || '');
  const numeri = testo.match(/\d{3,4}/g);
  if (!numeri) return '';
  for (const n of numeri) {
    const v = Number(n);
    if (v >= 500 && v <= 2200) return n;
  }
  return '';
}

/** Chiave di citazione: solo ASCII, perché è un identificatore LaTeX, non un testo. */
function slug(s: string, max: number): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // "Perùgia" → "Perugia"
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, max);
}

/**
 * `Cognome1340` quando c'è un autore, altrimenti la segnatura. Il cognome è la PRIMA parola
 * di un "Cognome, Nome" e l'ULTIMA di un "Nome Cognome": la virgola è il discriminante, ed
 * è la convenzione con cui i due formati si scrivono.
 */
function chiaveCitazione(m: Record_, usate: Set<string>): string {
  const autore = primoValorizzato(m, CAMPI_AUTORE);
  let base = '';
  if (autore) {
    const parti = autore.split(',');
    base = slug(parti.length > 1 ? parti[0] : autore.split(/\s+/).pop() || autore, 24);
  }
  if (!base) base = slug(m.segnatura, 24);
  if (!base) base = 'scheda';
  base = base + anno(m.dataCronica);
  // Due carte dello stesso notaio nello stesso anno esistono eccome: senza il suffisso,
  // BibTeX terrebbe solo la prima e la seconda citazione punterebbe al documento sbagliato.
  let chiave = base;
  let suffisso = 0;
  while (usate.has(chiave.toLowerCase())) chiave = base + String.fromCharCode(97 + (suffisso++ % 26)) + (suffisso > 26 ? suffisso : '');
  usate.add(chiave.toLowerCase());
  return chiave;
}

// Fase 3.4: qui c'era un TERZO parser dei tag, con la sua tolleranza all'array e la sua idea
// di che cosa sia un tag vuoto. Ora ce n'è uno solo, in `shared/model.ts`, e sa anche
// deduplicare per chiave normalizzata.
function tagList(m: Record_): string[] {
  return Model.tags(m);
}

// --- BibTeX ------------------------------------------------------------------

/**
 * Escaping BibTeX. I caratteri accentati restano UTF-8: biblatex li gestisce nativamente e
 * convertirli in `\`{o}` renderebbe il file illeggibile a Zotero, che è il consumatore
 * previsto. Si neutralizzano solo i caratteri che romperebbero il PARSER (le graffe, che
 * delimitano i valori) o che LaTeX interpreta come comandi.
 */
function escapeBibtex(s: any): string {
  return String(s === null || s === undefined ? '' : s)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}&%$#_])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\s*\r?\n\s*/g, ' ')
    .trim();
}

function campoBibtex(nome: string, valore: string): string {
  return valore ? `  ${nome} = {${valore}},\n` : '';
}

function voceBibtex(m: Record_, opzioni: Opzioni, testi: { [k: string]: string }, usate: Set<string>): string {
  const titolo = primoValorizzato(m, CAMPI_TITOLO) || m.segnatura || testi.cit_untitled;
  const nota: string[] = [];
  if (m.segnatura) nota.push(`${testi.cit_shelfmark}: ${m.segnatura}`);
  if (m.dataCronica) nota.push(`${testi.cit_chronic_date}: ${m.dataCronica}`);

  // `@misc` con `type`: è la forma che biblatex raccomanda per il materiale d'archivio
  // inedito, e l'unica che Zotero importa senza inventarsi un tipo di documento.
  // Le doppie graffe sul titolo proteggono le maiuscole: senza, gli stili che applicano il
  // sentence case trasformerebbero "Comune di Perugia" in "Comune di perugia".
  let out = `@misc{${chiaveCitazione(m, usate)},\n`;
  out += campoBibtex('title', `{${escapeBibtex(titolo)}}`);
  out += campoBibtex('author', escapeBibtex(primoValorizzato(m, CAMPI_AUTORE)));
  out += campoBibtex('year', anno(m.dataCronica));
  out += campoBibtex('type', escapeBibtex(opzioni.nomiTipi && opzioni.nomiTipi[m.tipoDocumento] || testi.cit_type));
  out += campoBibtex('number', escapeBibtex(m.segnatura));
  out += campoBibtex('organization', escapeBibtex(opzioni.fondo));
  out += campoBibtex('series', escapeBibtex(m.cartella));
  out += campoBibtex('address', escapeBibtex(m.dataTopica));
  out += campoBibtex('keywords', escapeBibtex(tagList(m).join(', ')));
  out += campoBibtex('note', escapeBibtex(nota.join('; ')));
  return out.replace(/,\n$/, '\n') + '}\n';
}

// --- RIS ---------------------------------------------------------------------

/** Una riga RIS: tag di due caratteri, due spazi, trattino, spazio. La forma è rigida. */
function rigaRis(tag: string, valore: any): string {
  const v = String(valore === null || valore === undefined ? '' : valore).replace(/\s*\r?\n\s*/g, ' ').trim();
  return v ? `${tag}  - ${v}\r\n` : '';
}

function voceRis(m: Record_, opzioni: Opzioni, testi: { [k: string]: string }): string {
  const titolo = primoValorizzato(m, CAMPI_TITOLO) || m.segnatura || testi.cit_untitled;
  // MANSCPT: il tipo RIS del manoscritto. È ciò che fa arrivare la scheda in Zotero come
  // "Manuscript" invece che come "Generic", con i campi al posto giusto.
  let out = 'TY  - MANSCPT\r\n';
  out += rigaRis('TI', titolo);
  // Un autore per riga: RIS non ammette una lista, e un `AU` con dentro tre nomi diventa
  // in Zotero un unico autore che si chiama come tutti e tre.
  for (const a of primoValorizzato(m, CAMPI_AUTORE).split(';')) out += rigaRis('AU', a);
  out += rigaRis('PY', anno(m.dataCronica));
  out += rigaRis('DA', m.dataCronica);
  out += rigaRis('CY', m.dataTopica);
  out += rigaRis('PB', opzioni.fondo);
  out += rigaRis('T2', m.cartella);
  out += rigaRis('AN', m.segnatura);
  out += rigaRis('M1', m.segnatura);
  for (const t of tagList(m)) out += rigaRis('KW', t);
  out += rigaRis('AB', primoValorizzato(m, CAMPI_SINTESI));
  out += 'ER  - \r\n\r\n';
  return out;
}

const ESTENSIONI: { [k: string]: string } = { bibtex: 'bib', ris: 'ris' };

function generaCitazioni(records: Record_[], opzioni: Opzioni = {}) {
  const formato = ESTENSIONI[String(opzioni.formato)] ? String(opzioni.formato) : 'bibtex';
  const testi = Object.assign({}, TESTI_DEFAULT, opzioni.testi || {});
  const lista = Array.isArray(records) ? records : [];
  if (formato === 'ris') {
    return { contenuto: lista.map((m) => voceRis(m, opzioni, testi)).join(''), estensione: 'ris' };
  }
  const usate = new Set<string>();
  return {
    contenuto: lista.map((m) => voceBibtex(m, opzioni, testi, usate)).join('\n'),
    estensione: 'bib'
  };
}

module.exports = { generaCitazioni, anno, chiaveCitazione, escapeBibtex };
export {};
