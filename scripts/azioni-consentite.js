// Registro chiuso delle azioni (S2 in REVIEW-SECURITY.md).
//
// Il dispatcher di logic/azioni.ts chiama per nome solo le funzioni elencate in
// logic/azioniConsentite.ts. L'elenco si ricava dai sorgenti: ogni nome che compare in un
// data-on-<evento>="…", in window.azione('<evento>', '…') o come argomento delle azioni che
// ricevono un nome (suInvio, inSequenza, seEsiste, fermaEChiama).
//
//   node scripts/azioni-consentite.js           verifica (esce con 1 se il file è da rigenerare)
//   node scripts/azioni-consentite.js --scrivi  rigenera logic/azioniConsentite.ts
//
// test/azioniConsentite.test.js usa `estraiNomi` per tenere il file allineato ai template.
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const RENDERER = path.join(RADICE, 'src', 'renderer');
const FILE_REGISTRO = path.join(RENDERER, 'js', 'logic', 'azioniConsentite.ts');

/** Azioni del registro AZIONI che ricevono il nome di una funzione globale come argomento. */
const META = new Set(['suInvio', 'inSequenza', 'seEsiste', 'fermaEChiama']);
const IDENT = /^[A-Za-z_$][\w$]*$/;

function sorgenti(dir, out = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name !== 'vendor' && voce.name !== 'locales') sorgenti(p, out);
    } else if (/\.(ts|html)$/.test(voce.name) && p !== FILE_REGISTRO) {
      out.push(p);
    }
  }
  return out;
}

/** Testo fra le parentesi bilanciate che si aprono in `inizio` (indice della "("). */
function argomentiChiamata(s, inizio) {
  let livello = 0;
  let quote = null;
  for (let i = inizio; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') livello++;
    else if (c === ')' && --livello === 0) return s.slice(inizio + 1, i);
  }
  return '';
}

/** Letterali stringa di primo livello, nell'ordine: ['click', 'fermaEChiama', 'selectItem', …]. */
function letteraliStringa(argomenti) {
  const out = [];
  const re = /'([^'\\]*)'|"([^"\\]*)"/g;
  let m;
  while ((m = re.exec(argomenti))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

const decodifica = (s) => s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');

function aggiungiDaMeta(nomi, meta, argomenti, file) {
  // inSequenza: ogni argomento è un nome; le altre: il primo.
  const candidati = meta === 'inSequenza' ? argomenti : argomenti.slice(0, 1);
  for (const a of candidati) if (typeof a === 'string' && IDENT.test(a)) nomi.set(a, file);
}

/** Map nome → primo file in cui compare. */
function estraiNomi() {
  const nomi = new Map();
  for (const file of sorgenti(RENDERER)) {
    const s = fs.readFileSync(file, 'utf8');
    const rel = path.relative(RADICE, file).replace(/\\/g, '/');

    // window.azione('click', 'nome', ...args)
    let i = -1;
    while ((i = s.indexOf('azione(', i + 1)) !== -1) {
      if (/[\w$]/.test(s[i - 1] || '')) continue; // es. "eseguiAzione("
      const lett = letteraliStringa(argomentiChiamata(s, i + 'azione'.length));
      if (lett.length < 2 || !IDENT.test(lett[1])) continue;
      if (META.has(lett[1])) aggiungiDaMeta(nomi, lett[1], lett.slice(2), rel);
      else nomi.set(lett[1], rel);
    }

    // data-on-click="nome" data-args-click="[…]" scritti a mano
    const re = /data-on-([a-z]+)="([^"$]+)"/g;
    let m;
    while ((m = re.exec(s))) {
      const [, tipo, nome] = m;
      if (!META.has(nome)) { nomi.set(nome, rel); continue; }
      const args = new RegExp(`data-args-${tipo}="([^"]*)"`).exec(s.slice(m.index, m.index + 600));
      if (!args) continue;
      try { aggiungiDaMeta(nomi, nome, JSON.parse(decodifica(args[1])), rel); } catch { /* segnaposto non JSON */ }
    }
  }
  return nomi;
}

function generaRegistro(nomi) {
  const elenco = [...nomi.keys()].filter((n) => !META.has(n)).sort();
  return `// GENERATO da scripts/azioni-consentite.js (--scrivi): non modificare a mano.
//
// Funzioni globali che il dispatcher di logic/azioni.ts può chiamare per nome da un attributo
// data-on-<evento>. Un nome fuori elenco non viene eseguito: così un attributo finito nel DOM
// da un dato (vault condiviso, import) non può chiamare funzioni che nessun pulsante usa.
// test/azioniConsentite.test.js fallisce se un template usa un nome assente da qui.

const AZIONI_CONSENTITE: ReadonlySet<string> = new Set([
${elenco.map((n) => `    '${n}',`).join('\n')}
]);
`;
}

if (require.main === module) {
  const atteso = generaRegistro(estraiNomi());
  const attuale = fs.existsSync(FILE_REGISTRO) ? fs.readFileSync(FILE_REGISTRO, 'utf8') : '';
  if (process.argv.includes('--scrivi')) {
    fs.writeFileSync(FILE_REGISTRO, atteso);
    console.log(`[azioni-consentite] scritto ${path.relative(RADICE, FILE_REGISTRO)}`);
  } else if (attuale !== atteso) {
    console.error('[azioni-consentite] registro non allineato: node scripts/azioni-consentite.js --scrivi');
    process.exit(1);
  } else {
    console.log('[azioni-consentite] registro allineato');
  }
}

module.exports = { estraiNomi, generaRegistro, FILE_REGISTRO, META };
