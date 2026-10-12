import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Prove M8.14, M10.4, M10.5, M10.6 di PIANO-PROVE-MANUALI.md: Wi-Fi diretto vero dal telefono
// (emulatore Android, build di debug, Metro acceso) a questa app desktop, senza Drive né account.
// Il QR del desktop diventa il poster della scena virtuale della fotocamera dell'emulatore, che
// lo legge come farebbe un telefono davanti allo schermo. L'emulatore legge i poster solo
// all'avvio: lo spec lo riavvia. Tocca i file dell'SDK (poster.png, Toren1BD.posters) e li
// rimette com'erano alla fine.
//
//   cd mobile && npx expo start          (Metro)
//   ARCHIVIEW_WIFI_EMULATORE=1 npx playwright test --project=manuali wifi-emulatore

test.skip(!process.env.ARCHIVIEW_WIFI_EMULATORE || process.platform !== 'win32', 'serve ARCHIVIEW_WIFI_EMULATORE=1 (emulatore + Metro)');
test.use({ seedWorkspace: 'Fondo Prova' });

const SERIALE = process.env.ANDROID_SERIAL || 'emulator-5554';
const AVD = process.env.ARCHIVIEW_AVD || 'Medium_Phone_API_37.0';
const SDK = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const RISORSE = path.join(SDK, 'emulator', 'resources');
const MOBILE = path.join(__dirname, '..', 'mobile');
const PKG = 'com.antonioorf.archiview.scanner';
// Poster della parete spostato davanti alla fotocamera all'avvio della scena.
const POSTERS = 'poster wall\nsize 1.0 1.0\nposition 0 0 -2.2\nrotation 0 0 0\ndefault poster.png\n\n'
  + 'poster table\nsize 1 1\nposition -2.205 -0.077 3.949\nrotation -90 0 120\n';

const adb = (...a: string[]) => spawnSync('adb', ['-s', SERIALE, ...a], { encoding: 'utf8' });
const attendi = async (cond: () => boolean, ms: number, cosa: string) => {
  const fine = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fine) throw new Error('scaduto: ' + cosa);
    await new Promise(r => setTimeout(r, 2000));
  }
};

async function riavviaEmulatore() {
  adb('emu', 'kill');
  await attendi(() => !spawnSync('adb', ['devices'], { encoding: 'utf8' }).stdout.includes(SERIALE), 60_000, 'emulatore spento');
  // -no-snapshot: avvio a freddo (rilegge i poster) senza perdere l'app installata.
  spawn(path.join(SDK, 'emulator', 'emulator.exe'), ['-avd', AVD, '-no-snapshot', '-no-boot-anim'], { detached: true, stdio: 'ignore' }).unref();
  await attendi(() => adb('shell', 'getprop', 'sys.boot_completed').stdout.trim() === '1', 240_000, 'avvio emulatore');
  if (!adb('shell', 'pm', 'path', PKG).stdout.includes('package:')) {
    const apk = path.join(MOBILE, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    expect(adb('install', apk).status).toBe(0);
  }
}

/** Lotti ricevuti per intero: solo `arrivo` e `assegnati` (staging e tmp sono invii a metà). */
function lottiArrivati(ws: string, ids: string[]): string[] {
  const base = path.join(ws, '.archiview', 'scanner');
  return ['arrivo', 'assegnati']
    .flatMap(d => fs.existsSync(path.join(base, d)) ? fs.readdirSync(path.join(base, d)) : [])
    .filter(n => ids.includes(n)).sort();
}

test('M8.14/M10.4/M10.5/M10.6 — Wi-Fi diretto dall\'emulatore al desktop, poi computer spento', async ({ page, userDataDir }) => {
  test.setTimeout(15 * 60_000);
  const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fondo Prova');

  await page.locator('#btn-scansioni').click();
  await page.locator('#scan-wifi').click();
  const qr = page.locator('#scan-wifi-qr img');
  await expect(qr).toBeVisible();
  const info = (await page.locator('#scan-wifi-info').textContent()) || '';
  console.log('[wifi] desktop:', info.replace(/\s+/g, ' '));

  const salva = (f: string) => { if (!fs.existsSync(f + '.orig')) fs.copyFileSync(f, f + '.orig'); };
  const poster = path.join(RISORSE, 'poster.png');
  const posters = path.join(RISORSE, 'Toren1BD.posters');
  salva(poster);
  salva(posters);
  try {
    fs.writeFileSync(poster, Buffer.from((await qr.getAttribute('src'))!.split(',')[1], 'base64'));
    fs.writeFileSync(posters, POSTERS);
    await riavviaEmulatore();

    const PROVA = ['20261011-100000-aaaa', '20261011-100100-bbbb'];
    const ALTRO = '20261011-100300-abcd';
    const maestro = spawn(process.execPath, [path.join('.maestro', 'esegui.mjs'), '20-wifi'], {
      cwd: MOBILE, env: { ...process.env, ANDROID_SERIAL: SERIALE, MAESTRO_WIFI_DESKTOP: 'acceso' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    maestro.stdout!.on('data', d => { log += d; });
    maestro.stderr!.on('data', d => { log += d; });
    const fineMaestro = new Promise<number>(r => maestro.on('close', c => r(c ?? 1)));

    // M8.14/M10.5: le pagine di «Fondo Prova» arrivano senza Drive né account.
    await expect.poll(() => lottiArrivati(ws, [...PROVA, ALTRO]), { timeout: 8 * 60_000, intervals: [3000] }).toEqual(PROVA);
    // M10.6: si chiude il pannello (server spento); il telefono deve accorgersene da solo.
    await page.keyboard.press('Escape');
    await expect(page.locator('#scanner-modal')).toBeHidden();

    const esito = await fineMaestro;
    console.log('[wifi] maestro:\n' + log.split('\n').filter(l => /▶|Failed|OK |FAIL/.test(l)).join('\n'));
    expect(esito, 'flusso Maestro 20-wifi-diretto').toBe(0);
    // M10.4: la pagina dell'altro archivio non è mai arrivata qui.
    expect(lottiArrivati(ws, [ALTRO])).toEqual([]);
  } finally {
    fs.copyFileSync(poster + '.orig', poster);
    fs.copyFileSync(posters + '.orig', posters);
  }
});
