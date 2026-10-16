const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const destinazione = path.join(radice, 'out', 'renderer', 'pdf');
const sorgente = path.join(radice, 'src', 'renderer', 'pdf', 'avvioPdfjs.mjs');

fs.mkdirSync(destinazione, { recursive: true });
if (!fs.existsSync(sorgente)) {
  console.error(`[copy-pdf-viewer] ERRORE: manca ${sorgente}.`);
  process.exit(1);
}
fs.copyFileSync(sorgente, path.join(destinazione, 'avvioPdfjs.mjs'));
for (const vecchio of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
  fs.rmSync(path.join(destinazione, vecchio), { force: true });
}

console.log('[copy-pdf-viewer] avvioPdfjs.mjs → out/renderer/pdf/');
