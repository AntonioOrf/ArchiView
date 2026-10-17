type Tipo = { id: string; nome?: string; campi?: string[] };
type Record_ = { [k: string]: any };

const Model = require('../../shared/model');
const META = new Set(Model.CHIAVI_SERVIZIO);

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

function formattaListaDinamica(valore: any[], separatore = '; '): string {
  return valore.map(el => {
    if (el === null || typeof el !== 'object') return String(el ?? '');
    const k = el.k ?? el.ruolo ?? '';
    const v = el.v ?? el.nome ?? '';
    if (k && v) return `${k}: ${v}`;
    return String(k || v || '');
  }).filter(Boolean).join(separatore);
}

function formattaAllegati(valore: any): string {
  if (!valore) return '';
  const lista = Array.isArray(valore) ? valore : [valore];
  return lista.map(a => (typeof a === 'string' ? a : (a && (a.originalName || a.nome || a.name)) || '')).filter(Boolean).join('; ');
}

function formattaValore(chiave: string, valore: any, testi: { [k: string]: string } = {}): string {
  if (valore === null || valore === undefined) return '';
  if (typeof valore === 'boolean') return valore ? (testi.si || 'Sì') : (testi.no || 'No');
  if (chiave === 'allegati') return formattaAllegati(valore);
  if (chiave === 'tags') return Model.tags({ tags: valore }).join(', ');
  if (chiave === 'lastModified') {
    const n = Number(valore);
    return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : '';
  }
  if (Array.isArray(valore)) return formattaListaDinamica(valore);
  if (typeof valore === 'object') return JSON.stringify(valore);
  return String(valore);
}

function neutralizzaFormula(cella: string): string {
  if (!cella) return cella;
  const c = cella[0];
  if (c === '=' || c === '+' || c === '@' || c === '\t' || c === '\r') return "'" + cella;
  if (c === '-' && !/^-\d[\d.,]*$/.test(cella)) return "'" + cella;
  return cella;
}

function quota(cella: string, delimitatore: string): string {
  const serve = cella.includes(delimitatore) || cella.includes('"') || /[\r\n]/.test(cella) || /^\s|\s$/.test(cella);
  return serve ? '"' + cella.replace(/"/g, '""') + '"' : cella;
}

function costruisciColonne(records: Record_[], tipiDocumento: Tipo[], etichetteIn: { [k: string]: string } = {}) {
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
  for (const m of records) {
    for (const d of Model.campiPropri(m)) {
      if (META.has(d.id) || visti.has(d.id)) continue;
      visti.add(d.id); campi.push(d.id);
      if (!etichette[d.id] && d.label) etichette[d.id] = d.label;
    }
  }
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
      if (delimitatore === '\t') v = v.replace(/\t/g, ' ');
      return quota(neutralizzaFormula(v), delimitatore);
    });
    righe.push(cells.join(delimitatore));
  }
  const preambolo = opzioni.preambolo !== undefined ? opzioni.preambolo : delimitatore === ',';
  const testo = (preambolo ? 'sep=' + delimitatore + '\r\n' : '') + righe.join('\r\n') + '\r\n';
  return opzioni.bom === false ? testo : '﻿' + testo;
}

export { generaCsv, costruisciColonne, formattaValore, formattaListaDinamica, neutralizzaFormula };
