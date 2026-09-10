import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, dismissOverlays } from './helpers';
import * as path from 'path';

/**
 * Fase 1.5 — azioni in massa, selezione dell'intero risultato e scorciatoie.
 *
 * Ogni seme contiene una scheda-ESCA che l'azione NON deve toccare: un'asserzione su un
 * conteggio che coincide con lo stato di partenza passerebbe anche ad azione inerte.
 */
type Riga = { segnatura: string; cartella?: string; tags?: string; tipoDocumento?: string; titolo?: string };

async function seed(page, righe: Riga[]) {
  await page.evaluate(async (righe) => {
    // @ts-ignore -- `appData` è una `let` globale (script classico), non window.appData.
    const data = appData;
    for (const r of righe) {
      data.manoscritti.push({
        id: crypto.randomUUID(),
        cartella: r.cartella ?? '',
        tipoDocumento: r.tipoDocumento || 'manoscritto',
        segnatura: r.segnatura,
        titolo: r.titolo || '',
        tags: r.tags || '',
        allegati: [],
        trascrizione: '',
        lastModified: 1,
        creatoDa: 'Anonimo',
        modificatoDa: 'Anonimo',
      });
      if (r.cartella && !data.cartelle.includes(r.cartella)) data.cartelle.push(r.cartella);
    }
    await (window as any).Store.commit();
  }, righe);
}

/** Il record con quella segnatura, letto da appData (non dal DOM). */
async function record(page, segnatura: string) {
  return page.evaluate((s) => {
    // @ts-ignore
    return appData.manoscritti.find((m) => m.segnatura === s);
  }, segnatura);
}

async function seleziona(page, segnature: string[]) {
  await page.evaluate((segnature) => {
    // @ts-ignore
    (window as any).selectedRecords = appData.manoscritti
      .filter((m) => segnature.includes(m.segnatura))
      .map((m) => m.id);
    (window as any).aggiornaStatoSelezione();
  }, segnature);
}

/** Applica l'azione del modale in massa e attende che si richiuda. */
async function applica(page) {
  await page.locator('#bulk-confirm').click();
  await expect(page.locator('#bulk-modal')).toBeHidden();
}

