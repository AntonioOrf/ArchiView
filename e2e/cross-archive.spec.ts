import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { test, launchApp, closeApp } from './fixtures';
import { openSidebarPanel, getAppData } from './helpers';

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const versione: string = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

const GIUDIZIARIO = { id: 'giudiziario', nome: 'Giudiziario', campi: ['attori_dinamici', 'dataTopica', 'note'] };

function scriviArchivio(dir: string, manoscritti: any[], tipi: any[] = [GIUDIZIARIO], extra: any = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'database_manoscritti.json'), JSON.stringify({
    schemaVersion: 4, cartelle: [], manoscritti, tipiDocumento: tipi, ...extra
  }));
}

function semina(userDataDir: string, extraN1: any = {}) {
  const ws = path.join(userDataDir, 'ws');
  const attivo = path.join(ws, 'Notarile');
  const giudiziario = path.join(ws, 'Giudiziario San Miniato');
  const sparito = path.join(ws, 'Sparito');
  scriviArchivio(attivo, [{ id: 'n1', tipoDocumento: 'giudiziario', segnatura: 'N1', note: "Luca d'Abete nell'archivio aperto", ...extraN1 }],
    [GIUDIZIARIO, { id: 'notarile', nome: 'Notarile', campi: ['attori_dinamici', 'note'] }],
    { vocabolari: { relazione: { id: 'relazione', nome: 'Tipo di relazione', valori: ['citato in', 'prosegue'] } } });
  scriviArchivio(giudiziario, [{
    id: 'a1', tipoDocumento: 'giudiziario', segnatura: 'Podestà 12, c. 3r', lastModified: 1,
    attori_dinamici: [{ k: 'Imputato', v: 'Luca d’Abete' }], dataTopica: 'San Miniato', note: "Gioco d'azzardo",
    allegati: [{ nome: 'carta-3r.png', tipo: 'immagine', originalName: 'c. 3r',
      trascrizione: '<p>Lucas de <i>Abete</i> ludens</p><img src="x" onerror="window.__xss = 1">' }]
  }]);
  fs.mkdirSync(path.join(giudiziario, 'allegati_manoscritti'), { recursive: true });
  fs.writeFileSync(path.join(giudiziario, 'allegati_manoscritti', 'carta-3r.png'), PNG_1PX);
  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({
    workspacePath: attivo, recentWorkspaces: [attivo, giudiziario, sparito], lastSeenVersion: versione
  }));
  return { attivo, giudiziario, sparito };
}

test('ricerca, anteprima ed esclusione di un altro archivio dal main', async ({ userDataDir }) => {
  const { giudiziario } = semina(userDataDir);
  const { app, page } = await launchApp(userDataDir);
  try {
    await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });

    const esito: any = await page.evaluate(() => (window as any).apiBrowser.crossArchiveSearch({ testo: "luca d'abete" }));
    expect(esito.ok).toBe(true);
    expect(esito.motore).toBe('worker');
    expect(esito.archivi.map((a: any) => a.nome)).toEqual(['Giudiziario San Miniato', 'Sparito']);
    const [g, s] = esito.archivi;
    expect(g).toMatchObject({ raggiungibile: true, schede: 1, tipo: 'local' });
    expect(s).toMatchObject({ raggiungibile: false, errore: 'assente' });
    expect(esito.risultati).toHaveLength(1);
    expect(esito.risultati[0]).toMatchObject({ archivioId: g.id, schedaId: 'a1', campo: 'attori_dinamici', tipoNome: 'Giudiziario' });
    expect(JSON.stringify(esito)).not.toContain(userDataDir.replace(/\\/g, '\\\\'));

    const vault = JSON.parse(fs.readFileSync(path.join(giudiziario, '.archiview-vault.json'), 'utf8'));
    expect(vault.archivioId).toBe(g.id);

    const anteprima: any = await page.evaluate((id) => (window as any).apiBrowser.crossArchiveGet(id, 'a1'), g.id);
    expect(anteprima.ok).toBe(true);
    expect(anteprima.scheda.dataTopica).toBe('San Miniato');
    expect(anteprima.tipo.id).toBe('giudiziario');

    const ostili: any[] = await page.evaluate(async () => {
      const api = (window as any).apiBrowser;
      return [await api.crossArchiveGet('percorso:../../etc', 'a1'), await api.crossArchiveGet({ x: 1 }, 'a1'), await api.crossArchiveGet('x'.repeat(500), 'a1')];
    });
    for (const o of ostili) expect(o.ok).toBe(false);

    await page.evaluate((id) => (window as any).apiSettings.patch({ crossArchiveEsclusi: [id] }), g.id);
    const dopo: any = await page.evaluate(() => (window as any).apiBrowser.crossArchiveSearch({ testo: "luca d'abete" }));
    expect(dopo.risultati).toHaveLength(0);
    expect(dopo.archivi.map((a: any) => a.nome)).toEqual(['Sparito']);
    const elenco: any = await page.evaluate(() => (window as any).apiBrowser.crossArchiveArchivi());
    expect(elenco.archivi.find((a: any) => a.id === g.id).escluso).toBe(true);
    expect(elenco.archivi.find((a: any) => a.nome === 'Sparito').raggiungibile).toBe(false);
    expect((await page.evaluate((id) => (window as any).apiBrowser.crossArchiveGet(id, 'a1'), g.id) as any).ok).toBe(false);
  } finally {
    await closeApp(app);
  }
});

