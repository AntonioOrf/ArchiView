/**
 * Genera gli screenshot della wiki utente pilotando l'app VERA (Electron + Playwright).
 *
 * Non è un test: vive fuori da `e2e/` di proposito, perché la guardia
 * `test/e2eProjects.test.js` fallisce su uno spec che non appartiene a nessun progetto.
 * Riusa però lo stesso avvio isolato dei test (`ARCHIVIEW_E2E_USER_DATA`), quindi non
 * tocca la userData reale né il workspace dell'utente.
 *
 * Ogni schermata viene catturata due volte, in tema chiaro e in tema scuro: la wiki
 * mostra l'una o l'altra secondo il tema scelto da chi legge (classi `light-only` e
 * `dark-only` in `.vitepress/theme/custom.css`).
 *
 * Uso:  node scripts/wiki-screenshots.mjs [cartella-di-destinazione]
 * Default: ../ArchiView-site/docs/wiki/public/img
 *
 * Prima serve una build aggiornata: `npm run build-css && npm run build-ts`.
 */
import { _electron as electron } from 'playwright';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(
  process.argv[2] || path.join(repoRoot, '..', 'ArchiView-site', 'docs', 'wiki', 'public', 'img')
);

// Finestra ampia ma non enorme: su una pagina di documentazione uno screenshot 1440px
// va ridotto al 60% e le etichette non si leggono più.
const LARGHEZZA = 1280;
const ALTEZZA = 800;

// L'allegato dei test è un quadrato grigio: nel visore sembrerebbe un'immagine rotta.
// Ne generiamo uno che somigli a una carta di registro, con Electron stesso.
const ALLEGATO = path.join(os.tmpdir(), 'archiview-wiki-carta.png');

