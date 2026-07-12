import { test, expect } from './fixtures';
import {
  createLocalWorkspace,
  createItemViaForm,
  createFolder,
  openSidebarPanel,
  getAppData,
  dismissOverlays,
} from './helpers';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Pannelli sidebar', () => {
  test('switchSidebarTab commuta tra i 5 pannelli', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Panels');

    for (const panel of ['search', 'tags', 'source-control', 'history', 'folders'] as const) {
      await openSidebarPanel(page, panel);
      for (const other of ['folders', 'search', 'tags', 'source-control', 'history']) {
        if (other !== panel) await expect(page.locator(`#sidebar-${other}`)).toBeHidden();
      }
    }
  });

  test('source control mostra una modifica pendente e apre il diff modal', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Panels');
    await createItemViaForm(page, 'MS-SRC-001');

    await openSidebarPanel(page, 'source-control');
    await expect(page.locator('#source-control-count')).not.toContainText('0');
    await expect(page.locator('#source-control-list')).toContainText('MS-SRC-001');

    await page.locator('#source-control-list li').first().click();
    await expect(page.locator('#diff-modal')).toBeVisible();
  });

  test('apriDiffModal mostra le differenze tra due versioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Panels');

    await page.evaluate(() => {
      (window as any).apriDiffModal(
        { segnatura: 'Vecchia' },
        { segnatura: 'Nuova' },
        'Test Diff',
      );
    });
    await expect(page.locator('#diff-modal')).toBeVisible();
    await expect(page.locator('#diff-modal')).toContainText('Test Diff');
  });

  test('history: senza cloud collegato mostra il messaggio di archivio non connesso', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Panels');

    await openSidebarPanel(page, 'history');
    await expect(page.locator('#history-list')).toBeVisible();
    await expect(page.locator('#history-list')).not.toContainText('undefined');
  });

  test('il footer mostra il nome dell\'archivio corrente', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'PanelsVault');
    await expect(page.locator('#current-vault-name')).toContainText('PanelsVault');
  });

  test('toggleVaultSwitcher apre il popover con l\'archivio corrente evidenziato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'PanelsVault2');

    await page.evaluate(() => (window as any).toggleVaultSwitcher());
    await expect(page.locator('#vault-switcher-popover')).toBeVisible();
    await expect(page.locator('#vault-switcher-list')).toContainText('PanelsVault2');
  });

  test('cambio tra due archivi tramite il vault switcher', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'wsA'), 'ArchivioA');

    // Crea un secondo archivio: passa direttamente al workspace B (reload della finestra).
    await page.evaluate((basePath) =>
      (window as any).apiBrowser.createWorkspaceInPath(basePath, 'ArchivioB', null),
    path.join(userDataDir, 'wsB'));

    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);
    await expect(page.locator('#current-vault-name')).toContainText('ArchivioB');

    await page.evaluate(() => (window as any).toggleVaultSwitcher());
    await expect(page.locator('#vault-switcher-list')).toContainText('ArchivioA');
    await expect(page.locator('#vault-switcher-list')).toContainText('ArchivioB');

    // Torna al primo archivio cliccando la voce nella lista.
    await page.locator('#vault-switcher-list div', { hasText: 'ArchivioA' }).first().click();

    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);
    await expect(page.locator('#current-vault-name')).toContainText('ArchivioA');
  });

  test('rimuovi un archivio dalla lista senza eliminarne i file', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'wsA'), 'ArchivioRimuovi');
    await page.evaluate((basePath) =>
      (window as any).apiBrowser.createWorkspaceInPath(basePath, 'ArchivioB2', null),
    path.join(userDataDir, 'wsB2'));
    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);

    await page.evaluate(() => (window as any).toggleVaultSwitcher());
    const rowRimuovi = page.locator('#vault-switcher-list div', { hasText: 'ArchivioRimuovi' }).first();
    await rowRimuovi.locator('button').click();

    await expect(page.locator('#vault-delete-modal')).toBeVisible();
    await page.locator('#btn-remove-list').click();
    await expect(page.locator('#vault-delete-modal')).toBeHidden();

    expect(fs.existsSync(path.join(userDataDir, 'wsA', 'ArchivioRimuovi'))).toBe(true);
  });
});
