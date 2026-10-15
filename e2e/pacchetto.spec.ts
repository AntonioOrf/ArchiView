import { chromium, type Browser, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { test, expect, seedWorkspaceOnDisk, stubDialog } from './fixtures';

/**
 * Prove M15 (PIANO-PESO) sull'app impacchettata: le esclusioni di `build.files` valgono solo
 * lì, quindi su out/ questi test non direbbero nulla e si saltano. Si lanciano con
 * `npm run test:e2e:pacchetto` dopo `npx electron-builder --win --dir`.
 *
 * Due modi di arrivarci:
 * - **exe vero** (`dist/win-unpacked/ArchiView.exe`): i fuse impediscono a Playwright di
 *   collegarsi al main, ma `--remote-debugging-port` è uno switch di Chromium e resta: ci si
 *   collega al renderer via CDP e si passa dalle stesse IPC del preload che usa l'app.
 * - **asar** (fixture con ARCHIVIEW_E2E_ASAR): lo stesso app.asar caricato dall'Electron di
 *   sviluppo, con il main raggiungibile. Serve dove c'è un dialogo nativo da sostituire.
 *
 * Il motore OCR qui è quello VERO (tesseract dall'app.asar.unpacked): le lingue `eng` e
 * `osd` si scaricano una volta in e2e/.cache/tessdata, la stessa fonte di `ocrLangs.ts`.
 */

const asar = process.env.ARCHIVIEW_E2E_ASAR ? path.resolve(__dirname, '..', process.env.ARCHIVIEW_E2E_ASAR) : '';
const radicePacchetto = asar ? path.resolve(path.dirname(asar), '..') : '';
const exe = radicePacchetto && path.join(radicePacchetto, 'ArchiView.exe');

test.skip(!asar, 'Solo sull\'app impacchettata: npm run test:e2e:pacchetto');
test.use({ seedWorkspace: 'Pacchetto' });
// OCR vero e avvii dell'exe: più lenti del resto della suite.
test.setTimeout(120_000);

const TESTO = [
  'The quick brown fox jumps',
  'over the lazy dog while',
  'the archive keeps old letters',
  'and manuscripts in order.',
];

// ---------------------------------------------------------------------------------------
// Lingue OCR

const cacheLingue = path.join(__dirname, '.cache', 'tessdata');

async function lingua(codice: string): Promise<string> {
  const file = path.join(cacheLingue, `${codice}.traineddata`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(cacheLingue, { recursive: true });
  let risposta: Response;
  try {
    risposta = await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${codice}.traineddata`);
  } catch (e) {
    throw new Error(`Download della lingua ${codice} fallito (serve la rete la prima volta): ${(e as Error).message}`);
  }
  if (!risposta.ok) throw new Error(`Download della lingua ${codice}: HTTP ${risposta.status}`);
  // Scrittura atomica: un download interrotto non deve restare in cache come file buono. Il
  // temporaneo è per processo, perché più worker possono scaricare la stessa lingua insieme.
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(await risposta.arrayBuffer()));
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    if (!fs.existsSync(file)) throw e;
  }
  return file;
}

async function installaLingue(userDataDir: string) {
  const dir = path.join(userDataDir, 'ocr-langs');
  fs.mkdirSync(dir, { recursive: true });
  for (const c of ['eng', 'osd']) fs.copyFileSync(await lingua(c), path.join(dir, `${c}.traineddata`));
}

// ---------------------------------------------------------------------------------------
// Immagini di prova, disegnate dal renderer (in Node non c'è un canvas)

async function pngConTesto(page: Page, ruotata: boolean): Promise<Buffer> {
  const base64 = await page.evaluate(({ righe, ruotata }) => {
    const L = 1600, H = 900;
    const c = document.createElement('canvas');
    c.width = ruotata ? H : L;
    c.height = ruotata ? L : H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (ruotata) { ctx.translate(H, 0); ctx.rotate(Math.PI / 2); }
    ctx.fillStyle = '#000';
    ctx.font = '72px serif';
    righe.forEach((r: string, i: number) => ctx.fillText(r, 80, 170 + i * 170));
    return c.toDataURL('image/png').split(',')[1];
  }, { righe: TESTO, ruotata });
  return Buffer.from(base64, 'base64');
}

/** Un PDF senza livello testo, solo l'immagine: è il caso che passa dall'host pdf.js + OCR. */
async function pdfScansione(png: Buffer): Promise<Buffer> {
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png);
  const p = doc.addPage([img.width / 2, img.height / 2]);
  p.drawImage(img, { x: 0, y: 0, width: img.width / 2, height: img.height / 2 });
  return Buffer.from(await doc.save());
}

const riconosciuto = (piano: string) => {
  const t = String(piano || '').toLowerCase();
  return ['quick', 'brown', 'lazy', 'archive', 'manuscripts'].filter(p => t.includes(p)).length;
};

// ---------------------------------------------------------------------------------------
// exe vero via CDP

async function portaLibera(): Promise<number> {
  return new Promise((risolvi, rifiuta) => {
    const s = net.createServer();
    s.once('error', rifiuta);
    s.listen(0, '127.0.0.1', () => {
      const porta = (s.address() as net.AddressInfo).port;
      s.close(() => risolvi(porta));
    });
  });
}

type Exe = { proc: ChildProcess; browser: Browser; page: Page };

async function avviaExe(userDataDir: string, argomenti: string[] = []): Promise<Exe> {
  const porta = await portaLibera();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') env[k] = v;
  const proc = spawn(exe, [`--remote-debugging-port=${porta}`, ...argomenti], {
    env: { ...env, ARCHIVIEW_E2E_USER_DATA: userDataDir, ARCHIVIEW_E2E_BACKGROUND: '1' },
    stdio: 'ignore',
  });
  let browser: Browser | undefined;
  const scadenza = Date.now() + 30_000;
  while (!browser) {
    if (proc.exitCode !== null) throw new Error(`L'exe è uscito subito (codice ${proc.exitCode})`);
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${porta}`);
    } catch {
      if (Date.now() > scadenza) { proc.kill(); throw new Error('CDP dell\'exe non raggiungibile'); }
      await new Promise(r => setTimeout(r, 300));
    }
  }
  let page: Page | undefined;
  while (!page) {
    page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
    if (!page) {
      if (Date.now() > scadenza) throw new Error('Finestra principale dell\'exe non trovata');
      await new Promise(r => setTimeout(r, 200));
    }
  }
  await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 30_000 });
  return { proc, browser, page };
}

async function chiudiExe(e: Exe | undefined) {
  if (!e) return;
  await e.browser.close().catch(() => {});
  e.proc.kill();
  await new Promise(r => setTimeout(r, 500));
}

/** Prepara userData per l'exe: workspace seminato, lingue OCR, file negli allegati. */
async function preparaExe(userDataDir: string, allegati: Record<string, Buffer> = {}) {
  const dir = path.join(userDataDir, 'exe');
  const ws = seedWorkspaceOnDisk(dir, 'PacchettoExe');
  await installaLingue(dir);
  const cartella = path.join(ws, 'allegati_manoscritti');
  fs.mkdirSync(cartella, { recursive: true });
  for (const [nome, dati] of Object.entries(allegati)) fs.writeFileSync(path.join(cartella, nome), dati);
  return dir;
}

test.describe('M15 — exe impacchettato', () => {
  test.beforeAll(() => {
    expect(fs.existsSync(exe), `manca ${exe}: npx electron-builder --win --dir`).toBe(true);
  });

  test('M15.4 — parte e disegna l\'interfaccia con lingue di Chromium non incluse', async ({ userDataDir }) => {
    expect(fs.readdirSync(path.join(radicePacchetto, 'locales')).sort()).toEqual(['en-US.pak', 'it.pak']);
    for (const lang of ['de', 'fr', 'ja', 'en-US']) {
      const ud = path.join(userDataDir, `lang-${lang}`);
      seedWorkspaceOnDisk(ud, 'Lingua');
      let e: Exe | undefined;
      try {
        e = await avviaExe(ud, [`--lang=${lang}`]);
        await expect(e.page.locator('#btn-tab-add')).toBeVisible();
        expect(await e.page.title()).toBe('ArchiView');
        // Il ripiego di Chromium: mai una lingua di cui manca il .pak.
        expect(['it', 'en-US']).toContain(await e.page.evaluate(() => navigator.language));
      } finally {
        await chiudiExe(e);
      }
    }
  });

  test('M15.6/4a — app:// serve il bundle e pdf.js una volta sola, non i file esclusi', async ({ userDataDir }) => {
    let e: Exe | undefined;
    try {
      e = await avviaExe(await preparaExe(userDataDir));
      const stati = await e.page.evaluate(async () => {
        const out: Record<string, number> = {};
        for (const f of ['js/app.bundle.js', 'js/temaIniziale.js', 'js/workers/elaboraImmagine.js',
          'pdf/avvioPdfjs.mjs', 'ocr/pdf.min.mjs', 'ocr/pdf.worker.min.mjs',
          'js/app.js', 'js/state.js', 'pdf/pdf.min.mjs', 'js/app.bundle.js.map']) {
          out[f] = await fetch(f).then(r => r.status, () => 0);
        }
        return out;
      });
      for (const f of ['js/app.bundle.js', 'js/temaIniziale.js', 'js/workers/elaboraImmagine.js',
        'pdf/avvioPdfjs.mjs', 'ocr/pdf.min.mjs', 'ocr/pdf.worker.min.mjs']) {
        expect(stati[f], f).toBe(200);
      }
      for (const f of ['js/app.js', 'js/state.js', 'pdf/pdf.min.mjs', 'js/app.bundle.js.map']) {
        expect(stati[f], f).not.toBe(200);
      }
    } finally {
      await chiudiExe(e);
    }
  });

  test('M15.6 — il visualizzatore carica pdf.js da ocr/ e disegna una pagina', async ({ userDataDir }) => {
    const pdf = fs.readFileSync(path.join(__dirname, 'fixtures', 'multipage.pdf')).toString('base64');
    let e: Exe | undefined;
    try {
      e = await avviaExe(await preparaExe(userDataDir));
      const esito = await e.page.evaluate(async (b64) => {
        // Come pdfViewer.ts: il modulo di avvio iniettato alla prima apertura di un PDF.
        const s = document.createElement('script');
        s.type = 'module';
        s.src = 'pdf/avvioPdfjs.mjs';
        const pronto = new Promise(r => window.addEventListener('pdfjs-pronto', r, { once: true }));
        document.head.appendChild(s);
        await pronto;
        const lib = (window as any).pdfjsLib;
        const dati = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const doc = await lib.getDocument({ data: dati }).promise;
        const pagina = await doc.getPage(1);
        const vista = pagina.getViewport({ scale: 1 });
        const c = document.createElement('canvas');
        c.width = vista.width; c.height = vista.height;
        await pagina.render({ canvasContext: c.getContext('2d'), viewport: vista }).promise;
        const px = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let nonBianchi = 0;
        for (let i = 0; i < px.length; i += 4) if (px[i] < 250 || px[i + 1] < 250 || px[i + 2] < 250) nonBianchi++;
        return { pagine: doc.numPages, nonBianchi, worker: lib.GlobalWorkerOptions.workerSrc };
      }, pdf);
      expect(esito.pagine).toBeGreaterThan(1);
      expect(esito.nonBianchi).toBeGreaterThan(0);
      expect(esito.worker).toMatch(/\/ocr\/pdf\.worker\.min\.mjs$/);
    } finally {
      await chiudiExe(e);
    }
  });

  test('M15.1 — OCR vero: immagine, foto ruotata raddrizzata, PDF scansionato', async ({ page, userDataDir }) => {
    // Le immagini le disegna la finestra della fixture (stesso asar), l'OCR lo fa l'exe.
    await page.waitForFunction(() => (window as any).__appPronta === true);
    const dritta = await pngConTesto(page, false);
    const ruotata = await pngConTesto(page, true);
    const dir = await preparaExe(userDataDir, {
      'dritta.png': dritta,
      'ruotata.png': ruotata,
      'scansione.pdf': await pdfScansione(dritta),
    });
    let e: Exe | undefined;
    try {
      e = await avviaExe(dir);
      const ocr = (o: any) => e!.page.evaluate((opz) => (window as any).apiOcr.esegui(opz), o);

      const lingue = await e.page.evaluate(() => (window as any).apiOcr.lingue());
      expect(lingue.ok).toBe(true);

      const a = await ocr({ nomeFile: 'dritta.png', tipo: 'immagine', lingue: ['eng'] });
      expect(a.ok, JSON.stringify(a)).toBe(true);
      expect(riconosciuto(a.piano), a.piano).toBeGreaterThanOrEqual(4);

      const b = await ocr({ nomeFile: 'ruotata.png', tipo: 'immagine', lingue: ['eng'], raddrizza: true });
      expect(b.ok, JSON.stringify(b)).toBe(true);
      expect([90, 270]).toContain(b.pagine[0].rotazione);
      expect(riconosciuto(b.piano), b.piano).toBeGreaterThanOrEqual(4);

      const c = await ocr({ nomeFile: 'scansione.pdf', tipo: 'pdf', lingue: ['eng'] });
      expect(c.ok, JSON.stringify(c)).toBe(true);
      expect(c.pagine[0].origine).toBe('ocr');
      expect(riconosciuto(c.piano), c.piano).toBeGreaterThanOrEqual(4);
    } finally {
      await chiudiExe(e);
    }
  });

  test('M15.7 — icone in resources/assets, tutorial dall\'asar', async ({ userDataDir }) => {
    for (const f of ['icon.ico', 'icon.png']) {
      expect(fs.statSync(path.join(radicePacchetto, 'resources', 'assets', f)).size).toBeGreaterThan(1000);
    }
    let e: Exe | undefined;
    try {
      e = await avviaExe(await preparaExe(userDataDir));
      const esito = await e.page.evaluate(() => {
        const p = (window as any).apiBrowser.loadTutorialWorkspace();
        // Il main ricarica la finestra subito dopo: la promessa può non tornare mai.
        return Promise.race([p, new Promise(r => setTimeout(() => r({ ricaricata: true }), 5000))]);
      }).catch(() => ({ ricaricata: true }));
      expect((esito as any).success === true || (esito as any).ricaricata === true, JSON.stringify(esito)).toBe(true);
      await e.page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 30_000 });
      const schede = await e.page.evaluate(() => {
        // @ts-ignore -- `appData` è una `let` globale
        return appData.manoscritti.length;
      });
      expect(schede).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(userDataDir, 'exe', 'Tutorial_Archive', 'allegati_manoscritti', 'tutorial.pdf'))).toBe(true);
    } finally {
      await chiudiExe(e);
    }
  });
});

test.describe('M15 — asar impacchettato, main raggiungibile', () => {
  test('la suite gira davvero sul pacchetto', async ({ electronApp }) => {
    const percorso = await electronApp.evaluate(({ app }) => app.getAppPath());
    expect(path.resolve(percorso)).toBe(asar);
  });

  test('M15.2 — PDF ricercabile con tesseract e pdf-lib del pacchetto', async ({ page, electronApp, userDataDir }) => {
    await page.waitForFunction(() => (window as any).__appPronta === true);
    await installaLingue(userDataDir);
    const ws = path.join(userDataDir, 'ws', 'Pacchetto');
    fs.writeFileSync(path.join(ws, 'allegati_manoscritti', 'pagina.png'), await pngConTesto(page, false));
    const uscita = path.join(userDataDir, 'ricercabile.pdf');
    await stubDialog(electronApp, { canceled: false, filePath: uscita });

    const esito = await page.evaluate(async () => {
      const api = (window as any).apiOcr;
      const inizio = await api.pdfInizia('Prova', 'PDF');
      const ocr = await api.esegui({ nomeFile: 'pagina.png', tipo: 'immagine', lingue: ['eng'], pdf: true });
      const fine = await api.pdfConcludi(false);
      return { inizio, ocr: { ok: ocr.ok, pdfErrore: ocr.pdfErrore, piano: ocr.piano }, fine };
    });
    expect(esito.inizio.ok, JSON.stringify(esito)).toBe(true);
    expect(esito.ocr.ok, JSON.stringify(esito)).toBe(true);
    expect(esito.ocr.pdfErrore ?? null).toBeNull();

    // Il testo si estrae dal PDF scritto: è il livello invisibile di Tesseract.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(uscita)) }).promise;
    const contenuto = await (await doc.getPage(1)).getTextContent();
    const testo = contenuto.items.map((i: any) => i.str).join(' ');
    expect(riconosciuto(testo), testo).toBeGreaterThanOrEqual(4);
  });

  test('M15.5 — client Drive del pacchetto: URL di login e rinnovo del token verso Google', async ({ electronApp }) => {
    const esito = await electronApp.evaluate(async ({ app }) => {
      // `require` come lo vede il main dell'app: risolve dentro app.asar.
      const { createRequire } = (process as any).mainModule.require('module');
      const req = createRequire(app.getAppPath() + '/out/main/main.js');
      const g = req('@googleapis/drive');
      const versioneAuth = req('google-auth-library/package.json').version;
      const o = new g.auth.OAuth2('123-prova.apps.googleusercontent.com', 'segreto-finto', 'http://127.0.0.1:1/');
      const url = o.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/drive.file'] });
      // Solo il refresh token: la prima chiamata deve passare dal rinnovo (google-auth-library
      // → gaxios → oauth2.googleapis.com), che con credenziali finte Google rifiuta.
      o.setCredentials({ refresh_token: 'finto' });
      const d = g.drive({ version: 'v3', auth: o });
      try {
        await d.files.list({ pageSize: 1 });
        return { url, versioneAuth, errore: null };
      } catch (e: any) {
        return { url, versioneAuth, errore: { status: e.response?.status ?? e.status, codice: e.code, messaggio: String(e.message) } };
      }
    });
    expect(esito.versioneAuth).toBe('10.6.2');
    expect(esito.url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    expect(esito.url).toContain(encodeURIComponent('https://www.googleapis.com/auth/drive.file'));
    test.skip(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT'].includes(esito.errore?.codice), 'Rete assente: rinnovo non provato');
    expect(esito.errore, 'credenziali finte: Google deve rifiutare').not.toBeNull();
    expect([400, 401], JSON.stringify(esito.errore)).toContain(Number(esito.errore!.status));
    expect(esito.errore!.messaggio).toMatch(/invalid_client|unauthorized_client|invalid_grant/i);
  });
});
