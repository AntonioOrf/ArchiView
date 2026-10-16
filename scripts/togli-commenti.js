const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ts = require('typescript');

const RADICE = path.join(__dirname, '..');
const ESCLUSI = /(^|\/)(out|dist|graphify-out|node_modules|vendor)\/|tailwind\.css$|\.md$/;
const ESTENSIONI = /\.(ts|tsx|js|mjs|cjs|css|html|ya?ml|toml|kt|gradle|sql|nsh)$|(^|\/)\.git(ignore|attributes)$/;

function direttiva(c) {
  if (/^\/\/\s*@ts-(ignore|expect-error)/.test(c)) return c.match(/^\/\/\s*@ts-(ignore|expect-error)/)[0];
  if (/^\/\/\s*@ts-(check|nocheck)\b/.test(c)) return c;
  if (/^\/[/*]\s*eslint-/.test(c)) return c.replace(/\s+--\s.*?(\*\/)?$/, (m, fine) => (fine ? ' */' : ''));
  if (/^\/\*\s*[@#]__PURE__\s*\*\/$/.test(c) || c.startsWith('/*!')) return c;
  return null;
}

function riduciPonytail(c) {
  const i = c.indexOf('ponytail:');
  if (i < 0) return null;
  if (c.startsWith('//')) return '// ' + c.slice(i);
  return (c.startsWith('/**') ? '/** ' : '/* ') + c.slice(i);
}

function inizioRiga(t, i) { return t.lastIndexOf('\n', i - 1) + 1; }
function fineRiga(t, i) { const j = t.indexOf('\n', i); return j < 0 ? t.length : j; }
function vuota(s) { return /^[ \t\r]*$/.test(s); }

function cancella(t, a, b) {
  const ls = inizioRiga(t, a) || (t[0] === '﻿' ? 1 : 0);
  const le = fineRiga(t, b);
  if (vuota(t.slice(ls, a)) && vuota(t.slice(b, le))) {
    let fine = Math.min(le + 1, t.length);
    const prima = t.slice(inizioRiga(t, Math.max(ls - 1, 0)), Math.max(ls - 1, 0));
    const dopo = t.slice(fine, fineRiga(t, fine));
    const primaVuotaOApertura = ls === 0 || vuota(prima) || /[{[(]\s*$/.test(prima);
    if (fine < t.length && vuota(dopo) && primaVuotaOApertura) fine = Math.min(fineRiga(t, fine) + 1, t.length);
    return t.slice(0, ls) + t.slice(fine);
  }
  if (!vuota(t.slice(ls, a)) && vuota(t.slice(b, le))) {
    let i = a;
    while (i > ls && /[ \t]/.test(t[i - 1])) i--;
    return t.slice(0, i) + t.slice(b);
  }
  let j = b;
  while (j < le && /[ \t]/.test(t[j])) j++;
  let k = a;
  while (k > ls && /[ \t]/.test(t[k - 1])) k--;
  if (t[k - 1] === '{' && t[j] === '}') return t.slice(0, k) + t.slice(j);
  if (j > b) return t.slice(0, a) + t.slice(j);
  let i = a;
  while (i > ls && /[ \t]/.test(t[i - 1])) i--;
  return t.slice(0, i) + t.slice(b);
}

function applica(testo, interventi) {
  interventi.sort((x, y) => y.a - x.a);
  let t = testo;
  for (const { a, b, nuovo } of interventi) t = nuovo == null ? cancella(t, a, b) : t.slice(0, a) + nuovo + t.slice(b);
  return t;
}

function rangeTs(testo, nomeFile) {
  const kind = /\.tsx$/.test(nomeFile) ? ts.ScriptKind.TSX : /\.(js|mjs|cjs)$/.test(nomeFile) ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(nomeFile, testo, ts.ScriptTarget.Latest, true, kind);
  const commenti = new Map();
  const jsxVuoti = [];
  const visita = n => {
    if (n.kind === ts.SyntaxKind.JsxExpression && !n.expression) jsxVuoti.push({ a: n.getStart(sf), b: n.end });
    if (n.kind === ts.SyntaxKind.JsxText) return;
    const figli = n.getChildren(sf);
    if (!figli.length || n.kind === ts.SyntaxKind.EndOfFileToken) {
      for (const r of [...(ts.getLeadingCommentRanges(testo, n.pos) || []), ...(ts.getTrailingCommentRanges(testo, n.pos) || [])]) {
        commenti.set(r.pos, r);
      }
    }
    figli.forEach(visita);
  };
  visita(sf);
  return { commenti: [...commenti.values()].sort((x, y) => x.pos - y.pos), jsxVuoti };
}

function togliTs(testo, nomeFile = 'x.ts') {
  const { commenti, jsxVuoti } = rangeTs(testo, nomeFile);
  const dentroJsx = r => jsxVuoti.some(j => r.pos >= j.a && r.end <= j.b);
  const interventi = jsxVuoti.map(j => ({ ...j, nuovo: null }));
  let rigaPonytail = -2;
  let colPonytail = -1;
  for (const r of commenti) {
    if (dentroJsx(r)) continue;
    const c = testo.slice(r.pos, r.end);
    const riga = testo.slice(0, r.pos).split('\n').length;
    const col = r.pos - inizioRiga(testo, r.pos);
    const d = direttiva(c);
    if (d != null) { if (d !== c) interventi.push({ a: r.pos, b: r.end, nuovo: d }); continue; }
    const p = riduciPonytail(c);
    if (p != null) {
      if (p !== c) interventi.push({ a: r.pos, b: r.end, nuovo: p });
      if (c.startsWith('//')) { rigaPonytail = riga; colPonytail = col; }
      continue;
    }
    const precedente = testo.slice(inizioRiga(testo, r.pos - 1), r.pos).trimEnd();
    if (c.startsWith('//') && riga === rigaPonytail + 1 && col === colPonytail && !/[.!?]$/.test(precedente)) { rigaPonytail = riga; continue; }
    interventi.push({ a: r.pos, b: r.end, nuovo: null });
  }
  return { testo: applica(testo, interventi), tolti: interventi.filter(i => i.nuovo == null).length };
}

function scansioneC(testo, { linea }) {
  const interventi = [];
  let i = 0;
  while (i < testo.length) {
    const ch = testo[i];
    if (ch === '"' || ch === "'") {
      i++;
      while (i < testo.length && testo[i] !== ch && testo[i] !== '\n') i += testo[i] === '\\' ? 2 : 1;
      i++;
    } else if (testo.startsWith('/*', i)) {
      const f = testo.indexOf('*/', i + 2);
      const b = f < 0 ? testo.length : f + 2;
      if (!testo.startsWith('/*!', i)) interventi.push({ a: i, b, nuovo: null });
      i = b;
    } else if (linea && testo.startsWith(linea, i)) {
      const b = fineRiga(testo, i);
      interventi.push({ a: i, b: testo[b - 1] === '\r' ? b - 1 : b, nuovo: null });
      i = b;
    } else i++;
  }
  return { testo: applica(testo, interventi), tolti: interventi.length };
}

function togliCss(testo) { return scansioneC(testo, { linea: null }); }
function togliKotlin(testo) { return scansioneC(testo, { linea: '//' }); }
function togliSql(testo) { return scansioneC(testo, { linea: '--' }); }

function togliHtml(testo) {
  let tolti = 0;
  let t = testo.replace(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/g, (m, ap, corpo, ch) => {
    const r = togliTs(corpo, 'x.js'); tolti += r.tolti; return ap + r.testo + ch;
  });
  t = t.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, ap, corpo, ch) => {
    const r = togliCss(corpo); tolti += r.tolti; return ap + r.testo + ch;
  });
  const interventi = [];
  const re = /<!--([\s\S]*?)-->/g;
  let m;
  while ((m = re.exec(t))) if (!/^\s*@include\s/.test(m[1])) interventi.push({ a: m.index, b: m.index + m[0].length, nuovo: null });
  return { testo: applica(t, interventi), tolti: tolti + interventi.length };
}

function togliCancelletto(testo, segni = '#') {
  const interventi = [];
  const re = new RegExp(`^[ \\t]*[${segni}](?!!).*$`, 'gm');
  let m;
  while ((m = re.exec(testo))) {
    const b = m.index + m[0].length;
    interventi.push({ a: m.index + m[0].search(/\S/), b: testo[b - 1] === '\r' ? b - 1 : b, nuovo: null });
  }
  return { testo: applica(testo, interventi), tolti: interventi.length };
}

function stampaSenzaCommenti(testo, nomeFile) {
  const kind = /\.tsx$/.test(nomeFile) ? ts.ScriptKind.TSX : /\.(js|mjs|cjs)$/.test(nomeFile) ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(nomeFile, testo, ts.ScriptTarget.Latest, false, kind);
  return ts.createPrinter({ removeComments: true }).printFile(sf).split('\n').filter(r => r.trim()).join('\n');
}

function stessoCodice(prima, dopo, nomeFile) {
  if (!/\.(ts|tsx|js|mjs|cjs)$/.test(nomeFile)) return true;
  return stampaSenzaCommenti(prima, nomeFile) === stampaSenzaCommenti(dopo, nomeFile);
}

function togli(testo, nomeFile) {
  if (/\.(ts|tsx|js|mjs|cjs)$/.test(nomeFile)) return togliTs(testo, nomeFile);
  if (/\.css$/.test(nomeFile)) return togliCss(testo);
  if (/\.html$/.test(nomeFile)) return togliHtml(testo);
  if (/\.(kt|gradle)$/.test(nomeFile)) return togliKotlin(testo);
  if (/\.sql$/.test(nomeFile)) return togliSql(testo);
  if (/\.nsh$/.test(nomeFile)) return togliCancelletto(testo, ';#');
  if (/(\.(ya?ml|toml)|(^|\/)\.git(ignore|attributes))$/.test(nomeFile)) return togliCancelletto(testo);
  return { testo, tolti: 0 };
}

function elencoFile(percorsi = []) {
  const tutti = execFileSync('git', ['ls-files'], { cwd: RADICE, encoding: 'utf8' }).split('\n')
    .filter(f => f && ESTENSIONI.test(f) && !ESCLUSI.test(f) && fs.existsSync(path.join(RADICE, f)));
  if (!percorsi.length) return tutti;
  const pref = percorsi.map(p => p.replace(/\\/g, '/').replace(/^\.\//, ''));
  return tutti.filter(f => pref.some(p => f === p || f.startsWith(p.endsWith('/') ? p : p + '/')));
}

function main() {
  const argv = process.argv.slice(2);
  const prova = argv.includes('--dry-run');
  const file = elencoFile(argv.filter(a => !a.startsWith('--')));
  let totale = 0;
  for (const f of file) {
    const pieno = path.join(RADICE, f);
    try {
      const testo = fs.readFileSync(pieno, 'utf8');
      const r = togli(testo, f);
      if (!r.tolti && r.testo === testo) continue;
      if (!stessoCodice(testo, r.testo, f)) {
        console.error(`CODICE CAMBIATO, file lasciato com'era: ${f}`);
        process.exitCode = 1;
        continue;
      }
      totale += r.tolti;
      console.log(`${String(r.tolti).padStart(5)}  ${f}`);
      if (!prova) fs.writeFileSync(pieno, r.testo);
    } catch (e) {
      console.error(`ERRORE ${f}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`${prova ? 'da togliere' : 'tolti'}: ${totale} commenti in ${file.length} file esaminati`);
}

if (require.main === module) main();

module.exports = { togli, stessoCodice, togliTs, togliCss, togliHtml, togliKotlin, togliCancelletto, elencoFile };
