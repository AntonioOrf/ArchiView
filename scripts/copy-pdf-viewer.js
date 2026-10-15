// Copia in out/renderer/pdf il modulo di avvio del visualizzatore PDF della trascrizione.
//
// pdf.js non si copia qui: il modulo lo importa da out/renderer/ocr, dove lo mette
// copy-ocr-host.js (eseguito prima in `copy-assets`). Due copie costavano ~1,8 MB
// nell'installazione; la pagina principale (app://) vede già tutta out/renderer, mentre lo
// schema `ocr-host://` continua a servire solo la sua cartella.
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
// Le copie di pdf.js lasciate dalle build precedenti non devono finire nell'installer.
for (const vecchio of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
  fs.rmSync(path.join(destinazione, vecchio), { force: true });
}

console.log('[copy-pdf-viewer] avvioPdfjs.mjs → out/renderer/pdf/');
