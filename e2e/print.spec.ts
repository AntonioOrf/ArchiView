import { test, expect } from './fixtures';
import { stubDialog } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

test.use({ seedWorkspace: 'Stampa' });

type Riga = { segnatura: string; cartella?: string; [k: string]: any };

async function seed(page, righe: Riga[]) {
  await page.evaluate(async (righe) => {
    // @ts-ignore
    const data = appData;
    for (const r of righe) {
      data.manoscritti.push(Object.assign({
        id: crypto.randomUUID(),
        cartella: '',
        tipoDocumento: 'manoscritto',
        tags: '',
        allegati: [],
        trascrizione: '',
        lastModified: Date.UTC(2026, 0, 2),
        creatoDa: 'Anonimo',
        modificatoDa: 'Anonimo',
      }, r));
      if (r.cartella && !data.cartelle.includes(r.cartella)) data.cartelle.push(r.cartella);
    }
    await (window as any).Store.commit();
  }, righe);
}

async function leggiPdf(percorso: string): Promise<Buffer> {
  await expect.poll(() => fs.existsSync(percorso), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => (fs.existsSync(percorso) ? fs.statSync(percorso).size : 0), { timeout: 20_000 })
    .toBeGreaterThan(500);
  return fs.readFileSync(percorso);
}

async function stampaPdf(page, ids: string[], opzioni: any = {}) {
  return page.evaluate(async ({ ids, opzioni }) => {
    const w = window as any;
    if (opzioni.layout) w.impostazioniStampa.layout = opzioni.layout;
    Object.assign(w.impostazioniStampa, opzioni.impostazioni || {});
    await w.flushSalvataggio?.();
    w.selectedRecords = ids;
    w.apriStampa('selezione');
    return await w.salvaStampaPdf();
  }, { ids, opzioni });
}

test.describe('Stampa e PDF', () => {

  test('2.2.1 — Salva PDF scrive un vero PDF e stampa solo le schede in ambito', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Stampa');
    await seed(page, [
      { segnatura: 'ST-1', autore: 'Anonimo', titolo: 'Vendita' },
      { segnatura: 'ST-2', autore: 'Bartolo' },
      { segnatura: 'ESCA', autore: 'Nessuno' },
    ]);

    const dati = await getAppData(page);
    const ids = dati.manoscritti.filter((m: any) => m.segnatura.startsWith('ST-')).map((m: any) => m.id);

    const out = path.join(userDataDir, 'schede.pdf');
    await stubDialog(electronApp, { canceled: false, filePath: out });

    const esito = await stampaPdf(page, ids, { layout: 'scheda' });
    expect(esito.success).toBe(true);
    expect(esito.count).toBe(2);

    const pdf = await leggiPdf(out);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('2.2.2 — i tre layout producono tre documenti', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Stampa');
    await seed(page, Array.from({ length: 20 }, (_, i) => ({
      segnatura: `L-${i + 1}`, autore: 'Anonimo', titolo: 'Atto di vendita numero ' + (i + 1), note: 'Nota lunga. '.repeat(20)
    })));
    const dati = await getAppData(page);
    const ids = dati.manoscritti.map((m: any) => m.id);

    const dimensioni: { [k: string]: number } = {};
    for (const layout of ['scheda', 'regesto', 'tabella']) {
      const out = path.join(userDataDir, `${layout}.pdf`);
      await stubDialog(electronApp, { canceled: false, filePath: out });
      const esito = await stampaPdf(page, ids, { layout });
      expect(esito.success, `layout ${layout}`).toBe(true);
      const pdf = await leggiPdf(out);
      expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      dimensioni[layout] = pdf.length;
    }
    expect(dimensioni.scheda).toBeGreaterThan(dimensioni.regesto);
    expect(dimensioni.scheda).toBeGreaterThan(dimensioni.tabella);
  });

  test('2.2.3 — l\'annullamento del dialogo non scrive nulla e non è un errore', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Stampa');
    await seed(page, [{ segnatura: 'ANN-1' }]);
    const dati = await getAppData(page);

    const out = path.join(userDataDir, 'mai-scritto.pdf');
    await stubDialog(electronApp, { canceled: true });
    await stampaPdf(page, [dati.manoscritti[0].id]);

    expect(fs.existsSync(out)).toBe(false);
    await expect(page.locator('#toast-container')).not.toContainText('Stampa non riuscita');
  });

  test('2.2.4 — Ctrl+P apre il modale e il conteggio segue l\'ambito', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Stampa');
    await seed(page, [
      { segnatura: 'A-1', cartella: 'Fondo' },
      { segnatura: 'A-2', cartella: 'Fondo' },
      { segnatura: 'A-3', cartella: 'Fondo' },
    ]);
    const dati = await getAppData(page);
    const uno = dati.manoscritti.filter((m: any) => m.segnatura === 'A-1').map((m: any) => m.id);
    await page.evaluate((ids) => {
      (window as any).selectedRecords = ids;
      (window as any).aggiornaStatoSelezione();
    }, uno);

    await page.keyboard.press('Control+P');
    const modal = page.locator('#print-modal');
    await expect(modal).toBeVisible();

    await expect(page.locator('#print-count')).toContainText('1');
    await page.locator('#print-scope').selectOption('cartella');
    await expect(page.locator('#print-count')).toContainText('3');

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('2.2.5 — fondo, autore e layout sopravvivono al riavvio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Stampa');
    await seed(page, [{ segnatura: 'P-1' }]);

    await page.keyboard.press('Control+P');
    await page.locator('#print-fondo').fill('ASP, Notarile');
    await page.locator('#print-autore').fill('M. Rossi');
    await page.locator('#print-layout-regesto').check();
    await page.evaluate(() => (window as any).chiudiStampa());

    const stato = await page.evaluate(async () => {
      const s = await (window as any).apiSettings.get();
      const d = (window as any).appData || {};
      return { stampa: s.appState && s.appState.stampa, nelDb: JSON.stringify(d).includes('M. Rossi') };
    });
    expect(stato.stampa.fondo).toBe('ASP, Notarile');
    expect(stato.stampa.autore).toBe('M. Rossi');
    expect(stato.stampa.layout).toBe('regesto');
    expect(stato.nelDb).toBe(false);
  });

  test('2.2.6 — le voci di stampa sono raggiungibili da menu e palette', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Stampa');
    await seed(page, [{ segnatura: 'MENU-P' }]);

    await page.locator('#context-overflow-slot button').click();
    await page.locator('#custom-context-menu button', { hasText: /^Esporta$/ }).click();
    const sub = page.locator('#custom-context-menu-1');
    await expect(sub).toContainText('Stampa');
    await expect(sub.locator('button[title="Stampa e PDF"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+K');
    await page.locator('#cp-input').fill('stampa');
    await expect(page.locator('#cp-lista')).toContainText('Stampa');
    await page.keyboard.press('Escape');
  });
});
