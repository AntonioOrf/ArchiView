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

  test('aprire un archivio tiene gli ultimi 20 recenti', async ({ userDataDir }) => {
    const vecchi = Array.from({ length: 25 }, (_, i) => path.join(userDataDir, 'vecchio-' + i));
    fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({ recentWorkspaces: vecchi }));
    const { app, page } = await launchApp(userDataDir);
    try {
      const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Venti');
      const recenti = JSON.parse(fs.readFileSync(path.join(userDataDir, 'settings.json'), 'utf8')).recentWorkspaces;
      expect(recenti).toHaveLength(20);
      expect(path.resolve(recenti[0])).toBe(path.resolve(ws));
      expect(recenti.slice(1)).toEqual(vecchi.slice(0, 19));
    } finally {
      await closeApp(app);
    }
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
