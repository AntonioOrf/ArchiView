const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const asar = path.join(radice, 'dist', 'win-unpacked', 'resources', 'app.asar');

if (!fs.existsSync(asar)) {
  console.error('[e2e-pacchetto] Manca dist/win-unpacked: eseguire prima "npx electron-builder --win --dir".');
  process.exit(1);
}

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
