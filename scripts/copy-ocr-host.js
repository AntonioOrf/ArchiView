// Copia in out/renderer/ocr la pagina host dell'OCR e i due file di pdf.js che le servono
// (Fase 2.3).
//
// Perché copiare invece di caricare da node_modules: la pagina è servita dallo schema
// `ocr-host://`, la cui autorità `app` punta a UNA cartella sola. Servire node_modules
// significherebbe esporre alla pagina l'intero albero delle dipendenze per risparmiare
// una copia di due file.
//
// Si usa la build `legacy`: è quella trasposta per i target più vecchi, e ArchiView gira
// anche su macchine dove `npm start` parte con l'accelerazione hardware disattivata.
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
