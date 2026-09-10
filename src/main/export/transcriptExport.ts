// Fase 2.5 — Esportazione della trascrizione (HTML autonomo, Markdown, RTF).
//
// Modulo PURO come `csvExport.ts` (2.1) e `printTemplate.ts` (2.2): nessun `fs`, nessun
// Electron, nessuna rete. Riceve i record e restituisce una stringa. Chi tocca il disco è
// `ipc/textExportIpc.ts`. La ragione è sempre la stessa: la parte che si può sbagliare —
// conversione dei tag, escaping RTF, marcatura delle bozze OCR — si esercita a freddo con
// `node` (`test/transcriptExport.test.js`).
//
// ⚠️ La sanificazione NON viene riscritta: si riusa `sanificaHtml` di printTemplate. Due
// whitelist per lo stesso contenuto non fidato divergerebbero alla prima aggiunta, e la
// copia dimenticata sarebbe quella con il buco.
//
// ⚠️ Il main non conosce la i18n: etichette e testi fissi arrivano dal renderer.

const { sanificaHtml, escapeHtml } = require('../print/printTemplate');

type Record_ = { [k: string]: any };

type Opzioni = {
  formato?: 'html' | 'md' | 'rtf';
  etichette?: { [k: string]: string };
  nomiTipi?: { [k: string]: string };
  /** Blocco di metadati sopra ogni trascrizione (segnatura, archivio, date…). */
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

// I campi che accompagnano la segnatura in testa alla trascrizione, nell'ordine in cui un
// archivista li legge. Non è l'elenco completo della scheda: quello è la stampa (2.2) o il
// CSV (2.1). Qui l'oggetto è il TESTO, e l'intestazione serve solo a dire di che carta si
// tratta — un export che ripete tutti i campi seppellisce la trascrizione.
const CAMPI_INTESTAZIONE = ['dataCronica', 'dataTopica', 'autore', 'Notaio', 'titolo'];

function haTesto(html: any): boolean {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
}

/** Una bozza OCR porta con sé `<p class="ocr-origine">`: è la firma lasciata dalla 2.3. */
function daOcr(html: any): boolean {
  return /class\s*=\s*["'][^"']*\bocr-origine\b/i.test(String(html || ''));
}

/**
 * Le carte con testo, in ordine. Dalla 2.3-bis il testo vive in `m.allegati[i].trascrizione`
 * e `m.trascrizione` è la concatenazione derivata: leggere la seconda darebbe le
 * intestazioni delle carte duplicate. La forma vecchia resta il fallback per i record che
 * non sono ancora passati dall'editor.
 */
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

/** Le righe dell'intestazione: solo quelle valorizzate — un campo vuoto è rumore. */
function metadati(m: Record_, opzioni: Opzioni, testi: { [k: string]: string }) {
  const righe: { etichetta: string; valore: string }[] = [];
  const nomiTipi = opzioni.nomiTipi || {};
  const push = (et: string, val: any) => {
    const v = valoreSemplice(val).trim();
    if (v) righe.push({ etichetta: et, valore: v });
  };
  push(etichetta('cartella', opzioni, testi.tx_field_folder), m.cartella);
  push(etichetta('tipoDocumento', opzioni, testi.tx_field_type), nomiTipi[m.tipoDocumento] || m.tipoDocumento);
  for (const c of CAMPI_INTESTAZIONE) push(etichetta(c, opzioni, c), m[c]);
  // Fase 3.4: la stringa CSV non si stampa grezza — spazi doppi e voci vuote comprese.
  push(etichetta('tags', opzioni, testi.tx_field_tags), require('../../shared/model').tags(m).join(', '));
  return righe;
}

// --- Analisi dell'HTML della trascrizione ------------------------------------
//
// L'HTML sanificato viene ridotto a BLOCCHI con dentro pezzi di testo e i loro stili. È il
// passaggio che permette a Markdown e RTF di condividere l'interpretazione del documento:
// due parser separati risponderebbero in modo diverso alla stessa lista annidata, e la
// differenza salterebbe fuori solo sul testo di qualcun altro.

type Pezzo = { testo: string; b?: boolean; i?: boolean; u?: boolean; s?: boolean; incerto?: boolean; href?: string };
type Blocco = { tipo: string; livello: number; ordinato?: boolean; numero?: number; pezzi: Pezzo[] };

const BLOCCHI = new Set(['p', 'div', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);

function decodificaEntita(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_x, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/gi, '&');   // per ultimo: `&amp;lt;` deve restare `&lt;`
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

  // `crudo` distingue il testo del documento — dove ogni sequenza di spazi, tabulazioni e
  // a capo del SORGENTE vale un solo spazio, come in HTML — dall'interruzione vera del
  // <br>, che è l'unica cosa che può produrre un a capo. Senza la distinzione, l'HTML
  // indentato dell'editor diventerebbe un testo a righe spezzate a caso.
  const aggiungiTesto = (grezzo: string, crudo?: boolean) => {
    const t = crudo ? grezzo : decodificaEntita(grezzo).replace(/\s+/g, ' ');
    if (!t) return;
    if (!corrente) apri('p');   // un contenteditable non garantisce il <p> attorno al testo
    const blocco = corrente as Blocco;
    const stile: Pezzo = {
      testo: t,
      b: stili.b > 0, i: stili.i > 0, u: stili.u > 0, s: stili.s > 0,
      incerto: stili.incerto > 0, href: href || undefined
    };
    const ultimo = blocco.pezzi[blocco.pezzi.length - 1];
    // Pezzi contigui con lo stesso stile si fondono: senza, in Markdown si otterrebbe
    // `**a****b**`, che nessun renderer interpreta come un unico grassetto.
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

    // Inline: contatori e non booleani, perché `<b><b>x</b></b>` non deve chiudere al primo.
    const delta = chiusura ? -1 : 1;
    if (tag === 'b' || tag === 'strong') stili.b += delta;
    else if (tag === 'i' || tag === 'em') stili.i += delta;
    else if (tag === 'u') stili.u += delta;
    else if (tag === 's' || tag === 'strike') stili.s += delta;
    else if (tag === 'a') href = chiusura ? '' : ((/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attributi) || [])[2] || '');
    else if (tag === 'span' || tag === 'mark' || tag === 'small') {
      // La chiusura di uno span non porta la classe: si chiude l'incertezza aperta. È il
      // motivo per cui `incerto` è un contatore e non un flag.
      if (!chiusura && /\bocr-incerto\b/.test(classe)) stili.incerto += 1;
      else if (chiusura && stili.incerto > 0) stili.incerto -= 1;
    }
    for (const k of Object.keys(stili)) if (stili[k] < 0) stili[k] = 0;
  }
  if (cursore < html.length) aggiungiTesto(html.slice(cursore));

  return blocchi.filter((b) => b.tipo === 'hr' || b.pezzi.some((p) => p.testo.trim()));
}

// --- Markdown ----------------------------------------------------------------

/** Escaping minimo: il testo di una trascrizione è pieno di parentesi quadre editoriali. */
function escapeMd(s: string): string {
  return s.replace(/([\\`*_[\]])/g, '\\$1');
}

function pezzoMd(p: Pezzo): string {
  const t = escapeMd(p.testo);
  if (!t.trim()) return t;
  const spazioIniziale = (/^\s+/.exec(t) || [''])[0];
  const spazioFinale = (/\s+$/.exec(t) || [''])[0];
  let nucleo = t.slice(spazioIniziale.length, t.length - spazioFinale.length);
  // L'incertezza dell'OCR è marcata `[?]`, la convenzione filologica per una lettura dubbia.
  // Perderla significherebbe consegnare una bozza come se fosse una lettura.
  if (p.incerto) nucleo = nucleo + '\\[?\\]';
  if (p.s) nucleo = '~~' + nucleo + '~~';
  if (p.b) nucleo = '**' + nucleo + '**';
  if (p.i) nucleo = '*' + nucleo + '*';
  if (p.href) nucleo = '[' + nucleo + '](' + p.href.replace(/[()<>\s]/g, encodeURIComponent) + ')';
  return spazioIniziale + nucleo + spazioFinale;
}

function bloccoMd(b: Blocco): string {
  if (b.tipo === 'hr') return '---';
  // Due spazi prima dell'a capo: è l'interruzione di riga di Markdown. Senza, un <br> in
  // mezzo a un verso sparirebbe e due righe diventerebbero un unico periodo.
  const testo = b.pezzi.map(pezzoMd).join('').replace(/\n/g, '  \n').trim();
  if (!testo) return '';
  if (/^h[1-6]$/.test(b.tipo)) {
    // I titoli della trascrizione scendono di due livelli: `#` è il documento e `##` la
    // scheda, quindi un <h1> dell'editor non può competere con la segnatura.
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
    // Voci di lista consecutive separate da UNA riga: la riga bianca ne farebbe una "loose
    // list", che i renderer impaginano con un paragrafo per voce — un elenco di testimoni
    // diventerebbe una pagina di paragrafi staccati.
    if (out) out += (precedente === 'li' && b.tipo === 'li') ? '\n' : '\n\n';
    out += testo;
    precedente = b.tipo;
  }
  return out;
}

// --- RTF ---------------------------------------------------------------------

/**
 * Escaping RTF. I caratteri fuori ASCII diventano `\uN?`: è l'unica forma che Word,
 * LibreOffice e TextEdit leggono allo stesso modo, e in una trascrizione i caratteri fuori
 * ASCII sono la norma (æ, œ, ſ, accenti, virgolette basse).
 * Le unità UTF-16 sopra 32767 vanno emesse NEGATIVE: l'argomento di `\u` è un intero a 16
 * bit con segno, e un valore positivo fuori range fa scrivere a Word un carattere a caso.
 */
function escapeRtf(s: string): string {
  let out = '';
  for (const ch of String(s)) {
    if (ch === '\\') { out += '\\\\'; continue; }
    if (ch === '{') { out += '\\{'; continue; }
    if (ch === '}') { out += '\\}'; continue; }
    if (ch === '\n') { out += '\\line '; continue; }
    const cp = ch.codePointAt(0) as number;
    if (cp < 128) { out += ch; continue; }
    // Fuori dal BMP: due unità surrogate, ciascuna con la sua `\u`.
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
  // Sottolineatura ondulata per l'incertezza OCR, continua per quella dell'utente: in RTF
  // sono due comandi distinti, e sulla carta la differenza si vede.
  if (p.incerto) apri.push('\\ulwave');
  else if (p.u) apri.push('\\ul');
  const testo = escapeRtf(p.testo);
  // Gruppo `{…}` e non coppie di toggle: la formattazione non può sopravvivere alla fine
  // del pezzo nemmeno se l'HTML di partenza aveva i tag sbilanciati.
  return apri.length ? '{' + apri.join('') + ' ' + testo + '}' : testo;
}

function bloccoRtf(b: Blocco): string {
  if (b.tipo === 'hr') return '\\pard\\brdrb\\brdrs\\brdrw10\\brsp20\\sa120\\par\\pard\\sa120';
  const testo = b.pezzi.map(pezzoRtf).join('');
  if (!testo.trim()) return '';
  if (/^h[1-6]$/.test(b.tipo)) {
    const dim = Math.max(24, 40 - Number(b.tipo[1]) * 4);   // mezzi punti
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

// --- Documento ---------------------------------------------------------------

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

  // CSP `default-src 'none'`: il file finisce per posta o in un repository e viene aperto in
  // un browser. La trascrizione è contenuto non fidato (arriva dal sync, cioè da un'altra
  // macchina): la whitelist di `sanificaHtml` è la prima difesa, questa la seconda.
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
    // Ogni scheda comincia a pagina nuova: è un fascicolo di trascrizioni, non un testo
    // continuo, e chi lo stampa vuole poter staccare la carta che gli serve.
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

/**
 * @returns `{ contenuto, estensione }`. Un record senza trascrizione NON viene saltato in
 * silenzio: compare con la sua intestazione e la nota "Nessuna trascrizione", perché un
 * export che perde per strada tre schede su venti senza dirlo è peggio di uno vuoto.
 */
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

module.exports = {
  generaEsportazioneTrascrizione,
  analizzaHtml, corpoMd, corpoRtf, escapeRtf, escapeMd, carteDiRecord, daOcr
};
export {};
