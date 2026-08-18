// Concatena e minifica in un unico file tutti gli script del renderer.
//
// Perché non `esbuild --bundle`: il codice del renderer non usa moduli, condivide lo scope
// globale di script classici (window.X, funzioni e `let` top-level visibili fra file). Un
// bundle a moduli cambierebbe quella semantica. Qui si concatena nell'ORDINE ESATTO dei tag
// <script defer> di index.html e si minifica senza rinominare gli identificatori top-level
// (minifyIdentifiers: false), che restano globali per contratto.
//
// Effetto su hardware lento: ~40 richieste file + 40 compilazioni V8 → una sola.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const outDir = path.join(__dirname, '../out/renderer');
const htmlFile = path.join(outDir, 'index.html');
const bundleRelative = 'js/app.bundle.js';
const bundleFile = path.join(outDir, bundleRelative);

let html = fs.readFileSync(htmlFile, 'utf8');

// Solo gli script dell'app (js/…): i vendor restano tag separati, sono già minificati
// e vengono serviti prima (non-defer) perché l'app li assume presenti a DOMContentLoaded.
const tagRegex = /[ \t]*<script defer src="(js\/[^"]+)"><\/script>\r?\n?/g;
const sources = [];
const matches = [...html.matchAll(tagRegex)];

if (matches.length === 0) {
  console.log('[build-bundle] Nessuno script da bundlare (index.html già bundlato?)');
  process.exit(0);
}

for (const m of matches) {
  const rel = m[1];
  const abs = path.join(outDir, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[build-bundle] ERRORE: manca ${rel} — build TS incompleta.`);
    process.exit(1);
  }
  // `;` di sicurezza fra file: senza, un file che termina senza punto e virgola
  // potrebbe fondersi con la prima espressione del successivo (ASI).
  sources.push(`// ---- ${rel} ----\n${fs.readFileSync(abs, 'utf8')}\n;`);
}

const result = esbuild.transformSync(sources.join('\n'), {
  loader: 'js',
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: false,
  target: 'chrome120',
  legalComments: 'none'
});

fs.mkdirSync(path.dirname(bundleFile), { recursive: true });
fs.writeFileSync(bundleFile, result.code);

// Sostituisce il primo tag con il bundle ed elimina gli altri.
let replaced = false;
html = html.replace(tagRegex, () => {
  if (replaced) return '';
  replaced = true;
  return `    <script defer src="${bundleRelative}"></script>\n`;
});
fs.writeFileSync(htmlFile, html);

const kb = (Buffer.byteLength(result.code) / 1024).toFixed(0);
console.log(`[build-bundle] ${matches.length} script → ${bundleRelative} (${kb} KB)`);
