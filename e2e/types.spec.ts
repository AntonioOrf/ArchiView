import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Types' });

test.describe('Tipi Documento', () => {
  test('apriNewTypeModal apre il modal di creazione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Types');

    await page.evaluate(() => (window as any).apriNewTypeModal());
    await expect(page.locator('#new-type-modal')).toBeVisible();
  });

  test('WCAG 2.5.7 — i campi del modello si riordinano con i pulsanti, senza trascinare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Types');

    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#new-type-select').selectOption('custom');
    await page.locator('#custom-type-name').fill('Ordine');
    for (const c of ['Primo', 'Secondo']) {
      await page.locator('#custom-type-extra-input').fill(c);
      await page.locator('#custom-type-extra-input').press('Enter');
    }
    const ordine = () => page.locator('#custom-fields-list .custom-field-item').evaluateAll(
      p => p.map(x => (x as HTMLElement).dataset.val).filter(v => v === 'Primo' || v === 'Secondo'));
    expect(await ordine()).toEqual(['Primo', 'Secondo']);

    const destra = page.locator('.custom-field-item[data-val="Primo"] .pill-sposta').nth(1);
    await expect(destra).toHaveAttribute('aria-label', /Primo/);
    await destra.click();
    expect(await ordine()).toEqual(['Secondo', 'Primo']);
    await expect(destra).toBeFocused();
    await expect(page.locator('#a11y-live-polite')).toContainText('Primo');

    await page.evaluate(() => (window as any).confermaCreaTipo());
    const tipo = (await getAppData(page)).tipiDocumento.find((t: any) => t.nome === 'Ordine');
    const campi = tipo.campi.filter((c: string) => c === 'Primo' || c === 'Secondo');
    expect(campi).toEqual(['Secondo', 'Primo']);
  });

  test('F11 — un campo del modello non può chiamarsi come una chiave della scheda; le virgolette nel nome non rompono l\'editor', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Types');
    const errori: string[] = [];
    page.on('pageerror', (e) => errori.push(String(e)));

    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#new-type-select').selectOption('custom');
    await page.locator('#custom-type-name').fill('Virgolette');
    for (const c of ['trascrizione', 'relazioni', 'Detto "il Vecchio"']) {
      await page.locator('#custom-type-extra-input').fill(c);
      await page.locator('#custom-type-extra-input').press('Enter');
    }
    const valori = await page.locator('#custom-fields-list .custom-field-item').evaluateAll(p => p.map(x => (x as HTMLElement).dataset.val));
    expect(valori).not.toContain('trascrizione');
    expect(valori).not.toContain('relazioni');
    expect(valori).toContain('Detto "il Vecchio"');

    await page.evaluate(() => (window as any).confermaCreaTipo());
    await expect(page.locator('#new-type-modal')).toBeHidden();
    const tipo = (await getAppData(page)).tipiDocumento.find((t: any) => t.nome === 'Virgolette');
    expect(tipo.campi).toContain('Detto "il Vecchio"');

    await page.evaluate((id) => (window as any).modificaTipoDocumento(id), tipo.id);
    await expect(page.locator('#new-type-modal')).toBeVisible();
    await expect(page.locator('#custom-fields-list')).toContainText('Detto "il Vecchio"');
    await page.locator('.custom-field-item').filter({ hasText: 'Detto "il Vecchio"' }).locator('button').last().click();
    await page.evaluate(() => (window as any).confermaCreaTipo());
    expect(errori).toEqual([]);
  });

  test('F16 — se il salvataggio del modello fallisce lo si dice, invece di «Modello creato»', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Types');
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('salva-dati');
      ipcMain.handle('salva-dati', () => { throw new Error('disco pieno'); });
    });
    const errori: string[] = [];
    page.on('pageerror', (e) => errori.push(String(e)));
    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#new-type-select').selectOption('custom');
    await page.locator('#custom-type-name').fill('Fallito');
    await page.locator('#custom-type-extra-input').fill('Campo');
    await page.locator('#custom-type-extra-input').press('Enter');
    await page.evaluate(() => (window as any).confermaCreaTipo());
    await expect(page.locator('#toast-container')).toContainText(/non è stato salvato|was not saved/);
    await expect(page.locator('#new-type-modal')).toBeVisible();
    expect(errori).toEqual([]);
  });

  test('crea un tipo documento custom con campi personalizzati', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Types');

    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#new-type-select').selectOption('custom');
    await page.locator('#custom-type-name').fill('Registro Notarile');
    await page.locator('#custom-type-extra-input').fill('CampoExtra');
    await page.locator('#custom-type-extra-input').press('Enter');

    await expect(page.locator('#custom-fields-list')).toContainText('CampoExtra');
    await page.evaluate(() => (window as any).confermaCreaTipo());

    await expect(page.locator('#new-type-modal')).toBeHidden();
    const appData = await getAppData(page);
    const tipo = appData.tipiDocumento.find((t: any) => t.nome === 'Registro Notarile');
    expect(tipo).toBeTruthy();
    expect(tipo.campi).toContain('CampoExtra');
  });

  test('il nuovo tipo compare come opzione nel form', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Types');

    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#custom-type-name').fill('Tipo Selezionabile');
    await page.locator('#custom-type-extra-input').fill('Campo1');
    await page.locator('#custom-type-extra-input').press('Enter');
    await page.evaluate(() => (window as any).confermaCreaTipo());

    await page.locator('#btn-tab-add').click();
    await expect(page.locator('#form-tipo-documento')).toContainText('Tipo Selezionabile');
  });

  test('manage types elenca i tipi ed elimina un tipo custom inutilizzato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Types');

    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#custom-type-name').fill('Da Eliminare');
    await page.locator('#custom-type-extra-input').fill('Campo1');
    await page.locator('#custom-type-extra-input').press('Enter');
    await page.evaluate(() => (window as any).confermaCreaTipo());

    await page.evaluate(() => (window as any).apriManageTypesModal());
    await expect(page.locator('#manage-types-list')).toBeVisible();
    await expect(page.locator('#manage-types-list')).toContainText('Da Eliminare');

    const tipoId = await getAppData(page).then((d) =>
      d.tipiDocumento.find((t: any) => t.nome === 'Da Eliminare').id,
    );
    await page.evaluate((id) => (window as any).eliminaTipoDocumento(id), tipoId);
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();

    const appData = await getAppData(page);
    expect(appData.tipiDocumento.find((t: any) => t.id === tipoId)).toBeUndefined();
  });

  test('i tipi documento custom persistono dopo il riavvio', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Types');

    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#custom-type-name').fill('Tipo Persistente');
    await page.locator('#custom-type-extra-input').fill('Campo1');
    await page.locator('#custom-type-extra-input').press('Enter');
    await page.evaluate(() => (window as any).confermaCreaTipo());

    await page.evaluate(() => (window as any).flushSalvataggio());

    const { launchApp, closeApp } = await import('./fixtures');
    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);

    await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await page2.locator('#btn-tab-add').click();
    await expect(page2.locator('#form-tipo-documento')).toContainText('Tipo Persistente');
    await closeApp(app2);
  });
});
