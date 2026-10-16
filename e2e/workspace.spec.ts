import { test, expect, launchApp, closeApp } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Gestione workspace', () => {
  test('crea un archivio locale e lo carica', async ({ page, userDataDir }) => {
    const basePath = path.join(userDataDir, 'ws');
    const wsPath = await createLocalWorkspace(page, basePath, 'Manoscritti');

    expect(fs.existsSync(wsPath)).toBe(true);

    await expect(page.locator('#current-vault-name')).toHaveText('Manoscritti', { timeout: 10_000 });
  });

  test('il workspace persiste dopo il riavvio', async ({ page, electronApp, userDataDir }) => {
    const basePath = path.join(userDataDir, 'ws');
    await createLocalWorkspace(page, basePath, 'Persistente');
    await expect(page.locator('#current-vault-name')).toHaveText('Persistente');

    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);

    await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await expect(page2.locator('#current-vault-name')).toHaveText('Persistente', { timeout: 10_000 });
    await closeApp(app2);
  });
});
