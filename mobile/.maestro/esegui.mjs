import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = 'com.antonioorf.archiview.scanner';
const QUI = dirname(fileURLToPath(import.meta.url));
const FOTO = join(QUI, '..', '..', 'scripts', 'assets', 'mgh-ss22-p104.jpg');
const WIN = process.platform === 'win32';

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (WIN ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : join(homedir(), 'Android', 'Sdk'));
const adbSdk = join(sdk, 'platform-tools', WIN ? 'adb.exe' : 'adb');
const ADB = existsSync(adbSdk) ? adbSdk : 'adb';
const maestroHome = join(homedir(), '.maestro', 'maestro', 'bin', WIN ? 'maestro.bat' : 'maestro');
const MAESTRO = existsSync(maestroHome) ? maestroHome : 'maestro';

function esegui(cmd, args, opz = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: WIN && cmd.endsWith('.bat'), ...opz });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  return r;
}

function adb(...args) {
  const r = esegui(ADB, args);
  if (r.status !== 0) throw new Error(`adb ${args.join(' ')}: ${r.stderr || r.stdout}`);
  return r.stdout;
}

const cartella = join(QUI, 'flussi');
const filtri = process.argv.slice(2);
const flussi = process.env.MAESTRO_FLUSSI
  ? process.env.MAESTRO_FLUSSI.split(',')
  : readdirSync(cartella).filter(f => f.endsWith('.yaml') && (filtri.length ? filtri.some(x => f.includes(x)) : !/schermate|wiki/.test(f))).sort();
if (!flussi.length) { console.error('Nessun flusso trovato.'); process.exit(1); }

if (!process.env.ANDROID_SERIAL) {
  const collegati = adb('devices').split('\n').slice(1).map(l => l.trim().split(/\s+/)).filter(([, s]) => s === 'device').map(([id]) => id);
  const emulatori = collegati.filter(id => id.startsWith('emulator-'));
  if (emulatori.length > 1 && flussi.length > 1) process.exit(await inParallelo(emulatori));
  process.env.ANDROID_SERIAL = emulatori[0] || collegati[0] || '';
}

