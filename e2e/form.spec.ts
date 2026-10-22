import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Form' });

test.describe('Vista Form (add/edit)', () => {
  test('Invio su "Nuova scheda" porta il fuoco sulla segnatura', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Form');
    await page.locator('#btn-tab-add').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#manoscritto-form')).toBeVisible();
    await expect(page.locator('#form-segnatura')).toBeFocused();
  });

  test('la scheda ha sezioni con etichette a sinistra, indice, titolo dalla segnatura e Salva sempre in vista', async ({ page, electronApp, userDataDir }) => {
    await electronApp.evaluate(({ BrowserWindow }) => {
      const b = BrowserWindow.getAllWindows()[0]; b.unmaximize(); b.setContentSize(1500, 860);
    });
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Form');
    await page.locator('#btn-tab-add').click();
    const titolo = page.locator('#form-titolo-segnatura');
    await expect(titolo).toHaveText(/Ancora senza segnatura|No shelfmark yet/);
    await page.locator('#form-segnatura').fill('ASF, Not. 1042');
    await expect(titolo).toHaveText('ASF, Not. 1042');

    await expect(page.locator('#manoscritto-form > .scheda-sez')).toHaveCount(4);
    const [etichetta, campo] = await Promise.all([
      page.locator('label[for="form-segnatura"]').boundingBox(),
      page.locator('#form-segnatura').boundingBox(),
    ]);
    expect(etichetta!.x + etichetta!.width).toBeLessThan(campo!.x);
    expect(Math.abs(etichetta!.y - campo!.y)).toBeLessThan(campo!.height);

    const salva = page.locator('#btn-submit-form');
    const inVista = async () => {
      const b = (await salva.boundingBox())!;
      return b.y + b.height <= await page.evaluate(() => window.innerHeight);
    };
    expect(await inVista()).toBe(true);
    await page.locator('.scheda-indice').getByRole('link', { name: /^(Tag e collegamenti|Tags and links)$/ }).click();
    await expect(page.locator('#form-tags')).toBeInViewport();
    expect(await inVista()).toBe(true);
  });

  test('cambiare tipo documento rigenera i campi dinamici', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Form');

    await page.locator('#btn-tab-add').click();
    await expect(page.locator('#manoscritto-form')).toBeVisible();

    const optionsCount = await page.locator('#form-tipo-documento option').count();
    expect(optionsCount).toBeGreaterThan(1);

    const primaHtml = await page.locator('#form-dynamic-fields').innerHTML();

    const secondoValore = await page.locator('#form-tipo-documento option').nth(1).getAttribute('value');
    await page.locator('#form-tipo-documento').selectOption(secondoValore!);

    const dopoHtml = await page.locator('#form-dynamic-fields').innerHTML();
    expect(dopoHtml).not.toBe(primaHtml);
  });

  test('i tag inseriti vengono salvati sulla scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Form');

    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-FORM-TAGS');
    await page.locator('#form-tags').fill('medievale, pergamena');
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-FORM-TAGS', { timeout: 10_000 });

    const data = await getAppData(page);
    const tags = data.manoscritti.find((m: any) => m.segnatura === 'MS-FORM-TAGS').tags;
    expect(tags).toBe('medievale, pergamena');
  });

  test('#btn-cancel-edit torna alla lista senza salvare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Form');
    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-FORM-ORIG');
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-FORM-ORIG', { timeout: 10_000 });

    await page.locator('main button', { hasText: /Modifica|Edit/i }).first().click();
    await expect(page.locator('#btn-cancel-edit')).toBeVisible();
    await page.locator('#form-segnatura').fill('MS-FORM-MODIFICATO');
    await page.locator('#btn-cancel-edit').click();

    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();

    await expect(page.locator('#view-list')).toBeVisible();
    await expect(page.locator('#view-list')).toContainText('MS-FORM-ORIG');
    await expect(page.locator('#view-list')).not.toContainText('MS-FORM-MODIFICATO');
  });

  test('guardia modifiche non salvate: navigare via con form sporco mostra la conferma', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Form');

    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-DIRTY');
    await expect.poll(() => page.evaluate(() => (window as any).isFormDirty)).toBe(true);

    await page.evaluate(() => (window as any).switchTab('list'));
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();

    await page.locator('#bottom-confirm-banner button', { hasText: /Annulla/i }).click();
    await expect(page.locator('#view-add')).toBeVisible();

    await page.evaluate(() => (window as any).switchTab('list'));
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();
    await expect(page.locator('#view-list')).toBeVisible();
  });

  test('Ctrl+N apre la vista add e mette il focus sulla segnatura', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Form');

    await page.keyboard.press('Control+n');
    await expect(page.locator('#view-add')).toBeVisible();
    await expect(page.locator('#form-segnatura')).toBeFocused();
  });
});