test.describe('Azioni in massa', () => {
  test('Ctrl+A seleziona tutti i risultati, non solo quelli a schermo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    // 60 schede: oltre la pagina da 50, così "tutti i risultati" e "tutte le card
    // renderizzate" danno numeri DIVERSI — senza questo il test sarebbe vacuo.
    const righe = Array.from({ length: 60 }, (_, i) => ({ segnatura: 'MS ' + (i + 1) }));
    await seed(page, righe);
    await dismissOverlays(page);

    const renderizzate = await page.locator('.card-scheda').count();
    expect(renderizzate).toBeLessThan(60);

    await page.locator('#titolo-cartella-attuale').click();   // fuoco fuori dai campi di testo
    await page.keyboard.press('Control+a');

    const selezionate = await page.evaluate(() => (window as any).selectedRecords.length);
    expect(selezionate).toBe(60);
    await expect(page.locator('#selection-indicator')).toContainText('60');
  });

  test('Ctrl+A è inerte dentro un campo di testo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await seed(page, [{ segnatura: 'MS 1' }, { segnatura: 'MS 2' }]);
    await dismissOverlays(page);

    await page.evaluate(() => (window as any).apriSidebarTab('search'));
    await page.locator('#search-input').fill('MS');
    await page.locator('#search-input').focus();
    await page.keyboard.press('Control+a');

    // Dentro la ricerca Ctrl+A deve selezionare il TESTO, non le schede.
    expect(await page.evaluate(() => (window as any).selectedRecords.length)).toBe(0);
  });

  test('sposta in un archivio: solo le schede selezionate cambiano cartella', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await createFolder(page, 'Notarile');
    await seed(page, [{ segnatura: 'A' }, { segnatura: 'B' }, { segnatura: 'ESCA' }]);
    await dismissOverlays(page);

    await seleziona(page, ['A', 'B']);
    await page.evaluate(() => (window as any).apriAzioneMassa('cartella'));
    await expect(page.locator('#bulk-modal')).toBeVisible();
    await expect(page.locator('#bulk-count')).toContainText('2');
    await page.locator('#bulk-cartella').selectOption('Notarile');
    await applica(page);

    expect((await record(page, 'A')).cartella).toBe('Notarile');
    expect((await record(page, 'B')).cartella).toBe('Notarile');
    expect((await record(page, 'ESCA')).cartella).toBe('');
    // La scheda toccata è marcata come modificata, l'esca no: senza questa asserzione un
    // `lastModified` scritto su tutta la selezione passerebbe inosservato fino al sync.
    expect((await record(page, 'ESCA')).lastModified).toBe(1);
    expect((await record(page, 'A')).lastModified).toBeGreaterThan(1);
  });

  test('tag: aggiunge senza duplicare e rimuove solo il tag esatto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await seed(page, [
      { segnatura: 'A', tags: 'pergamena' },
      { segnatura: 'B', tags: '' },
      { segnatura: 'ESCA', tags: '' },
    ]);
    await dismissOverlays(page);

    await seleziona(page, ['A', 'B']);
    await page.evaluate(() => (window as any).apriAzioneMassa('tag'));
    await page.locator('#bulk-tag-input').fill('Pergamena, notarile');
    await applica(page);

    // "Pergamena" non si aggiunge dove c'è già "pergamena": il tag esistente vince.
    expect((await record(page, 'A')).tags).toBe('pergamena, notarile');
    expect((await record(page, 'B')).tags).toBe('Pergamena, notarile');
    expect((await record(page, 'ESCA')).tags).toBe('');

    await seleziona(page, ['A']);
    await page.evaluate(() => (window as any).apriAzioneMassa('tag'));
    await page.locator('#bulk-tag-modo').selectOption('rimuovi');
    await page.locator('#bulk-tag-input').fill('not');
    await applica(page);

    // "not" NON deve portarsi via "notarile": la rimozione è per corrispondenza esatta.
    expect((await record(page, 'A')).tags).toBe('pergamena, notarile');
  });

  test('trova e sostituisci: anteprima, applicazione e annullamento', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await seed(page, [
      { segnatura: 'ASP 1' },
      { segnatura: 'ASP 2' },
      { segnatura: 'ASF 3' },   // esca: nessuna occorrenza
    ]);
    await dismissOverlays(page);

    await seleziona(page, ['ASP 1', 'ASP 2', 'ASF 3']);
    await page.evaluate(() => (window as any).apriAzioneMassa('sostituisci'));
    await expect(page.locator('#bulk-modal')).toBeVisible();

    // A ricerca vuota il pulsante è disabilitato: applicare "niente" non è un'azione.
    await expect(page.locator('#bulk-confirm')).toBeDisabled();

    await page.locator('#bulk-cerca').fill('ASP');
    await expect(page.locator('#bulk-anteprima')).toContainText('2');
    await expect(page.locator('#bulk-confirm')).toBeEnabled();

    await page.locator('#bulk-sostituisci').fill('ASPg');
    await applica(page);

    expect((await record(page, 'ASPg 1'))).toBeTruthy();
    expect((await record(page, 'ASF 3'))).toBeTruthy();

    // L'undo riporta indietro TUTTE le schede toccate, in un colpo solo.
    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(async () => !!(await record(page, 'ASP 1'))).toBe(true);
    expect((await record(page, 'ASP 2'))).toBeTruthy();
  });

  test('cambia tipo: il modale avverte e il tipo cambia solo sulla selezione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await seed(page, [{ segnatura: 'A' }, { segnatura: 'ESCA' }]);
    await dismissOverlays(page);

    // Un secondo tipo deve esistere, altrimenti il test cambierebbe tipo verso se stesso.
    const secondo = await page.evaluate(() => {
      // @ts-ignore
      const altri = appData.tipiDocumento.filter((t) => t.id !== 'manoscritto');
      return altri.length > 0 ? altri[0].id : null;
    });
    test.skip(!secondo, 'Nessun secondo tipo documento nel workspace di default');

    await seleziona(page, ['A']);
    await page.evaluate(() => (window as any).apriAzioneMassa('tipo'));
    await expect(page.locator('#bulk-modal')).toBeVisible();
    await page.locator('#bulk-tipo').selectOption(secondo!);
    await applica(page);

    expect((await record(page, 'A')).tipoDocumento).toBe(secondo);
    expect((await record(page, 'ESCA')).tipoDocumento).toBe('manoscritto');
  });

  test('senza selezione il modale non si apre', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await seed(page, [{ segnatura: 'MS 1' }]);
    await dismissOverlays(page);

    await page.evaluate(() => (window as any).apriAzioneMassa('tag'));
    await expect(page.locator('#bulk-modal')).toBeHidden();
  });

  test('Esc chiude il modale e, senza modali, azzera la selezione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await seed(page, [{ segnatura: 'MS 1' }, { segnatura: 'MS 2' }]);
    await dismissOverlays(page);

    await seleziona(page, ['MS 1', 'MS 2']);
    await page.evaluate(() => (window as any).apriAzioneMassa('tag'));
    await expect(page.locator('#bulk-modal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#bulk-modal')).toBeHidden();
    // Il primo Esc chiude il modale e NON tocca la selezione: costruirla costa,
    // perderla per una finestra chiusa sarebbe una punizione.
    expect(await page.evaluate(() => (window as any).selectedRecords.length)).toBe(2);

    await page.locator('#titolo-cartella-attuale').click();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).selectedRecords.length)).toBe(0);
  });

  test('la palette elenca le azioni in massa solo con una selezione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await seed(page, [{ segnatura: 'MS 1' }]);
    await dismissOverlays(page);

    const idComandi = async (query: string) =>
      page.evaluate((q) => (window as any).costruisciComandi(q).map((c: any) => c.id), query);

    let ids = await idComandi('');
    expect(ids).toContain('seleziona-tutti');
    expect(ids).not.toContain('massa-tag');

    await seleziona(page, ['MS 1']);
    ids = await idComandi('');
    expect(ids).toContain('massa-tag');
    expect(ids).toContain('massa-sostituisci');
  });

  test('il pannello "?" documenta le scorciatoie nuove', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await dismissOverlays(page);

    await page.evaluate(() => (window as any).apriScorciatoie());
    const corpo = page.locator('#shortcuts-body');
    await expect(corpo).toBeVisible();

    // Le combinazioni implementate in app.ts e la tabella che le documenta possono
    // divergere in silenzio: qui si verifica almeno che il gruppo nuovo ci sia tutto.
    const righe = await corpo.locator('kbd').evaluateAll((els) => els.map((e) => e.textContent!.trim()));
    for (const tasto of ['Canc', 'F2', 'Maiusc']) expect(righe).toContain(tasto);
    // Nessuna chiave i18n grezza a schermo: una chiave mancante si vede così.
    await expect(corpo).not.toContainText('shortcut_bulk');
  });
});