async function inParallelo(emulatori) {
  const durata = f => {
    try { return Number(/time="([\d.]+)"/.exec(readFileSync(join(QUI, 'esiti', f.replace(/\.yaml$/, '.xml')), 'utf8'))?.[1]) || 40; }
    catch { return 40; }
  };
  const code = emulatori.map(id => ({ id, flussi: [], totale: 0 }));
  for (const f of [...flussi].sort((a, b) => durata(b) - durata(a))) {
    const c = code.reduce((a, b) => (b.totale < a.totale ? b : a));
    c.flussi.push(f);
    c.totale += durata(f);
  }
  const esiti = [];
  await Promise.all(code.filter(c => c.flussi.length).map(c => new Promise(fine => {
    console.log(`${c.id}: ${c.flussi.length} flussi, ~${Math.round(c.totale)} s`);
    const figlio = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, ANDROID_SERIAL: c.id, MAESTRO_FLUSSI: c.flussi.sort().join(',') }
    });
    let resto = '';
    const righe = dati => {
      const parti = (resto + dati).split('\n');
      resto = parti.pop();
      for (const r of parti) {
        const m = /^\s+(OK|FAIL)\s+(\S+\.yaml)$/.exec(r);
        if (m) esiti.push([m[2], m[1] === 'OK']);
        else if (r.trim()) console.log(`[${c.id}] ${r}`);
      }
    };
    figlio.stdout.on('data', righe);
    figlio.stderr.on('data', righe);
    figlio.on('close', fine);
  })));
  console.log('\nEsiti:');
  for (const [f, ok] of esiti.sort()) console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${f}`);
  return esiti.length === flussi.length && esiti.every(([, ok]) => ok) ? 0 : 1;
}
if (!process.env.ANDROID_SERIAL) { console.error('Nessun dispositivo adb collegato.'); process.exit(1); }
const emulatore = [adb('shell', 'getprop', 'ro.kernel.qemu'), adb('shell', 'getprop', 'ro.boot.qemu')].some(v => v.trim() === '1');
if (!emulatore && process.env.ARCHIVIEW_MAESTRO_TELEFONO !== '1') {
  console.error(`${process.env.ANDROID_SERIAL} è un telefono vero: i flussi ne azzerano i dati. ARCHIVIEW_MAESTRO_TELEFONO=1 per procedere.`);
  process.exit(1);
}

const sha = b => createHash('sha256').update(b).digest('hex');
const foto = readFileSync(FOTO);
const pagina = (n, etichetta) => ({ file: `p${String(n).padStart(4, '0')}.jpg`, sha256: sha(foto), byte: foto.length, modalita: 'documento', ...(etichetta ? { etichetta } : {}) });
const ARCHIVIO = 'Fondo Prova';

function lotto(id, stato, destinazione, pagine, extra = {}) {
  const b = { id, creatoIl: '2026-10-11T10:00:00+02:00', stato, archivio: ARCHIVIO, ...extra, destinazione, pagine };
  return { [`lotti/${id}/bozza.json`]: JSON.stringify(b), ...Object.fromEntries(pagine.map(p => [`lotti/${id}/${p.file}`, foto])) };
}

function documento(id, nome, n, cartella) {
  const pagine = Array.from({ length: n }, (_, i) => ({ file: `p${String(i + 1).padStart(4, '0')}.jpg`, v: 1 }));
  const d = { id, nome, ...(cartella ? { cartella } : {}), creatoIl: '2026-10-11T09:00:00+02:00', pagine };
  return { [`documenti/${id}/documento.json`]: JSON.stringify(d), ...Object.fromEntries(pagine.map(p => [`documenti/${id}/${p.file}`, foto])) };
}

const SEMI = {
  vuoto: () => ({}),
  archivio: () => ({
    'impostazioni.json': JSON.stringify({ soloWifi: true, dopoInvio: { modo: 'sempre', giorni: 7 }, archivio: { nome: ARCHIVIO, nuovo: false } }),
    'archivi.json': JSON.stringify([ARCHIVIO, 'Fondo Altro']),
    'schede.json': JSON.stringify({
      formato: 'archiview-scanner/config', versione: 1, archivio: ARCHIVIO, aggiornatoIl: '2026-10-11T08:00:00+02:00',
      schede: [
        { id: 'scheda-reg41', segnatura: 'Reg. 41', cartella: 'Notarile', titolo: 'Imbreviature' },
        { id: 'scheda-reg42', segnatura: 'Reg. 42', cartella: 'Notarile/Atti', titolo: 'Atti sciolti' },
        { id: 'scheda-perg7', segnatura: 'Perg. 7', cartella: '', titolo: 'Privilegio' }
      ],
      cartelle: ['Notarile', 'Notarile/Atti', 'Vuota']
    }),
    'schede-nuove.json': JSON.stringify([{ archivio: ARCHIVIO, id: 'nuova-0001abcd', segnatura: 'Busta 3', cartella: 'Notarile' }]),
    ...lotto('20261011-100000-aaaa', 'in_coda', { tipo: 'esistente', schedaId: 'scheda-reg41' }, [pagina(1, '1r'), pagina(2, '1v'), pagina(3, '2r')], { titolo: 'Reg. 41' }),
    ...lotto('20261011-100100-bbbb', 'in_coda', { tipo: 'nessuna' }, [pagina(1)], { titolo: 'Carte sciolte', nota: 'Trovate nella busta' }),
    ...lotto('20261011-090000-cccc', 'inviato', { tipo: 'esistente', schedaId: 'scheda-perg7' }, [pagina(1, 'recto')], { titolo: 'Perg. 7', inviatoIl: '2026-10-11T09:30:00+02:00' })
  }),
  recupero: () => ({
    ...SEMI.archivio(),
    'lotti/20261012-080000-dddd/bozza.json': 'x',
    'lotti/20261012-080000-dddd/p0001.jpg': foto,
    'lotti/20261012-080000-dddd/p0002.jpg': foto
  }),
  scadute: () => ({
    ...SEMI.archivio(),
    'impostazioni.json': JSON.stringify({ soloWifi: true, dopoInvio: { modo: 'giorni', giorni: 1 }, archivio: { nome: ARCHIVIO, nuovo: false } }),
    ...lotto('20261011-090000-cccc', 'inviato', { tipo: 'esistente', schedaId: 'scheda-perg7' }, [pagina(1, 'recto')], { titolo: 'Perg. 7', inviatoIl: new Date(Date.now() - 30 * 3600e3).toISOString() }),
    ...lotto('20261011-091000-eeee', 'inviato', { tipo: 'esistente', schedaId: 'scheda-reg42' }, [pagina(1, '5r')], { titolo: 'Reg. 42', inviatoIl: new Date(Date.now() - 3600e3).toISOString() })
  }),
  nuove: () => ({
    ...SEMI.archivio(),
    ...lotto('20261011-100200-ffff', 'in_coda', { tipo: 'nuova', tipoDocumento: 'imbreviature', schedaId: 'nuova-0001abcd', cartella: 'Notarile', campi: { segnatura: 'Busta 3' } }, [pagina(1), pagina(2)], { titolo: 'Busta 3' })
  }),
  wifi: () => ({
    ...SEMI.archivio(),
    ...lotto('20261011-100300-abcd', 'in_coda', { tipo: 'nessuna' }, [pagina(1)], { archivio: 'Fondo Altro', titolo: 'Altro archivio' })
  }),
  documenti: () => ({
    'documenti/cartelle.json': JSON.stringify(['Ricevute', 'Scaffale']),
    ...documento('0b6f4c1e-1111-4a6e-9c1d-000000000001', 'Ricevuta biblioteca', 2),
    ...documento('0b6f4c1e-2222-4a6e-9c1d-000000000002', 'Fotocopia articolo', 1, 'Ricevute')
  }),
  novita: () => {
    const base = SEMI.archivio();
    const schede = JSON.parse(base['schede.json']);
    for (const s of schede.schede) if (s.id !== 'scheda-reg41') s.daVedere = true;
    const bozza = JSON.parse(base['lotti/20261011-100000-aaaa/bozza.json']);
    return {
      ...base,
      'impostazioni.json': JSON.stringify({ ...JSON.parse(base['impostazioni.json']), viste: { [ARCHIVIO]: ['scheda-perg7'] } }),
      'schede.json': JSON.stringify(schede),
      'lotti/20261011-100000-aaaa/bozza.json': JSON.stringify({ ...bozza, sfocate: ['p0002.jpg'] })
    };
  },
  documentiArchivio: () => ({
    ...SEMI.documenti(),
    'impostazioni.json': JSON.stringify({ soloWifi: true, dopoInvio: { modo: 'sempre', giorni: 7 }, archivio: { nome: ARCHIVIO, nuovo: false }, documenti: true }),
    'archivi.json': JSON.stringify([ARCHIVIO])
  })
};

const BENVENUTO = JSON.stringify({ versione: 1, data: '2026-10-12T08:00:00+02:00' });

const PORTA = process.env.METRO_PORTA || '8081';
const PREFERENZE = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?><map><string name="debug_http_host">localhost:${PORTA}</string></map>`;

