import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

test.describe('Tipi Documento', () => {
  test('apriNewTypeModal apre il modal di creazione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Types');

    await page.evaluate(() => (window as any).apriNewTypeModal());
    await expect(page.locator('#new-type-modal')).toBeVisible();
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

    const { launchApp, closeApp } = await import('./fixtures');
    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);

    await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await page2.locator('#btn-tab-add').click();
    await expect(page2.locator('#form-tipo-documento')).toContainText('Tipo Persistente');
    await closeApp(app2);
  });
});
