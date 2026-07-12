import { test, expect } from './fixtures';
import { createLocalWorkspace, seedItems, openSidebarPanel } from './helpers';
import * as path from 'path';

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
        { id: crypto.randomUUID(), cartella: 'Generale', tipoDocumento: 'manoscritto', segnatura: 'A', tags: 'rosso, grande', allegati: [], lastModified: Date.now() },
        { id: crypto.randomUUID(), cartella: 'Generale', tipoDocumento: 'manoscritto', segnatura: 'B', tags: 'rosso, piccolo', allegati: [], lastModified: Date.now() },
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

    // La scorciatoia richiama switchTab('list') e mette il focus sull'input:
    // non cambia il pannello sidebar attivo, va quindi aperto a mano prima.
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
});
