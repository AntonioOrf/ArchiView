import { test, expect, stubDialog } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

test.use({ seedWorkspace: 'Impostazioni' });

test.describe('Impostazioni', () => {
  test('tab da tastiera: frecce, Home/End, roving tabindex e ultima tab ricordata', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Impostazioni');
    await page.evaluate(() => (window as any).apriImpostazioni('tab-general'));

    const tabs = page.locator('#settings-modal [role="tab"]');
    await expect(tabs).toHaveCount(6);
    const generali = page.locator('#tab-general-btn');
    await expect(generali).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#settings-modal [role="tab"][tabindex="0"]')).toHaveCount(1);

    await generali.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#tab-appearance-btn')).toBeFocused();
    await expect(page.locator('#tab-appearance-btn')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-appearance')).toBeVisible();
    await expect(page.locator('#tab-general')).toBeHidden();

    await page.keyboard.press('End');
    await expect(page.locator('#tab-system-btn')).toBeFocused();
    await expect(page.locator('#tab-system')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#tab-general-btn')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#tab-system-btn')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('#tab-general-btn')).toBeFocused();
    await expect(page.locator('#tab-general-btn')).toHaveAttribute('tabindex', '0');
    await expect(page.locator('#tab-system-btn')).toHaveAttribute('tabindex', '-1');

    await page.locator('#tab-documents-btn').click();
    await page.evaluate(() => (window as any).chiudiImpostazioni());
    await page.evaluate(() => (window as any).apriImpostazioni());
    await expect(page.locator('#tab-documents')).toBeVisible();
    await expect(page.locator('#tab-documents-btn')).toHaveAttribute('aria-selected', 'true');
  });

  test('Backup in ZIP: il pulsante scrive davvero il file', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Impostazioni');
    const out = path.join(userDataDir, 'backup.zip');
    await stubDialog(electronApp, { canceled: false, filePath: out });
    await page.evaluate(() => (window as any).apriImpostazioni('tab-data'));
    await page.locator('#settings-modal button', { hasText: /Esporta Backup in ZIP|Export Backup to ZIP/ }).click();
    await expect.poll(() => fs.existsSync(out) && fs.statSync(out).size, { timeout: 15_000 }).toBeGreaterThan(0);
  });

  test('cartella allegati per archivio, e il backup ZIP la include', async ({ page, electronApp, userDataDir }) => {
    const wsA = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Impostazioni');
    const esterna = fs.mkdtempSync(path.join(require('os').tmpdir(), 'av-allegati-'));
    const percorso = () => page.evaluate(() => (window as any).apiSettings.percorsoAllegati());
    const pronta = () => page.waitForFunction(() => (window as any).__appPronta === true && !!(window as any).apiSettings);

    await stubDialog(electronApp, { canceled: false, filePaths: [esterna] });
    await page.evaluate(() => (window as any).cambiaCartellaAllegati());
    expect(path.resolve(await percorso())).toBe(path.resolve(esterna));
    fs.writeFileSync(path.join(esterna, 'carta-1r.jpg'), 'immagine');

    const zip = path.join(userDataDir, 'backup.zip');
    await stubDialog(electronApp, { canceled: false, filePath: zip });
    expect((await page.evaluate(() => (window as any).apiBrowser.exportWorkspaceZip('Backup'))).success).toBe(true);
    const metodi: Record<string, number> = await new Promise((ok, ko) => require('yauzl').open(zip, { lazyEntries: true }, (err: any, z: any) => {
      if (err) return ko(err);
      const nomi: Record<string, number> = {};
      z.on('entry', (e: any) => { nomi[e.fileName] = e.compressionMethod; z.readEntry(); });
      z.on('end', () => ok(nomi));
      z.readEntry();
    }));
    const voci = Object.keys(metodi);
    expect(voci).toContain('allegati_manoscritti/carta-1r.jpg');
    expect(metodi['allegati_manoscritti/carta-1r.jpg'], 'P6: un JPEG non si ricomprime').toBe(0);
    expect(metodi['.archiview-vault.json'], 'il resto si comprime').toBe(8);

    await page.evaluate((p) => { setTimeout(() => (window as any).apiBrowser.createWorkspaceInPath(p, 'Secondo'), 0); }, path.join(userDataDir, 'ws'));
    await page.waitForURL(/index\.html/);
    await pronta();
    await expect.poll(percorso).toBe(path.join(userDataDir, 'ws', 'Secondo', 'allegati_manoscritti'));
    await page.evaluate((p) => { setTimeout(() => (window as any).apiBrowser.openRecentWorkspace(p), 0); }, wsA);
    await expect.poll(async () => { try { await pronta(); return path.resolve(await percorso()); } catch { return ''; } })
      .toBe(path.resolve(esterna));
    fs.rmSync(esterna, { recursive: true, force: true });
  });

  test('la cartella allegati globale di prima passa agli archivi che la usavano', async ({ userDataDir }) => {
    const { seedWorkspaceOnDisk, launchApp, closeApp } = await import('./fixtures');
    const aperto = seedWorkspaceOnDisk(userDataDir, 'Aperto');
    const altro = path.join(userDataDir, 'ws', 'Altro');
    fs.mkdirSync(altro, { recursive: true });
    const esterna = path.join(userDataDir, 'allegati-comuni');
    fs.mkdirSync(esterna);
    const file = path.join(userDataDir, 'settings.json');
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...s, customAttachmentsPath: esterna, recentWorkspaces: [aperto, altro] }));

    const { app, page } = await launchApp(userDataDir);
    try {
      await page.waitForFunction(() => (window as any).__appPronta === true);
      expect(path.resolve(await page.evaluate(() => (window as any).apiSettings.percorsoAllegati()))).toBe(path.resolve(esterna));
      expect(JSON.parse(fs.readFileSync(file, 'utf8')).customAttachmentsPath).toBeUndefined();
      expect(JSON.parse(fs.readFileSync(path.join(altro, '.archiview-vault.json'), 'utf8')).customAttachmentsPath).toBe(esterna);
    } finally {
      await closeApp(app);
    }
  });

  test('numero non valido: segnalato, non salvato, valore precedente ripristinato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Impostazioni');
    await page.evaluate(() => (window as any).apriImpostazioni('tab-data'));
    const campo = page.locator('#settings-cestino-giorni');
    await campo.fill('45');
    await campo.press('Tab');
    await expect.poll(async () => (await page.evaluate(() => (window as any).apiSettings.get())).cestinoGiorni).toBe(45);

    await campo.fill('-5');
    await campo.press('Tab');
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#settings-cestino-giorni-errore')).toBeVisible();
    await expect(campo).toHaveValue('45');
    expect((await page.evaluate(() => (window as any).apiSettings.get())).cestinoGiorni).toBe(45);

    await campo.fill('60');
    await campo.press('Tab');
    await expect(campo).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#settings-cestino-giorni-errore')).toBeHidden();
  });

  test('zoom da tastiera e dal pannello: stessa chiave, applicato alla finestra', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Impostazioni');
    const fattore = () => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor());
    const tasto = (key: string) => electronApp.evaluate(({ BrowserWindow }, key) => {
      BrowserWindow.getAllWindows()[0].webContents.emit('before-input-event', { preventDefault() {} }, { type: 'keyDown', control: true, meta: false, alt: false, key });
    }, key);

    await tasto('=');
    await expect.poll(async () => (await page.evaluate(() => (window as any).apiSettings.get())).zoomInterfaccia).toBe(110);
    await expect.poll(fattore).toBeCloseTo(1.1);

    await page.evaluate(() => (window as any).apriImpostazioni('tab-appearance'));
    await expect(page.locator('#settings-zoom-select')).toHaveValue('110');
    await page.locator('#settings-zoom-select').selectOption('90');
    await expect.poll(fattore).toBeCloseTo(0.9);

    await tasto('0');
    await expect.poll(fattore).toBeCloseTo(1);
    await expect(page.locator('#settings-zoom-select')).toHaveValue('100');
  });

  test('le preferenze nuove restano dopo il riavvio e si applicano', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Impostazioni');
    await page.evaluate(() => (window as any).apriImpostazioni('tab-appearance'));
    await page.locator('#settings-theme .tema-scheda:has(input[value="blue-dark"])').click();
    await page.locator('#settings-zoom-select').selectOption('120');
    await page.locator('#settings-font-trascrizione').selectOption('junicode');
    await page.locator('#settings-dim-trascrizione').fill('22');
    await page.locator('#settings-dim-trascrizione').press('Tab');
    await page.locator('#tab-documents-btn').click();
    await page.locator('#settings-pdf-risoluzione').selectOption('2000');
    await page.locator('#settings-pdf-zoom').selectOption('larghezza');
    await page.locator('#tab-system-btn').click();
    await page.locator('#settings-aggiornamenti-auto').uncheck();
    await expect.poll(async () => (await page.evaluate(() => (window as any).apiSettings.get())).aggiornamentiAutomatici).toBe(false);

    const { launchApp, closeApp } = await import('./fixtures');
    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);
    try {
      await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
      const s = await page2.evaluate(() => (window as any).apiSettings.get());
      expect(s).toMatchObject({
        theme: 'blue-dark', zoomInterfaccia: 120, fontTrascrizione: 'junicode', dimensioneTrascrizione: 22,
        pdfRisoluzione: 2000, pdfZoomIniziale: 'larghezza', aggiornamentiAutomatici: false
      });
      await expect(page2.locator('html')).toHaveClass(/blue-dark-theme/);
      await expect.poll(() => app2.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor())).toBeCloseTo(1.2);
      const stile = await page2.evaluate(() => ({
        font: getComputedStyle(document.documentElement).getPropertyValue('--font-trascrizione'),
        dim: getComputedStyle(document.documentElement).getPropertyValue('--dim-trascrizione'),
        pdf: (window as any).pdfRisoluzioneMassima
      }));
      expect(stile.font).toContain('Junicode');
      expect(stile.dim.trim()).toBe('22px');
      expect(stile.pdf).toBe(2000);
      expect(await page2.evaluate(async () => { await document.fonts.load("16px 'Junicode'"); return document.fonts.check("16px 'Junicode'"); })).toBe(true);
      await page2.evaluate(() => (window as any).apriImpostazioni('tab-appearance'));
      await expect(page2.locator('#settings-theme input[value="blue-dark"]')).toBeChecked();
      await expect(page2.locator('#settings-theme input:checked')).toHaveCount(1);
      await expect(page2.locator('#settings-versione-nav')).toHaveText(/^\d+\.\d+\.\d+/);
    } finally {
      await closeApp(app2);
    }
  });

  test('una chiave fuori elenco o non valida torna in rifiutate', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Impostazioni');
    const esito = await page.evaluate(() => (window as any).apiSettings.patch({ zoomInterfaccia: 115, fontTrascrizione: 'comic', dimensioneTrascrizione: 20 }));
    expect(esito).toEqual({ ok: false, rifiutate: ['zoomInterfaccia', 'fontTrascrizione'] });
    const s = await page.evaluate(() => (window as any).apiSettings.get());
    expect(s.dimensioneTrascrizione).toBe(20);
    expect(s.zoomInterfaccia).toBeUndefined();
  });
});