const PAGINA_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:900px;height:1250px;}
  body{background:#e3d5b4;font-family:'Palatino Linotype','Book Antiqua',Georgia,serif;
       color:#4a3722;position:relative;overflow:hidden;}
  .macchie{position:absolute;inset:0;
    background:
      radial-gradient(ellipse 200px 140px at 12% 8%, rgba(120,88,45,.16), transparent 70%),
      radial-gradient(ellipse 260px 180px at 88% 78%, rgba(120,88,45,.14), transparent 70%),
      radial-gradient(ellipse 160px 120px at 70% 20%, rgba(90,64,30,.10), transparent 70%);}
  .foglio{position:relative;padding:96px 92px;}
  .marg{position:absolute;left:38px;top:150px;width:42px;font-size:15px;line-height:1.5;
        font-style:italic;color:#6b4f2c;transform:rotate(-1.5deg);}
  h1{font-size:26px;font-variant:small-caps;letter-spacing:.06em;margin:0 0 28px;font-weight:normal;}
  p{font-size:21px;line-height:1.72;margin:0 0 14px;text-align:justify;
    text-indent:0;letter-spacing:.01em;}
  .capolettera{float:left;font-size:64px;line-height:.86;padding:4px 10px 0 0;color:#7a2f18;}
  .fine{margin-top:34px;font-style:italic;font-size:19px;}
  .riga{margin-top:46px;border-top:1px solid rgba(90,64,30,.28);padding-top:10px;
        font-size:15px;font-style:italic;color:#6b4f2c;display:flex;justify-content:space-between;}
</style></head><body>
  <div class="macchie"></div>
  <div class="marg">de venditione terre</div>
  <div class="foglio">
    <h1>Anno Domini M CCC XL, indictione VIII</h1>
    <p><span class="capolettera">I</span>n nomine Domini amen. Anno ab incarnatione eiusdem
    millesimo trecentesimo quadragesimo, indictione octava, die duodecimo mensis maii, actum
    Florentie in populo Sancti Petri Maioris, presentibus testibus ad hec vocatis et rogatis
    Iohanne quondam Bindi et Lapo quondam Ricchi de Florentia.</p>
    <p>Bindus quondam Lapi de Florentia, per se et suos heredes, dedit, vendidit et tradidit
    Nere filie sue et eius heredibus petiam unam terre laboratorie posite in populo Sancti
    Petri de Valle Pese, cui a primo via, a secundo fossatum, a tertio bona heredum Ricchi,
    a quarto bona ecclesie Sancti Michaelis.</p>
    <p>Pro pretio librarum quinquaginta florenorum parvorum, quas dictus venditor confessus
    fuit se habuisse et recepisse a dicta emptrice, renuntians exceptioni non numerate
    pecunie et non habite.</p>
    <p>Quam venditionem promisit dictus venditor legiptime defendere et disbrigare ab omni
    persona, collegio et universitate, sub pena dupli dicte quantitatis.</p>
    <p class="fine">Ego Iohannes quondam Lapi, imperiali auctoritate iudex ordinarius et
    notarius publicus, hiis omnibus interfui et rogatus scribere scripsi.</p>
    <div class="riga"><span>c. 42r</span><span>ASF, Notarile antecosimiano 1042</span></div>
  </div>
</body></html>`;

fs.mkdirSync(outDir, { recursive: true });

/** Dati d'esempio: un fondo notarile verosimile ma inventato. */
const SCHEDE = [
  { seg: 'ASF, Not. 1042', tipo: 'imbreviature', data: 'c. 1340', luogo: 'Firenze', notaio: 'Ser Giovanni di Lapo', atto: 'Compravendita', oggetto: 'Vendita di un podere in Val di Pesa', tags: 'da rivedere, val di pesa' },
  { seg: 'ASF, Not. 1043', tipo: 'imbreviature', data: '12 maggio 1341', luogo: 'Firenze', notaio: 'Ser Giovanni di Lapo', atto: 'Dote', oggetto: 'Costituzione di dote per Nera di Bindo', tags: 'doti' },
  { seg: 'ASF, Not. 1044', tipo: 'imbreviature', data: 'ante 1350', luogo: 'Prato', notaio: 'Ser Piero da Vinci', atto: 'Testamento', oggetto: 'Testamento di Bartolo di Ricco', tags: 'testamenti, da trascrivere' },
  { seg: 'ASF, Not. 1045', tipo: 'imbreviature', data: 'sec. XIV in.', luogo: 'Firenze', notaio: 'Ser Piero da Vinci', atto: 'Locazione', oggetto: 'Locazione di bottega in Mercato Vecchio', tags: 'lacunoso' },
  { seg: 'ASF, Not. 1046', tipo: 'imbreviature', data: '1340-45', luogo: 'Siena', notaio: 'Ser Ranieri di Guido', atto: 'Procura', oggetto: 'Procura per la riscossione di crediti', tags: 'doti, da trascrivere' },
  { seg: 'ASF, Giud. 88', tipo: 'atti', data: '3 aprile 1338', oggetto: 'Causa per confini fra i comuni di Empoli e Vinci', tags: 'confini' },
  { seg: 'ASF, Giud. 91', tipo: 'atti', data: '1339', oggetto: 'Causa matrimoniale Buondelmonti-Donati', tags: 'cause matrimoniali' },
  { seg: 'ASF, Est. 12', tipo: 'fiscali', data: '1347', oggetto: 'Estimo del popolo di San Frediano', tags: 'estimi' },
  { seg: 'ASF, Est. 13', tipo: 'fiscali', data: 's.d.', oggetto: 'Frammento di estimo, popolo non identificato', tags: 'estimi, lacunoso' },
];

const CSV_ESEMPIO = [
  'Segnatura;Data cronica;Notaio;Tipo di atto;Oggetto',
  'ASF, Not. 1102;c. 1352;Ser Bartolo di Neri;Compravendita;Vendita di casa in Oltrarno',
  'ASF, Not. 1103;1353 giugno 4;Ser Bartolo di Neri;Dote;Dote di Caterina di Ghino',
  'ASF, Not. 1104;ante 1360;Ser Bartolo di Neri;Testamento;Testamento di Nuccio di Lapo',
  'ASF, Not. 1105;sec. XIV med.;Ser Bartolo di Neri;Locazione;Locazione di terreno a Settimo',
].join('\r\n');

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-wiki-shots-'));
  const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-wiki-ws-'));
  const csvPath = path.join(basePath, 'schedatura-notarile.csv');
  fs.writeFileSync(csvPath, CSV_ESEMPIO, 'utf8');

  const cleanEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue;
    cleanEnv[k] = v;
  }

  const app = await electron.launch({
    args: ['.'],
    cwd: repoRoot,
    env: { ...cleanEnv, ARCHIVIEW_E2E_USER_DATA: userDataDir, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
  });

  const page = await app.firstWindow();
  await page.waitForURL(/index\.html$/, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');

  // Dimensione deterministica: senza, lo screenshot dipende dallo schermo di chi lo genera.
  await app.evaluate(({ BrowserWindow }, [w, h]) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(w, h);
    win.center();
  }, [LARGHEZZA, ALTEZZA]);

  // I dialog nativi non sono pilotabili da Playwright: il wizard di import ne apre uno.
  await app.evaluate(({ dialog }, percorso) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [percorso] });
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: undefined });
    dialog.showMessageBox = async () => ({ response: 0 });
    dialog.showMessageBoxSync = () => 0;
  }, csvPath);

  await creaPaginaDiEsempio(app);

  await creaWorkspace(page, basePath);
  await seed(page);
  const idAllegato = await aggiungiAllegato(page);

  // Quattro passate: due lingue per due temi. La wiki italiana usa le schermate in
  // italiano, quella inglese le proprie: una guida che mostra un'interfaccia in
  // un'altra lingua costringe il lettore a tradurre da sé i nomi dei comandi.
  let totale = 0;
  for (const lingua of ['it', 'en']) {
    await page.evaluate((l) => window.cambiaLingua(l), lingua);
    await page.waitForTimeout(900);
    const cartella = lingua === 'en' ? path.join(outDir, 'en') : outDir;
    fs.mkdirSync(cartella, { recursive: true });
    for (const tema of ['light', 'dark']) {
      await page.evaluate((t) => window.applicaTema(t), tema);
      await page.waitForTimeout(500);
      console.log(`\n[${lingua}] tema ${tema === 'dark' ? 'scuro' : 'chiaro'} -> ${cartella}\n`);
      totale += await passata(page, tema, idAllegato, cartella);
    }
  }

  console.log(`\n${totale} screenshot generati.\n`);

  try { await app.close(); } catch { /* già chiusa */ }
  try { fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* lock */ }
  try { fs.rmSync(basePath, { recursive: true, force: true, maxRetries: 3 }); } catch { /* lock */ }
}

/** Cattura l'intero catalogo di schermate nel tema corrente. */
async function passata(page, tema, idAllegato, cartella) {
  const suffisso = tema === 'dark' ? '-scuro' : '';
  let n = 0;

  const scatta = async (nome) => {
    await page.waitForTimeout(400); // transizioni CSS: senza, si fotografa un modale a metà
    const file = path.join(cartella, `${nome}${suffisso}.png`);
    await page.screenshot({ path: file });
    console.log(`  ${nome}${suffisso}.png (${Math.round(fs.statSync(file).size / 1024)} KB)`);
    n++;
  };

  const chiudi = async () => {
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.add('hidden-tab'));
      window.chiudiPannelloFiltri?.();
      window.chiudiCommandPalette?.();
      document.getElementById('tutorial-banner')?.classList.add('hidden-tab');
    });
    await page.waitForTimeout(250);
  };

  const inCartella = async () => {
    await page.evaluate(() => { window.switchTab('list'); window.vaiACartella('Imbreviature'); });
    await page.waitForTimeout(600);
  };

  // --- Viste principali ------------------------------------------------------
  await inCartella();
  await scatta('vista-griglia');

  await page.evaluate(() => window.cambiaVistaLista('tabella'));
  await scatta('vista-tabella');
  await page.evaluate(() => window.cambiaVistaLista('griglia'));
  await page.waitForTimeout(400);

  // --- Scheda e campi --------------------------------------------------------
  await page.evaluate(() => window.editItem(appData.manoscritti[0].id));
  await scatta('form-scheda');

  await page.evaluate(() => window.apriRiordinoCampi());
  await scatta('riordino-campi');
  await page.evaluate(() => window.chiudiRiordinoCampi?.(true));
  await page.waitForTimeout(300);

  await page.evaluate(() => window.apriCampoProprioModal());
  await scatta('campo-proprio');
  await chiudi();
  await inCartella();

  // --- Trascrizione e allegati ----------------------------------------------
  await page.evaluate((id) => window.apriTrascrizione(id), idAllegato);
  await page.waitForTimeout(1400);
  await scatta('trascrizione');

  await page.evaluate((id) => window.apriOcrModal(id, 0), idAllegato);
  await scatta('ocr');
  await chiudi();
  await inCartella();

  // --- Ricerca, filtri, comandi ---------------------------------------------
  await page.evaluate(() => window.apriPannelloFiltri(document.getElementById('btn-filtri')));
  await scatta('filtri');
  await chiudi();

  await page.evaluate(() => window.apriCommandPalette());
  await page.waitForTimeout(250);
  await page.keyboard.type('esporta', { delay: 20 });
  await scatta('comandi');
  await chiudi();

  await page.evaluate(() => window.apriScorciatoie());
  await scatta('scorciatoie');
  await chiudi();

  // --- Tag, vocabolari, anagrafica ------------------------------------------
  await page.evaluate(() => window.switchSidebarTab('tags'));
  await scatta('tag');

  await page.evaluate(() => window.apriGestioneTag());
  await scatta('gestione-tag');
  await chiudi();
  await page.evaluate(() => window.switchSidebarTab('folders'));
  await page.waitForTimeout(300);

  await page.evaluate(() => window.apriVocabolari());
  await scatta('vocabolari');
  await chiudi();

  await page.evaluate(() => window.apriAnagrafica('persona'));
  await scatta('anagrafica');
  await chiudi();

  // --- Collegamenti ----------------------------------------------------------
  await page.evaluate(() => window.apriCollegamenti(appData.manoscritti[0].id));
  await scatta('collegamenti');
  await chiudi();

  await page.evaluate(() => window.apriGrafo());
  await page.waitForTimeout(2000); // il layout a forze gira a blocchi: va lasciato assestare
  await scatta('grafo');
  await chiudi();

  // --- Più schede insieme ----------------------------------------------------
  await page.evaluate(() => {
    window.selectedRecords = appData.manoscritti.slice(0, 3).map((m) => m.id);
    window.aggiornaStatoSelezione?.();
    window.renderMain?.();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.apriAzioneMassa('tag'));
  await scatta('azioni-massa');
  await chiudi();
  await page.evaluate(() => { window.selectedRecords = []; window.renderMain?.(); });
  await page.waitForTimeout(300);

  // --- Stampa ed esportazioni ------------------------------------------------
  await page.evaluate(() => window.apriStampa('cartella'));
  await scatta('stampa');
  await chiudi();

  await page.evaluate(() => window.apriEsportaTesto('cartella'));
  await scatta('esporta-testo');
  await chiudi();

  await page.evaluate(() => window.apriImportCsv());
  await page.waitForTimeout(1500); // legge il file dal disco
  await scatta('import-csv');
  await chiudi();

  // --- Sicurezza del dato ----------------------------------------------------
  await page.evaluate(() => window.apriCestino());
  await scatta('cestino');
  await chiudi();

  await page.evaluate(() => window.switchSidebarTab('history'));
  await page.waitForTimeout(900);
  await scatta('cronologia');
  await page.evaluate(() => window.switchSidebarTab('folders'));
  await page.waitForTimeout(300);

  // --- Condivisione e impostazioni ------------------------------------------
  await page.evaluate(() => window.apriShareModal());
  await scatta('condivisione');
  await chiudi();

  await page.evaluate(() => window.apriImpostazioni());
  await scatta('impostazioni');
  await chiudi();

  return n;
}

/**
 * Disegna la carta d'esempio in una finestra nascosta e la salva come PNG.
 * Electron sa già renderizzare e catturare: non serve alcuna dipendenza in più.
 */
async function creaPaginaDiEsempio(app) {
  // `app.evaluate` gira nel main come modulo ESM: niente `require`, quindi il PNG
  // torna qui come data URL e lo scrive Node.
  const dataUrl = await app.evaluate(async ({ BrowserWindow }, html) => {
    const win = new BrowserWindow({
      width: 900, height: 1250, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise((r) => setTimeout(r, 700)); // i font di sistema vanno lasciati caricare
    const immagine = await win.webContents.capturePage();
    const url = immagine.toDataURL();
    win.destroy();
    return url;
  }, PAGINA_HTML);
  fs.writeFileSync(ALLEGATO, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`  carta d'esempio: ${ALLEGATO}`);
}

/** Crea un archivio locale dalla welcome modal (stesso percorso di `e2e/helpers.ts`). */
async function creaWorkspace(page, basePath) {
  await page.locator('#welcome-modal').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(
    () => typeof window.t === 'function' && typeof window.creaCartellaIniziale === 'function',
    null,
    { timeout: 20_000 },
  );
  await page.locator('#welcome-buttons button', { hasText: 'Crea Nuova Cartella Locale' }).click();
  await page.locator('#welcome-create-form').waitFor({ state: 'visible' });
  await page.locator('#welcome-new-folder-name').fill('Fondo Notarile');
  await page.locator('#welcome-new-folder-path').evaluate((el, v) => { el.value = v; }, basePath);
  await page.evaluate(() => window.creaCartellaIniziale());
  await page.locator('#btn-tab-add').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => window.__appPronta === true, null, { timeout: 20_000 });

  // Changelog e banner del primo avvio coprirebbero ogni schermata.
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.chiudiChangelogModal?.();
    window.chiudiInfoConfirm?.();
    window.nascondiMessaggi?.();
    window.rifiutaInvitoTutorial?.();
    document.getElementById('tutorial-banner')?.classList.add('hidden-tab');
    document.querySelectorAll('.driver-overlay, .driver-popover').forEach((e) => e.remove());
  });
  await page.waitForTimeout(400);
}

