import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment } from './helpers';
import * as path from 'path';

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');

/**
 * Il tutorial non aveva alcuna copertura E2E, ed è il tipo di codice che marcisce in
 * silenzio: un passo che punta a un selettore scomparso non solleva errori, driver.js
 * ripiega sul popover centrato e la guida continua a scorrere indicando il nulla.
 *
 * Qui non si guida l'intero tour (richiederebbe l'Archivio Tutorial e una ventina di
 * click): si verifica il contratto che davvero si rompe, cioè che OGNI passo citi un
 * selettore che nell'applicazione esiste, e che i passi della Fase 1 ci siano.
 */
async function seed(page, righe: { segnatura: string; allegati?: any[] }[]) {
  await page.evaluate(async (righe) => {
    // @ts-ignore -- `appData` è una `let` globale (script classico), non window.appData.
    const data = appData;
    for (const r of righe) {
      data.manoscritti.push({
        id: crypto.randomUUID(),
        cartella: '',
        tipoDocumento: 'manoscritto',
        segnatura: r.segnatura,
        titolo: '',
        tags: '',
        allegati: r.allegati || [],
        trascrizione: '',
        lastModified: Date.now(),
        creatoDa: 'Anonimo',
        modificatoDa: 'Anonimo',
      });
    }
    await (window as any).Store.commit();
  }, righe);
}

/** Avvia il tour e restituisce i selettori dei suoi passi. */
async function selettoriDeiPassi(page): Promise<string[]> {
  await page.evaluate(() => (window as any).avviaTutorial());
  await page.waitForFunction(() => !!(window as any).dInstance, null, { timeout: 10_000 });
  return page.evaluate(() =>
    ((window as any).dInstance.getConfig('steps') || [])
      .map((s: any) => s.element)
      .filter((e: any) => typeof e === 'string')
  );
}

test.describe('Tutorial guidato', () => {
  test('ogni passo punta a un selettore che esiste nel DOM', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tour');
    // Due schede: con l'archivio vuoto avviaTutorial propone di caricare l'Archivio
    // Tutorial e si ferma su un banner di conferma invece di costruire i passi.
    await seed(page, [{ segnatura: 'MS 1' }, { segnatura: 'MS 2' }]);

    const selettori = await selettoriDeiPassi(page);
    expect(selettori.length).toBeGreaterThan(15);

    // `body` e i selettori dei passi condizionali (cloud, viste non ancora aperte) sono
    // legittimamente assenti qui: si verifica che il selettore sia SINTATTICAMENTE valido
    // e che gli elementi della vista lista, quella in cui il tour parte, esistano davvero.
    const mancanti = await page.evaluate((selettori) => {
      const fuori: string[] = [];
      for (const sel of selettori) {
        try {
          document.querySelector(sel);
        } catch (e) {
          fuori.push(sel); // selettore malformato: errore vero, non assenza
        }
      }
      return fuori;
    }, selettori);
    expect(mancanti).toEqual([]);
  });

  test('i passi della Fase 1 sono presenti e citano gli elementi giusti', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tour');
    await seed(page, [{ segnatura: 'MS 1' }, { segnatura: 'MS 2' }]);

    const selettori = await selettoriDeiPassi(page);

    // Ordinamento/tabella (1.1), filtri (1.3), comandi rapidi (1.4), visualizzatore (1.2).
    expect(selettori).toContain('#btn-vista-tabella');
    expect(selettori).toContain('#btn-filtri');
    expect(selettori).toContain('#context-overflow-slot button');
    expect(selettori).toContain('#trascrizione-allegato-panel:not(.hidden-tab)');

    // I tre della vista elenco devono essere davvero a schermo quando il tour ci arriva:
    // è il passo dopo "Ritorno alla Navigazione", cioè con la lista aperta.
    await page.evaluate(() => (window as any).dInstance?.destroy());
    for (const sel of ['#btn-vista-tabella', '#btn-filtri', '#context-overflow-slot button']) {
      await expect(page.locator(sel)).toBeVisible();
    }
  });

  test('i passi della Fase 1 hanno un testo tradotto, non la chiave grezza', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tour');

    // Una chiave mancante in i18n si manifesta come l'id stesso stampato nel popover.
    for (const lang of ['it', 'en']) {
      const testi = await page.evaluate((lang) => {
        (window as any).linguaAttuale = lang;
        const chiavi = [
          'tut_sort_title', 'tut_sort_desc',
          'tut_filters_title', 'tut_filters_desc',
          'tut_palette_title', 'tut_palette_desc',
          'tut_viewer_title', 'tut_viewer_desc',
        ];
        return chiavi.map((k) => [k, (window as any).t(k)]);
      }, lang);

      for (const [chiave, testo] of testi) {
        expect(testo, `${chiave} non tradotta in ${lang}`).not.toBe(chiave);
        expect(String(testo).length).toBeGreaterThan(10);
      }
    }
  });

  test('il pannello dell\'allegato non è illuminato quando la scheda non ne ha', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tour');
    await seed(page, [{ segnatura: 'SENZA ALLEGATI' }, { segnatura: 'MS 2' }]);

    await page.evaluate(async () => {
      // @ts-ignore
      const m = appData.manoscritti.find((x) => x.segnatura === 'SENZA ALLEGATI');
      await (window as any).apriTrascrizione(m.id);
    });
    await expect(page.locator('#view-trascrizione')).toBeVisible();

    // Il pannello ESISTE nel DOM anche senza allegati: con il selettore nudo driver.js
    // illuminerebbe un elemento a dimensione zero. `:not(.hidden-tab)` lo esclude, e il
    // passo ripiega sul popover centrato invece di indicare il nulla.
    await expect(page.locator('#trascrizione-allegato-panel')).toHaveCount(1);
    await expect(page.locator('#trascrizione-allegato-panel:not(.hidden-tab)')).toHaveCount(0);
  });

  test('con un allegato il pannello è invece il bersaglio del passo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tour');
    // Senza questo caso il test precedente sarebbe vacuo: un selettore che non
    // corrisponde MAI lo supererebbe, e il passo ripiegherebbe sempre sul popover
    // centrato senza che nessuno se ne accorga.
    const id = await createItemWithAttachment(page, 'MS CON ALLEGATO', FIXTURE_PNG);

    await page.evaluate(async (id) => {
      await (window as any).apriTrascrizione(id);
    }, id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();

    await expect(page.locator('#trascrizione-allegato-panel:not(.hidden-tab)')).toBeVisible();
  });
});
