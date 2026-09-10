import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';

/**
 * Fase 3.7 — campi propri della scheda.
 *
 * Il modello puro è coperto da `test/campiPropri.test.js`; qui si verifica il giro che quel
 * test non può vedere: il campo dichiarato dal modale → il controllo nel form → il valore
 * nel record insieme alla sua definizione → e di nuovo nel form riaprendo la scheda. È il
 * percorso in cui una definizione può restare nel form senza arrivare al record (o
 * viceversa), e nessun errore lo direbbe.
 */

/** Dichiara un campo proprio passando dal modale vero. */
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

    // Il campo è nel form, marcato: senza il segno non si distingue da uno del modello.
    await expect(page.locator('#dyn-Filigrana')).toBeVisible();
    await expect(page.locator('.form-group.campo-proprio')).toHaveCount(1);
    await page.locator('#dyn-Filigrana').fill('unicorno');
    await salvaScheda(page);

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const m = (await getAppData(page)).manoscritti[0];
    expect(m.Filigrana).toBe('unicorno');
    expect(m.campiPropri.map((d: any) => d.id)).toEqual(['Filigrana']);
    // Il MODELLO non cambia: è tutto il punto della fase.
    const tipo = (await getAppData(page)).tipiDocumento.find((t: any) => t.id === m.tipoDocumento);
    expect(tipo.campi).not.toContain('Filigrana');

    // Riaprendo la scheda il campo torna, con il suo valore.
    await page.evaluate((id) => (window as any).editItem(id), m.id);
    await expect(page.locator('#dyn-Filigrana')).toHaveValue('unicorno');
  });

  test('3.7.2 — aggiungere un campo NON cancella ciò che si sta già scrivendo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Propri');

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('PRO-2');
    // Un campo del modello compilato PRIMA di aggiungerne uno proprio: il ridisegno azzera
    // il contenitore, e senza rileggere/rimettere i valori la scheda si svuoterebbe a metà.
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

    // Il campo appartiene alla SCHEDA: restare nel form vorrebbe dire ritrovarselo addosso
    // su ogni scheda creata dopo.
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
    // La conferma passa dal banner in basso; qui si accetta.
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

    // Il campo resta nel form — ora come campo del modello — e il valore non si perde.
    await expect(page.locator('#dyn-Filigrana')).toHaveValue('unicorno');
    await expect(page.locator('.form-group.campo-proprio')).toHaveCount(0);
    await salvaScheda(page);

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const d = await getAppData(page);
    const m = d.manoscritti[0];
    const tipo = d.tipiDocumento.find((t: any) => t.id === m.tipoDocumento);
    expect(tipo.campi).toContain('Filigrana');
    expect(m.Filigrana).toBe('unicorno');
    // Niente doppione: la definizione propria sparisce alla prima riscrittura della scheda.
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

    // Il campo entra fra i criteri di ordinamento offerti dall'elenco, che è il segno che
    // le colonne si costruiscono dai RECORD e non dai soli modelli.
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
    // I campi restano nel DOM, solo nascosti: un salvataggio a elenco aperto scrive comunque.
    await expect(page.locator('#dyn-Notaio')).toHaveValue('Pietro');

    // Il secondo campo sale in testa, dalla tastiera (l'alternativa accessibile al trascinamento).
    await page.locator('#form-riordino-lista .riordino-riga').nth(1).locator('button').first().click();
    await page.evaluate(() => (window as any).chiudiRiordinoCampi());
    await expect(page.locator('#form-riordino')).toBeHidden();

    const dopo = await ordineForm();
    expect(dopo[0]).toBe(prima[1]);
    // Il valore già scritto non si perde nel ridisegno.
    await expect(page.locator('#dyn-Notaio')).toHaveValue('Pietro');

    await salvaScheda(page);
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const d = await getAppData(page);
    const m = d.manoscritti[0];
    expect(m.ordineCampi[0]).toBeTruthy();
    // Il modello resta com'era: l'ordine è una scelta di questa scheda sola.
    const tipo = d.tipiDocumento.find((t: any) => t.id === m.tipoDocumento);
    expect(tipo.campi[0]).toBe('Marginalia');

    // Riaprendo la scheda l'ordine torna quello scelto.
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
    // Un elenco che ripete l'ordine già noto sarebbe una chiave in più nell'impronta del
    // record: mezzo archivio "modificato" al prossimo sync di ogni collega.
    expect((await getAppData(page)).manoscritti[0].ordineCampi).toBeUndefined();
  });
});
