import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.describe('Cloud: stati UI offline', () => {
  test('senza cloud configurato i bottoni Fetch/Pull/Push sono nascosti', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CloudOff');

    await expect(page.locator('#cloud-buttons-container')).not.toHaveClass(/(^| )flex/);
    await expect(page.locator('#btn-tab-source-control')).toBeHidden();
    await expect(page.locator('#btn-tab-history')).toBeHidden();
  });

  test('gli indicatori di sincronizzazione sono nascosti in locale', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CloudOff');

    await expect(page.locator('#incoming-updates-indicator')).toBeHidden();
    await expect(page.locator('#pending-changes-indicator')).toBeHidden();
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
