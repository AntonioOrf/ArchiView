import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'CambioAccount' });

test('#40: Disconnetti e accesso con un altro account dalle Impostazioni su un backup propone archivio esistente o nuovo backup', async ({ page, electronApp, userDataDir }) => {
  await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CambioAccount');
  await electronApp.evaluate(({ ipcMain }: any) => {
    let utente: string | null = 'a@example.org';
    const sostituisci = (canale: string, fn: (...a: any[]) => any) => { ipcMain.removeHandler(canale); ipcMain.handle(canale, fn); };
    sostituisci('get-vault-config', () => ({ vaultType: 'backup', provider: 'drive', sync: { sharedVaultId: 'cartella-a' } }));
    sostituisci('drive-logout', () => { utente = null; return true; });
    sostituisci('drive-auth', () => { utente = 'b@example.org'; return true; });
    sostituisci('drive-status', () => utente
      ? { isAuthenticated: true, user: utente, backupAltroAccount: utente !== 'a@example.org' }
      : { isAuthenticated: false });
    sostituisci('drive-list-vaults', () => [{ id: 'cartella-b', name: 'Archivio su B', modifiedTime: '2026-10-01T10:00:00Z' }]);
  });

  await page.evaluate(async () => { await (window as any).aggiornaStatoDrive(); (window as any).apriImpostazioni('tab-sync'); });
  await page.locator('#btn-drive-logout').click();
  await expect(page.locator('#btn-drive-login')).toBeVisible();
  await page.locator('#btn-drive-login').click();

  await expect(page.locator('#cloud-relink-section')).toBeVisible();
  await expect(page.locator('#cloud-relink-list')).toContainText('Archivio su B');
});

test('Da connesso, Cambia account chiede conferma e apre la scelta dell\'account', async ({ page, electronApp, userDataDir }) => {
  await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CambioAccount');
  await electronApp.evaluate(({ ipcMain }: any) => {
    (globalThis as any).__authForzate = [];
    const sostituisci = (canale: string, fn: (...a: any[]) => any) => { ipcMain.removeHandler(canale); ipcMain.handle(canale, fn); };
    sostituisci('get-vault-config', () => ({ vaultType: 'backup', provider: 'drive', sync: { sharedVaultId: 'cartella-a' } }));
    sostituisci('drive-status', () => ({ isAuthenticated: true, user: 'a@example.org' }));
    sostituisci('drive-auth', (_e: any, forza: boolean) => { (globalThis as any).__authForzate.push(forza); return true; });
  });

  await page.evaluate(async () => { (window as any).apriImpostazioni('tab-sync'); await (window as any).aggiornaStatoDrive(); });
  const sezione = page.locator('#settings-drive-section');
  await expect(sezione.locator('#btn-drive-switch')).toBeVisible();
  await expect(sezione.locator('#btn-drive-login')).toBeHidden();
  await sezione.locator('#btn-drive-switch').click();

  const dialogo = page.getByRole('dialog', { name: 'Cambiare account Google?' });
  await expect(dialogo).toContainText('a@example.org');
  await dialogo.getByRole('button', { name: 'Annulla' }).click();
  await expect(dialogo).toHaveCount(0);
  expect(await electronApp.evaluate(() => (globalThis as any).__authForzate)).toEqual([]);

  await sezione.locator('#btn-drive-switch').click();
  await dialogo.getByRole('button', { name: 'Cambia account' }).click();
  await expect.poll(() => electronApp.evaluate(() => (globalThis as any).__authForzate)).toEqual([true]);
});