test('interruttore nella ricerca, risultati raggruppati e anteprima in sola lettura', async ({ userDataDir }) => {
  semina(userDataDir);
  const { app, page } = await launchApp(userDataDir);
  try {
    await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await openSidebarPanel(page, 'search');
    const sezione = page.locator('#altri-archivi');
    const interruttore = page.locator('#search-altri-archivi');

    await expect(interruttore).not.toBeChecked();
    await page.locator('#search-input').fill("luca d'abete");
    await expect(page.locator('#card-n1')).toBeVisible();
    await expect(sezione).toBeHidden();

    await interruttore.check();
    await expect(sezione).toBeVisible();
    await expect(page.locator('#altri-archivi-stato')).toHaveText('1 scheda in un altro archivio');
    const gruppo = sezione.locator('.altri-archivi-gruppo');
    await expect(gruppo).toHaveCount(1);
    await expect(gruppo.locator('.altri-archivi-gruppo-titolo')).toContainText('Giudiziario San Miniato');
    const risultato = gruppo.locator('.altri-archivi-risultato');
    await expect(risultato).toHaveCount(1);
    await expect(risultato).toContainText('Podestà 12, c. 3r');
    await expect(risultato.locator('mark')).toHaveText('Luca');
    await expect(sezione).not.toContainText('N1');
    await expect(sezione.locator('.altri-archivi-assenti')).toContainText('Sparito');

    const dati = await getAppData(page);
    expect(dati.manoscritti.map((m: any) => m.id)).toEqual(['n1']);

    await page.locator('#search-input').fill('azzardo');
    await expect(risultato).toContainText('Gioco');
    await page.locator('#search-input').fill('nessunacorrispondenza');
    await expect(page.locator('#altri-archivi-stato')).toContainText('Nessuna scheda negli altri archivi');
    await expect(sezione.locator('.altri-archivi-risultato')).toHaveCount(0);

    await page.locator('#search-input').fill("luca d'abete");
    await risultato.click();
    const modal = page.locator('#altro-archivio-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#altro-archivio-titolo')).toHaveText('Podestà 12, c. 3r');
    await expect(page.locator('#altro-archivio-sottotitolo')).toContainText('Giudiziario San Miniato');
    await expect(page.locator('#altro-archivio-sottotitolo')).toContainText('sola lettura');
    const campi = modal.locator('.altri-archivi-campi');
    await expect(campi).toContainText('Imputato: Luca d’Abete');
    await expect(campi).toContainText('San Miniato');
    const img = modal.locator('img.altri-archivi-immagine');
    await expect(img).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1);
    await modal.locator('summary').click();
    await expect(modal.locator('.altri-archivi-trascrizione')).toContainText('Lucas de Abete ludens');
    expect(await modal.locator('.altri-archivi-trascrizione [onerror]').count()).toBe(0);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(await modal.locator('input, textarea, select, [contenteditable="true"]').count()).toBe(0);

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    await interruttore.uncheck();
    await expect(sezione).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('archiview.ricercaAltriArchivi'))).toBe('0');
  } finally {
    await closeApp(app);
  }
});

