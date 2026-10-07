// Baseline di prestazioni (PIANO-SICUREZZA-OTTIMIZZAZIONE.md, Fase 3, punto 17).
//
// Avvia l'app buildata (out/) su un archivio sintetico e misura:
//  - avvio:       dal lancio del processo all'app pronta (wall clock) e dalla navigazione al
//                 mark `archiview:pronta` (lato renderer, senza il costo di Playwright);
//  - heap:        heap JS del renderer dopo il caricamento, a valle di una GC forzata;
//  - apertura:    `leggi-dati` (lettura + parse + passaggio IPC) e riapertura completa (reload);
//  - salvataggio: `salvaTutto()` (validazione + stringify + IPC + scrittura atomica).
// Più le dimensioni degli script caricati da index.html.
//
// Uso: npm run build-ts && node scripts/misura-prestazioni.js [--schede 5000] [--giri 5] [--radice] [--json out.json]
// I numeri hanno senso solo come confronto sulla stessa macchina: lanciare prima e dopo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '..');
const arg = (nome, def) => {
  const i = process.argv.indexOf('--' + nome);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const SCHEDE = Number(arg('schede', 5000));
const GIRI = Number(arg('giri', 5));
const OUT_JSON = arg('json', null);
const RADICE = process.argv.includes('--radice');
const PROFILO = process.argv.includes('--profilo');

const Model = require(path.join(repoRoot, 'out/shared/model.js'));
const appVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;

const NOMI = ['Luca', 'Bartolo', 'Giovanni', 'Piero', 'Nanni', 'Cecco', 'Andrea', 'Bindo', 'Lapo', 'Vanni'];
const COGNOMI = ["d'Abete", 'di Ser Lapo', 'Bonaccorsi', 'del Pace', 'Ricoveri', 'da Pisa', 'Mannelli', 'Strozzi'];
const LUOGHI = ['San Miniato', 'Firenze', 'Prato', 'Pistoia', 'Empoli', 'Fucecchio', 'Pisa', 'Lucca'];
const PAROLE = 'item die predicto in civitate coram domino potestate comparuit dictus accusatus de ludo taxillorum contra formam statutorum et condempnatus fuit in libris decem denariorum'.split(' ');

let seme = 42;
const caso = (n) => { seme = (Math.imul(seme, 1103515245) + 12345) >>> 0; return (seme >>> 8) % n; };
const frase = (n) => Array.from({ length: n }, () => PAROLE[caso(PAROLE.length)]).join(' ');
const persona = () => NOMI[caso(NOMI.length)] + ' ' + COGNOMI[caso(COGNOMI.length)];

// Archivio realistico: 20 buste dentro un fondo, la prima aperta nella sidebar.
// Con --radice tutte le schede stanno nella radice (aperta di default): sidebar con una riga
// per scheda, il caso peggiore per il render.
const BUSTE = 20;
const busta = (i) => `Fondo/Busta ${i % BUSTE}`;

function generaDatabase(n) {
  const db = Model.databaseVuoto();
  if (!RADICE) db.cartelle = ['Fondo', ...Array.from({ length: BUSTE }, (_, i) => busta(i))];
  const tipi = Model.MODELLI_PREDEFINITI.map(m => m.id);
  for (let i = 0; i < n; i++) {
    db.manoscritti.push({
      id: 'm' + i,
      tipoDocumento: tipi[i % tipi.length],
      cartella: RADICE ? '' : busta(i),
      segnatura: `Busta ${Math.floor(i / 250)}, c. ${i % 250}r`,
      lastModified: 1,
      dataCronica: `13${String(caso(100)).padStart(2, '0')}`,
      dataTopica: LUOGHI[caso(LUOGHI.length)],
      attori_dinamici: [{ k: 'Imputato', v: persona() }, { k: 'Testimone', v: persona() }],
      note: frase(30),
      trascrizione: frase(250),
      tags: i % 7 ? [] : ['da rivedere'],
      allegati: []
    });
  }
  return db;
}

function preparaUserData(db) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-bench-'));
  const ws = path.join(userData, 'ws', 'Bench');
  fs.mkdirSync(ws, { recursive: true });
  fs.writeFileSync(path.join(ws, 'database_manoscritti.json'), JSON.stringify(db));
  fs.writeFileSync(path.join(userData, 'settings.json'),
    JSON.stringify({
      workspacePath: ws, recentWorkspaces: [ws], lastSeenVersion: appVersion,
      ...(RADICE ? {} : { appState: { cartella: busta(0), cartelleEspanse: ['', 'Fondo', busta(0)] } })
    }, null, 2));
  return { userData, ws };
}