/** Popola l'archivio con cartelle, schede d'esempio e qualche collegamento. */
async function seed(page) {
  await page.evaluate(async (schede) => {
    appData.cartelle = ['Imbreviature', 'Imbreviature/Ser Giovanni di Lapo', 'Atti giudiziari', 'Estimi'];
    const cartellaDi = { imbreviature: 'Imbreviature', atti: 'Atti giudiziari', fiscali: 'Estimi' };
    const ora = Date.now();

    appData.manoscritti = schede.map((s, i) => ({
      id: crypto.randomUUID(),
      cartella: cartellaDi[s.tipo] || '',
      tipoDocumento: s.tipo,
      segnatura: s.seg,
      dataCronica: s.data || '',
      dataTopica: s.luogo || '',
      Notaio: s.notaio || '',
      tipo_di_atto: s.atto || '',
      oggetto: s.oggetto || '',
      note: s.tipo === 'fiscali' ? s.oggetto : '',
      motivazione_processo: s.tipo === 'atti' ? s.oggetto : '',
      tags: s.tags || '',
      allegati: [],
      attori_dinamici: s.notaio
        ? [{ chiave: 'Venditore', valore: 'Bindo di Lapo' }, { chiave: 'Acquirente', valore: 'Nera di Bindo' }]
        : [],
      trascrizione: i < 3
        ? '<p>In nomine Domini amen. Anno Domini millesimo trecentesimo quadragesimo, indictione octava, die XII mensis maii.</p><p>Bindus quondam Lapi de Florentia vendidit et tradidit Nerae filiae sue petiam unam terre posite in populo Sancti Petri.</p>'
        : '',
      lastModified: ora - i * 86_400_000,
      creatoDa: 'Antonio',
      modificatoDa: 'Antonio',
    }));

    // Qualche collegamento, o il pannello e il grafo sarebbero vuoti.
    const m = appData.manoscritti;
    m[0].relazioni = [{ id: m[1].id, tipo: 'atto collegato' }, { id: m[4].id, tipo: 'copia di' }];
    m[1].relazioni = [{ id: m[2].id, tipo: 'citato in' }];
    m[5].relazioni = [{ id: m[6].id, tipo: 'atto collegato' }];

    await window.Store.commit();
    window.renderMain?.();
    window.renderSidebar?.();
  }, SCHEDE);
  await page.waitForTimeout(800);
}

/** Aggiunge un allegato reale alla prima scheda, per la trascrizione e per l'OCR. */
async function aggiungiAllegato(page) {
  await page.evaluate(() => window.editItem(appData.manoscritti[0].id));
  await page.locator('#manoscritto-form').waitFor({ state: 'visible' });
  await page.locator('#form-allegato').setInputFiles(ALLEGATO);
  await page.waitForTimeout(800);
  await page.locator('#btn-submit-form').click();
  await page.waitForTimeout(1800);
  return page.evaluate(() => appData.manoscritti[0].id);
}

main().catch((e) => { console.error(e); process.exit(1); });