async function apriAnteprimaA1(page: any) {
  await openSidebarPanel(page, 'search');
  await page.locator('#search-altri-archivi').check();
  await page.locator('#search-input').fill("luca d'abete");
  await page.locator('#altri-archivi .altri-archivi-risultato').click();
  await expect(page.locator('#altro-archivio-modal .altri-archivi-campi')).toBeVisible();
}

test('copia della scheda intera: riepilogo, allegati, provenienza, annullamento', async ({ userDataDir }) => {
  const { attivo } = semina(userDataDir);
  const { app, page } = await launchApp(userDataDir);
  try {
    await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await apriAnteprimaA1(page);
    await page.locator('#altro-archivio-copia').click();
    const dialogo = page.locator('#copia-archivio-modal');
    await expect(dialogo).toBeVisible();
    await expect(page.locator('#copia-archivio-origine')).toContainText('Giudiziario San Miniato · Podestà 12, c. 3r');

    const riepilogo = page.locator('#copia-archivio-riepilogo');
    await expect(page.locator('#copia-archivio-tipo')).toHaveValue('giudiziario');
    await expect(riepilogo).toContainText('Tipo di documento: Giudiziario');
    await expect(riepilogo).not.toContainText('campi propri');
    await page.locator('#copia-archivio-tipo').selectOption('notarile');
    await expect(riepilogo).toContainText('Un campo diventa campo proprio della scheda: Data Topica');
    await expect(riepilogo).toContainText('San Miniato (nuovo)');
    await expect(riepilogo).toContainText('Senza allegati la trascrizione resta sulla scheda');

    await expect(page.locator('#copia-archivio-allegati-testo')).toContainText('1 file');
    await page.locator('#copia-archivio-allegati').check();
    await expect(riepilogo).toContainText('Allegati: 1 copiati, 0 IIIF, 0 non presenti');
    await expect(page.locator('#copia-archivio-visibilita')).toBeHidden();

    await page.locator('#copia-archivio-conferma').click();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('#altro-archivio-modal')).toBeHidden();

    const dati = await getAppData(page);
    const copia = dati.manoscritti.find((m: any) => m.provenienza);
    expect(copia).toBeTruthy();
    expect(copia.id).not.toBe('a1');
    expect(copia.tipoDocumento).toBe('notarile');
    expect(copia.segnatura).toBe('Podestà 12, c. 3r');
    expect(copia.dataTopica).toBe('San Miniato');
    expect(copia.campiPropri.map((d: any) => d.id)).toEqual(['dataTopica']);
    expect(copia.provenienza).toMatchObject({ archivioNome: 'Giudiziario San Miniato', schedaId: 'a1', segnatura: 'Podestà 12, c. 3r' });
    expect(copia.allegati).toHaveLength(1);
    const nome = copia.allegati[0].nome;
    expect(nome.startsWith(String(copia.id).replace(/[^a-zA-Z0-9_-]/g, '_'))).toBe(true);
    expect(copia.allegati[0].trascrizione).toContain('Lucas de');
    const file = path.join(attivo, 'allegati_manoscritti', nome);
    expect(fs.existsSync(file)).toBe(true);
    expect(copia.allegati[0].hash).toBe(crypto.createHash('sha256').update(PNG_1PX).digest('hex'));

    await expect.poll(() => {
      const db = JSON.parse(fs.readFileSync(path.join(attivo, 'database_manoscritti.json'), 'utf8'));
      return db.manoscritti.some((m: any) => m.id === copia.id);
    }).toBe(true);

    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(async () => (await getAppData(page)).manoscritti.map((m: any) => m.id)).toEqual(['n1']);
  } finally {
    await closeApp(app);
  }
});