function envPulito(userData) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue;
    env[k] = v;
  }
  return { ...env, ARCHIVIEW_E2E_USER_DATA: userData, ARCHIVIEW_E2E_BACKGROUND: '1' };
}

const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const tondo = (x) => Math.round(x * 10) / 10;

async function attendiPronta(page) {
  await page.waitForURL(/index\.html$/, { timeout: 30_000 });
  await page.waitForFunction(() => window.__appPronta === true, null, { timeout: 60_000 });
}

async function lancia(userData) {
  const t0 = performance.now();
  const app = await electron.launch({ args: ['.'], cwd: repoRoot, env: envPulito(userData) });
  const page = await app.firstWindow();
  await attendiPronta(page);
  const wall = performance.now() - t0;
  const renderer = await page.evaluate(() => {
    const m = performance.getEntriesByName('archiview:pronta')[0];
    const nav = performance.getEntriesByType('navigation')[0];
    // Mark aggiuntivi (`av:*`), messi a mano per scomporre l'avvio quando serve.
    const passi = performance.getEntriesByType('mark').filter(e => e.name.startsWith('av:'))
      .map(e => e.name.slice(3) + '=' + Math.round(e.startTime));
    return { pronta: m ? m.startTime : NaN, dcl: nav ? nav.domContentLoadedEventEnd : NaN, passi };
  });
  return { app, page, wall, ...renderer };
}

async function chiudi(app) {
  try {
    await Promise.race([app.close(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000))]);
  } catch {
    try { app.process().kill(); } catch { /* già chiuso */ }
  }
}

async function heapDopoGc(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  await cdp.detach();
  return usedSize / 1048576;
}

// --profilo: profilo CPU di una riapertura, con il tempo proprio per funzione. Il profiler
// rallenta tutto: conta la proporzione fra le voci, non i millisecondi assoluti.
async function profilaRiapertura(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  await page.evaluate(() => { window.__appPronta = false; });
  await page.reload();
  await attendiPronta(page);
  const { profile } = await cdp.send('Profiler.stop');
  await cdp.detach();
  const tempo = new Map();
  profile.samples.forEach((id, i) => tempo.set(id, (tempo.get(id) || 0) + profile.timeDeltas[i] / 1000));
  const perFunzione = {};
  for (const n of profile.nodes) {
    const t = tempo.get(n.id) || 0;
    if (!t) continue;
    const f = n.callFrame;
    const k = `${f.functionName || '(anonima)'}  ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber}`;
    perFunzione[k] = (perFunzione[k] || 0) + t;
  }
  console.log('profilo della riapertura (tempo proprio):');
  Object.entries(perFunzione).sort((a, b) => b[1] - a[1]).slice(0, 25)
    .forEach(([k, v]) => console.log(`  ${v.toFixed(1).padStart(8)} ms  ${k}`));
}

function dimensioniScript() {
  const dir = path.join(repoRoot, 'out/renderer');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const src = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
  const righe = src.map(s => {
    const f = path.join(dir, s);
    return { script: s, kb: fs.existsSync(f) ? tondo(fs.statSync(f).size / 1024) : null };
  });
  return { righe, totaleKb: tondo(righe.reduce((t, r) => t + (r.kb || 0), 0)) };
}

