const SOGLIA_CONFIDENZA = 70;

function rigaEScarto(riga) {
  const t = (riga && riga.text ? String(riga.text) : '').trim();
  if (!t) return true;
  const haLettere = /\p{L}/u.test(t);
  if (!haLettere && t.length <= 3) return true;
  const conf = typeof riga.confidence === 'number' ? riga.confidence : 100;
  return !haLettere && conf < 50;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizzaRiga(testo) {
  const s = String(testo == null ? '' : testo);
  let out = '';
  let spazioPendente = false;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const eControllo = (c < 0x20 && c !== 0x09) || c === 0x7f || (c >= 0x80 && c <= 0x9f);
    const eInvisibile = c === 0xad || c === 0x200b || c === 0xfeff;
    const eSpazio = c === 0x09 || c === 0x20 || c === 0xa0 || (c >= 0x2000 && c <= 0x200a) || c === 0x202f || c === 0x205f;
    if (eControllo || eInvisibile) continue;
    if (eSpazio) { spazioPendente = out.length > 0; continue; }
    if (spazioPendente) { out += ' '; spazioPendente = false; }
    out += ch;
  }
  return out;
}

function unisciSillabazione(righe) {
  const lavoro = (righe || []).slice();
  const out: any[] = [];
  for (let i = 0; i < lavoro.length; i++) {
    const corrente = lavoro[i];
    const m = /^(.*\p{L})[-‐‑]$/u.exec(corrente);
    const succ = lavoro[i + 1];
    if (m && succ && /^\p{Ll}/u.test(succ)) {
      lavoro[i + 1] = m[1] + succ;
      continue;
    }
    out.push(corrente);
  }
  return out;
}

function raggruppaParagrafi(righe) {
  const paragrafi: string[][] = [];
  let corrente: string[] = [];
  for (const r of righe || []) {
    if (!r) {
      if (corrente.length) { paragrafi.push(corrente); corrente = []; }
      continue;
    }
    corrente.push(r);
  }
  if (corrente.length) paragrafi.push(corrente);
  return paragrafi;
}

function righeNormalizzate(righe) {
  const grezze = (righe || []).map((r) => {
    const oggetto = typeof r === 'string' ? { text: r } : r;
    return rigaEScarto(oggetto) ? '' : normalizzaRiga(oggetto.text);
  });
  return unisciSillabazione(grezze);
}

function testoOcrPiano(righe) {
  const paragrafi = raggruppaParagrafi(righeNormalizzate(righe));
  return paragrafi.map(p => p.join(' ')).join('\n\n');
}

function confidenzaMedia(righe) {
  let peso = 0;
  let somma = 0;
  for (const r of righe || []) {
    if (typeof r === 'string' || !r) continue;
    const t = normalizzaRiga(r.text);
    if (!t) continue;
    const c = typeof r.confidence === 'number' ? r.confidence : 0;
    peso += t.length;
    somma += c * t.length;
  }
  if (!peso) return 0;
  return Math.round((somma / peso) * 10) / 10;
}

function confidenzePerParola(righe) {
  const parole = new Map();
  for (const r of righe || []) {
    if (typeof r === 'string' || !r || !Array.isArray(r.words)) continue;
    for (const w of r.words) {
      const t = normalizzaRiga(w && w.text);
      if (!t) continue;
      const c = typeof w.confidence === 'number' ? w.confidence : 100;
      if (!parole.has(t) || parole.get(t) > c) parole.set(t, c);
    }
  }
  return parole;
}

function testoOcrInHtml(righe, opzioni?) {
  const o = opzioni || {};
  const soglia = typeof o.soglia === 'number' ? o.soglia : SOGLIA_CONFIDENZA;
  const paragrafi = raggruppaParagrafi(righeNormalizzate(righe));
  const parole = confidenzePerParola(righe);

  const parti: string[] = [];
  if (o.intestazione) {
    parti.push('<p class="ocr-origine"><em>' + escapeHtml(o.intestazione) + '</em></p>');
  }

  for (const p of paragrafi) {
    const marcato = p.join(' ').split(' ').map((tok) => {
      const conf = parole.has(tok) ? parole.get(tok) : 100;
      const esc = escapeHtml(tok);
      if (conf >= soglia) return esc;
      return '<span class="ocr-incerto" title="OCR ' + Math.round(conf) + '%">' + esc + '</span>';
    }).join(' ');
    parti.push('<p>' + marcato + '</p>');
  }

  if (parti.length === 0 || paragrafi.length === 0) parti.push('<p><br></p>');
  return parti.join('\n');
}

function unisciPagine(pagine, etichettaPagina?) {
  const et = etichettaPagina || function (n) { return 'p. ' + n; };
  const piano: string[] = [];
  const html: string[] = [];
  for (const pg of pagine || []) {
    const t = testoOcrPiano(pg.righe);
    if (!t) continue;
    const nome = et(pg.numero);
    piano.push('[' + nome + ']\n' + t);
    html.push('<p class="ocr-pagina"><strong>[' + escapeHtml(nome) + ']</strong></p>');
    html.push(testoOcrInHtml(pg.righe, { soglia: SOGLIA_CONFIDENZA }));
  }
  return { piano: piano.join('\n\n'), html: html.join('\n') };
}

export { SOGLIA_CONFIDENZA, normalizzaRiga, unisciSillabazione, raggruppaParagrafi, righeNormalizzate, testoOcrPiano, testoOcrInHtml, confidenzaMedia, confidenzePerParola, unisciPagine };
