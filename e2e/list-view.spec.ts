import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemViaForm, seedItems, getAppData } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Vista Lista', () => {
  test('empty state e counter a zero su archivio vuoto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'List');

    await expect(page.locator('#empty-state')).toBeVisible();
    await expect(page.locator('#counter-results')).toContainText('0');
  });

  test('il counter riflette il numero di schede create', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'List');
    await seedItems(page, 3);

    await expect(page.locator('#empty-state')).toBeHidden();
    await expect(page.locator('#counter-results')).toContainText('3');
  });

  test('bottone Modifica sulla card apre il form in edit', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'List');
    await createItemViaForm(page, 'MS-LIST-001');

    await page.locator('main button', { hasText: /Modifica|Edit/i }).first().click();
    await expect(page.locator('#view-add')).toBeVisible();
    await expect(page.locator('#form-segnatura')).toHaveValue('MS-LIST-001');
  });

  test('elimina una scheda: conferma rimuove la card e crea un tombstone', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'List');
    await createItemViaForm(page, 'MS-LIST-DEL');

    const dataDel = await getAppData(page);
    const id = dataDel.manoscritti.find((m: any) => m.segnatura === 'MS-LIST-DEL').id;

    await page.evaluate((recId) => (window as any).deleteItem(recId), id);
    await expect(page.locator('#delete-modal')).toBeVisible();
    await page.evaluate(() => (window as any).confermaEliminazione());

    await expect(page.locator('#delete-modal')).toBeHidden();
    await expect(page.locator('main')).not.toContainText('MS-LIST-DEL');

    const appData = await getAppData(page);
    expect(appData.deletedIds).toContain(id);
  });

  test('annulla eliminazione lascia la scheda intatta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'List');
    await createItemViaForm(page, 'MS-LIST-KEEP');

    const dataKeep = await getAppData(page);
    const id = dataKeep.manoscritti.find((m: any) => m.segnatura === 'MS-LIST-KEEP').id;

    await page.evaluate((recId) => (window as any).deleteItem(recId), id);
    await expect(page.locator('#delete-modal')).toBeVisible();
    await page.evaluate(() => (window as any).chiudiDeleteModal());

    await expect(page.locator('#delete-modal')).toBeHidden();
    await expect(page.locator('main')).toContainText('MS-LIST-KEEP');
  });

  test('esporta scheda scarica lo zip', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'List');
    await createItemViaForm(page, 'MS-LIST-EXPORT');

    const exportPath = path.join(userDataDir, 'export.zip');
    const { stubDialog } = await import('./fixtures');
    await stubDialog(electronApp, { canceled: false, filePath: exportPath });

    const dataExport = await getAppData(page);
    const id = dataExport.manoscritti.find((m: any) => m.segnatura === 'MS-LIST-EXPORT').id;
    await page.evaluate((recId) => (window as any).esportaManoscritto(recId), id);

    await expect.poll(() => fs.existsSync(exportPath), { timeout: 10_000 }).toBe(true);
  });

  test('paginazione compare con 51 schede', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'List');
    await seedItems(page, 51);

    await expect(page.locator('#pagination-controls')).toBeVisible();
    await expect(page.locator('#page-indicator')).toContainText('1');
    await expect(page.locator('#page-indicator')).toContainText('2');
    await expect(page.locator('.card-scheda')).toHaveCount(50);

    await expect(page.locator('#btn-prev-page')).toBeDisabled();
    await expect(page.locator('#btn-next-page')).toBeEnabled();

    await page.locator('#btn-next-page').click();
    await expect(page.locator('.card-scheda')).toHaveCount(1);
    await expect(page.locator('#btn-next-page')).toBeDisabled();
    await expect(page.locator('#btn-prev-page')).toBeEnabled();

    await page.locator('#btn-prev-page').click();
    await expect(page.locator('.card-scheda')).toHaveCount(50);
  });

  test('#btn-delete-folder elimina la cartella corrente vuota', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'List');
    await page.evaluate(() => (window as any).aggiungiCartella());
    await page.locator('#folder-name-input').fill('DaEliminare');
    await page.evaluate(() => (window as any).confermaAggiungiCartella());

    await page.evaluate(() => {
      (window as any).cartellaAttuale = 'DaEliminare';
      (window as any).switchTab('list');
      (window as any).renderMain();
    });

    await expect(page.locator('#btn-delete-folder')).toBeVisible();
    await page.locator('#btn-delete-folder').click();

    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();

    const appData = await getAppData(page);
    expect(appData.cartelle).not.toContain('DaEliminare');
  });
});
