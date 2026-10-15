// Tutta la suite e2e sull'app impacchettata (dist/win-unpacked), più le prove M15 di
// e2e/pacchetto.spec.ts. Le esclusioni di `build.files` valgono solo lì: su out/ non si vedono.
//
// Uso: npx electron-builder --win --dir, poi `npm run test:e2e:pacchetto [-- <argomenti playwright>]`.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const asar = path.join(radice, 'dist', 'win-unpacked', 'resources', 'app.asar');

if (!fs.existsSync(asar)) {
  console.error('[e2e-pacchetto] Manca dist/win-unpacked: eseguire prima "npx electron-builder --win --dir".');
  process.exit(1);
}

// Un pacchetto più vecchio della build proverebbe codice che non è quello del working tree.
const mainOut = path.join(radice, 'out', 'main', 'main.js');
if (fs.existsSync(mainOut) && fs.statSync(mainOut).mtimeMs > fs.statSync(asar).mtimeMs) {
  console.error('[e2e-pacchetto] out/ è più recente di app.asar: rifare "npx electron-builder --win --dir".');
  process.exit(1);
}

const esito = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  cwd: radice,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ARCHIVIEW_E2E_ASAR: path.relative(radice, asar) },
});
process.exit(esito.status === null ? 1 : esito.status);