test('copia di un singolo campo: negli appunti e dentro la scheda aperta', async ({ userDataDir }) => {
  semina(userDataDir);
  const { app, page } = await launchApp(userDataDir);
  try {
    await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await apriAnteprimaA1(page);

    const modal = page.locator('#altro-archivio-modal');
    await expect(modal.locator('[data-inserisci]')).toHaveCount(0);
    await expect(modal.locator('.altri-archivi-azione svg').first()).toBeVisible();
    await modal.locator('dd', { hasText: "Gioco d'azzardo" }).locator('.altri-archivi-azione').first().click();
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe("Gioco d'azzardo");
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    const { id } = await page.evaluate(async () => {
      const r = await (window as any).apiBrowser.crossArchiveSearch({ testo: "luca d'abete" });
      return { id: r.risultati[0].archivioId };
    });
    await page.evaluate(() => (window as any).switchTab('add'));
    await expect(page.locator('#view-add')).toBeVisible();
    await page.evaluate((archivioId) => (window as any).apriAnteprimaAltroArchivio(archivioId, 'a1'), id);
    await expect(modal.locator('.altri-archivi-campi')).toBeVisible();
    await expect(modal.locator('[data-inserisci="note"]')).toHaveCount(0);
    await modal.locator('[data-inserisci="dataTopica"]').click();
    await expect(page.locator('#dyn-dataTopica')).toHaveValue('San Miniato');
    await page.locator('#dyn-dataTopica').fill('Firenze');
    await modal.locator('[data-inserisci="dataTopica"]').click();
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await expect(page.locator('#dyn-dataTopica')).toHaveValue('Firenze');
    await page.locator('#btn-bottom-confirm-yes').click();
    await expect(page.locator('#dyn-dataTopica')).toHaveValue('San Miniato');
    await modal.locator('[data-inserisci="attori_dinamici"]').click();
    await expect(page.locator('#container-attori_dinamici .dynamic-list-row')).toHaveCount(1);
    await expect(page.locator('#container-attori_dinamici input').nth(1)).toHaveValue('Luca d’Abete');
    expect((await getAppData(page)).manoscritti.map((m: any) => m.id)).toEqual(['n1']);
  } finally {
    await closeApp(app);
  }
});

