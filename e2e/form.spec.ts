import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

test.describe('Vista Form (add/edit)', () => {
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
    await expect(page.locator('main')).toContainText('MS-FORM-TAGS', { timeout: 10_000 });

    const data = await getAppData(page);
    const tags = data.manoscritti.find((m: any) => m.segnatura === 'MS-FORM-TAGS').tags;
    expect(tags).toBe('medievale, pergamena');
  });

  test('#btn-cancel-edit torna alla lista senza salvare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Form');
    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-FORM-ORIG');
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('main')).toContainText('MS-FORM-ORIG', { timeout: 10_000 });

    await page.locator('main button', { hasText: /Modifica|Edit/i }).first().click();
    await expect(page.locator('#btn-cancel-edit')).toBeVisible();
    await page.locator('#form-segnatura').fill('MS-FORM-MODIFICATO');
    await page.locator('#btn-cancel-edit').click();

    // Il campo modificato ha marcato il form come "dirty": la stessa guardia
    // di switchTab scatta anche per Annulla e mostra la conferma di uscita.
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();

    await expect(page.locator('#view-list')).toBeVisible();
    await expect(page.locator('main')).toContainText('MS-FORM-ORIG');
    await expect(page.locator('main')).not.toContainText('MS-FORM-MODIFICATO');
  });

  test('guardia modifiche non salvate: navigare via con form sporco mostra la conferma', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Form');

    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-DIRTY');
    await expect.poll(() => page.evaluate(() => (window as any).isFormDirty)).toBe(true);

    await page.evaluate(() => (window as any).switchTab('list'));
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();

    // Annulla: resta sul form.
    await page.locator('#bottom-confirm-banner button', { hasText: /Annulla/i }).click();
    await expect(page.locator('#view-add')).toBeVisible();

    // Riprova e conferma uscita.
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
