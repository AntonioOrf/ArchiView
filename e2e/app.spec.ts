import { test, expect } from './fixtures';

test.describe('Avvio applicazione', () => {
  test('la finestra si apre con titolo corretto', async ({ electronApp, page }) => {
    await expect(page).toHaveTitle('ArchiView');

    const isVisible = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return !!win && !win.isDestroyed() && win.isVisible();
    });
    expect(isVisible).toBe(true);
  });

  test('al primo avvio compare la welcome modal', async ({ page }) => {
    await expect(page.locator('#welcome-modal')).toBeVisible();
    await expect(page.locator('#welcome-buttons')).toBeVisible();
    await expect(
      page.locator('#welcome-buttons button', { hasText: 'Crea Nuova Cartella Locale' }),
    ).toBeVisible();
  });

  test('sulla welcome modal la richiesta di chiusura riceve conferma', async ({ electronApp, page }) => {
    await expect(page.locator('#welcome-modal')).toBeVisible();
    await page.waitForFunction(() => (window as any).__appPronta === true);
    await electronApp.evaluate(({ ipcMain, BrowserWindow }) => {
      ipcMain.removeAllListeners('confirm-close');
      (globalThis as any).chiusureConfermate = 0;
      ipcMain.on('confirm-close', () => { (globalThis as any).chiusureConfermate++; });
      BrowserWindow.getAllWindows()[0].webContents.send('request-close');
    });
    await expect.poll(() => electronApp.evaluate(() => (globalThis as any).chiusureConfermate)).toBe(1);
  });

  test('R1 — un link archiview:// che avvia l\'app chiusa apre il join con il codice', async ({ userDataDir }) => {
    const { launchApp, closeApp } = await import('./fixtures');
    const { app, page } = await launchApp(userDataDir, ['archiview://join/CODICEFREDDO']);
    try {
      await expect(page.locator('#welcome-join-code')).toHaveValue('CODICEFREDDO');
    } finally {
      await closeApp(app);
    }
  });

  test('F21 — «Crea e Avvia» che fallisce mostra il motivo e riabilita il pulsante', async ({ electronApp, page }) => {
    await expect(page.locator('#welcome-modal')).toBeVisible();
    await page.waitForFunction(() => (window as any).__appPronta === true);
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('create-workspace-in-path');
      ipcMain.handle('create-workspace-in-path', () => { throw new Error('permesso negato'); });
    });
    await page.evaluate(() => {
      (document.getElementById('welcome-new-folder-name') as HTMLInputElement).value = 'Prova';
      (document.getElementById('welcome-new-folder-path') as HTMLInputElement).value = 'C:\\inesistente';
    });
    await page.evaluate(() => (window as any).creaCartellaIniziale());
    await expect(page.locator('#toast-container')).toContainText('permesso negato');
    await expect(page.locator('#welcome-create-form .btn-primary')).toBeEnabled();
  });

  test('nessun errore fatale in console al boot', async ({ userDataDir }) => {
    const { launchApp, closeApp } = await import('./fixtures');
    const { app, page } = await launchApp(userDataDir);
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await expect(page.locator('#welcome-modal')).toBeVisible();
    await page.waitForTimeout(500);
    await closeApp(app);

    const fatal = errors.filter((e) => /FATAL ERROR|Uncaught|is not defined/i.test(e));
    expect(fatal, `Errori in console:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('Icone', () => {
  test.use({ seedWorkspace: 'Icone' });

  test('tutte le icone sono disegnate e una nuova chiamata non ricrea quelle esistenti', async ({ page }) => {
    const avvisi: string[] = [];
    page.on('console', (msg) => { if (/icona lucide sconosciuta/.test(msg.text())) avvisi.push(msg.text()); });
    await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await page.evaluate(() => (window as any).apriImpostazioni());
    await expect(page.locator('#settings-modal')).toBeVisible();

    const esito = await page.evaluate(() => {
      const L = (window as any).lucide;
      L.createIcons();
      const tutte = Array.from(document.querySelectorAll('[data-lucide]'));
      const nonDisegnate = tutte
        .filter((el) => el.namespaceURI !== 'http://www.w3.org/2000/svg' || !el.classList.contains('lucide-' + el.getAttribute('data-lucide')))
        .map((el) => el.getAttribute('data-lucide'));
      const [ferma, cambiata] = tutte.filter((el) => el.namespaceURI === 'http://www.w3.org/2000/svg');
      const genitore = cambiata.parentNode as Element;
      const posizione = Array.prototype.indexOf.call(genitore.childNodes, cambiata);
      cambiata.setAttribute('data-lucide', 'search');
      L.createIcons();
      const nuova = genitore.childNodes[posizione] as Element;
      return {
        totale: tutte.length,
        nonDisegnate,
        fermaAncoraNelDom: document.contains(ferma),
        nuovaDisegnata: nuova.classList.contains('lucide-search') && nuova.querySelector('*') !== null,
      };
    });

    expect(esito.totale).toBeGreaterThan(50);
    expect(esito.nonDisegnate).toEqual([]);
    expect(esito.fermaAncoraNelDom).toBe(true);
    expect(esito.nuovaDisegnata).toBe(true);
    expect(avvisi).toEqual([]);
  });
});