test('rimandi ad altri archivi e provenienza nel form', async ({ userDataDir }) => {
  semina(userDataDir, {
    lastModified: 1,
    rimandiEsterni: [{ archivioId: 'xx', archivioNome: 'Sparito', schedaId: 's1', segnatura: 'S1' }],
    provenienza: { archivioId: 'id-di-un-altro-pc', archivioNome: 'Giudiziario San Miniato', schedaId: 'a1',
      segnatura: 'Podestà 12, c. 3r', copiataIl: Date.UTC(2026, 9, 1, 12) }
  });
  const { app, page } = await launchApp(userDataDir);
  try {
    await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await page.evaluate(() => (window as any).editItem('n1'));
    await expect(page.locator('#view-add')).toBeVisible();

    const prov = page.locator('#form-provenienza');
    await expect(prov).toBeVisible();
    await expect(prov).toContainText('Copiata da Giudiziario San Miniato · Podestà 12, c. 3r');
    await page.locator('#form-provenienza-apri').click();
    const anteprima = page.locator('#altro-archivio-modal');
    await expect(page.locator('#altro-archivio-titolo')).toHaveText('Podestà 12, c. 3r');
    await page.keyboard.press('Escape');
    await expect(anteprima).toBeHidden();

    const sparito = page.locator('[data-rimando="xx:s1"]');
    await expect(sparito).toContainText('S1 · Sparito');
    await expect(sparito).toContainText('archivio non disponibile su questo computer');
    await expect(sparito.locator('[data-apri-rimando]')).toHaveCount(0);

    await page.locator('#btn-rimando-esterno').click();
    const selettore = page.locator('#rimando-esterno-modal');
    await expect(selettore).toBeVisible();
    await page.locator('#rimando-esterno-tipo').selectOption('citato in');
    await page.locator('#rimando-esterno-cerca').fill('abete');
    const risultato = selettore.locator('.altri-archivi-risultato', { hasText: 'Podestà 12, c. 3r' });
    await risultato.click();
    await expect(selettore).toBeHidden();
    const nuovo = page.locator('#form-rimandi-esterni-list .rel-riga', { hasText: 'Podestà 12, c. 3r' });
    await expect(nuovo).toContainText('citato in');
    await expect(nuovo).toContainText('Giudiziario San Miniato');
    await nuovo.locator('[data-apri-rimando]').click();
    await expect(anteprima).toBeVisible();
    await page.keyboard.press('Escape');

    await sparito.locator('[data-togli-rimando]').click();
    await expect(sparito).toHaveCount(0);
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
    await expect.poll(async () => {
      const n1 = (await getAppData(page)).manoscritti.find((m: any) => m.id === 'n1');
      return n1.rimandiEsterni;
    }).toEqual([expect.objectContaining({ archivioNome: 'Giudiziario San Miniato', schedaId: 'a1', segnatura: 'Podestà 12, c. 3r', tipo: 'citato in' })]);
    const n1 = (await getAppData(page)).manoscritti.find((m: any) => m.id === 'n1');
    expect(n1.provenienza.schedaId).toBe('a1');

    await page.evaluate(() => (window as any).editItem('n1'));
    await expect(nuovo).toBeVisible();
    await page.locator('#btn-rimando-esterno').click();
    await page.locator('#rimando-esterno-cerca').fill('abete');
    await expect(risultato).toBeDisabled();
    await expect(risultato).toContainText('già collegata');
    await page.keyboard.press('Escape');
    await expect(selettore).toBeHidden();

    await nuovo.locator('[data-togli-rimando]').click();
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
    await expect.poll(async () => 'rimandiEsterni' in (await getAppData(page)).manoscritti.find((m: any) => m.id === 'n1')).toBe(false);
  } finally {
    await closeApp(app);
  }
});

test('suggerimento nel form: lo stesso nome negli altri archivi', async ({ userDataDir }) => {
  semina(userDataDir);
  const { app, page } = await launchApp(userDataDir);
  try {
    await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await page.evaluate(() => (window as any).switchTab('add'));
    await expect(page.locator('#view-add')).toBeVisible();

    const luogo = page.locator('#dyn-dataTopica');
    await luogo.fill('San Miniato');
    await luogo.press('Tab');
    const chipLuogo = page.locator('[data-suggerimento="dataTopica"]');
    await expect(chipLuogo).toHaveText('Trovato in un altro archivio');
    await luogo.fill('Firenze');
    await expect(chipLuogo).toHaveCount(0);
    await luogo.press('Tab');
    await page.waitForTimeout(800);
    await expect(chipLuogo).toHaveCount(0);

    await luogo.fill('San Miniato');
    await luogo.press('Tab');
    await page.evaluate(() => (window as any).aggiungiElementoDinamico('attori_dinamici', '', ''));
    const prima = page.locator('#container-attori_dinamici .dynamic-list-row').last();
    await prima.locator('.list-val').fill("Luca d'Abete");
    await prima.locator('.list-val').press('Tab');
    await expect(prima.locator('[data-suggerimento]')).toBeVisible();
    await expect(chipLuogo).toBeVisible();
    await prima.locator('button[aria-label]').first().click();

    await page.evaluate(() => (window as any).aggiungiElementoDinamico('attori_dinamici', '', ''));
    const riga = page.locator('#container-attori_dinamici .dynamic-list-row').last();
    await riga.locator('.list-val').fill('luca d’ABETE');
    const chipPersona = riga.locator('[data-suggerimento="attori_dinamici"]');
    await expect(chipPersona).toBeVisible();
    await riga.locator('.list-val').fill('Luca');
    await expect(chipPersona).toHaveCount(0);
    await page.waitForTimeout(800);
    await expect(chipPersona).toHaveCount(0);
    await riga.locator('.list-val').fill("Luca d'Abete");
    await expect(chipPersona).toBeVisible();

    await chipPersona.click();
    const omonimi = page.locator('#omonimi-modal');
    await expect(omonimi).toBeVisible();
    await expect(page.locator('#omonimi-titolo')).toHaveText("Luca d'Abete negli altri archivi");
    const voce = omonimi.locator('.omonimi-voce', { hasText: 'Podestà 12, c. 3r' });
    await voce.locator('.omonimi-collega').click();
    await expect(voce.locator('.omonimi-collega')).toBeDisabled();
    await expect(page.locator('#form-rimandi-esterni-list .rel-riga', { hasText: 'Podestà 12, c. 3r' })).toBeVisible();

    await voce.locator('.altri-archivi-risultato').click();
    const anteprima = page.locator('#altro-archivio-modal');
    await expect(anteprima).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(anteprima).toBeHidden();
    await expect(omonimi).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(omonimi).toBeHidden();

    await riga.locator('button[aria-label]').first().click();
    await expect(page.locator('[data-suggerimento="attori_dinamici"]')).toHaveCount(0);

    await page.evaluate(() => (window as any).apiSettings.patch({ suggerimentiAltriArchivi: false }));
    await page.waitForTimeout(2100);
    await page.locator('#dyn-dataTopica').fill('San Miniato');
    await page.locator('#dyn-dataTopica').press('Tab');
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-suggerimento]')).toHaveCount(0);
  } finally {
    await closeApp(app);
  }
});

