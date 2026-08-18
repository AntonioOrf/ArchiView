import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, createItemViaForm, getAppData } from './helpers';
import * as path from 'path';

test.describe('Cartelle', () => {
  test('crea cartella e appare nella sidebar', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Folders');
    await createFolder(page, 'Notarile');

    await expect(page.locator('#folder-list')).toContainText('Notarile');
  });

  test('crea sottocartella annidata', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Folders');
    await createFolder(page, 'Notarile');
    await createFolder(page, 'Notarile/Imbreviature');

    const appData = await getAppData(page);
    expect(appData.cartelle).toContain('Notarile/Imbreviature');
  });

  test('rinomina cartella tramite il rename modal generico', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Folders');
    await createFolder(page, 'DaRinominare');

    await page.evaluate(() => (window as any).rinominaCartellaDaSidebar('DaRinominare'));
    await expect(page.locator('#rename-modal')).toBeVisible();
    await page.locator('#rename-input').fill('Rinominata');
    await page.evaluate(() => (window as any).confermaRinomina());

    await expect(page.locator('#rename-modal')).toBeHidden();
    const appData = await getAppData(page);
    expect(appData.cartelle).toContain('Rinominata');
    expect(appData.cartelle).not.toContain('DaRinominare');
  });

  test('rinomina cartella sposta anche le schede contenute', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Folders');
    await createFolder(page, 'ConSchede');
    await page.evaluate(() => {
      (window as any).cartellaAttuale = 'ConSchede';
      (window as any).aggiornaSelectCartelle();
    });
    await createItemViaForm(page, 'MS-FOLDER-MOVE');

    await page.evaluate(() => (window as any).rinominaCartellaDaSidebar('ConSchede'));
    await page.locator('#rename-input').fill('Rinominata2');
    await page.evaluate(() => (window as any).confermaRinomina());

    const appData = await getAppData(page);
    const rec = appData.manoscritti.find((m: any) => m.segnatura === 'MS-FOLDER-MOVE');
    expect(rec.cartella).toBe('Rinominata2');
  });

  test('elimina cartella vuota: bottom-confirm-banner conferma la rimozione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Folders');
    await createFolder(page, 'DaEliminareSidebar');

    await page.evaluate(() => (window as any).eliminaCartellaDaSidebar('DaEliminareSidebar'));
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();

    const appData = await getAppData(page);
    expect(appData.cartelle).not.toContain('DaEliminareSidebar');
  });

  test('elimina cartella con schede elimina anche le schede contenute (con tombstone)', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Folders');
    await createFolder(page, 'ConSchedeDaEliminare');
    await page.evaluate(() => {
      (window as any).cartellaAttuale = 'ConSchedeDaEliminare';
      (window as any).aggiornaSelectCartelle();
    });
    await createItemViaForm(page, 'MS-FOLDER-DEL');
    const idPrima = (await getAppData(page)).manoscritti.find((m: any) => m.segnatura === 'MS-FOLDER-DEL').id;

    await page.evaluate(() => (window as any).eliminaCartellaDaSidebar('ConSchedeDaEliminare'));
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();

    const appData = await getAppData(page);
    expect(appData.manoscritti.find((m: any) => m.segnatura === 'MS-FOLDER-DEL')).toBeUndefined();
    expect(appData.deletedIds).toContain(idPrima);
    expect(appData.cartelle).not.toContain('ConSchedeDaEliminare');
  });

  // Radice virtuale: nessuna cartella viene creata automaticamente all'apertura di un
  // vault nuovo. L'albero mostra solo cartelle, quindi resta proprio vuoto.
  test('vault nuovo: nessuna cartella auto-creata, albero vuoto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Radice');

    const appData = await getAppData(page);
    expect(appData.cartelle).toEqual([]);
    await expect(page.locator('#folder-list .sidebar-row')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).cartellaAttuale)).toBe('');
  });

  test('il tasto destro nell\'area vuota crea la prima cartella', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Radice');

    await page.evaluate(() => (window as any).showSidebarFolderContextMenu(
      new MouseEvent('contextmenu', { clientX: 40, clientY: 200 }), 'ROOT'));
    await page.locator('#custom-context-menu [role="menuitem"]', { hasText: /Crea nuova cartella|New folder/i }).click();

    await expect(page.locator('#folder-modal')).toBeVisible();
    await page.locator('#folder-name-input').fill('Prima');
    await page.evaluate(() => (window as any).confermaAggiungiCartella());

    expect((await getAppData(page)).cartelle).toEqual(['Prima']);
    await expect(page.locator('#folder-list')).toContainText('Prima');
  });

  test('click nell\'area vuota della sidebar torna alla radice', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Radice');
    await createFolder(page, 'Notarile');
    expect(await page.evaluate(() => (window as any).cartellaAttuale)).toBe('Notarile');

    const box = (await page.locator('#sidebar-folders').boundingBox())!;
    await page.mouse.click(box.x + 20, box.y + box.height - 12);

    expect(await page.evaluate(() => (window as any).cartellaAttuale)).toBe('');
  });

  test('scheda creata senza cartelle finisce nella radice ed è visibile', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Radice');
    await createItemViaForm(page, 'MS-RADICE-001');

    const appData = await getAppData(page);
    expect(appData.manoscritti.find((m: any) => m.segnatura === 'MS-RADICE-001').cartella).toBe('');
    expect(appData.cartelle).toEqual([]);
    await expect(page.locator('main')).toContainText('MS-RADICE-001');
  });

  test('eliminare l\'ultima cartella riporta alla radice senza errori', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Radice');
    await createFolder(page, 'Unica');

    await page.evaluate(() => (window as any).eliminaCartellaDaSidebar('Unica'));
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();

    const appData = await getAppData(page);
    expect(appData.cartelle).toEqual([]);
    expect(await page.evaluate(() => (window as any).cartellaAttuale)).toBe('');
    await expect(page.locator('#folder-list .sidebar-row')).toHaveCount(0);
  });

  test('validazione: nome cartella vuoto mostra errore e non chiude il modal', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Folders');
    await page.evaluate(() => (window as any).aggiungiCartella());
    await page.locator('#folder-name-input').fill('   ');
    await page.evaluate(() => (window as any).confermaAggiungiCartella());

    await expect(page.locator('#folder-modal')).toBeVisible();
  });

  test('validazione: nome cartella duplicato mostra errore', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Folders');
    await createFolder(page, 'Duplicata');

    await page.evaluate(() => (window as any).aggiungiCartella());
    await page.locator('#folder-name-input').fill('Duplicata');
    await page.evaluate(() => (window as any).confermaAggiungiCartella());

    await expect(page.locator('#folder-modal')).toBeVisible();
  });
});
