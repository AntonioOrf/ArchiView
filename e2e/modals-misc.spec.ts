import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, createItemViaForm } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Modals' });

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');

test.describe('Modali minori', () => {
  test('click sulla miniatura allegato nel form apre l\'image modal', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await createItemWithAttachment(page, 'MS-MODAL-IMG', FIXTURE_PNG);

    await page.locator('main button', { hasText: /Modifica|Edit/i }).first().click();
    await page.locator('.allegato-row').first().click();

    await expect(page.locator('#image-modal')).toBeVisible();
    await expect(page.locator('#modal-img')).toBeVisible();

    await page.evaluate(() => (window as any).chiudiModal());
    await expect(page.locator('#image-modal')).toBeHidden();
  });

  test('apriModalDocumenti apre e chiude il modal documenti', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await createItemViaForm(page, 'MS-MODAL-DOCS');

    const id = await page.evaluate(() => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.segnatura === 'MS-MODAL-DOCS').id;
    });

    await page.evaluate((recId) => (window as any).apriModalDocumenti(recId), id);
    await expect(page.locator('#docs-modal')).toBeVisible();
    await expect(page.locator('#docs-modal-title')).toContainText('MS-MODAL-DOCS');

    await page.evaluate(() => (window as any).chiudiModalDocumenti());
    await expect(page.locator('#docs-modal')).toBeHidden();
  });

  test('D16 — le preferenze dell\'interfaccia escono dal database e restano in locale', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    const fs = await import('fs');
    const file = path.join(ws, 'database_manoscritti.json');
    await page.evaluate(() => (window as any).salvaTutto());
    const db = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...db, skipConfirmations: { delete_type: true }, trascrizioneEditorWidth: '30%' }));
    await page.reload();
    await page.waitForFunction(() => (window as any).__appPronta === true);

    await expect.poll(() => {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      return [d.skipConfirmations, d.trascrizioneEditorWidth];
    }).toEqual([undefined, undefined]);
    const saltata = await page.evaluate(() => new Promise((ok) => {
      (window as any).mostraBottomConfirm('?', () => ok(true), 'delete_type');
      setTimeout(() => ok(false), 500);
    }));
    expect(saltata).toBe(true);
    expect(await page.evaluate(() => (window as any).prefLocale('larghezzaTrascrizione:testo'))).toBe('30%');
  });

  test('il changelog è riapribile e richiudibile dopo il primo avvio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');

    await page.evaluate(() => (window as any).apriChangelogModal());
    await expect(page.locator('#changelog-modal')).toBeVisible();

    await page.evaluate(() => (window as any).chiudiChangelogModal());
    await expect(page.locator('#changelog-modal')).toBeHidden();
  });

  test('il changelog mostra la versione in esecuzione e contenuto non vuoto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');

    const versione = await page.evaluate(() => (window as any).apiBrowser.getVersion());
    await page.evaluate(() => (window as any).apriChangelogModal());
    await expect(page.locator('#changelog-modal')).toBeVisible();

    await expect(page.locator('#changelog-modal .modal-title')).toContainText(String(versione));
    await expect(page.locator('#changelog-content')).not.toBeEmpty();

    await page.evaluate(() => (window as any).chiudiChangelogModal());
  });

  test('issue modal si apre, mostra i campi e si chiude senza inviare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');

    await page.evaluate(() => (window as any).apriIssueModal());
    await expect(page.locator('#issue-modal')).toBeVisible();
    await expect(page.locator('#issue-title-input')).toBeVisible();
    await expect(page.locator('#issue-desc-input')).toBeVisible();

    await page.locator('#issue-title-input').fill('Problema di prova');
    await page.locator('#issue-modal button', { hasText: /Annulla/i }).click();

    await expect(page.locator('#issue-modal')).toBeHidden();
  });

  test('un\'azione mostra un toast che poi scompare da solo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await createItemViaForm(page, 'MS-MODAL-TOAST');

    const id = await page.evaluate(() => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.segnatura === 'MS-MODAL-TOAST').id;
    });
    await page.evaluate((recId) => (window as any).deleteItem(recId), id);
    await page.evaluate(() => (window as any).confermaEliminazione());

    await expect(page.locator('#toast-container')).toBeVisible();
    await expect(page.locator('#toast-container')).toBeHidden({ timeout: 15_000 });
  });

  test('eliminare una scheda mostra un banner di conferma con opzione di annullamento', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await createItemViaForm(page, 'MS-MODAL-UNDO');

    const id = await page.evaluate(() => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.segnatura === 'MS-MODAL-UNDO').id;
    });
    await page.evaluate((recId) => (window as any).deleteItem(recId), id);
    await page.evaluate(() => (window as any).confermaEliminazione());

    await expect(page.locator('#toast-container')).toContainText(/eliminat/i);
  });

  test('F22 — riordinare le carte trascinandole nel modale Documenti si annulla con Ctrl+Z', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-RIORDINO');
    await page.locator('#form-allegato').setInputFiles([FIXTURE_PNG, path.join(__dirname, 'fixtures', 'sample.pdf')]);
    await page.locator('#btn-submit-form').click();
    const ordine = () => page.evaluate(() => {
      // @ts-ignore
      const m = (appData as any).manoscritti.find((x: any) => x.segnatura === 'MS-RIORDINO');
      return m ? m.allegati.map((a: any) => a.tipo) : [];
    });
    await expect.poll(ordine).toHaveLength(2);
    const prima = await ordine();
    const id = await page.evaluate(() => {
      // @ts-ignore
      return (appData as any).manoscritti.find((x: any) => x.segnatura === 'MS-RIORDINO').id;
    });
    await page.evaluate((rid) => (window as any).apriModalDocumenti(rid), id);
    const carte = page.locator('#docs-modal-content > div[draggable="true"]');
    await expect(carte).toHaveCount(2);
    await carte.nth(1).dragTo(carte.nth(0), { targetPosition: { x: 5, y: 20 } });
    expect(await ordine()).toEqual([...prima].reverse());
    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(ordine).toEqual(prima);
  });

  test('F22 — «Abbandona l\'archivio condiviso» chiede conferma una volta sola', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await electronApp.evaluate(({ ipcMain }) => {
      (globalThis as any).__scollegato = 0;
      ipcMain.removeHandler('set-vault-type');
      ipcMain.handle('set-vault-type', () => { (globalThis as any).__scollegato++; return { vaultType: 'local' }; });
    });
    await page.evaluate(() => (window as any).abbandonaArchivioShare());
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();
    await expect.poll(() => electronApp.evaluate(() => (globalThis as any).__scollegato)).toBe(1);
    await expect(page.locator('#bottom-confirm-banner')).toBeHidden();
  });

  test('F20 — il pannello «?» elenca Ctrl+Maiusc+S, Alt+K e PagSu/PagGiù', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Modals');
    await page.evaluate(() => (window as any).apriScorciatoie());
    const corpo = page.locator('#shortcuts-body');
    await expect(corpo).toBeVisible();
    const tasti = await corpo.locator('kbd').evaluateAll((els) => els.map((e) => e.textContent!.trim()));
    for (const t of ['K', 'S', 'PagSu', 'PagGiù']) expect(tasti).toContain(t);
    await expect(corpo).toContainText(/Caratteri speciali|Special characters/);
  });
});