test('impostazioni: archivi in cui cercare e suggerimento nel form', async ({ userDataDir }) => {
  semina(userDataDir);
  const { app, page } = await launchApp(userDataDir);
  try {
    await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await openSidebarPanel(page, 'search');
    await page.locator('#search-altri-archivi').check();
    await page.locator('#search-input').fill("luca d'abete");
    await expect(page.locator('#altri-archivi-stato')).toHaveText('1 scheda in un altro archivio');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await page.evaluate(() => (window as any).cambiaTabImpostazioni('tab-data'));
    const lista = page.locator('#settings-cross-archivi');
    const giudiziario = lista.locator('label', { hasText: 'Giudiziario San Miniato' }).locator('input');
    await expect(giudiziario).toBeChecked();
    await expect(lista.locator('label', { hasText: 'Sparito' })).toContainText('cartella non trovata');
    await expect(lista).not.toContainText('Notarile');
    const sugg = page.locator('#settings-cross-suggerimenti');
    await expect(sugg).toBeChecked();

    await giudiziario.uncheck();
    await expect.poll(async () => (await page.evaluate(() => (window as any).apiSettings.get())).crossArchiveEsclusi?.length).toBe(1);
    const r: any = await page.evaluate(() => (window as any).apiBrowser.crossArchiveSearch({ testo: "luca d'abete", canale: 'prova' }));
    expect(r.risultati).toHaveLength(0);
    await expect(page.locator('#altri-archivi-stato')).toContainText('Nessuna scheda negli altri archivi');

    await giudiziario.check();
    await expect.poll(async () => (await page.evaluate(() => (window as any).apiSettings.get())).crossArchiveEsclusi).toEqual([]);
    await expect(page.locator('#altri-archivi-stato')).toHaveText('1 scheda in un altro archivio');

    await sugg.uncheck();
    await expect.poll(async () => (await page.evaluate(() => (window as any).apiSettings.get())).suggerimentiAltriArchivi).toBe(false);
    await sugg.check();
    await expect.poll(async () => (await page.evaluate(() => (window as any).apiSettings.get())).suggerimentiAltriArchivi).toBe(true);

    await giudiziario.uncheck();
    await page.keyboard.press('Escape');
    await page.evaluate(() => (window as any).apriImpostazioni());
    await page.evaluate(() => (window as any).cambiaTabImpostazioni('tab-data'));
    await expect(lista.locator('label', { hasText: 'Giudiziario San Miniato' }).locator('input')).not.toBeChecked();
  } finally {
    await closeApp(app);
  }
});
