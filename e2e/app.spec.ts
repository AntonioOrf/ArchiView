import { test, expect } from './fixtures';

test.describe('Avvio applicazione', () => {
  test('la finestra si apre con titolo corretto', async ({ electronApp, page }) => {
    // toHaveTitle ritenta: sotto il carico della suite completa il titolo letto una volta
    // sola poteva arrivare prima che il documento lo avesse.
    await expect(page).toHaveTitle('ArchiView');

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

// Fase 3 (O2): lucide è ridotto in build alle icone nominate nei sorgenti, e logic/icone.ts
// ridisegna solo ciò che è cambiato. Un'icona fuori dal sottoinsieme resterebbe un <i> vuoto.
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
      // Cambio di glifo come fa mainView: si riscrive data-lucide sull'svg e si richiama.
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
