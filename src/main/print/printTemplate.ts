type Tipo = { id: string; nome?: string; campi?: string[] };
type Record_ = { [k: string]: any };

type Intestazione = { fondo?: string; autore?: string; data?: string };

type Opzioni = {
  layout?: 'scheda' | 'regesto' | 'tabella';
  etichette?: { [k: string]: string };
  nomiTipi?: { [k: string]: string };
  colonne?: string[];
  intestazione?: Intestazione;
  frontespizio?: boolean;
  includiTrascrizione?: boolean;
  includiVuoti?: boolean;
  orientamento?: 'portrait' | 'landscape';
  miniature?: { [nomeFile: string]: string };
  testi?: { [k: string]: string };
};

const Model = require('../../shared/model');
import * as Csv from '../ipc/csvExport';
const META = new Set(Model.CHIAVI_SERVIZIO);

function tagsDi(m: any): string {
  return Model.tags(m).join(', ');
}

const CAMPI_REGESTO = ['oggetto', 'titolo', 'motivazione_processo', 'note'];

const CAMPI_DATA = ['dataCronica', 'dataTopica'];

const TESTI_DEFAULT: { [k: string]: string } = {
  print_doc_title: 'Schedatura',
  print_cover_fund: 'Fondo',
  print_cover_author: 'Schedatura a cura di',
  print_cover_date: 'Data',
  print_cover_count: 'Schede',
  print_section_transcription: 'Trascrizione',
  print_section_attachments: 'Allegati',
  print_field_signature: 'Segnatura',
  print_field_folder: 'Archivio',
  print_field_tags: 'Tag',
  print_field_type: 'Tipo documento',
  print_no_records: 'Nessuna scheda da stampare.',
  print_untitled: 'Senza segnatura'
};

function escapeHtml(s: any): string {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const TAG_AMMESSI = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sup', 'sub',
  'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'div', 'mark', 'small', 'hr', 'a'
]);

const TAG_DA_SVUOTARE = /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;

function attributiAmmessi(tag: string, grezzi: string): string {
  let out = '';
  const classe = /\bclass\s*=\s*("([^"]*)"|'([^']*)')/i.exec(grezzi);
  if (classe) {
    const valore = (classe[2] || classe[3] || '').replace(/[^A-Za-z0-9 _-]/g, '').trim();
    if (valore) out += ` class="${valore}"`;
  }
  if (tag === 'a') {
    const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(grezzi);
    const url = (href && (href[2] || href[3]) || '').trim();
    if (/^(https?:|mailto:)/i.test(url)) out += ` href="${escapeHtml(url)}"`;
  }
  return out;
}

function sanificaHtml(html: any): string {
  let testo = String(html || '').replace(TAG_DA_SVUOTARE, '');
  testo = testo.replace(/<!--[\s\S]*?-->/g, '');
  return testo.replace(/<\/?([A-Za-z][A-Za-z0-9]*)\b([^>]*)>/g, (intero, nome, resto) => {
    const tag = String(nome).toLowerCase();
    if (!TAG_AMMESSI.has(tag)) return '';
    if (intero[1] === '/') return `</${tag}>`;
    return `<${tag}${attributiAmmessi(tag, resto)}>`;
  });
}

function haTesto(html: any): boolean {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
}

const formattaListaDinamica = (valore: any[]) => Csv.formattaListaDinamica(valore, ' · ');

