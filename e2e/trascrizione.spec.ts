import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, getAppData } from './helpers';
import * as path from 'path';

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'sample.pdf');

test.describe('Vista Trascrizione', () => {
  test('apertura con allegato immagine mostra editor e anteprima', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-IMG', FIXTURE_PNG);

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await expect(page.locator('#trasc-img-preview')).toBeVisible();
    const src = await page.locator('#trasc-img-preview').getAttribute('src');
    expect(src).toBeTruthy();

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Nota di trascrizione');
    await expect(page.locator('#trascrizione-editor')).toContainText('Nota di trascrizione');
  });

  test('apertura con allegato PDF mostra la preview PDF', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-PDF', FIXTURE_PDF);

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-pdf-preview')).toBeVisible();
    const src = await page.locator('#trasc-pdf-preview').getAttribute('src');
    expect(src).toBeTruthy();
  });

  test('thumbnails e navigazione tra due allegati', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-MULTI', FIXTURE_PNG);

    // Aggiunge un secondo allegato tramite l'editor di trascrizione.
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#trascrizione-thumbnails')).toBeVisible();
    await expect(page.locator('#trascrizione-thumbnails .allegato-btn')).toHaveCount(2);

    await expect(page.locator('#btn-next-allegato')).toBeVisible();
    await page.locator('#btn-next-allegato').click();
    await expect(page.locator('#trasc-pdf-preview')).toBeVisible();

    await page.locator('#btn-prev-allegato').click();
    await expect(page.locator('#trasc-img-preview')).toBeVisible();
  });

  test('Alt+ArrowRight cambia allegato da tastiera', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-KEY', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#trascrizione-thumbnails .allegato-btn')).toHaveCount(2);

    await page.locator('#view-trascrizione').click();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.locator('#trasc-pdf-preview')).toBeVisible();

    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.locator('#trasc-img-preview')).toBeVisible();
  });

  test('Ctrl+S salva la trascrizione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-SAVE', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Testo da salvare');
    await page.keyboard.press('Control+s');

    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 8_000 });
    const appData = await getAppData(page);
    const rec = appData.manoscritti.find((m: any) => m.id === id);
    expect(rec.trascrizione).toContain('Testo da salvare');
  });

  test('Alt+F attiva/disattiva il fullscreen dell\'editor', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-FULL', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    const isHidden = () => page.evaluate(() =>
      document.getElementById('trascrizione-editor-panel')!.classList.contains('hidden'),
    );

    // Alt da solo attiva il menu nativo su Windows/Electron: dispatch diretto
    // dell'evento invece di keyboard.press, per testare l'handler in isolamento.
    const dispatchAltF = () => page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', altKey: true, bubbles: true }));
    });

    await dispatchAltF();
    await expect.poll(isHidden).toBe(true);

    await dispatchAltF();
    await expect.poll(isHidden).toBe(false);
  });

  test('#btn-collapse-editor collassa e riespande il pannello editor', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-COLLAPSE', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    const isHidden = () => page.evaluate(() =>
      document.getElementById('trascrizione-editor-panel')!.classList.contains('hidden'),
    );

    await page.locator('#btn-collapse-editor').click();
    await expect.poll(isHidden).toBe(true);

    await page.locator('#btn-collapse-editor').click();
    await expect.poll(isHidden).toBe(false);
  });

  test('uscire con modifiche non salvate mostra il modal di conferma', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-DIRTY', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Non salvato');

    await page.locator('#btn-back-to-list-trasc').click();
    await expect(page.locator('#unsaved-modal')).toBeVisible();

    await page.evaluate(() => (window as any).confermaUscitaTrascrizione());
    await expect(page.locator('#view-list')).toBeVisible();
  });
});
