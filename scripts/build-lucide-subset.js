// Sostituisce out/renderer/vendor/lucide.min.js (~390 KB, ~2.000 icone) con le sole icone
// usate dall'app (PIANO-SICUREZZA-OTTIMIZZAZIONE.md, O2).
//
// Quali icone: ogni parola in kebab-case che compare in un sorgente del renderer o di
// src/shared e che è il nome di un'icona lucide. È una sovra-inclusione voluta: "check",
// "list" o "x" entrano anche quando sono parole qualunque, e così entra pure ogni nome
// scritto in un ternario o in una tabella (`asc ? 'arrow-down-a-z' : 'arrow-up-z-a'`).
// Sfuggirebbe solo un nome composto a runtime ('arrow-' + verso): non ce ne sono, e
// logic/icone.ts lo segnalerebbe in console ("icona lucide sconosciuta").
//
// Il file prodotto espone solo ciò che usa logic/icone.ts: `createElement` e `icons`.
// I nodi delle icone e gli attributi predefiniti dell'<svg> si leggono dal file vendor
// valutandolo in un contesto isolato, quindi un aggiornamento di lucide non va riportato qui.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const vendor = path.join(root, 'src/renderer/vendor/lucide.min.js');
const dest = path.join(root, 'out/renderer/vendor/lucide.min.js');
const sorgenti = [path.join(root, 'src/renderer'), path.join(root, 'src/shared')];

function fileSorgente(dir) {
  const out = [];
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name !== 'vendor' && voce.name !== 'locales') out.push(...fileSorgente(p));
    } else if (/\.(ts|html|js)$/.test(voce.name) && !voce.name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
  return out;
}

const chiave = (nome) => {
  const camel = nome.replace(/^([A-Z])|[\s-_]+(\w)/g, (_m, iniziale, dopo) =>
    dopo ? dopo.toUpperCase() : iniziale.toLowerCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

function main() {
  const codice = fs.readFileSync(vendor, 'utf8');
  const ctx = vm.createContext({});
  new vm.Script(codice, { filename: 'lucide.min.js' }).runInContext(ctx);
  const lucide = ctx.lucide;
  if (!lucide || !lucide.icons || typeof lucide.createElement !== 'function') {
    throw new Error('lucide.min.js non espone icons/createElement: formato del vendor cambiato');
  }

  // Attributi predefiniti dell'<svg>: l'oggetto che createElement fonde sotto quelli passati.
  const m = codice.match(/\{xmlns:"http:\/\/www\.w3\.org\/2000\/svg"[^}]*\}/);
  if (!m) throw new Error('attributi predefiniti dell\'svg non trovati nel vendor lucide');
  const predefiniti = vm.runInNewContext('(' + m[0] + ')');

  const usate = new Set();
  for (const f of sorgenti.flatMap(fileSorgente)) {
    const testo = fs.readFileSync(f, 'utf8');
    for (const parola of testo.match(/[a-z][a-z0-9]*(?:-[a-z0-9]+)*/g) || []) {
      const k = chiave(parola);
      if (Object.prototype.hasOwnProperty.call(lucide.icons, k)) usate.add(k);
    }
  }
  if (usate.size < 50) throw new Error(`solo ${usate.size} icone trovate: scansione dei sorgenti rotta?`);

  const icons = {};
  for (const k of [...usate].sort()) icons[k] = lucide.icons[k];

  const licenza = (codice.match(/^\/\*\*[\s\S]*?\*\//) || [''])[0];
  const uscita = `${licenza}
// Sottoinsieme generato da scripts/build-lucide-subset.js: ${usate.size} icone su ${Object.keys(lucide.icons).length}.
(function () {
  var predefiniti = ${JSON.stringify(predefiniti)};
  function crea(nodo) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', nodo[0]);
    for (var k in nodo[1]) el.setAttribute(k, String(nodo[1][k]));
    if (nodo[2]) for (var i = 0; i < nodo[2].length; i++) el.appendChild(crea(nodo[2][i]));
    return el;
  }
  function createElement(figli, attributi) {
    var tutti = {};
    for (var a in predefiniti) tutti[a] = predefiniti[a];
    for (var b in (attributi || {})) tutti[b] = attributi[b];
    return crea(['svg', tutti, figli]);
  }
  window.lucide = { createElement: createElement, icons: ${JSON.stringify(icons)}, createIcons: function () {} };
})();
`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, uscita);
  console.log(`[lucide-subset] ${usate.size} icone, ${(Buffer.byteLength(uscita) / 1024).toFixed(0)} KB (vendor ${(Buffer.byteLength(codice) / 1024).toFixed(0)} KB)`);
}

try {
  main();
} catch (err) {
  console.error('[lucide-subset] ERRORE:', err.message);
  process.exit(1);
}
