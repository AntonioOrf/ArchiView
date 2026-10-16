const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const sorgente = path.join(radice, 'out', 'shared');
const destinazione = path.join(radice, 'out', 'renderer', 'js', 'shared');

const daCopiare = ['model.js', 'dataStorica.js', 'csvImport.js', 'iiifManifest.js', 'copiaScheda.js', 'collazione.js'];

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
