import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, dismissOverlays } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Massa' });

type Riga = { segnatura: string; cartella?: string; tags?: string; tipoDocumento?: string; titolo?: string };

async function seed(page, righe: Riga[]) {
  await page.evaluate(async (righe) => {
    // @ts-ignore
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

async function applica(page) {
  await page.locator('#bulk-confirm').click();
  await expect(page.locator('#bulk-modal')).toBeHidden();
}

test.describe('Azioni in massa', () => {
  test('Ctrl+A seleziona tutti i risultati, non solo quelli a schermo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    const righe = Array.from({ length: 60 }, (_, i) => ({ segnatura: 'MS ' + (i + 1) }));
    await seed(page, righe);
    await dismissOverlays(page);

    const renderizzate = await page.locator('.card-scheda').count();
    expect(renderizzate).toBeLessThan(60);

    await page.locator('#titolo-cartella-attuale').click();
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
    expect((await record(page, 'ESCA')).lastModified).toBe(1);
    expect((await record(page, 'A')).lastModified).toBeGreaterThan(1);
  });

  test('F6 — Invio nel dialogo dei tag non esegue lo spostamento annullato prima', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await createFolder(page, 'Notarile');
    await seed(page, [{ segnatura: 'A' }, { segnatura: 'B' }]);
    await dismissOverlays(page);

    await seleziona(page, ['A', 'B']);
    await page.evaluate(() => (window as any).apriAzioneMassa('cartella'));
    await page.locator('#bulk-cartella').selectOption('Notarile');
    await page.keyboard.press('Escape');
    await expect(page.locator('#bulk-modal')).toBeHidden();

    await page.evaluate(() => (window as any).apriAzioneMassa('tag'));
    await page.locator('#bulk-tag-input').fill('notarile');
    await page.locator('#bulk-tag-input').press('Enter');
    await expect(page.locator('#bulk-modal')).toBeHidden();

    expect((await record(page, 'A')).tags).toContain('notarile');
    expect((await record(page, 'A')).cartella).toBe('');
    expect((await record(page, 'B')).cartella).toBe('');
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

    expect((await record(page, 'A')).tags).toBe('pergamena, notarile');
    expect((await record(page, 'B')).tags).toBe('Pergamena, notarile');
    expect((await record(page, 'ESCA')).tags).toBe('');

    await seleziona(page, ['A']);
    await page.evaluate(() => (window as any).apriAzioneMassa('tag'));
    await page.locator('#bulk-tag-modo').selectOption('rimuovi');
    await page.locator('#bulk-tag-input').fill('not');
    await applica(page);

    expect((await record(page, 'A')).tags).toBe('pergamena, notarile');
  });

  test('trova e sostituisci: anteprima, applicazione e annullamento', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await seed(page, [
      { segnatura: 'ASP 1' },
      { segnatura: 'ASP 2' },
      { segnatura: 'ASF 3' },
    ]);
    await dismissOverlays(page);

    await seleziona(page, ['ASP 1', 'ASP 2', 'ASF 3']);
    await page.evaluate(() => (window as any).apriAzioneMassa('sostituisci'));
    await expect(page.locator('#bulk-modal')).toBeVisible();

    await expect(page.locator('#bulk-confirm')).toBeDisabled();

    await page.locator('#bulk-cerca').fill('ASP');
    await expect(page.locator('#bulk-anteprima')).toContainText('2');
    await expect(page.locator('#bulk-confirm')).toBeEnabled();

    await page.locator('#bulk-sostituisci').fill('ASPg');
    await applica(page);

    expect((await record(page, 'ASPg 1'))).toBeTruthy();
    expect((await record(page, 'ASF 3'))).toBeTruthy();

    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(async () => !!(await record(page, 'ASP 1'))).toBe(true);
    expect((await record(page, 'ASP 2'))).toBeTruthy();
  });

  test('cambia tipo: il modale avverte e il tipo cambia solo sulla selezione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await seed(page, [{ segnatura: 'A' }, { segnatura: 'ESCA' }]);
    await dismissOverlays(page);

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

  test('F14 — gli strumenti d\'archivio sono nella palette anche senza selezione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await dismissOverlays(page);
    await page.evaluate(() => { (window as any).selectedRecords = []; });
    const ids = await page.evaluate(() => (window as any).costruisciComandi('').map((c: any) => c.id));
    for (const id of ['cestino', 'vocabolari', 'anagrafica', 'gestione-tag', 'grafo', 'snapshot-crea', 'duplicati']) {
      expect(ids, id).toContain(id);
    }
    expect(ids).not.toContain('massa-tag');
  });

  test('il pannello "?" documenta le scorciatoie nuove', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    await dismissOverlays(page);

    await page.evaluate(() => (window as any).apriScorciatoie());
    const corpo = page.locator('#shortcuts-body');
    await expect(corpo).toBeVisible();

    const righe = await corpo.locator('kbd').evaluateAll((els) => els.map((e) => e.textContent!.trim()));
    for (const tasto of ['Canc', 'F2', 'Maiusc']) expect(righe).toContain(tasto);
    await expect(corpo).not.toContainText('shortcut_bulk');
  });

  test('D9 — copia e incolla: clone con id nuovo, firma nuova, senza rimandi, file proprio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Massa');
    const fs = require('fs');
    const dirAllegati = path.join(userDataDir, 'ws', 'Massa', 'allegati_manoscritti');
    fs.mkdirSync(dirAllegati, { recursive: true });
    fs.writeFileSync(path.join(dirAllegati, 'd9_carta.jpg'), 'immagine');

    const esito = await page.evaluate(async () => {
      const w = window as any;
      // @ts-ignore
      appData.manoscritti.push(
        { id: 'd9-a', segnatura: 'MS D9', cartella: '', lastModified: 1, creatoDa: 'Altro', modificatoDa: 'Altro',
          relazioni: [{ id: 'd9-b' }], allegati: [{ nome: 'd9_carta.jpg', tipo: 'image/jpeg', trascrizione: '<p>t</p>' }] },
        { id: 'd9-b', segnatura: 'MS B', cartella: '', lastModified: 1 });
      await w.Store.commit();
      w.copiedRecordIds = ['d9-a'];
      w.cutRecordIds = [];
      await w.incollaRecord('');
      // @ts-ignore
      return appData.manoscritti.filter((m: any) => !['d9-a', 'd9-b'].includes(String(m.id)));
    });

    expect(esito).toHaveLength(1);
    const c = esito[0];
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(c.segnatura).toBe('MS D9 (Copia)');
    expect(c.creatoDa).not.toBe('Altro');
    expect(c.lastModified).toBeGreaterThan(1);
    expect(c.relazioni || []).toEqual([]);
    expect(c.allegati).toHaveLength(1);
    expect(c.allegati[0].nome).not.toBe('d9_carta.jpg');
    expect(c.allegati[0].trascrizione).toBe('<p>t</p>');
    expect(fs.readFileSync(path.join(dirAllegati, c.allegati[0].nome), 'utf8')).toBe('immagine');
  });
});
