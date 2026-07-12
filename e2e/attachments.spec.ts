import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'sample.pdf');

test.describe('Allegati', () => {
  test('allega un file locale a una scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Allegati');

    await page.locator('#btn-tab-add').click();
    await expect(page.locator('#manoscritto-form')).toBeVisible();
    await page.locator('#form-segnatura').fill('MS-ATT-001');

    // Il file input reale bypassa il dialog nativo: nessuno stub necessario.
    await page.locator('#form-allegato').setInputFiles(FIXTURE_PNG);

    // Anteprima del file in coda di upload.
    await expect(page.locator('#form-allegati-new-preview')).toContainText('sample.png');

    await page.locator('#btn-submit-form').click();
    await expect(page.locator('main')).toContainText('MS-ATT-001', { timeout: 10_000 });

    // La pipeline main (salvaAllegato → hash → store) ha persistito l'allegato sul record.
    const allegatiCount = await page.evaluate(() => {
      // @ts-ignore -- `appData` è una `let` globale (script classico), non window.appData.
      const rec = appData?.manoscritti?.find((m: any) => m.segnatura === 'MS-ATT-001');
      return rec?.allegati?.length ?? 0;
    });
    expect(allegatiCount).toBeGreaterThan(0);
  });

  test('allega un PDF a una scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Allegati');

    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-ATT-PDF');
    await page.locator('#form-allegato').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#form-allegati-new-preview')).toContainText('sample.pdf');

    await page.locator('#btn-submit-form').click();
    await expect(page.locator('main')).toContainText('MS-ATT-PDF', { timeout: 10_000 });

    const appData = await getAppData(page);
    const rec = appData.manoscritti.find((m: any) => m.segnatura === 'MS-ATT-PDF');
    expect(rec.allegati[0].tipo).toBe('pdf');
  });

  test('rimuove un allegato dal form prima di salvare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Allegati');

    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-ATT-RIMOSSO');
    await page.locator('#form-allegato').setInputFiles(FIXTURE_PNG);
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('main')).toContainText('MS-ATT-RIMOSSO', { timeout: 10_000 });

    await page.locator('main button', { hasText: /Modifica|Edit/i }).first().click();
    await expect(page.locator('.allegato-row')).toHaveCount(1);

    await page.locator('.allegato-row button[aria-label*="Rimuovi" i], .allegato-row button[aria-label*="Remove" i]').click();
    await expect(page.locator('.allegato-row')).toHaveCount(0);

    await page.locator('#btn-submit-form').click();
    await expect(page.locator('main')).toContainText('MS-ATT-RIMOSSO', { timeout: 10_000 });

    const appData = await getAppData(page);
    const rec = appData.manoscritti.find((m: any) => m.segnatura === 'MS-ATT-RIMOSSO');
    expect(rec.allegati.length).toBe(0);
  });
});
