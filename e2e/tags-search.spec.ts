import { test, expect } from './fixtures';
import { createLocalWorkspace, seedItems, openSidebarPanel } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Tags' });

test.describe('Tag e Ricerca', () => {
  test('il pannello tag mostra i tag delle schede', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await seedItems(page, 6, { tagPrefix: 'periodo' });

    await openSidebarPanel(page, 'tags');
    await expect(page.locator('#tag-list')).toContainText('periodo-0');
    await expect(page.locator('#tag-list')).toContainText('periodo-1');
    await expect(page.locator('#tag-list')).toContainText('periodo-2');
  });

  test('click su un tag filtra la griglia e #btn-clear-tag lo rimuove', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await seedItems(page, 6, { tagPrefix: 'periodo' });

    await openSidebarPanel(page, 'tags');
    await page.locator('#tag-list button', { hasText: 'periodo-0' }).click();

    await expect(page.locator('#counter-results')).toContainText('2');
    await expect(page.locator('#btn-clear-tag')).toBeVisible();

    await page.locator('#btn-clear-tag').click();
    await expect(page.locator('#counter-results')).toContainText('6');
  });

  test('#global-tag-search filtra la lista tag visibili', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await seedItems(page, 3, { tagPrefix: 'unico' });
    await seedItems(page, 3, { tagPrefix: 'altro' });

    await openSidebarPanel(page, 'tags');
    await page.locator('#global-tag-search').fill('unico');
    await page.evaluate(() => (window as any).renderTagList());

    await expect(page.locator('#tag-list')).toContainText('unico-0');
    await expect(page.locator('#tag-list')).not.toContainText('altro-0');
  });

  test('filtro multi-tag combina i criteri (AND)', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await page.evaluate(async () => {
      const w = window as any;
      // @ts-ignore
      appData.manoscritti.push(
        { id: crypto.randomUUID(), cartella: '', tipoDocumento: 'manoscritto', segnatura: 'A', tags: 'rosso, grande', allegati: [], lastModified: Date.now() },
        { id: crypto.randomUUID(), cartella: '', tipoDocumento: 'manoscritto', segnatura: 'B', tags: 'rosso, piccolo', allegati: [], lastModified: Date.now() },
      );
      await w.Store.commit();
    });

    await openSidebarPanel(page, 'tags');
    await page.locator('#tag-list button', { hasText: 'rosso' }).click();
    await expect(page.locator('#counter-results')).toContainText('2');

    await page.locator('#tag-list button', { hasText: 'grande' }).click();
    await expect(page.locator('#counter-results')).toContainText('1');
  });

  test('Ctrl+F porta il focus sul campo di ricerca già visibile', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await openSidebarPanel(page, 'search');

    await page.locator('#search-input').blur();
    await page.keyboard.press('Control+f');
    await expect(page.locator('#search-input')).toBeFocused();
  });

  test('i suggerimenti di ricerca elencano la scheda trovata', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await seedItems(page, 2);

    await openSidebarPanel(page, 'search');
    await page.locator('#search-input').fill('Seed-000');
    await expect(page.locator('#search-suggestions')).toContainText('Seed-000');
  });

  test('la ricerca ignora gli accenti in entrambe le direzioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await page.evaluate(async () => {
      // @ts-ignore
      appData.manoscritti.push(
        { id: crypto.randomUUID(), cartella: '', tipoDocumento: 'manoscritto', segnatura: 'ACC-1', titolo: 'Rogito redatto in Perùgia', tags: '', allegati: [], lastModified: Date.now() },
        { id: crypto.randomUUID(), cartella: '', tipoDocumento: 'manoscritto', segnatura: 'ACC-2', titolo: 'Rogito redatto in Perugia', tags: '', allegati: [], lastModified: Date.now() },
        { id: crypto.randomUUID(), cartella: '', tipoDocumento: 'manoscritto', segnatura: 'ACC-3', titolo: 'Rogito redatto in Firenze', tags: '', allegati: [], lastModified: Date.now() },
      );
      await (window as any).Store.commit();
    });

    await openSidebarPanel(page, 'search');
    await expect(page.locator('[id^="card-"]')).toHaveCount(3);

    await page.locator('#search-input').fill('perugia');
    await expect(page.locator('[id^="card-"]')).toHaveCount(2);

    await page.locator('#search-input').fill('perùgia');
    await expect(page.locator('[id^="card-"]')).toHaveCount(2);
  });

  test('la ricerca non trova i tag HTML della trascrizione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await page.evaluate(async () => {
      // @ts-ignore
      appData.manoscritti.push(
        { id: crypto.randomUUID(), cartella: '', tipoDocumento: 'manoscritto', segnatura: 'HTML-1', tags: '', allegati: [], lastModified: Date.now(),
          trascrizione: '<p class="ocr-pagina"><strong>[p. 1]</strong></p><p>In&nbsp;nomine Domini</p>' },
        { id: crypto.randomUUID(), cartella: '', tipoDocumento: 'manoscritto', segnatura: 'HTML-2', tags: '', allegati: [], lastModified: Date.now(),
          trascrizione: '<p>La pagina strappata</p>' },
      );
      await (window as any).Store.commit();
    });

    await openSidebarPanel(page, 'search');
    await page.locator('#search-input').fill('pagina');
    await expect(page.locator('[id^="card-"]')).toHaveCount(1);
    await page.locator('#search-input').fill('strong');
    await expect(page.locator('[id^="card-"]')).toHaveCount(0);
    await page.locator('#search-input').fill('nbsp');
    await expect(page.locator('[id^="card-"]')).toHaveCount(0);
    await page.locator('#search-input').fill('in nomine');
    await expect(page.locator('[id^="card-"]')).toHaveCount(1);
  });

  test('piu parole nella ricerca si combinano in AND anche su campi diversi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await page.evaluate(async () => {
      // @ts-ignore
      appData.manoscritti.push(
        { id: crypto.randomUUID(), cartella: '', tipoDocumento: 'manoscritto', segnatura: 'AND-1', titolo: 'Rogito del notaio', datazione: 'anno 1340', tags: '', allegati: [], lastModified: Date.now() },
        { id: crypto.randomUUID(), cartella: '', tipoDocumento: 'manoscritto', segnatura: 'AND-2', titolo: 'Rogito del notaio', datazione: 'anno 1350', tags: '', allegati: [], lastModified: Date.now() },
      );
      await (window as any).Store.commit();
    });

    await openSidebarPanel(page, 'search');

    await page.locator('#search-input').fill('notaio');
    await expect(page.locator('[id^="card-"]')).toHaveCount(2);

    await page.locator('#search-input').fill('notaio 1340');
    await expect(page.locator('[id^="card-"]')).toHaveCount(1);

    await page.locator('#search-input').fill('notaio 1360');
    await expect(page.locator('[id^="card-"]')).toHaveCount(0);
  });

  test('i campi dei tipi personalizzati sono cercabili nella griglia', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await page.evaluate(async () => {
      // @ts-ignore
      appData.tipiDocumento.push({ id: 'custom_e2e', nome: 'Tipo E2E', campi: ['campo_speciale'] });
      // @ts-ignore
      appData.manoscritti.push(
        {
          id: crypto.randomUUID(), cartella: '', tipoDocumento: 'custom_e2e',
          segnatura: 'CUS-1', campo_speciale: 'pergamena membranacea',
          tags: '', allegati: [], lastModified: Date.now(),
        },
        {
          id: crypto.randomUUID(), cartella: '', tipoDocumento: 'custom_e2e',
          segnatura: 'CUS-2', campo_speciale: 'cartaceo',
          tags: '', allegati: [], lastModified: Date.now(),
        },
      );
      await (window as any).Store.commit();
    });

    await openSidebarPanel(page, 'search');
    await expect(page.locator('[id^="card-"]')).toHaveCount(2);

    await page.locator('#search-input').fill('membranacea');
    await expect(page.locator('[id^="card-"]')).toHaveCount(1);
  });

  test('il pannello tag mostra quante schede usano ogni tag', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await seedItems(page, 6, { tagPrefix: 'periodo' });

    await openSidebarPanel(page, 'tags');
    await expect(page.locator('#tag-list button', { hasText: 'periodo-0' })).toContainText('2');
  });

  test('la ricerca attiva viene ripristinata dopo il riavvio', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tags');
    await seedItems(page, 3);

    await openSidebarPanel(page, 'search');
    await page.locator('#search-input').fill('Seed-001');
    await expect(page.locator('[id^="card-"]')).toHaveCount(1);

    await page.evaluate(async () => {
      await (window as any).flushSalvataggio();
      await (window as any).salvaStatoPosizione();
    });

    const { launchApp, closeApp } = await import('./fixtures');
    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);

    await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await page2.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });

    await expect(page2.locator('#search-input')).toHaveValue('Seed-001');
    await expect(page2.locator('[id^="card-"]')).toHaveCount(1);
    await closeApp(app2);
  });
});
