const { spawnSync } = require('child_process');
const path = require('path');

const radice = path.resolve(__dirname, '..');
const CONTROLLATI = [
  /^src\/renderer\/js\/state\.ts\(/,
  /^src\/renderer\/js\/logic\//
];

const tsc = require.resolve('typescript/bin/tsc');
const esito = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.renderer.json'], { cwd: radice, encoding: 'utf8' });
const righe = (esito.stdout + esito.stderr).split(/\r?\n/).filter(r => /error TS\d+/.test(r));
const errori = righe.filter(r => CONTROLLATI.some(re => re.test(r.replace(/\\/g, '/'))));

if (errori.length) {
  console.error(errori.join('\n'));
  console.error(`controllo-null-renderer: ${errori.length} errori strictNullChecks nei file controllati`);
  process.exit(1);
}
console.log(`controllo-null-renderer: ok (${righe.length} errori fuori dai file controllati)`);
