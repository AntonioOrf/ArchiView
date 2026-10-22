import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Allegati' });

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'sample.pdf');

test.describe('Allegati', () => {
  test('F9 — salvataggio rifiutato dalla validazione: nessun file copiato nella cartella allegati', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Allegati');
    await page.locator('#btn-tab-add').click();
    await expect(page.locator('#manoscritto-form')).toBeVisible();
    const campo = await page.evaluate(() => {
      const w = window as any;
      const defs = w.campiDefinitiDelForm();
      const d = defs.find((x: any) => x.tipo === 'text' || !x.tipo);
      // @ts-ignore
      const tipo = appData.tipiDocumento.find((t: any) => t.id === (document.getElementById('form-tipo-documento') as HTMLSelectElement).value);
      tipo.campiDef = tipo.campiDef || {};
      tipo.campiDef[d.id] = { ...(tipo.campiDef[d.id] || { id: d.id, tipo: 'text' }), obbligatorio: true };
      return d.id;
    });
    expect(campo).toBeTruthy();
    await page.locator('#form-segnatura').fill('MS-F9');
    await page.locator('#form-allegato').setInputFiles(FIXTURE_PNG);
    const fs = require('fs');
    const dir = path.join(ws, 'allegati_manoscritti');
    const quanti = () => (fs.existsSync(dir) ? fs.readdirSync(dir).length : 0);
    for (let i = 0; i < 2; i++) {
      await page.locator('#btn-submit-form').click();
      await page.waitForTimeout(300);
    }
    expect(quanti(), 'ogni tentativo copiava di nuovo i file con un id nuovo').toBe(0);
  });

  test('allega un file locale a una scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Allegati');

    await page.locator('#btn-tab-add').click();
    await expect(page.locator('#manoscritto-form')).toBeVisible();
    await page.locator('#form-segnatura').fill('MS-ATT-001');

    await page.locator('#form-allegato').setInputFiles(FIXTURE_PNG);

    await expect(page.locator('#form-allegati-new-preview')).toContainText('sample.png');

    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-ATT-001', { timeout: 10_000 });

    const allegatiCount = await page.evaluate(() => {
      // @ts-ignore
      const rec = appData?.manoscritti?.find((m: any) => m.segnatura === 'MS-ATT-001');
      return rec?.allegati?.length ?? 0;
    });
    expect(allegatiCount).toBeGreaterThan(0);
  });

  test('due file con lo stesso nome sulla stessa scheda restano due carte distinte', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Allegati');
    const fs = await import('fs');
    const os = await import('os');
    const radice = fs.mkdtempSync(path.join(os.tmpdir(), 'av-omonimi-'));
    const [a, b] = ['a', 'b'].map((d) => path.join(radice, d, 'IMG_0001.png'));
    fs.mkdirSync(path.dirname(a)); fs.mkdirSync(path.dirname(b));
    fs.copyFileSync(FIXTURE_PNG, a);
    fs.writeFileSync(b, Buffer.concat([fs.readFileSync(FIXTURE_PNG), Buffer.from('diverso')]));

    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-OMONIMI');
    await page.locator('#form-allegato').setInputFiles(a);
    await page.locator('#form-allegato').setInputFiles(b);
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-OMONIMI', { timeout: 10_000 });

    const carte = await page.evaluate(() => {
      // @ts-ignore
      const rec = appData.manoscritti.find((m: any) => m.segnatura === 'MS-OMONIMI');
      return rec.allegati.map((x: any) => ({ nome: x.nome, hash: x.hash }));
    });
    expect(carte).toHaveLength(2);
    expect(new Set(carte.map((c) => c.nome)).size).toBe(2);
    expect(new Set(carte.map((c) => c.hash)).size).toBe(2);
  });

  test('allega un PDF a una scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Allegati');

    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-ATT-PDF');
    await page.locator('#form-allegato').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#form-allegati-new-preview')).toContainText('sample.pdf');

    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-ATT-PDF', { timeout: 10_000 });

    const appData = await getAppData(page);
    const rec = appData.manoscritti.find((m: any) => m.segnatura === 'MS-ATT-PDF');
    expect(rec.allegati[0].tipo).toBe('pdf');
  });

  test('rimuove un allegato dal form prima di salvare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Allegati');

    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-ATT-RIMOSSO');
    await page.locator('#form-allegato').setInputFiles(FIXTURE_PNG);
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-ATT-RIMOSSO', { timeout: 10_000 });

    await page.locator('main button', { hasText: /Modifica|Edit/i }).first().click();
    await expect(page.locator('.allegato-row')).toHaveCount(1);

    await page.locator('.allegato-row button[aria-label*="Rimuovi" i], .allegato-row button[aria-label*="Remove" i]').click();
    await expect(page.locator('.allegato-row')).toHaveCount(0);

    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-ATT-RIMOSSO', { timeout: 10_000 });

    const appData = await getAppData(page);
    const rec = appData.manoscritti.find((m: any) => m.segnatura === 'MS-ATT-RIMOSSO');
    expect(rec.allegati.length).toBe(0);
  });
});
