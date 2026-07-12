import { test, expect } from './fixtures';

test.describe('Avvio applicazione', () => {
  test('la finestra si apre con titolo corretto', async ({ electronApp, page }) => {
    expect(await page.title()).toBe('ArchiView');

    // La finestra non è distrutta e ha dimensioni reali.
    const isVisible = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return !!win && !win.isDestroyed() && win.isVisible();
    });
    expect(isVisible).toBe(true);
  });

  test('al primo avvio compare la welcome modal', async ({ page }) => {
    await expect(page.locator('#welcome-modal')).toBeVisible();
    await expect(page.locator('#welcome-buttons')).toBeVisible();
    // Le azioni chiave sono presenti.
    await expect(
      page.locator('#welcome-buttons button', { hasText: 'Crea Nuova Cartella Locale' }),
    ).toBeVisible();
  });

  test('nessun errore fatale in console al boot', async ({ userDataDir }) => {
    // Rilancio dedicato per catturare la console dall'inizio.
    const { launchApp, closeApp } = await import('./fixtures');
    const { app, page } = await launchApp(userDataDir);
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await expect(page.locator('#welcome-modal')).toBeVisible();
    await page.waitForTimeout(500); // lascia sfogare eventuali errori async del boot
    await closeApp(app);

    const fatal = errors.filter((e) => /FATAL ERROR|Uncaught|is not defined/i.test(e));
    expect(fatal, `Errori in console:\n${errors.join('\n')}`).toEqual([]);
  });
});