function formattaValoreStampa(chiave: string, valore: any, locale?: string, testi?: { [k: string]: string }): string {
  if (valore === null || valore === undefined) return '';
  if (typeof valore === 'boolean') return valore ? ((testi && testi.value_yes) || 'Sì') : ((testi && testi.value_no) || 'No');
  if (chiave === 'lastModified') {
    const n = Number(valore);
    if (!Number.isFinite(n) || n <= 0) return '';
    try {
      return new Date(n).toLocaleDateString(locale || 'it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
      return new Date(n).toISOString().slice(0, 10);
    }
  }
  if (Array.isArray(valore)) return formattaListaDinamica(valore);
  if (typeof valore === 'object') return '';
  return String(valore);
}

function nomeAllegato(a: any, i: number): string {
  if (typeof a === 'string') return a;
  return (a && (a.originalName || a.nome || a.name)) || `${i + 1}`;
}

function fileAllegato(a: any): string {
  if (typeof a === 'string') return a;
  return (a && (a.nome || a.name)) || '';
}

function campiDaStampare(m: Record_, tipiDocumento: Tipo[], includiVuoti?: boolean): string[] {
  const tipo = (tipiDocumento || []).find(t => t.id === (m.tipoDocumento || 'manoscritto'));
  const campi: string[] = [];
  const visti = new Set<string>();
  for (const c of (tipo && tipo.campi) || []) {
    if (META.has(c) || visti.has(c)) continue;
    visti.add(c); campi.push(c);
  }
  for (const d of Model.campiPropri(m)) {
    if (META.has(d.id) || visti.has(d.id)) continue;
    visti.add(d.id); campi.push(d.id);
  }
  for (const k of Object.keys(m)) {
    if (META.has(k) || visti.has(k)) continue;
    if (m[k] === '' || m[k] === null || m[k] === undefined) continue;
    if (Array.isArray(m[k]) && m[k].length === 0) continue;
    visti.add(k); campi.push(k);
  }
  const ordinati = Model.ordinaDefinizioni(campi.map((id: string) => ({ id })), m.ordineCampi)
    .map((d: any) => d.id);
  if (includiVuoti) return ordinati;
  return ordinati.filter((c: string) => formattaValoreStampa(c, m[c]).trim() !== '');
}

function testo(opzioni: Opzioni, chiave: string): string {
  const t = opzioni.testi || {};
  return t[chiave] !== undefined ? t[chiave] : TESTI_DEFAULT[chiave] || chiave;
}

function etichetta(opzioni: Opzioni, chiave: string, m?: Record_): string {
  const e = opzioni.etichette || {};
  if (e[chiave]) return e[chiave];
  if (m) {
    for (const d of Model.campiPropri(m)) if (d.id === chiave && d.label) return d.label;
  }
  return chiave;
}

function nomeTipo(opzioni: Opzioni, m: Record_): string {
  const id = m.tipoDocumento || 'manoscritto';
  return (opzioni.nomiTipi || {})[id] || id;
}

function segnaturaDi(m: Record_, opzioni: Opzioni): string {
  const s = String(m.segnatura || '').trim();
  return s || testo(opzioni, 'print_untitled');
}

function frontespizio(records: Record_[], opzioni: Opzioni): string {
  const i = opzioni.intestazione || {};
  const righe: string[] = [];
  if (i.autore) righe.push(`<div class="cover-riga"><span>${escapeHtml(testo(opzioni, 'print_cover_author'))}</span><strong>${escapeHtml(i.autore)}</strong></div>`);
  if (i.data) righe.push(`<div class="cover-riga"><span>${escapeHtml(testo(opzioni, 'print_cover_date'))}</span><strong>${escapeHtml(i.data)}</strong></div>`);
  righe.push(`<div class="cover-riga"><span>${escapeHtml(testo(opzioni, 'print_cover_count'))}</span><strong>${records.length}</strong></div>`);
  return `
  <section class="cover">
    <p class="cover-etichetta">${escapeHtml(testo(opzioni, 'print_cover_fund'))}</p>
    <h1 class="cover-titolo">${escapeHtml(i.fondo || testo(opzioni, 'print_doc_title'))}</h1>
    <div class="cover-dati">${righe.join('')}</div>
  </section>`;
}

function miniatureDi(m: Record_, opzioni: Opzioni): string {
  const mappa = opzioni.miniature || {};
  const allegati = Array.isArray(m.allegati) ? m.allegati : [];
  if (allegati.length === 0) return '';
  const celle = allegati.map((a, i) => {
    const file = fileAllegato(a);
    const src = file && mappa[file];
    const didascalia = escapeHtml(nomeAllegato(a, i));
    const corpo = src
      ? `<img src="${escapeHtml(src)}" alt="${didascalia}">`
      : `<span class="mini-assente"></span>`;
    return `<figure class="mini">${corpo}<figcaption>${didascalia}</figcaption></figure>`;
  }).join('');
  return `<div class="blocco"><h3 class="blocco-titolo">${escapeHtml(testo(opzioni, 'print_section_attachments'))}</h3><div class="miniature">${celle}</div></div>`;
}

function trascrizioneDiRecord(m: Record_): string {
  if (haTesto(m.trascrizione)) return String(m.trascrizione);
  const allegati = Array.isArray(m.allegati) ? m.allegati : [];
  const conTesto = allegati.filter((a: any) => a && haTesto(a.trascrizione));
  if (conTesto.length === 0) return '';
  return conTesto.map((a: any, i: number) => {
    const nome = String(a.originalName || a.nome || a.name || (i + 1));
    const header = conTesto.length > 1 ? `<p class="trasc-carta"><strong>${escapeHtml(nome)}</strong></p>` : '';
    return `${header}<div>${sanificaHtml(a.trascrizione)}</div>`;
  }).join('\n');
}

function schedaSingola(m: Record_, tipiDocumento: Tipo[], opzioni: Opzioni): string {
  const campi = campiDaStampare(m, tipiDocumento, opzioni.includiVuoti);
  const righe = campi.map(c => `
      <div class="campo">
        <div class="campo-etichetta">${escapeHtml(etichetta(opzioni, c, m))}</div>
        <div class="campo-valore">${escapeHtml(formattaValoreStampa(c, m[c])).replace(/\n/g, '<br>')}</div>
      </div>`).join('');

  const intestazioneScheda = `
    <header class="scheda-header">
      <h2 class="scheda-segnatura">${escapeHtml(segnaturaDi(m, opzioni))}</h2>
      <p class="scheda-meta">
        ${escapeHtml(nomeTipo(opzioni, m))}${m.cartella ? ' · ' + escapeHtml(m.cartella) : ''}
        ${tagsDi(m) ? ' · ' + escapeHtml(tagsDi(m)) : ''}
      </p>
    </header>`;

  let trascrizione = '';
  const htmlTrasc = trascrizioneDiRecord(m);
  if (opzioni.includiTrascrizione && haTesto(htmlTrasc)) {
    trascrizione = `<div class="blocco"><h3 class="blocco-titolo">${escapeHtml(testo(opzioni, 'print_section_transcription'))}</h3><div class="trascrizione">${sanificaHtml(htmlTrasc)}</div></div>`;
  }

  return `<article class="scheda">${intestazioneScheda}<div class="campi">${righe}</div>${miniatureDi(m, opzioni)}${trascrizione}</article>`;
}

function rigaRegesto(m: Record_, opzioni: Opzioni): string {
  const date = CAMPI_DATA.map(c => String(m[c] || '').trim()).filter(Boolean).join(', ');
  let sintesi = '';
  for (const c of CAMPI_REGESTO) {
    const v = formattaValoreStampa(c, m[c], undefined, opzioni.testi).trim();
    if (v) { sintesi = v; break; }
  }
  const attori = Array.isArray(m.attori_dinamici) && m.attori_dinamici.length
    ? `<div class="regesto-attori">${escapeHtml(formattaListaDinamica(m.attori_dinamici))}</div>` : '';
  return `
    <div class="regesto-voce">
      <div class="regesto-testa">
        <span class="regesto-segnatura">${escapeHtml(segnaturaDi(m, opzioni))}</span>
        ${date ? `<span class="regesto-data">${escapeHtml(date)}</span>` : ''}
      </div>
      ${sintesi ? `<div class="regesto-sintesi">${escapeHtml(sintesi)}</div>` : ''}
      ${attori}
    </div>`;
}

function colonneTabella(records: Record_[], tipiDocumento: Tipo[], opzioni: Opzioni): string[] {
  const richieste = (opzioni.colonne || []).filter(c => !META.has(c));
  if (richieste.length) return richieste;
  const visti = new Set<string>();
  const campi: string[] = [];
  for (const m of records) {
    for (const c of campiDaStampare(m, tipiDocumento, false)) {
      if (!visti.has(c)) { visti.add(c); campi.push(c); }
    }
  }
  return campi.slice(0, 6);
}

function tabella(records: Record_[], tipiDocumento: Tipo[], opzioni: Opzioni): string {
  const colonne = colonneTabella(records, tipiDocumento, opzioni);
  const th = [testo(opzioni, 'print_field_signature'), ...colonne.map(c => etichetta(opzioni, c))]
    .map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const righe = records.map(m => {
    const celle = colonne.map(c => `<td>${escapeHtml(formattaValoreStampa(c, m[c], undefined, opzioni.testi))}</td>`).join('');
    return `<tr><td class="col-segnatura">${escapeHtml(segnaturaDi(m, opzioni))}</td>${celle}</tr>`;
  }).join('');
  return `<table class="tabella"><thead><tr>${th}</tr></thead><tbody>${righe}</tbody></table>`;
}

function foglioDiStile(opzioni: Opzioni): string {
  return `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #fff; color: #1c1917;
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
    font-size: 10.5pt; line-height: 1.45;
  }
  h1, h2, h3 { margin: 0; font-weight: 600; }
  .cover { height: 96vh; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; }
  .cover-etichetta { margin: 0 0 6mm; font-size: 9pt; letter-spacing: .22em; text-transform: uppercase; color: #78716c; }
  .cover-titolo { font-size: 26pt; line-height: 1.2; margin-bottom: 10mm; }
  .cover-dati { display: inline-flex; flex-direction: column; gap: 2mm; margin: 0 auto; font-size: 10pt; }
  .cover-riga { display: flex; justify-content: space-between; gap: 12mm; border-bottom: .3pt solid #d6d3d1; padding-bottom: 1mm; }
  .cover-riga span { color: #78716c; }

  /* Una scheda per pagina: e' il formato cartaceo di schedatura. L'ultima non forza un
     salto, altrimenti ogni stampa finirebbe con una pagina bianca. */
  .scheda { page-break-after: always; }
  .scheda:last-child { page-break-after: auto; }
  .scheda-header { border-bottom: 1pt solid #1c1917; padding-bottom: 2mm; margin-bottom: 4mm; }
  .scheda-segnatura { font-size: 15pt; }
  .scheda-meta { margin: 1mm 0 0; font-size: 8.5pt; color: #78716c; text-transform: uppercase; letter-spacing: .06em; }
  .campi { display: grid; grid-template-columns: 38mm 1fr; gap: 1.6mm 5mm; }
  .campo { display: contents; }
  .campo-etichetta { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; color: #57534e; padding-top: .4mm; }
  .campo-valore { white-space: pre-wrap; }
  .blocco { margin-top: 6mm; page-break-inside: avoid; }
  .blocco-titolo { font-size: 9pt; text-transform: uppercase; letter-spacing: .12em; color: #57534e; border-bottom: .3pt solid #d6d3d1; padding-bottom: 1mm; margin-bottom: 3mm; }
  /* La trascrizione puo' essere lunghissima: qui il salto di pagina e' AMMESSO, e senza
     orfane e vedove il testo diventa illeggibile fra una pagina e l'altra. */
  .trascrizione { page-break-inside: auto; orphans: 3; widows: 3; }
  .trascrizione p { margin: 0 0 2mm; }
  .ocr-incerto { text-decoration: underline wavy #b45309; text-decoration-skip-ink: none; }
  .ocr-origine { font-size: 8pt; color: #78716c; font-style: italic; }
  .miniature { display: flex; flex-wrap: wrap; gap: 4mm; }
  .mini { margin: 0; width: 44mm; }
  .mini img { width: 100%; height: auto; border: .3pt solid #d6d3d1; }
  .mini-assente { display: block; height: 30mm; border: .3pt dashed #d6d3d1; }
  .mini figcaption { font-size: 7.5pt; color: #78716c; margin-top: 1mm; word-break: break-word; }

  .regesto-voce { page-break-inside: avoid; padding: 2mm 0; border-bottom: .3pt solid #e7e5e4; }
  .regesto-testa { display: flex; justify-content: space-between; gap: 6mm; }
  .regesto-segnatura { font-weight: 600; }
  .regesto-data { color: #57534e; white-space: nowrap; }
  .regesto-sintesi { margin-top: .8mm; }
  .regesto-attori { margin-top: .6mm; font-size: 9pt; color: #57534e; }

  .tabella { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .tabella th { text-align: left; border-bottom: 1pt solid #1c1917; padding: 1.5mm 2mm; text-transform: uppercase; font-size: 7.5pt; letter-spacing: .05em; }
  .tabella td { border-bottom: .3pt solid #e7e5e4; padding: 1.5mm 2mm; vertical-align: top; }
  .tabella tr { page-break-inside: avoid; }
  .col-segnatura { font-weight: 600; white-space: nowrap; }

  .vuoto { color: #78716c; font-style: italic; }
  .titolo-elenco { font-size: 13pt; margin-bottom: 4mm; padding-bottom: 2mm; border-bottom: 1pt solid #1c1917; }
  ${opzioni.orientamento === 'landscape' ? '.campi { grid-template-columns: 34mm 1fr; }' : ''}
  `;
}

function generaHtmlStampa(records: Record_[], tipiDocumento: Tipo[], opzioni: Opzioni = {}): string {
  const layout = opzioni.layout === 'regesto' || opzioni.layout === 'tabella' ? opzioni.layout : 'scheda';
  const lista = Array.isArray(records) ? records : [];

  let corpo: string;
  if (lista.length === 0) {
    corpo = `<p class="vuoto">${escapeHtml(testo(opzioni, 'print_no_records'))}</p>`;
  } else if (layout === 'scheda') {
    corpo = lista.map(m => schedaSingola(m, tipiDocumento || [], opzioni)).join('\n');
  } else {
    const i = opzioni.intestazione || {};
    const titolo = !opzioni.frontespizio && (i.fondo || '').trim()
      ? `<h1 class="titolo-elenco">${escapeHtml(i.fondo)}</h1>` : '';
    corpo = titolo + (layout === 'regesto'
      ? `<div class="regesto">${lista.map(m => rigaRegesto(m, opzioni)).join('')}</div>`
      : tabella(lista, tipiDocumento || [], opzioni));
  }

  const cover = opzioni.frontespizio && lista.length ? frontespizio(lista, opzioni) : '';
  const titoloDocumento = (opzioni.intestazione && opzioni.intestazione.fondo) || testo(opzioni, 'print_doc_title');

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src print-host: data: iiif-img: https:; style-src 'unsafe-inline'">
<title>${escapeHtml(titoloDocumento)}</title>
<style>${foglioDiStile(opzioni)}</style>
</head>
<body>
${cover}
${corpo}
</body>
</html>`;
}

export { generaHtmlStampa, sanificaHtml, formattaValoreStampa, campiDaStampare, colonneTabella, escapeHtml };
