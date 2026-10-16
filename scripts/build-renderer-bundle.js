const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const outDir = path.join(__dirname, '../out/renderer');
const htmlFile = path.join(outDir, 'index.html');
const bundleRelative = 'js/app.bundle.js';
const bundleFile = path.join(outDir, bundleRelative);

let html = fs.readFileSync(htmlFile, 'utf8');

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

let replaced = false;
html = html.replace(tagRegex, () => {
  if (replaced) return '';
  replaced = true;
  return `    <script defer src="${bundleRelative}"></script>\n`;
});
fs.writeFileSync(htmlFile, html);

const kb = (Buffer.byteLength(result.code) / 1024).toFixed(0);
console.log(`[build-bundle] ${matches.length} script → ${bundleRelative} (${kb} KB)`);
