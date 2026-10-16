import { sanificaHtml, escapeHtml } from '../print/printTemplate';

type Record_ = { [k: string]: any };

type Opzioni = {
  formato?: 'html' | 'md' | 'rtf';
  etichette?: { [k: string]: string };
  nomiTipi?: { [k: string]: string };
  intestazione?: boolean;
  intestazioneDocumento?: { fondo?: string; autore?: string; data?: string };
  testi?: { [k: string]: string };
};

const TESTI_DEFAULT: { [k: string]: string } = {
  tx_doc_title: 'Trascrizioni',
  tx_field_folder: 'Archivio',
  tx_field_type: 'Tipo documento',
  tx_field_tags: 'Tag',
  tx_untitled: 'Senza segnatura',
  tx_empty: 'Nessuna trascrizione.',
  tx_ocr_notice: 'Bozza generata da OCR: testo non riletto, i tratti incerti sono segnalati.',
  tx_author: 'Schedatura di',
  tx_date: 'Data'
};

const Model = require('../../shared/model');
const META = new Set(Model.CHIAVI_SERVIZIO);

function haTesto(html: any): boolean {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
}

function daOcr(html: any): boolean {
  return /class\s*=\s*["'][^"']*\bocr-origine\b/i.test(String(html || ''));
}

function carteDiRecord(m: Record_): { nome: string; html: string }[] {
  const allegati = Array.isArray(m.allegati) ? m.allegati : [];
  const conTesto = allegati.filter((a: any) => a && haTesto(a.trascrizione));
  if (conTesto.length > 0) {
    return conTesto.map((a: any, i: number) => ({
      nome: String(a.originalName || a.nome || a.name || (i + 1)),
      html: String(a.trascrizione)
    }));
  }
  return haTesto(m.trascrizione) ? [{ nome: '', html: String(m.trascrizione) }] : [];
}

function etichetta(chiave: string, opzioni: Opzioni, fallback: string): string {
  const e = opzioni.etichette || {};
  return e[chiave] || fallback;
}

function etichettaCampo(chiave: string, opzioni: Opzioni, m?: Record_, fallback?: string): string {
  const e = opzioni.etichette || {};
  if (e[chiave]) return e[chiave];
  if (m) {
    for (const d of Model.campiPropri(m)) if (d.id === chiave && d.label) return d.label;
  }
  return fallback || chiave;
}

function valoreSemplice(v: any): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) {
    return v.map((el) => {
      if (el === null || typeof el !== 'object') return String(el ?? '');
      const k = el.k ?? el.ruolo ?? '';
      const val = el.v ?? el.nome ?? '';
      return k && val ? `${k}: ${val}` : String(k || val || '');
    }).filter(Boolean).join('; ');
  }
  if (typeof v === 'object') return '';
  return String(v);
}

function metadati(m: Record_, opzioni: Opzioni, testi: { [k: string]: string }) {
  const righe: { etichetta: string; valore: string }[] = [];
  const nomiTipi = opzioni.nomiTipi || {};
  const push = (et: string, val: any) => {
    const v = valoreSemplice(val).trim();
    if (v) righe.push({ etichetta: et, valore: v });
  };
  push(etichetta('cartella', opzioni, testi.tx_field_folder || 'Archivio'), m.cartella);
  push(etichetta('tipoDocumento', opzioni, testi.tx_field_type || 'Tipo documento'), nomiTipi[m.tipoDocumento] || m.tipoDocumento);
  push(etichetta('tags', opzioni, testi.tx_field_tags || 'Tag'), Model.tags(m).join(', '));

  const visti = new Set<string>();
  const campi: string[] = [];

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

  for (const c of ordinati) {
    push(etichettaCampo(c, opzioni, m, c), m[c]);
  }

  if (Array.isArray(m.allegati) && m.allegati.length > 0) {
    const lista = m.allegati.map((a: any, i: number) => {
      if (typeof a === 'string') return a;
      const n = (a && (a.originalName || a.nome || a.name)) || String(i + 1);
      return (a && a.remoto) ? `${n} (IIIF)` : n;
    }).filter(Boolean).join('; ');
    if (lista) {
      push(etichetta('allegati', opzioni, testi.tx_field_attachments || 'Allegati'), lista);
    }
  }

  return righe;
}

