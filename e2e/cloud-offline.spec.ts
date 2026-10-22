import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.describe('Cloud: stati UI offline', () => {
  test('senza cloud configurato i tab cloud sono nascosti e lo stato è "Solo locale"', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CloudOff');

    await expect(page.locator('#btn-tab-source-control')).toBeHidden();
    await expect(page.locator('#btn-tab-history')).toBeHidden();

    const btn = page.locator('#cloud-status-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('data-stato', 'locale');
    await expect(page.locator('#cloud-status-label')).toHaveText('Solo locale');
  });

  test('il popover in locale offre di attivare il cloud, non le azioni di sync', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CloudOff');

    await page.locator('#cloud-status-btn').click();
    const menu = page.locator('#custom-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Attiva il cloud');
    await expect(menu.locator('[role="menuitem"]')).toHaveCount(1);
  });

  test('il cloud modal in locale mostra solo il backup personale, non le opzioni di disconnessione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CloudOff');

    await page.evaluate(() => (window as any).apriCloudModal());
    await expect(page.locator('#cloud-modal')).toBeVisible();
    await expect(page.locator('#btn-trasforma-personale')).toBeVisible();
    await expect(page.locator('#btn-disconnect-cloud')).toBeHidden();
  });

  test('apriShareModal su archivio locale mostra lo stato "locale"', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CloudOff');

    await page.evaluate(() => (window as any).apriShareModal());
    await expect(page.locator('#share-modal')).toBeVisible();
    await expect(page.locator('#share-state-local')).toBeVisible();
    await expect(page.locator('#share-state-owner')).toBeHidden();
    await expect(page.locator('#share-state-member')).toBeHidden();
  });

  test('da proprietario la matita rinomina l\'archivio condiviso', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CloudOff');
    await page.evaluate(async () => {
      const w = window as any;
      w.hubConfig = { name: 'Vault ABC', attachmentsMode: 'off', lastLoadedAt: Date.now() };
      w.getHubRole = async () => 'owner';
      w.listaMembriHub = async () => [];
      w.__rinominato = null;
      w.rinominaVaultHub = async (nome: string) => { w.__rinominato = nome; return true; };
      await w.apriShareModal();
    });
    await expect(page.locator('#share-owner-reponame')).toHaveText('Vault ABC');
    await page.getByRole('button', { name: /Rinomina l'archivio|Rename the archive/ }).click();
    const campo = page.locator('#share-owner-reponame input');
    await expect(campo).toBeFocused();
    await campo.fill('Fondo Notarile');
    await campo.press('Enter');
    await expect(page.locator('#share-owner-reponame')).toHaveText('Fondo Notarile');
    expect(await page.evaluate(() => (window as any).__rinominato)).toBe('Fondo Notarile');
  });

  test('gestione archivi: i recenti si elencano e uno si apre con un clic', async ({ page, userDataDir }) => {
    const base = path.join(userDataDir, 'ws');
    await createLocalWorkspace(page, base, 'CloudOff');
    const primo = await page.evaluate(() => (window as any).apiBrowser.getWorkspacePath());
    await page.evaluate((p) => { setTimeout(() => (window as any).apiBrowser.createWorkspaceInPath(p, 'Secondo'), 0); }, base);
    await expect.poll(async () => { try { return await page.evaluate(() => (window as any).apiBrowser.getWorkspacePath()); } catch { return ''; } })
      .toBe(path.join(base, 'Secondo'));
    await page.waitForFunction(() => (window as any).__appPronta === true);

    await page.evaluate(() => (window as any).mostraWelcomeModal());
    const recenti = page.locator('#welcome-recenti');
    await expect(recenti).toBeVisible();
    await expect(recenti.locator('.archivio-recente[aria-current="true"]')).toContainText('Secondo');
    await expect(recenti.locator('.archivio-recente[aria-current="true"]')).toBeDisabled();
    await recenti.locator('.archivio-recente', { hasText: 'CloudOff' }).click();
    await expect.poll(async () => { try { return await page.evaluate(() => (window as any).apiBrowser.getWorkspacePath()); } catch { return ''; } })
      .toBe(primo);
  });

  test('welcome join: un codice invito non valido mostra un errore, senza chiamate di rete', async ({ page, userDataDir }) => {
    await expect(page.locator('#welcome-modal')).toBeVisible();
    await page.evaluate(() => (window as any).mostraJoinForm());
    await expect(page.locator('#welcome-join-form')).toBeVisible();

    await page.locator('#welcome-join-code').fill('codice-non-valido-!!!');

    const stato = await page.evaluate(() => ({
      driveInvite: (window as any).welcomeDriveInvite,
      hubInvite: (window as any).welcomeHubInvite,
      errText: document.getElementById('join-code-err')?.textContent,
    }));
    expect(stato.driveInvite).toBeNull();
    expect(stato.hubInvite).toBeNull();
    expect(stato.errText).toBeTruthy();
  });
});
