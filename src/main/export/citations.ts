type Record_ = { [k: string]: any };

const Model = require('../../shared/model');

type Opzioni = {
  formato?: 'bibtex' | 'ris';
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

function slug(s: string, max: number): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, max);
}

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
  let chiave = base;
  let suffisso = 0;
  while (usate.has(chiave.toLowerCase())) chiave = base + String.fromCharCode(97 + (suffisso++ % 26)) + (suffisso > 26 ? suffisso : '');
  usate.add(chiave.toLowerCase());
  return chiave;
}

function tagList(m: Record_): string[] {
  return Model.tags(m);
}

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

function rigaRis(tag: string, valore: any): string {
  const v = String(valore === null || valore === undefined ? '' : valore).replace(/\s*\r?\n\s*/g, ' ').trim();
  return v ? `${tag}  - ${v}\r\n` : '';
}

function voceRis(m: Record_, opzioni: Opzioni, testi: { [k: string]: string }): string {
  const titolo = primoValorizzato(m, CAMPI_TITOLO) || m.segnatura || testi.cit_untitled;
  let out = 'TY  - MANSCPT\r\n';
  out += rigaRis('TI', titolo);
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

export { generaCitazioni, anno, chiaveCitazione, escapeBibtex };
