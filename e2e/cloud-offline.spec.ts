import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.describe('Cloud: stati UI offline', () => {
  // Fase 3: niente più gruppo Fetch/Pull/Push né indicatori separati. Il controllo unico
  // resta visibile anche in locale (3.5) e dichiara "Solo locale" invece di sparire.
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

  test('welcome join: un codice invito non valido mostra un errore, senza chiamate di rete', async ({ page, userDataDir }) => {
    // Nessun createLocalWorkspace: la welcome modal è già visibile al primo avvio.
    await expect(page.locator('#welcome-modal')).toBeVisible();
    await page.evaluate(() => (window as any).mostraJoinForm());
    await expect(page.locator('#welcome-join-form')).toBeVisible();

    await page.locator('#welcome-join-code').fill('codice-non-valido-!!!');

    const stato = await page.evaluate(() => ({
      pusherCreds: (window as any).welcomePusherCreds,
      hubInvite: (window as any).welcomeHubInvite,
      errText: document.getElementById('join-code-err')?.textContent,
    }));
    expect(stato.pusherCreds).toBeNull();
    expect(stato.hubInvite).toBeNull();
    expect(stato.errText).toBeTruthy();
  });
});
