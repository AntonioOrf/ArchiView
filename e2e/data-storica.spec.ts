import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Date' });

async function seed(page, righe: any[]) {
  await page.evaluate(async (righe) => {
    // @ts-ignore
    const data = appData;
    for (const r of righe) {
      data.manoscritti.push(Object.assign({
        id: crypto.randomUUID(),
        cartella: '',
        tipoDocumento: 'imbreviature',
        tags: '',
        allegati: [],
        trascrizione: '',
        lastModified: Date.UTC(2026, 0, 2),
        creatoDa: 'Anonimo',
        modificatoDa: 'Anonimo',
      }, r));
    }
    await (window as any).Store.commit();
  }, righe);
}

async function segnature(page): Promise<string[]> {
  return page.evaluate(() =>
    (window as any).getManoscrittiFiltrati().map((m: any) => m.segnatura));
}

test.describe('Data storica fuzzy', () => {

  test('3.2.1 — l\'ordinamento per data cronica è cronologico, non alfabetico', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Date');
    await seed(page, [
      { segnatura: 'A', dataCronica: '12 maggio 1340' },
      { segnatura: 'B', dataCronica: '3 aprile 1290' },
      { segnatura: 'C', dataCronica: 'sec. XIV' },
      { segnatura: 'D', dataCronica: 'c. 1400' },
      { segnatura: 'E', dataCronica: 'pergamena' },
      { segnatura: 'F', dataCronica: '' }
    ]);

    await page.evaluate(() => (window as any).impostaOrdinamento('dataCronica', 'asc'));
    expect(await segnature(page)).toEqual(['B', 'C', 'A', 'D', 'E', 'F']);

    await page.evaluate(() => (window as any).impostaOrdinamento('dataCronica', 'desc'));
    const desc = await segnature(page);
    expect(desc.slice(0, 4)).toEqual(['D', 'A', 'C', 'B']);
    expect(desc.slice(4).sort()).toEqual(['E', 'F']);
  });

  test('3.2.2 — il filtro per periodo seleziona per secolo, sovrapposizioni comprese', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Date');
    await seed(page, [
      { segnatura: 'TRE-1', dataCronica: '12 maggio 1340' },
      { segnatura: 'TRE-2', dataCronica: 'sec. XIV ex.' },
      { segnatura: 'CAVALLO', dataCronica: '1290-1310' },
      { segnatura: 'DUE-1', dataCronica: '1250' },
      { segnatura: 'QUATTRO-1', dataCronica: 'c. 1450' },
      { segnatura: 'IGNOTA', dataCronica: 'pergamena' }
    ]);

    await page.evaluate(() => (window as any).applicaFiltriAvanzati({ daAnno: '1301', aAnno: '1400' }));
    const dentro = (await segnature(page)).sort();
    expect(dentro).toEqual(['CAVALLO', 'TRE-1', 'TRE-2']);
    expect(dentro).not.toContain('IGNOTA');

    await page.evaluate(() => (window as any).applicaFiltriAvanzati({ daAnno: '', aAnno: '' }));
    expect((await segnature(page)).length).toBe(6);
  });

  test('3.2.3 — la scorciatoia per secolo compila gli anni e i chip lo dicono', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Date');
    await seed(page, [{ segnatura: 'X-1', dataCronica: '1340' }]);

    await page.evaluate(() => (window as any).apriPannelloFiltri());
    await expect(page.locator('#filtro-secolo')).toBeVisible();
    await page.locator('#filtro-secolo').selectOption('14');

    await expect(page.locator('#filtro-da-anno')).toHaveValue('1301');
    await expect(page.locator('#filtro-a-anno')).toHaveValue('1400');
    const f = await page.evaluate(() => (window as any).filtriAvanzati);
    expect(f.daAnno).toBe('1301');
    expect(f.aAnno).toBe('1400');
    expect(f.daData).toBe('');
    expect(f.aData).toBe('');
  });

  test('3.2.4 — il campo dice come ha letto la datazione, e quando non l\'ha letta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Date');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-tipo-documento').selectOption('imbreviature');
    await page.evaluate(() => (window as any).renderDynamicFields());

    const riscontro = page.locator('#dyn-dataCronica-riscontro');
    await page.locator('#dyn-dataCronica').fill('c. 1340');
    await expect(riscontro).toContainText('1340');
    await expect(riscontro).toContainText('circa');

    await page.locator('#dyn-dataCronica').fill('sec. XIV in.');
    await expect(riscontro).toContainText('1301');
    await expect(riscontro).toContainText('1325');

    await page.locator('#dyn-dataCronica').fill('pergamena');
    await expect(riscontro).toContainText('non interpretata');
    await expect(riscontro).toHaveClass(/non-letta/);

    await page.locator('#dyn-dataCronica').fill('c. 1340');
    await expect(page.locator('#dyn-dataCronica')).toHaveValue('c. 1340');
  });

  test('3.2.5 — la datazione resta una stringa: nel record non entra nulla di derivato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Date');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-tipo-documento').selectOption('imbreviature');
    await page.evaluate(() => (window as any).renderDynamicFields());
    await page.locator('#form-segnatura').fill('RAW-1');
    await page.locator('#dyn-dataCronica').fill('sec. XIV in.');
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const m = (await getAppData(page)).manoscritti[0];
    expect(m.dataCronica).toBe('sec. XIV in.');
    const derivate = Object.keys(m).filter(k => k !== 'dataCronica' && /datacronica/i.test(k));
    expect(derivate).toEqual([]);
    expect(JSON.stringify(m)).not.toContain('13010101');
  });
});
