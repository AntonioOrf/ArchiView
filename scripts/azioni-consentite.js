const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const RENDERER = path.join(RADICE, 'src', 'renderer');
const FILE_REGISTRO = path.join(RENDERER, 'js', 'logic', 'azioniConsentite.ts');

const META = new Set(['suInvio', 'inSequenza', 'seEsiste', 'fermaEChiama']);
const IDENT = /^[A-Za-z_$][\w$]*$/;

function sorgenti(dir, out = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name !== 'vendor') sorgenti(p, out);
    } else if (/\.(ts|html)$/.test(voce.name) && p !== FILE_REGISTRO) {
      out.push(p);
    }
  }
  return out;
}

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

function letteraliStringa(argomenti) {
  const out = [];
  const re = /'([^'\\]*)'|"([^"\\]*)"/g;
  let m;
  while ((m = re.exec(argomenti))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

const decodifica = (s) => s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');

function aggiungiDaMeta(nomi, meta, argomenti, file) {
  const candidati = meta === 'inSequenza' ? argomenti : argomenti.slice(0, 1);
  for (const a of candidati) if (typeof a === 'string' && IDENT.test(a)) nomi.set(a, file);
}

function estraiNomi() {
  const nomi = new Map();
  for (const file of sorgenti(RENDERER)) {
    const s = fs.readFileSync(file, 'utf8');
    const rel = path.relative(RADICE, file).replace(/\\/g, '/');

    let i = -1;
    while ((i = s.indexOf('azione(', i + 1)) !== -1) {
      if (/[\w$]/.test(s[i - 1] || '')) continue;
      const lett = letteraliStringa(argomentiChiamata(s, i + 'azione'.length));
      if (lett.length < 2 || !IDENT.test(lett[1])) continue;
      if (META.has(lett[1])) aggiungiDaMeta(nomi, lett[1], lett.slice(2), rel);
      else nomi.set(lett[1], rel);
    }

    const re = /data-on-([a-z]+)="([^"$]+)"/g;
    let m;
    while ((m = re.exec(s))) {
      const [, tipo, nome] = m;
      if (!META.has(nome)) { nomi.set(nome, rel); continue; }
      const args = new RegExp(`data-args-${tipo}="([^"]*)"`).exec(s.slice(m.index, m.index + 600));
      if (!args) continue;
      try { aggiungiDaMeta(nomi, nome, JSON.parse(decodifica(args[1])), rel); } catch {}
    }
  }
  return nomi;
}

function generaRegistro(nomi) {
  const elenco = [...nomi.keys()].filter((n) => !META.has(n)).sort();
  return `const AZIONI_CONSENTITE: ReadonlySet<string> = new Set([
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
