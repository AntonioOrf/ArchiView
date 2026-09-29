// Copia in out/renderer/pdf il visualizzatore PDF della trascrizione: il modulo di avvio e
// i due file di pdf.js (build `legacy`, per le stesse ragioni dell'host OCR in
// copy-ocr-host.js).
//
// Cartella distinta da out/renderer/ocr: quella è servita dallo schema `ocr-host://` alla
// finestra offscreen, questa è caricata da file:// dalla pagina principale. Condividerla
// legherebbe due sottosistemi che non hanno ragione di dipendere l'uno dall'altro.
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const destinazione = path.join(radice, 'out', 'renderer', 'pdf');
const sorgentePdfjs = path.join(radice, 'node_modules', 'pdfjs-dist', 'legacy', 'build');

fs.mkdirSync(destinazione, { recursive: true });

const daCopiare = [
  [path.join(radice, 'src', 'renderer', 'pdf', 'avvioPdfjs.mjs'), 'avvioPdfjs.mjs'],
  [path.join(sorgentePdfjs, 'pdf.min.mjs'), 'pdf.min.mjs'],
  [path.join(sorgentePdfjs, 'pdf.worker.min.mjs'), 'pdf.worker.min.mjs']
];

for (const [da, nome] of daCopiare) {
  if (!fs.existsSync(da)) {
    console.error(`[copy-pdf-viewer] ERRORE: manca ${da}. Eseguire "npm install".`);
    process.exit(1);
  }
  fs.copyFileSync(da, path.join(destinazione, nome));
}

console.log(`[copy-pdf-viewer] ${daCopiare.length} file → out/renderer/pdf/`);
