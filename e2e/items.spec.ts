import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.describe('Schede (manoscritti)', () => {
  test('crea, cerca e modifica una scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Schede');

    // Apri il form "Nuova Scheda".
    await page.locator('#btn-tab-add').click();
    await expect(page.locator('#view-add')).toBeVisible();
    await expect(page.locator('#manoscritto-form')).toBeVisible();

    // La cartella 'Generale' e i tipi documento di default devono essere disponibili.
    await expect(page.locator('#form-cartella option')).not.toHaveCount(0);
    await expect(page.locator('#form-tipo-documento option')).not.toHaveCount(0);

    const segnatura = 'MS-E2E-001';
    await page.locator('#form-segnatura').fill(segnatura);
    await page.locator('#btn-submit-form').click();

    // Dopo il salvataggio si torna alla lista: la scheda è visibile nel pannello principale.
    await expect(page.locator('main')).toContainText(segnatura, { timeout: 10_000 });

    // Ricerca globale: la scheda viene trovata.
    await page.locator('header button[data-tab="search"]').click();
    await expect(page.locator('#sidebar-search')).toBeVisible();
    await page.locator('#search-input').fill('MS-E2E');
    await expect(page.locator('#search-suggestions')).toContainText(segnatura, { timeout: 10_000 });

    // Modifica: cambia la segnatura e risalva.
    await page.locator('main').getByText(segnatura, { exact: false }).first().scrollIntoViewIfNeeded();
    await page.locator('main button', { hasText: /Modifica|Edit/i }).first().click();
    await expect(page.locator('#view-add')).toBeVisible();
    const nuova = 'MS-E2E-001-BIS';
    await page.locator('#form-segnatura').fill(nuova);
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('main')).toContainText(nuova, { timeout: 10_000 });
  });
});