async function main() {
  if (!fs.existsSync(path.join(repoRoot, 'out/renderer/index.html'))) {
    throw new Error('out/ mancante: eseguire prima npm run build-ts');
  }
  const db = generaDatabase(SCHEDE);
  const { userData, ws } = preparaUserData(db);
  const mbDb = fs.statSync(path.join(ws, 'database_manoscritti.json')).size / 1048576;
  console.log(`[bench] ${SCHEDE} schede${RADICE ? ' tutte nella radice' : ` in ${BUSTE} buste`}, DB ${tondo(mbDb)} MB, ${GIRI} giri, Electron ${require('electron/package.json').version}`);

  const avvii = [];
  let ultimo = null;
  try {
    // Il primo avvio crea la userData e, se l'app la usa, la cache del codice: va a parte.
    for (let i = 0; i <= GIRI; i++) {
      const r = await lancia(userData);
      if (i < GIRI) await chiudi(r.app);
      else ultimo = r;
      avvii.push({ wall: r.wall, pronta: r.pronta, dcl: r.dcl });
      if (r.passi.length) console.log(`  avvio ${i}: ${r.passi.join(' ')} pronta=${Math.round(r.pronta)}`);
    }

    const { app, page } = ultimo;
    const heap = await heapDopoGc(page);

    const letture = [];
    const salvataggi = [];
    for (let i = 0; i < GIRI; i++) {
      letture.push(await page.evaluate(async () => {
        const t = performance.now();
        const d = await window.leggiDatiArchivio();
        if (!d || !d.manoscritti) throw new Error('leggiDati vuoto');
        return performance.now() - t;
      }));
      salvataggi.push(await page.evaluate(async () => {
        const t = performance.now();
        await window.salvaTutto({ pendenti: false });
        return performance.now() - t;
      }));
    }

    // Ridisegno di sidebar + vista principale, cioè ciò che segue ogni selezione o modifica.
    const render = [];
    for (let i = 0; i < GIRI; i++) {
      render.push(await page.evaluate(() => {
        const t = performance.now();
        window.renderSidebar();
        window.renderMain();
        return performance.now() - t;
      }));
    }

    const riaperture = [];
    for (let i = 0; i < GIRI; i++) {
      await page.evaluate(() => { window.__appPronta = false; });
      const t = performance.now();
      await page.reload();
      await attendiPronta(page);
      riaperture.push(performance.now() - t);
    }
    if (PROFILO) await profilaRiapertura(page);
    await chiudi(app);
    ultimo = null;

    const caldi = avvii.slice(1);
    const risultato = {
      data: new Date().toISOString(),
      commit: (() => { try { return require('child_process').execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim(); } catch { return null; } })(),
      schede: SCHEDE,
      radice: RADICE,
      dbMb: tondo(mbDb),
      avvioFreddo: { wallMs: tondo(avvii[0].wall), prontaMs: tondo(avvii[0].pronta) },
      avvio: {
        wallMs: tondo(mediana(caldi.map(a => a.wall))),
        domContentLoadedMs: tondo(mediana(caldi.map(a => a.dcl))),
        prontaMs: tondo(mediana(caldi.map(a => a.pronta)))
      },
      heapMb: tondo(heap),
      leggiDatiMs: tondo(mediana(letture)),
      salvataggioMs: tondo(mediana(salvataggi)),
      renderMs: tondo(mediana(render)),
      riaperturaMs: tondo(mediana(riaperture)),
      script: dimensioniScript()
    };

    console.log(`avvio a freddo       ${risultato.avvioFreddo.wallMs} ms (renderer pronto a ${risultato.avvioFreddo.prontaMs} ms)`);
    console.log(`avvio (mediana)      ${risultato.avvio.wallMs} ms wall, DCL ${risultato.avvio.domContentLoadedMs} ms, pronta ${risultato.avvio.prontaMs} ms`);
    console.log(`heap renderer        ${risultato.heapMb} MB`);
    console.log(`leggi-dati           ${risultato.leggiDatiMs} ms`);
    console.log(`salvataggio          ${risultato.salvataggioMs} ms`);
    console.log(`render sidebar+main  ${risultato.renderMs} ms`);
    console.log(`riapertura (reload)  ${risultato.riaperturaMs} ms`);
    console.log(`script caricati      ${risultato.script.totaleKb} KB`);
    for (const r of risultato.script.righe) console.log(`  ${String(r.kb).padStart(8)} KB  ${r.script}`);
    if (OUT_JSON) fs.writeFileSync(path.resolve(OUT_JSON), JSON.stringify(risultato, null, 2));
  } finally {
    if (ultimo) await chiudi(ultimo.app);
    try { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* lock di Chromium */ }
  }
}

main().catch((err) => {
  console.error('[bench] Errore:', err && err.stack || err);
  process.exitCode = 1;
});
