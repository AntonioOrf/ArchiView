// Post-processing del testo riconosciuto (Fase 2.3).
//
// Modulo PURO: nessun `fs`, nessun Electron, nessuna dipendenza da tesseract. Prende le righe
// così come le restituisce il motore e produce le due forme che servono all'applicazione:
// il testo piano da indicizzare e l'HTML della bozza di trascrizione. Sta separato per lo
// stesso motivo di `csvExport.ts` (Fase 2.1): è l'unica parte dell'OCR che si può esercitare
// senza avviare Electron, e `test/ocrText.test.js` lo fa sul sorgente reale.

/** Soglia sotto la quale una parola è "incerta" e va segnalata all'utente nella bozza. */
const SOGLIA_CONFIDENZA = 70;

/**
 * Una riga senza caratteri alfabetici e con confidenza bassa è quasi sempre sporcizia del
 * bordo della carta (piegature, ombre, buchi di rilegatura). Tenerla significa consegnare
 * al ricercatore una bozza da ripulire prima ancora di poterla leggere.
 */
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

/**
 * Normalizza una riga di OCR.
 *
 * Tesseract emette caratteri di controllo e soft hyphen: invisibili a schermo, ma spezzano
 * le ricerche e sporcano l'export di chi porta la trascrizione fuori dall'app. Le virgolette
 * tipografiche restano invece com'erano: su un'edizione la forma del segno può contare.
 */
function normalizzaRiga(testo) {
  const s = String(testo == null ? '' : testo);
  let out = '';
  let spazioPendente = false;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    // Controlli C0/C1, soft hyphen e i vari separatori invisibili: si buttano o
    // diventano uno spazio normale. Scritto a codepoint e non con una regex di
    // caratteri letterali perché in sorgente quei byte sono invisibili e la prima
    // riformattazione del file li perde senza che nessun test se ne accorga.
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

/**
 * Ricompone le parole spezzate a fine riga.
 *
 * Sulla pagina a stampa la sillabazione è ovunque, e senza questo passaggio l'indice di
 * ricerca contiene `conven-` e `zione` invece di `convenzione`: la parola cercata non si
 * trova proprio nel documento in cui è scritta. Si unisce SOLO quando la riga seguente
 * comincia in minuscolo — se comincia per maiuscola il trattino è quasi sempre un vero
 * trattino (nomi doppi, segnature, numeri d'inventario) e unire distruggerebbe il testo.
 */
function unisciSillabazione(righe) {
  const lavoro = (righe || []).slice();
  const out = [];
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

/**
 * Raggruppa le righe in paragrafi. Una riga vuota chiude il paragrafo; dentro il paragrafo
 * le righe sono unite da uno spazio. L'a capo tipografico di una scansione non è un a capo
 * del testo: conservarlo produrrebbe una trascrizione con la giustezza della pagina
 * originale, cioè illeggibile appena si cambia la larghezza della finestra.
 */
function raggruppaParagrafi(righe) {
  const paragrafi = [];
  let corrente = [];
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

/**
 * Righe del motore → righe di testo pulite. La forma attesa è quella di tesseract.js
 * (`{text, confidence, words:[{text, confidence}]}`), ma sono accettate anche stringhe
 * nude: così il modulo resta utilizzabile con qualsiasi motore, HTR remoto incluso (5.6).
 */
function righeNormalizzate(righe) {
  // Le righe di scarto diventano stringa vuota invece di sparire: `raggruppaParagrafi` legge
  // il vuoto come fine paragrafo, e senza questo passaggio l'intera pagina uscirebbe come un
  // unico blocco: proprio ciò che rende illeggibile la bozza di un atto con più partizioni.
  const grezze = (righe || []).map((r) => {
    const oggetto = typeof r === 'string' ? { text: r } : r;
    return rigaEScarto(oggetto) ? '' : normalizzaRiga(oggetto.text);
  });
  return unisciSillabazione(grezze);
}

/** Testo piano: quello che finisce nel campo dell'allegato e nell'indice di ricerca. */
function testoOcrPiano(righe) {
  const paragrafi = raggruppaParagrafi(righeNormalizzate(righe));
  return paragrafi.map(p => p.join(' ')).join('\n\n');
}

/**
 * Confidenza media pesata sul numero di caratteri: una riga di due lettere non deve pesare
 * quanto una riga intera, altrimenti il numero mostrato all'utente dice poco.
 */
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

/** Mappa parola → confidenza peggiore osservata. La peggiore, perché è quella da controllare. */
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

/**
 * Bozza HTML per l'editor di trascrizione.
 *
 * Le parole sotto soglia sono avvolte in `<span class="ocr-incerto">`: è il punto della
 * feature. Una bozza che non distingue ciò che il motore ha letto bene da ciò che ha tirato
 * a indovinare è una trascrizione falsamente autorevole, e l'errore finirebbe citato.
 *
 * L'intestazione di provenienza (motore, lingua, data) è un `<p class="ocr-origine">` e
 * resta nel testo salvato: chi riapre la scheda fra un anno deve sapere che quel testo non
 * l'ha battuto nessuno.
 */
function testoOcrInHtml(righe, opzioni) {
  const o = opzioni || {};
  const soglia = typeof o.soglia === 'number' ? o.soglia : SOGLIA_CONFIDENZA;
  const paragrafi = raggruppaParagrafi(righeNormalizzate(righe));
  const parole = confidenzePerParola(righe);

  const parti = [];
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

/**
 * Unisce i risultati di più pagine in un solo blocco, con il numero di pagina in testa a
 * ciascuna. Il numero va conservato: senza, una trascrizione di trenta carte non è più
 * riconducibile all'immagine da cui viene, ed è il primo dato che serve per il controllo.
 */
function unisciPagine(pagine, etichettaPagina) {
  const et = etichettaPagina || function (n) { return 'p. ' + n; };
  const piano = [];
  const html = [];
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

module.exports = {
  SOGLIA_CONFIDENZA,
  normalizzaRiga,
  unisciSillabazione,
  raggruppaParagrafi,
  righeNormalizzate,
  testoOcrPiano,
  testoOcrInHtml,
  confidenzaMedia,
  confidenzePerParola,
  unisciPagine
};
export {};
