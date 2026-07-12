import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, createItemViaForm } from './helpers';
import * as path from 'path';

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');

test.describe('Modali minori', () => {
  test('click sulla miniatura allegato nel form apre l\'image modal', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await createItemWithAttachment(page, 'MS-MODAL-IMG', FIXTURE_PNG);

    await page.locator('main button', { hasText: /Modifica|Edit/i }).first().click();
    await page.locator('.allegato-row').first().click();

    await expect(page.locator('#image-modal')).toBeVisible();
    await expect(page.locator('#modal-img')).toBeVisible();

    await page.evaluate(() => (window as any).chiudiModal());
    await expect(page.locator('#image-modal')).toBeHidden();
  });

  test('apriModalDocumenti apre e chiude il modal documenti', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await createItemViaForm(page, 'MS-MODAL-DOCS');

    const id = await page.evaluate(() => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.segnatura === 'MS-MODAL-DOCS').id;
    });

    await page.evaluate((recId) => (window as any).apriModalDocumenti(recId), id);
    await expect(page.locator('#docs-modal')).toBeVisible();
    await expect(page.locator('#docs-modal-title')).toContainText('MS-MODAL-DOCS');

    await page.evaluate(() => (window as any).chiudiModalDocumenti());
    await expect(page.locator('#docs-modal')).toBeHidden();
  });

  test('il changelog è riapribile e richiudibile dopo il primo avvio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');

    await page.evaluate(() => (window as any).apriChangelogModal());
    await expect(page.locator('#changelog-modal')).toBeVisible();

    await page.evaluate(() => (window as any).chiudiChangelogModal());
    await expect(page.locator('#changelog-modal')).toBeHidden();
  });

  test('issue modal si apre, mostra i campi e si chiude senza inviare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');

    await page.evaluate(() => (window as any).apriIssueModal());
    await expect(page.locator('#issue-modal')).toBeVisible();
    await expect(page.locator('#issue-title-input')).toBeVisible();
    await expect(page.locator('#issue-desc-input')).toBeVisible();

    await page.locator('#issue-title-input').fill('Problema di prova');
    await page.locator('#issue-modal button', { hasText: /Annulla/i }).click();

    await expect(page.locator('#issue-modal')).toBeHidden();
  });

  test('un\'azione mostra un toast che poi scompare da solo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await createItemViaForm(page, 'MS-MODAL-TOAST');

    const id = await page.evaluate(() => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.segnatura === 'MS-MODAL-TOAST').id;
    });
    await page.evaluate((recId) => (window as any).deleteItem(recId), id);
    await page.evaluate(() => (window as any).confermaEliminazione());

    await expect(page.locator('#toast-container')).toBeVisible();
    await expect(page.locator('#toast-container')).toBeHidden({ timeout: 15_000 });
  });

  test('eliminare una scheda mostra un banner di conferma con opzione di annullamento', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await createItemViaForm(page, 'MS-MODAL-UNDO');

    const id = await page.evaluate(() => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.segnatura === 'MS-MODAL-UNDO').id;
    });
    await page.evaluate((recId) => (window as any).deleteItem(recId), id);
    await page.evaluate(() => (window as any).confermaEliminazione());

    await expect(page.locator('#toast-container')).toContainText(/eliminat/i);
  });
});
