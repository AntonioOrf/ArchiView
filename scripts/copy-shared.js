// Copia in out/renderer/js/shared/ i moduli condivisi fra main e renderer (Fase 3.0).
//
// Perché una copia e non un import: il renderer non usa moduli — gli script sono classici,
// concatenati in un unico scope da build-renderer-bundle.js, che raccoglie SOLO i tag
// `<script defer src="js/...">` di index.html. Un file che vive in `out/shared/` non è
// raggiungibile da lì, e `require` nel renderer non esiste (contextIsolation).
// I file sono scritti apposta per funzionare in entrambi i mondi: `module.exports` sotto
// guardia per il main, `window.Model` per il renderer (vedi la testa di src/shared/model.ts).
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const sorgente = path.join(radice, 'out', 'shared');
const destinazione = path.join(radice, 'out', 'renderer', 'js', 'shared');

const daCopiare = ['model.js', 'dataStorica.js', 'csvImport.js'];

fs.mkdirSync(destinazione, { recursive: true });

for (const nome of daCopiare) {
  const da = path.join(sorgente, nome);
  if (!fs.existsSync(da)) {
    console.error(`[copy-shared] ERRORE: manca ${da} — build TS incompleta (eseguire "tsc").`);
    process.exit(1);
  }
  fs.copyFileSync(da, path.join(destinazione, nome));
}

console.log(`[copy-shared] ${daCopiare.length} file → out/renderer/js/shared/`);