type Pezzo = { testo: string; b?: boolean; i?: boolean; u?: boolean; s?: boolean; incerto?: boolean; href?: string };
type Blocco = { tipo: string; livello: number; ordinato?: boolean; numero?: number; pezzi: Pezzo[] };

const BLOCCHI = new Set(['p', 'div', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);

function decodificaEntita(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_x, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/gi, '&');
}

function analizzaHtml(html: string): Blocco[] {
  const blocchi: Blocco[] = [];
  const stili: { [k: string]: number } = { b: 0, i: 0, u: 0, s: 0, incerto: 0 };
  const liste: { ordinato: boolean; contatore: number }[] = [];
  let href = '';
  let corrente: Blocco | null = null;

  const apri = (tipo: string, extra: any = {}) => {
    corrente = Object.assign({ tipo, livello: liste.length ? liste.length - 1 : 0, pezzi: [] }, extra) as Blocco;
    blocchi.push(corrente);
  };

  const aggiungiTesto = (grezzo: string, crudo?: boolean) => {
    const t = crudo ? grezzo : decodificaEntita(grezzo).replace(/\s+/g, ' ');
    if (!t) return;
    if (!corrente) apri('p');
    const blocco = corrente as Blocco;
    const stile: Pezzo = {
      testo: t,
      b: stili.b > 0, i: stili.i > 0, u: stili.u > 0, s: stili.s > 0,
      incerto: stili.incerto > 0, href: href || undefined
    };
    const ultimo = blocco.pezzi[blocco.pezzi.length - 1];
    if (ultimo && ultimo.b === stile.b && ultimo.i === stile.i && ultimo.u === stile.u &&
        ultimo.s === stile.s && ultimo.incerto === stile.incerto && ultimo.href === stile.href) {
      ultimo.testo += t;
    } else if (t.trim() || blocco.pezzi.length) {
      blocco.pezzi.push(stile);
    }
  };

  const regex = /<\/?([A-Za-z][A-Za-z0-9]*)\b([^>]*)>/g;
  let cursore = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    if (m.index > cursore) aggiungiTesto(html.slice(cursore, m.index));
    cursore = regex.lastIndex;
    const tag = m[1].toLowerCase();
    const chiusura = m[0][1] === '/';
    const attributi = m[2] || '';
    const classe = (/\bclass\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attributi) || [])[2] || '';

    if (tag === 'br') { aggiungiTesto('\n', true); continue; }
    if (tag === 'hr') { corrente = null; blocchi.push({ tipo: 'hr', livello: 0, pezzi: [] }); continue; }
    if (tag === 'ul' || tag === 'ol') {
      if (chiusura) liste.pop(); else liste.push({ ordinato: tag === 'ol', contatore: 0 });
      corrente = null;
      continue;
    }
    if (BLOCCHI.has(tag)) {
      if (chiusura) { corrente = null; continue; }
      if (tag === 'li') {
        const lista = liste[liste.length - 1];
        if (lista) lista.contatore++;
        apri('li', { ordinato: !!(lista && lista.ordinato), numero: lista ? lista.contatore : 1 });
      } else {
        apri(tag);
      }
      continue;
    }

    const delta = chiusura ? -1 : 1;
    if (tag === 'b' || tag === 'strong') stili.b += delta;
    else if (tag === 'i' || tag === 'em') stili.i += delta;
    else if (tag === 'u') stili.u += delta;
    else if (tag === 's' || tag === 'strike') stili.s += delta;
    else if (tag === 'a') href = chiusura ? '' : ((/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attributi) || [])[2] || '');
    else if (tag === 'span' || tag === 'mark' || tag === 'small') {
      if (!chiusura && /\bocr-incerto\b/.test(classe)) stili.incerto += 1;
      else if (chiusura && stili.incerto > 0) stili.incerto -= 1;
    }
    for (const k of Object.keys(stili)) if (stili[k] < 0) stili[k] = 0;
  }
  if (cursore < html.length) aggiungiTesto(html.slice(cursore));

  return blocchi.filter((b) => b.tipo === 'hr' || b.pezzi.some((p) => p.testo.trim()));
}

