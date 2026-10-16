const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const destinazione = path.join(radice, 'out', 'renderer', 'ocr');
const sorgentePdfjs = path.join(radice, 'node_modules', 'pdfjs-dist', 'legacy', 'build');

fs.mkdirSync(destinazione, { recursive: true });

const daCopiare = [
  [path.join(radice, 'src', 'renderer', 'ocr', 'pdfHost.html'), 'pdfHost.html'],
  [path.join(sorgentePdfjs, 'pdf.min.mjs'), 'pdf.min.mjs'],
  [path.join(sorgentePdfjs, 'pdf.worker.min.mjs'), 'pdf.worker.min.mjs']
];

for (const [da, nome] of daCopiare) {
  if (!fs.existsSync(da)) {
    console.error(`[copy-ocr-host] ERRORE: manca ${da}. Eseguire "npm install".`);
    process.exit(1);
  }
  fs.copyFileSync(da, path.join(destinazione, nome));
}

console.log(`[copy-ocr-host] ${daCopiare.length} file → out/renderer/ocr/`);
