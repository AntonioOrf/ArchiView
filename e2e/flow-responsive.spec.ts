import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, seedItems, openView } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Flow' });

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
    // Il click nell'area vuota dell'albero esce da ogni cartella e azzera i filtri.
    const box = (await page.locator('#sidebar-folders').boundingBox())!;
    await page.mouse.click(box.x + 20, box.y + box.height - 12);
    await expect(filtri).toBeHidden();
    const etichettaRadice = await page.evaluate(() => (window as any).etichettaRadice());
    await expect(page.locator('#titolo-cartella-attuale')).toHaveText(etichettaRadice);
  });

  // Audit front-end P1-3: sotto md la sidebar si impilava sopra il contenuto e <main> restava
  // alto ~50px (#view-list a 0). Si ridimensiona la FINESTRA vera, non il viewport emulato.
  test('6.3b — a metà schermo di un portatile (683px) la vista principale resta utilizzabile', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Flow');
    await seedItems(page, 2);
    await electronApp.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.unmaximize();
      w.setSize(683, 740);
    });
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBeLessThan(700);

    for (const vista of ['list', 'add'] as const) {
      await openView(page, vista);
      const g = await page.evaluate((v) => {
        const r = document.getElementById('view-' + v)!.getBoundingClientRect();
        const m = document.getElementById('contenuto-principale')!.getBoundingClientRect();
        return { vistaH: r.height, mainH: m.height, mainW: m.width };
      }, vista);
      expect(g.mainH, `${vista}: altezza di <main>`).toBeGreaterThan(400);
      expect(g.mainW, `${vista}: larghezza di <main>`).toBeGreaterThan(360);
      expect(g.vistaH, `${vista}: altezza della vista`).toBeGreaterThan(300);
    }
    await expect(page.locator('#sidebar')).toBeVisible();
    await openView(page, 'list');
    await expect(page.locator('#view-list .card-scheda').first()).toBeInViewport();
    const scrollaOrizzontale = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(scrollaOrizzontale).toBe(false);
  });

  test('6.3 — sotto i 768px nessuna funzione sparisce e la pagina non scrolla in orizzontale', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Flow');
    await seedItems(page, 1);
    await page.setViewportSize({ width: 700, height: 800 });

    // Zona 1 (navigazione), Zona 2 (stato cloud), Zona 3 (azioni di contesto).
    // `#context-overflow-slot button` al posto del cestino: "Elimina archivio" è dentro
    // quel menu dalla revisione della barra, e la funzione non deve sparire sotto i 768px.
    for (const sel of ['#btn-tab-folders', '#btn-tab-search', '#btn-tab-tags', '#cloud-status-btn', '#btn-tab-add', '#btn-filtri', '#context-overflow-slot button']) {
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
