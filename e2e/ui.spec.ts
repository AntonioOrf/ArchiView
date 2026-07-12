import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.describe('UI: impostazioni, lingua, tema', () => {
  test('apre e chiude la modale impostazioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await expect(page.locator('#settings-modal')).toBeVisible();

    await page.evaluate(() => (window as any).chiudiImpostazioni());
    await expect(page.locator('#settings-modal')).toBeHidden();
  });

  test('il cambio lingua aggiorna il DOM', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    // Baseline: titolo sidebar in italiano.
    const struttura = page.locator('[data-i18n="title_structure"]').first();
    await expect(struttura).toHaveText('Struttura');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await page.locator('#settings-language').selectOption('en');

    await expect(struttura).toHaveText('Structure', { timeout: 8_000 });
  });

  test('il cambio tema applica la classe dark', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await page.locator('#settings-theme').selectOption('dark');

    await expect(page.locator('html')).toHaveClass(/dark-theme/, { timeout: 8_000 });
  });

  test('il tema scelto persiste dopo il riavvio', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await page.locator('#settings-theme').selectOption('dark');
    await expect(page.locator('html')).toHaveClass(/dark-theme/, { timeout: 8_000 });

    const { launchApp, closeApp } = await import('./fixtures');
    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);

    await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await expect(page2.locator('html')).toHaveClass(/dark-theme/, { timeout: 8_000 });
    await closeApp(app2);
  });

  test('username personalizzato viene salvato nelle impostazioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await page.locator('#settings-username').fill('Archivista Test');
    await page.locator('#settings-username').blur();
    await page.evaluate(() => (window as any).chiudiImpostazioni());

    const settings = await page.evaluate(() => (window as any).apiSettings.get());
    expect(settings.username).toBe('Archivista Test');
  });
});