function escapeMd(s: string): string {
  return s.replace(/([\\`*_[\]])/g, '\\$1');
}

function pezzoMd(p: Pezzo): string {
  const t = escapeMd(p.testo);
  if (!t.trim()) return t;
  const spazioIniziale = (/^\s+/.exec(t) || [''])[0];
  const spazioFinale = (/\s+$/.exec(t) || [''])[0];
  let nucleo = t.slice(spazioIniziale.length, t.length - spazioFinale.length);
  if (p.incerto) nucleo = nucleo + '\\[?\\]';
  if (p.s) nucleo = '~~' + nucleo + '~~';
  if (p.b) nucleo = '**' + nucleo + '**';
  if (p.i) nucleo = '*' + nucleo + '*';
  if (p.href) nucleo = '[' + nucleo + '](' + p.href.replace(/[()<>\s]/g, encodeURIComponent) + ')';
  return spazioIniziale + nucleo + spazioFinale;
}

function bloccoMd(b: Blocco): string {
  if (b.tipo === 'hr') return '---';
  const testo = b.pezzi.map(pezzoMd).join('').replace(/\n/g, '  \n').trim();
  if (!testo) return '';
  if (/^h[1-6]$/.test(b.tipo)) {
    return '#'.repeat(Math.min(6, Number(b.tipo[1]) + 2)) + ' ' + testo;
  }
  if (b.tipo === 'blockquote') return testo.split('\n').map((r) => '> ' + r).join('\n');
  if (b.tipo === 'li') {
    const rientro = '  '.repeat(b.livello);
    return rientro + (b.ordinato ? `${b.numero}. ` : '- ') + testo.replace(/\n/g, '\n' + rientro + '  ');
  }
  return testo;
}

function corpoMd(html: string): string {
  const blocchi = analizzaHtml(sanificaHtml(html));
  let out = '';
  let precedente = '';
  for (const b of blocchi) {
    const testo = bloccoMd(b);
    if (!testo) continue;
    if (out) out += (precedente === 'li' && b.tipo === 'li') ? '\n' : '\n\n';
    out += testo;
    precedente = b.tipo;
  }
  return out;
}

function escapeRtf(s: string): string {
  let out = '';
  for (const ch of String(s)) {
    if (ch === '\\') { out += '\\\\'; continue; }
    if (ch === '{') { out += '\\{'; continue; }
    if (ch === '}') { out += '\\}'; continue; }
    if (ch === '\n') { out += '\\line '; continue; }
    const cp = ch.codePointAt(0) as number;
    if (cp < 128) { out += ch; continue; }
    for (let i = 0; i < ch.length; i++) {
      let unita = ch.charCodeAt(i);
      if (unita > 32767) unita -= 65536;
      out += '\\u' + unita + '?';
    }
  }
  return out;
}

function pezzoRtf(p: Pezzo): string {
  const apri: string[] = [];
  if (p.b) apri.push('\\b');
  if (p.i) apri.push('\\i');
  if (p.s) apri.push('\\strike');
  if (p.incerto) apri.push('\\ulwave');
  else if (p.u) apri.push('\\ul');
  const testo = escapeRtf(p.testo);
  return apri.length ? '{' + apri.join('') + ' ' + testo + '}' : testo;
}

function bloccoRtf(b: Blocco): string {
  if (b.tipo === 'hr') return '\\pard\\brdrb\\brdrs\\brdrw10\\brsp20\\sa120\\par\\pard\\sa120';
  const testo = b.pezzi.map(pezzoRtf).join('');
  if (!testo.trim()) return '';
  if (/^h[1-6]$/.test(b.tipo)) {
    const dim = Math.max(24, 40 - Number(b.tipo[1]) * 4);
    return `\\pard\\sa120\\keepn{\\b\\fs${dim} ${testo}}\\par`;
  }
  if (b.tipo === 'blockquote') return `\\pard\\li720\\ri720\\sa120{\\i ${testo}}\\par`;
  if (b.tipo === 'li') {
    const rientro = 720 + b.livello * 360;
    const marcatore = b.ordinato ? `${b.numero}.` : '\\bullet';
    return `\\pard\\fi-360\\li${rientro}\\sa60 ${marcatore}\\tab ${testo}\\par`;
  }
  return `\\pard\\sa120\\qj ${testo}\\par`;
}

function corpoRtf(html: string): string {
  return analizzaHtml(sanificaHtml(html)).map(bloccoRtf).filter(Boolean).join('\n');
}

function foglioStile(): string {
  return `
:root { color-scheme: light; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.55;
       max-width: 40em; margin: 2.5em auto; padding: 0 1.5em; color: #1c1917; background: #fff; }
h1 { font-size: 1.5em; margin: 0 0 .2em; }
h2 { font-size: 1.15em; margin: 2em 0 .4em; border-bottom: 1px solid #d6d3d1; padding-bottom: .2em; }
h3 { font-size: 1em; margin: 1.6em 0 .3em; color: #57534e; font-variant: small-caps; letter-spacing: .04em; }
.tx-meta { font-size: .85em; color: #57534e; margin: 0 0 1.2em; }
.tx-meta div { margin: .1em 0; }
.tx-meta b { font-weight: 600; color: #292524; }
.tx-testo p { text-align: justify; margin: 0 0 .7em; }
.tx-nota { font-size: .8em; color: #78716c; border-left: 3px solid #d6d3d1; padding-left: .7em; margin: 0 0 1em; }
.ocr-incerto { text-decoration: underline wavy #b45309; text-underline-offset: 3px; }
.ocr-origine { font-size: .85em; color: #78716c; }
hr { border: 0; border-top: 1px solid #d6d3d1; margin: 2.5em 0; }
@media print { body { margin: 0; max-width: none; } h2 { page-break-before: always; } }
`.trim();
}

function documentoHtml(records: Record_[], opzioni: Opzioni, testi: { [k: string]: string }): string {
  const intest = opzioni.intestazioneDocumento || {};
  const titolo = intest.fondo || testi.tx_doc_title;
  const parti: string[] = [`<h1>${escapeHtml(titolo)}</h1>`];
  const sotto: string[] = [];
  if (intest.autore) sotto.push(`${escapeHtml(testi.tx_author)}: ${escapeHtml(intest.autore)}`);
  if (intest.data) sotto.push(`${escapeHtml(testi.tx_date)}: ${escapeHtml(intest.data)}`);
  if (sotto.length) parti.push(`<p class="tx-meta">${sotto.join(' — ')}</p>`);

  for (const m of records) {
    parti.push(`<h2>${escapeHtml(m.segnatura || testi.tx_untitled)}</h2>`);
    if (opzioni.intestazione !== false) {
      const righe = metadati(m, opzioni, testi)
        .map((r) => `<div><b>${escapeHtml(r.etichetta)}:</b> ${escapeHtml(r.valore)}</div>`);
      if (righe.length) parti.push(`<div class="tx-meta">${righe.join('')}</div>`);
    }
    const carte = carteDiRecord(m);
    if (carte.length === 0) { parti.push(`<p class="tx-nota">${escapeHtml(testi.tx_empty)}</p>`); continue; }
    for (const carta of carte) {
      if (carta.nome && carte.length > 1) parti.push(`<h3>${escapeHtml(carta.nome)}</h3>`);
      if (daOcr(carta.html)) parti.push(`<p class="tx-nota">${escapeHtml(testi.tx_ocr_notice)}</p>`);
      parti.push(`<div class="tx-testo">${sanificaHtml(carta.html)}</div>`);
    }
  }

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(titolo)}</title>
<style>${foglioStile()}</style>
</head>
<body>
${parti.join('\n')}
</body>
</html>
`;
}

function documentoMd(records: Record_[], opzioni: Opzioni, testi: { [k: string]: string }): string {
  const intest = opzioni.intestazioneDocumento || {};
  const parti: string[] = [`# ${intest.fondo || testi.tx_doc_title}`];
  const sotto: string[] = [];
  if (intest.autore) sotto.push(`*${testi.tx_author}: ${intest.autore}*`);
  if (intest.data) sotto.push(`*${testi.tx_date}: ${intest.data}*`);
  if (sotto.length) parti.push(sotto.join(' — '));

  for (const m of records) {
    parti.push(`## ${m.segnatura || testi.tx_untitled}`);
    if (opzioni.intestazione !== false) {
      const righe = metadati(m, opzioni, testi).map((r) => `- **${r.etichetta}:** ${r.valore}`);
      if (righe.length) parti.push(righe.join('\n'));
    }
    const carte = carteDiRecord(m);
    if (carte.length === 0) { parti.push(`*${testi.tx_empty}*`); continue; }
    for (const carta of carte) {
      if (carta.nome && carte.length > 1) parti.push(`### ${carta.nome}`);
      if (daOcr(carta.html)) parti.push(`> ${testi.tx_ocr_notice}`);
      const corpo = corpoMd(carta.html);
      if (corpo) parti.push(corpo);
    }
  }
  return parti.join('\n\n') + '\n';
}

function documentoRtf(records: Record_[], opzioni: Opzioni, testi: { [k: string]: string }): string {
  const intest = opzioni.intestazioneDocumento || {};
  const parti: string[] = [
    `\\pard\\qc\\sa240{\\b\\fs36 ${escapeRtf(intest.fondo || testi.tx_doc_title)}}\\par`
  ];
  const sotto: string[] = [];
  if (intest.autore) sotto.push(`${testi.tx_author}: ${intest.autore}`);
  if (intest.data) sotto.push(`${testi.tx_date}: ${intest.data}`);
  if (sotto.length) parti.push(`\\pard\\qc\\sa240{\\i\\fs20 ${escapeRtf(sotto.join(' — '))}}\\par`);

  records.forEach((m, indice) => {
    if (indice > 0) parti.push('\\page');
    parti.push(`\\pard\\sa120\\keepn{\\b\\fs30 ${escapeRtf(m.segnatura || testi.tx_untitled)}}\\par`);
    if (opzioni.intestazione !== false) {
      for (const r of metadati(m, opzioni, testi)) {
        parti.push(`\\pard\\sa20{\\fs18{\\b ${escapeRtf(r.etichetta)}: }${escapeRtf(r.valore)}}\\par`);
      }
    }
    const carte = carteDiRecord(m);
    if (carte.length === 0) { parti.push(`\\pard\\sa120{\\i ${escapeRtf(testi.tx_empty)}}\\par`); return; }
    for (const carta of carte) {
      if (carta.nome && carte.length > 1) {
        parti.push(`\\pard\\sa100\\keepn{\\b\\scaps ${escapeRtf(carta.nome)}}\\par`);
      }
      if (daOcr(carta.html)) parti.push(`\\pard\\sa120{\\i\\fs18 ${escapeRtf(testi.tx_ocr_notice)}}\\par`);
      const corpo = corpoRtf(carta.html);
      if (corpo) parti.push(corpo);
    }
  });

  return '{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}}\n' +
    '\\paperw11906\\paperh16838\\margl1418\\margr1418\\margt1418\\margb1418\\fs24\n' +
    parti.join('\n') + '\n}';
}

const ESTENSIONI: { [k: string]: string } = { html: 'html', md: 'md', rtf: 'rtf' };

function generaEsportazioneTrascrizione(records: Record_[], opzioni: Opzioni = {}) {
  const formato = ESTENSIONI[String(opzioni.formato)] ? String(opzioni.formato) : 'html';
  const testi = Object.assign({}, TESTI_DEFAULT, opzioni.testi || {});
  const lista = Array.isArray(records) ? records : [];
  const contenuto = formato === 'md'
    ? documentoMd(lista, opzioni, testi)
    : formato === 'rtf'
      ? documentoRtf(lista, opzioni, testi)
      : documentoHtml(lista, opzioni, testi);
  return { contenuto, estensione: ESTENSIONI[formato] };
}

export { generaEsportazioneTrascrizione, analizzaHtml, corpoMd, corpoRtf, escapeRtf, escapeMd, carteDiRecord, daOcr };
