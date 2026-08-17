import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, seedItems } from './helpers';
import * as path from 'path';

// Fase 4 — le azioni che prima esistevano solo nel tasto destro devono avere
// un accesso visibile ("⋯") e il menu deve essere navigabile da tastiera.
test.describe('Menu contestuale e overflow', () => {
  test('il "⋯" della card apre il menu con Esporta ed Elimina', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    await seedItems(page, 1);

    const overflow = page.locator('.card-scheda .card-overflow-btn').first();
    await expect(overflow).toBeVisible();
    await overflow.click();

    const menu = page.locator('#custom-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Esporta');
    await expect(menu).toContainText('Elimina');
    // Il menu prende il fuoco sulla prima voce: navigabile subito da tastiera.
    await expect(menu.locator('[role="menuitem"]').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(overflow).toBeFocused();

    // Percorso mouse: il mousedown dentro il menu non lo deve chiudere prima del click.
    await overflow.click();
    await menu.locator('[role="menuitem"]', { hasText: 'Copia' }).click();
    await expect(menu).toBeHidden();
    await expect(page.locator('#toast-container')).toContainText('copiat');
  });

  test('le frecce scorrono le voci e Invio esegue l\'azione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    await seedItems(page, 1);

    await page.locator('.card-scheda .card-overflow-btn').first().click();
    const voci = page.locator('#custom-context-menu [role="menuitem"]');
    await expect(voci.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(voci.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(voci.first()).toBeFocused();

    // La prima voce su selezione singola è "Rinomina / Modifica" → apre il form.
    await page.keyboard.press('Enter');
    await expect(page.locator('#custom-context-menu')).toBeHidden();
    await expect(page.locator('#manoscritto-form')).toBeVisible();
  });

  test('il "⋯" della cartella in sidebar espone rinomina e apri in Esplora', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    await createFolder(page, 'Notarile');

    const riga = page.locator('#folder-list .sidebar-row', { hasText: 'Notarile' }).first();
    await riga.hover();
    const overflow = riga.locator('button[aria-haspopup="menu"]');
    await expect(overflow).toBeVisible();
    await overflow.click();

    const menu = page.locator('#custom-context-menu');
    await expect(menu).toContainText('Rinomina cartella');
    await expect(menu).toContainText('Esplora Risorse');
    await expect(menu).toContainText('Crea nuova scheda');
  });

  test('la barra di selezione compare con le azioni multiple', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    const ids = await seedItems(page, 3);

    await expect(page.locator('#selection-bar')).toBeHidden();
    await page.evaluate((recIds) => {
      (window as any).selectedRecords = recIds;
      (window as any).aggiornaSelectionBar();
    }, ids.slice(0, 2));

    const bar = page.locator('#selection-bar');
    await expect(bar).toBeVisible();
    await expect(page.locator('#selection-count')).toContainText('2');
    await bar.locator('button', { hasText: 'Deseleziona' }).click();
    await expect(bar).toBeHidden();
  });
});