function semina(nome, lingua = 'it') {
  const seme = SEMI[nome];
  if (!seme) throw new Error(`seme sconosciuto: ${nome} (noti: ${Object.keys(SEMI).join(', ')})`);
  adb('shell', 'am', 'force-stop', PKG);
  adb('shell', 'run-as', PKG, 'sh', '-c', '"rm -rf files/* files/.[!.]*"');
  adb('shell', 'pm', 'clear-permission-flags', PKG, 'android.permission.CAMERA', 'user-set', 'user-fixed');
  adb('reverse', `tcp:${PORTA}`, `tcp:${PORTA}`);
  const pref = join(tmpdir(), `archiview-preferenze-${process.env.ANDROID_SERIAL}.xml`);
  writeFileSync(pref, PREFERENZE);
  adb('push', pref, '/data/local/tmp/archiview-preferenze.xml');
  adb('shell', 'run-as', PKG, 'sh', '-c', `"mkdir -p shared_prefs && cp /data/local/tmp/archiview-preferenze.xml shared_prefs/${PKG}_preferences.xml"`);
  const file = nome === 'vuoto' ? {} : { 'benvenuto.json': BENVENUTO, ...seme() };
  file['impostazioni.json'] = JSON.stringify({ ...JSON.parse(file['impostazioni.json'] || '{}'), lingua });
  const dir = join(tmpdir(), `archiview-seme-${process.env.ANDROID_SERIAL}`);
  rmSync(dir, { recursive: true, force: true });
  for (const [p, dati] of Object.entries(file)) {
    if (dati === null) continue;
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    if (Buffer.isBuffer(dati)) copyFileSync(FOTO, join(dir, p));
    else writeFileSync(join(dir, p), dati);
  }
  adb('shell', 'rm', '-rf', '/data/local/tmp/archiview-seme');
  adb('push', dir, '/data/local/tmp/archiview-seme');
  adb('shell', 'run-as', PKG, 'sh', '-c', '"mkdir -p files && cp -r /data/local/tmp/archiview-seme/. files/"');
}

if (emulatore) {
  adb('shell', 'settings', 'put', 'secure', 'stylus_handwriting_enabled', '0');}

mkdirSync(join(QUI, 'esiti'), { recursive: true });
const esiti = [];
for (const f of flussi) {
  const testo = readFileSync(join(cartella, f), 'utf8');
  const seme = /^#\s*seme:\s*(\S+)/m.exec(testo)?.[1] || 'vuoto';
  const lingua = /^#\s*lingua:\s*(\S+)/m.exec(testo)?.[1] || 'it';
  console.log(`\n▶ ${f} (seme: ${seme}, lingua: ${lingua})`);
  try {
    semina(seme, lingua);
  } catch (e) {
    console.error(`  seme non scritto: ${e.message}`);
    esiti.push([f, false]);
    continue;
  }
  const r = esegui(MAESTRO, ['--device', process.env.ANDROID_SERIAL, 'test',`flussi/${f}`, '--format', 'junit', '--output', `esiti/${f.replace(/\.yaml$/, '.xml')}`], { cwd: QUI, stdio: 'inherit', env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1', MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true' } });
  esiti.push([f, r.status === 0]);
}

console.log('\nEsiti:');
for (const [f, ok] of esiti) console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${f}`);
process.exit(esiti.every(([, ok]) => ok) ? 0 : 1);
