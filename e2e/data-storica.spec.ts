import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

/**
 * Fase 3.2 — data storica fuzzy.
 *
 * Il parser è coperto da `test/dataStorica.test.js`; qui si verifica che quella lettura
 * arrivi davvero dove serve: l'ordine della lista, il filtro per periodo e il riscontro
 * sotto il campo. Sono tre punti in cui una datazione può tornare a essere una stringa
 * senza che nulla lo segnali — la lista continuerebbe a mostrare le stesse schede, solo
 * nell'ordine sbagliato.
 */

async function seed(page, righe: any[]) {
  await page.evaluate(async (righe) => {
    // @ts-ignore -- `appData` è una `let` globale (script classico).
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

/** Le segnature nell'ordine in cui la griglia le sta mostrando. */
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
      { segnatura: 'E', dataCronica: 'pergamena' },   // non è una data
      { segnatura: 'F', dataCronica: '' }             // vuota
    ]);

    await page.evaluate(() => (window as any).impostaOrdinamento('dataCronica', 'asc'));
    // ⚠️ Il difetto che la fase esiste per risolvere: in ordine alfabetico "12 maggio 1340"
    // precede "3 aprile 1290", perché 1 viene prima di 3.
    expect(await segnature(page)).toEqual(['B', 'C', 'A', 'D', 'E', 'F']);

    // Invertendo, i valori senza data restano comunque in fondo: sono schede incomplete,
    // non le più antiche né le più recenti.
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
    // La scheda a cavallo dei due secoli va MOSTRATA: escluderla perché sborda nasconderebbe
    // proprio i documenti di passaggio, che sono quelli che si cercano.
    expect(dentro).toEqual(['CAVALLO', 'TRE-1', 'TRE-2']);
    // Una datazione che l'app non ha capito non appartiene a nessun periodo: mostrarla
    // direbbe che è del Trecento senza saperlo.
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

    // "sec. XIV" è il modo in cui la domanda viene posta davvero: comporre 1301/1400 a mano
    // ogni volta è l'attrito che fa smettere di usare un filtro.
    await expect(page.locator('#filtro-da-anno')).toHaveValue('1301');
    await expect(page.locator('#filtro-a-anno')).toHaveValue('1400');
    const f = await page.evaluate(() => (window as any).filtriAvanzati);
    expect(f.daAnno).toBe('1301');
    expect(f.aAnno).toBe('1400');
    // ⚠️ Il periodo storico NON deve toccare l'intervallo di ultima modifica: sono due date
    // diverse, e confonderle filtrerebbe per quando la scheda è stata scritta a computer.
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

    // Se non è stata capita bisogna saperlo PRIMA, non scoprirlo fra mille schede.
    await page.locator('#dyn-dataCronica').fill('pergamena');
    await expect(riscontro).toContainText('non interpretata');
    await expect(riscontro).toHaveClass(/non-letta/);

    // ⚠️ Il testo non viene mai riscritto: l'incertezza è essa stessa un dato.
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
    // ⚠️ Nessun intervallo salvato accanto al testo: sarebbe un dato derivato dentro un file
    // sincronizzato, resterebbe quello sbagliato di oggi dopo ogni correzione del parser, e
    // cambierebbe l'impronta del record facendolo apparire modificato a ogni collega.
    const derivate = Object.keys(m).filter(k => k !== 'dataCronica' && /datacronica/i.test(k));
    expect(derivate).toEqual([]);
    expect(JSON.stringify(m)).not.toContain('13010101');
  });
});
