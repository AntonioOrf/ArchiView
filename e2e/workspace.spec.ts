import { test, expect, launchApp, closeApp } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Gestione workspace', () => {
  test('crea un archivio locale e lo carica', async ({ page, userDataDir }) => {
    const basePath = path.join(userDataDir, 'ws');
    const wsPath = await createLocalWorkspace(page, basePath, 'Manoscritti');

    // Il workspace è stato scritto su disco.
    expect(fs.existsSync(wsPath)).toBe(true);

    // La sidebar mostra il nome dell'archivio corrente.
    await expect(page.locator('#current-vault-name')).toHaveText('Manoscritti', { timeout: 10_000 });
  });

  test('il workspace persiste dopo il riavvio', async ({ page, electronApp, userDataDir }) => {
    const basePath = path.join(userDataDir, 'ws');
    await createLocalWorkspace(page, basePath, 'Persistente');
    await expect(page.locator('#current-vault-name')).toHaveText('Persistente');

    // Chiudi e rilancia con la STESSA userData: il workspace deve ricaricarsi da solo.
    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);

    // Nessuna welcome modal: si va diretti all'app con l'archivio già attivo.
    await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await expect(page2.locator('#current-vault-name')).toHaveText('Persistente', { timeout: 10_000 });
    await closeApp(app2);
  });
});
