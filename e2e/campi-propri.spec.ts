import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Propri' });

async function aggiungiCampoProprio(page, nome: string, tipo = 'text') {
  await page.evaluate(() => (window as any).apriCampoProprioModal());
  await expect(page.locator('#campo-proprio-modal')).toBeVisible();
  await page.locator('#campo-proprio-nome').fill(nome);
  await page.locator('#campo-proprio-tipo').selectOption(tipo);
  await page.evaluate(() => (window as any).confermaCampoProprio());
  await expect(page.locator('#campo-proprio-modal')).toBeHidden();
}

async function salvaScheda(page) {
  await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
    .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
}

test.describe('Campi propri della scheda', () => {

  test('3.7.1 — il campo si aggiunge, si compila e finisce nel record con la sua definizione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('PRO-1');
    await aggiungiCampoProprio(page, 'Filigrana');

    await expect(page.locator('#dyn-Filigrana')).toBeVisible();
    await expect(page.locator('.form-group.campo-proprio')).toHaveCount(1);
    await page.locator('#dyn-Filigrana').fill('unicorno');
    await salvaScheda(page);

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const m = (await getAppData(page)).manoscritti[0];
    expect(m.Filigrana).toBe('unicorno');
    expect(m.campiPropri.map((d: any) => d.id)).toEqual(['Filigrana']);
    const tipo = (await getAppData(page)).tipiDocumento.find((t: any) => t.id === m.tipoDocumento);
    expect(tipo.campi).not.toContain('Filigrana');

    await page.evaluate((id) => (window as any).editItem(id), m.id);
    await expect(page.locator('#dyn-Filigrana')).toHaveValue('unicorno');
  });

  test('F1 — una lista chiave-valore con spazi e parentesi nel nome conserva le righe', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('PRO-F1');
    await aggiungiCampoProprio(page, 'Beni mobili (stimati)', 'dynamic_list');
    const gruppo = page.locator('.form-group.campo-proprio');
    for (const [k, v] of [['letto', '3 lire'], ['cassa', '1 lira']]) {
      await gruppo.locator('button.btn-secondary').click();
      const riga = gruppo.locator('.dynamic-list-row').last();
      await riga.locator('.list-key').fill(k);
      await riga.locator('.list-val').fill(v);
    }
    await salvaScheda(page);

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const m = (await getAppData(page)).manoscritti[0];
    const id = m.campiPropri[0].id;
    expect(m[id]).toEqual([{ k: 'letto', v: '3 lire' }, { k: 'cassa', v: '1 lira' }]);

    await page.evaluate((x) => (window as any).editItem(x), m.id);
    await expect(page.locator('.form-group.campo-proprio .dynamic-list-row')).toHaveCount(2);
  });

  test('3.7.2 — aggiungere un campo NON cancella ciò che si sta già scrivendo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('PRO-2');
    await page.locator('#dyn-Notaio').fill('Pietro di Bencivenne');
    await aggiungiCampoProprio(page, 'Filigrana');
    await expect(page.locator('#dyn-Notaio')).toHaveValue('Pietro di Bencivenne');
  });

  test('3.7.3 — la scheda successiva non eredita i campi della precedente', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('PRO-3');
    await aggiungiCampoProprio(page, 'Filigrana');
    await page.locator('#dyn-Filigrana').fill('unicorno');
    await salvaScheda(page);
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);

    await page.evaluate(() => (window as any).switchTab('add'));
    await expect(page.locator('#dyn-Filigrana')).toHaveCount(0);
    await page.locator('#form-segnatura').fill('PRO-4');
    await salvaScheda(page);
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(2);
    const seconda = (await getAppData(page)).manoscritti.find((m: any) => m.segnatura === 'PRO-4');
    expect(seconda.campiPropri).toBeUndefined();
  });

  test('3.7.4 — togliere il campo cancella anche il suo valore dal record', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('PRO-5');
    await aggiungiCampoProprio(page, 'Filigrana');
    await page.locator('#dyn-Filigrana').fill('unicorno');
    await salvaScheda(page);
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const id = (await getAppData(page)).manoscritti[0].id;

    await page.evaluate((x) => (window as any).editItem(x), id);
    await page.evaluate(() => (window as any).rimuoviCampoProprio('Filigrana'));
    await page.locator('#btn-bottom-confirm-yes').click();
    await expect(page.locator('#dyn-Filigrana')).toHaveCount(0);
    await salvaScheda(page);

    await expect.poll(async () => {
      const m = (await getAppData(page)).manoscritti[0];
      return m.campiPropri === undefined && m.Filigrana === undefined;
    }, { timeout: 10_000 }).toBe(true);
  });

  test('3.7.5 — promuovere il campo lo sposta nel modello e lo toglie dalla scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('PRO-6');
    await aggiungiCampoProprio(page, 'Filigrana');
    await page.locator('#dyn-Filigrana').fill('unicorno');
    await page.evaluate(() => (window as any).promuoviCampoProprio('Filigrana'));

    await expect(page.locator('#dyn-Filigrana')).toHaveValue('unicorno');
    await expect(page.locator('.form-group.campo-proprio')).toHaveCount(0);
    await salvaScheda(page);

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const d = await getAppData(page);
    const m = d.manoscritti[0];
    const tipo = d.tipiDocumento.find((t: any) => t.id === m.tipoDocumento);
    expect(tipo.campi).toContain('Filigrana');
    expect(m.Filigrana).toBe('unicorno');
    expect(m.campiPropri).toBeUndefined();
  });

  test('3.7.6 — il campo proprio è cercabile e diventa una colonna della tabella', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('PRO-7');
    await aggiungiCampoProprio(page, 'Filigrana');
    await page.locator('#dyn-Filigrana').fill('unicorno');
    await salvaScheda(page);
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);

    await page.evaluate(() => (window as any).switchTab('list'));
    await expect.poll(async () => page.locator('#select-ordinamento option[value="Filigrana"]').count(),
      { timeout: 10_000 }).toBe(1);

    const trovate = await page.evaluate(() => {
      const q = (window as any).analizzaQuery('Filigrana:unicorno');
      return (appData as any).manoscritti.filter((m: any) => (window as any).recordPassaCampi(m, q.campi)).length;
    });
    expect(trovate).toBe(1);
  });

  test('3.8.1 — il riordino vale su questa scheda, sopravvive al salvataggio e non tocca il modello', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('ORD-1');
    await page.locator('#dyn-Notaio').fill('Pietro');

    const ordineForm = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('#form-dynamic-fields .form-group label.form-label'))
        .map((l) => (l.textContent || '').trim()));

    const prima = await ordineForm();
    await page.evaluate(() => (window as any).apriRiordinoCampi());
    await expect(page.locator('#form-riordino')).toBeVisible();
    await expect(page.locator('#dyn-Notaio')).toHaveValue('Pietro');

    await page.locator('#form-riordino-lista .riordino-riga').nth(1).locator('button').first().click();
    await page.evaluate(() => (window as any).chiudiRiordinoCampi());
    await expect(page.locator('#form-riordino')).toBeHidden();

    const dopo = await ordineForm();
    expect(dopo[0]).toBe(prima[1]);
    await expect(page.locator('#dyn-Notaio')).toHaveValue('Pietro');

    await salvaScheda(page);
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const d = await getAppData(page);
    const m = d.manoscritti[0];
    expect(m.ordineCampi[0]).toBeTruthy();
    const tipo = d.tipiDocumento.find((t: any) => t.id === m.tipoDocumento);
    expect(tipo.campi[0]).toBe('Marginalia');

    await page.evaluate((id) => (window as any).editItem(id), m.id);
    expect((await ordineForm())[0]).toBe(dopo[0]);
  });

  test('3.8.2 — "Ordine del modello" toglie la chiave invece di salvare l ordine naturale', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('ORD-2');
    await page.evaluate(() => (window as any).apriRiordinoCampi());
    await page.locator('#form-riordino-lista .riordino-riga').nth(1).locator('button').first().click();
    await page.locator('#form-riordino button', { hasText: /Ordine del modello|Model order/ }).click();
    await page.evaluate(() => (window as any).chiudiRiordinoCampi());
    await salvaScheda(page);

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    expect((await getAppData(page)).manoscritti[0].ordineCampi).toBeUndefined();
  });
});
