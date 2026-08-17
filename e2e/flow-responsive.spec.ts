import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, seedItems } from './helpers';
import * as path from 'path';

// Fase 6 — verifica dei percorsi che le fasi precedenti hanno toccato.
test.describe('Percorsi di verifica', () => {
  test('6.2 — ricerca → cambio tab → cartella: griglia e chip filtri restano d\'accordo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Flow');
    await createFolder(page, 'Notarile');
    await seedItems(page, 2); // radice virtuale ('')
    await seedItems(page, 1, { cartella: 'Notarile' });

    // seedItems riparte da Seed-000 a ogni chiamata: serve una segnatura univoca.
    await page.evaluate(async () => {
      // @ts-ignore -- appData è una let globale
      appData.manoscritti[0].segnatura = 'Univoco-42';
      await (window as any).Store.commit();
    });

    // 1. Ricerca globale: chip visibile e griglia coerente col chip.
    await page.evaluate(() => (window as any).apriSidebarTab('search'));
    await page.locator('#search-input').fill('Univoco-42');
    await page.evaluate(() => (window as any).renderMain());
    const filtri = page.locator('#active-filters');
    await expect(filtri).toBeVisible();
    await expect(filtri).toContainText('Univoco-42');
    await expect(page.locator('.card-scheda')).toHaveCount(1);
    // In ricerca globale l'intestazione dice che NON stiamo guardando una cartella.
    await expect(page.locator('#titolo-cartella-attuale')).toContainText('Ricerca Globale');

    // 2. Cambio tab: la ricerca resta attiva, e il chip continua a dichiararlo.
    await page.evaluate(() => (window as any).apriSidebarTab('folders'));
    await expect(filtri).toContainText('Univoco-42');
    await expect(page.locator('.card-scheda')).toHaveCount(1);

    // 3. Click su una cartella: esce dalla ricerca, i chip spariscono con essa.
    await page.locator('#folder-list .sidebar-row', { hasText: 'Notarile' }).first().click();
    await expect(filtri).toBeHidden();
    await expect(page.locator('#search-input')).toHaveValue('');
    await expect(page.locator('#titolo-cartella-attuale')).toHaveText('Notarile');
    await expect(page.locator('.card-scheda')).toHaveCount(1);

    // 4. Stessa storia con un tag attivo.
    await page.evaluate(() => {
      // @ts-ignore -- appData è una let globale
      appData.manoscritti[0].tags = 'pergamena';
      (window as any).activeTags = new Set(['pergamena']);
      (window as any).renderMain();
    });
    await expect(filtri).toBeVisible();
    await expect(filtri).toContainText('pergamena');
    // La radice virtuale è selezionabile come qualsiasi cartella e azzera i filtri.
    await page.locator('#folder-root-row').click();
    await expect(filtri).toBeHidden();
    const etichettaRadice = await page.evaluate(() => (window as any).etichettaRadice());
    await expect(page.locator('#titolo-cartella-attuale')).toHaveText(etichettaRadice);
  });

  test('6.3 — sotto i 768px nessuna funzione sparisce e la pagina non scrolla in orizzontale', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Flow');
    await seedItems(page, 1);
    await page.setViewportSize({ width: 700, height: 800 });

    // Zona 1 (navigazione), Zona 2 (stato cloud), Zona 3 (azioni di contesto).
    for (const sel of ['#btn-tab-folders', '#btn-tab-search', '#btn-tab-tags', '#cloud-status-btn', '#btn-tab-add', '#btn-delete-folder']) {
      await expect(page.locator(sel)).toBeVisible();
    }
    // Zona 4: le azioni sull'oggetto restano raggiungibili dal "⋯".
    await expect(page.locator('.card-scheda .card-overflow-btn').first()).toBeVisible();

    const scrollaOrizzontale = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(scrollaOrizzontale).toBe(false);

    // Anche a 700px il popover cloud si apre: nessun controllo dietro un breakpoint.
    await page.locator('#cloud-status-btn').click();
    await expect(page.locator('#custom-context-menu')).toBeVisible();
  });
});
