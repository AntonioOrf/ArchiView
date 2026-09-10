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

  // Nessuna cartella viene creata automaticamente all'apertura di un vault nuovo: l'albero
  // ha la SOLA riga dell'archivio, che è la radice ('') col nome del vault. La 2.4.1 aveva
  // tolto quella riga e l'albero restava proprio vuoto — senza un posto in cui vedere le
  // schede non archiviate, che è dove finiscono gli import.
  test("vault nuovo: nessuna cartella auto-creata, in albero solo la riga dell archivio", async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Radice');

    const appData = await getAppData(page);
    expect(appData.cartelle).toEqual([]);
    const righe = page.locator('#folder-list .sidebar-row');
    await expect(righe).toHaveCount(1);
    // La riga porta il nome dell'ARCHIVIO, non la parola "Radice".
    await expect(righe.first()).toContainText('Radice');   // qui il vault si chiama così
    expect(await page.evaluate(() => (window as any).cartellaAttuale)).toBe('');
  });

  test("la riga dell archivio prende il nome del vault e mostra le schede non archiviate", async ({ page, userDataDir }) => {
    // Il vault si chiama "Fiesole": l'esca è proprio questa, perché con l'etichetta fissa
    // "Radice" il test passerebbe comunque.
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fiesole');
    await createItemViaForm(page, 'MS-RADICE-001');

    const riga = page.locator('#folder-list .sidebar-row').first();
    await expect(riga).toContainText('Fiesole');
    // La scheda senza cartella si vede DENTRO l'archivio, nell'albero: prima non compariva
    // da nessuna parte nella Struttura.
    await expect(page.locator('#folder-list')).toContainText('MS-RADICE-001');

    // Cliccare la riga riporta alla radice, come una cartella qualsiasi.
    await page.evaluate(() => { (window as any).cartellaAttuale = 'Altrove'; });
    await riga.click();
    expect(await page.evaluate(() => (window as any).cartellaAttuale)).toBe('');
  });

  test("l archivio non si rinomina ne si elimina dal menu della sua riga", async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Radice');

    // Il menu della radice offre solo di creare: rinomina, esporta ed elimina agirebbero su
    // una cartella che non esiste.
    await page.evaluate(() => (window as any).apriMenuContestuale(
      new MouseEvent('contextmenu', { clientX: 40, clientY: 100 }), (window as any).vociMenuCartella('')));
    const menu = page.locator('#custom-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('button', { hasText: /Rinomina|Rename/ })).toHaveCount(0);
    await expect(menu.locator('button', { hasText: /Elimina|Delete/ })).toHaveCount(0);
    await expect(menu.locator('button', { hasText: /Nuova cartella|New folder/ })).toHaveCount(1);
  });

  test('il tasto destro nell\'area vuota crea la prima cartella', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Radice');

    await page.evaluate(() => (window as any).showSidebarFolderContextMenu(
      new MouseEvent('contextmenu', { clientX: 40, clientY: 200 }), 'ROOT'));
    await page.locator('#custom-context-menu [role="menuitem"]', { hasText: /Nuova cartella|New folder/i }).click();

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
    // Resta la sola riga dell'archivio: la cartella eliminata sparisce, la radice no.
    await expect(page.locator('#folder-list .sidebar-row')).toHaveCount(1);
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
