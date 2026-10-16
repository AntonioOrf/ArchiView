import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Updater' });

const INCOMPLETA = 'Cannot find latest.yml in the latest release artifacts (https://github.com/AntonioOrf/ArchiView/releases/download/v3.2.1/latest.yml): HttpError: 404';

async function stubControllo(app, esito) {
  await app.evaluate(({ ipcMain }, e) => {
    (globalThis as any).__controlli = 0;
    ipcMain.removeHandler('check-for-updates');
    ipcMain.handle('check-for-updates', () => { (globalThis as any).__controlli++; return e; });
  }, esito);
}

const controlli = (app) => app.evaluate(() => (globalThis as any).__controlli);

test.describe('Aggiornamenti', () => {

  test('release in pubblicazione: silenziosa all\'avvio, "Riprova" nel controllo manuale', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Updater');
    await stubControllo(electronApp, { error: INCOMPLETA, errorCode: 'release-incomplete' });
    await electronApp.evaluate(({ ipcMain }, msg) => {
      ipcMain.removeHandler('check-for-updates');
      ipcMain.handle('check-for-updates', (ev: any) => {
        (globalThis as any).__controlli++;
        ev.sender.send('update-error', { error: msg, errorCode: 'release-incomplete' });
        return { error: msg, errorCode: 'release-incomplete' };
      });
    }, INCOMPLETA);

    await expect.poll(() => controlli(electronApp), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(300);
    await expect(page.locator('#update-banner')).toBeHidden();

    await page.evaluate(() => (window as any).controllaAggiornamenti(true));
    await expect(page.locator('#update-banner')).toBeVisible();
    await expect(page.locator('#update-banner-text')).toContainText('pubblicazione di una nuova versione');
    await expect(page.locator('#btn-scarica-aggiornamento')).toHaveText('Riprova');

    await stubControllo(electronApp, { updateAvailable: true, latestVersion: '9.9.9', currentVersion: '3.2.1' });
    await page.locator('#btn-scarica-aggiornamento').click();
    await expect(page.locator('#update-banner-text')).toContainText('9.9.9');
    expect(await controlli(electronApp)).toBe(1);
  });

  test('un errore durante il download resta visibile, con "Scarica" per riprovare', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Updater');
    await stubControllo(electronApp, { updateAvailable: true, latestVersion: '9.9.9', currentVersion: '3.2.1' });
    await expect.poll(() => controlli(electronApp), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect(page.locator('#update-banner-text')).toContainText('9.9.9');

    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('download-update');
      ipcMain.handle('download-update', () => new Promise(() => {}));
    });
    await page.locator('#btn-scarica-aggiornamento').click();
    await electronApp.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update-error', { error: 'read ECONNRESET', errorCode: 'offline' });
    });
    await expect(page.locator('#update-banner-text')).toContainText('Nessuna connessione');
    await expect(page.locator('#btn-scarica-aggiornamento')).not.toHaveText('Riprova');
  });
});
