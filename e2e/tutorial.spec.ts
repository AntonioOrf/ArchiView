import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Tour' });

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');

async function seed(page, righe: { segnatura: string; allegati?: any[] }[]) {
  await page.evaluate(async (righe) => {
    // @ts-ignore
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
    await seed(page, [{ segnatura: 'MS 1' }, { segnatura: 'MS 2' }]);

    const selettori = await selettoriDeiPassi(page);
    expect(selettori.length).toBeGreaterThan(15);

    const mancanti = await page.evaluate((selettori) => {
      const fuori: string[] = [];
      for (const sel of selettori) {
        try {
          document.querySelector(sel);
        } catch (e) {
          fuori.push(sel);
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

    expect(selettori).toContain('#btn-vista-tabella');
    expect(selettori).toContain('#btn-filtri');
    expect(selettori).toContain('#context-overflow-slot button');
    expect(selettori).toContain('#trascrizione-allegato-panel:not(.hidden-tab)');
    expect(selettori).toContain('.card-scheda');

    await page.evaluate(() => (window as any).dInstance?.destroy());
    for (const sel of ['#btn-vista-tabella', '#btn-filtri', '#context-overflow-slot button']) {
      await expect(page.locator(sel)).toBeVisible();
    }
  });

  test('i passi della Fase 1 hanno un testo tradotto, non la chiave grezza', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tour');

    for (const lang of ['it', 'en']) {
      const testi = await page.evaluate((lang) => {
        (window as any).linguaAttuale = lang;
        const chiavi = [
          'tut_sort_title', 'tut_sort_desc',
          'tut_filters_title', 'tut_filters_desc',
          'tut_palette_title', 'tut_palette_desc',
          'tut_viewer_title', 'tut_viewer_desc',
          'tut_bulk_title', 'tut_bulk_desc',
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

    await expect(page.locator('#trascrizione-allegato-panel')).toHaveCount(1);
    await expect(page.locator('#trascrizione-allegato-panel:not(.hidden-tab)')).toHaveCount(0);
  });

  test('con un allegato il pannello è invece il bersaglio del passo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tour');
    const id = await createItemWithAttachment(page, 'MS CON ALLEGATO', FIXTURE_PNG);

    await page.evaluate(async (id) => {
      await (window as any).apriTrascrizione(id);
    }, id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();

    await expect(page.locator('#trascrizione-allegato-panel:not(.hidden-tab)')).toBeVisible();
  });
test('in un archivio locale il clic su Condivisione porta il tour sulla finestra Condivisione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tour');
    await seed(page, [{ segnatura: 'MS 1' }]);
    const selettori = await selettoriDeiPassi(page);
    const indice = selettori.indexOf('#sidebar-cloud-btn');
    expect(indice).toBeGreaterThan(-1);
    await page.evaluate((i) => (window as any).dInstance.moveTo(i), indice);
    await expect(page.locator('.driver-popover')).toBeVisible();
    await page.waitForTimeout(500);

    await page.locator('#sidebar-cloud-btn').click();
    await expect(page.locator('#share-modal')).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const el = (window as any).dInstance?.getActiveElement?.();
      return !!(el && el.closest && el.closest('#share-modal'));
    })).toBe(true);
    await page.waitForTimeout(600);

    await page.locator('#share-modal [data-on-click="chiudiShareModal"]').first().click();
    await expect(page.locator('#share-modal')).toBeHidden();
    await expect.poll(() => page.evaluate(() => {
      const el = (window as any).dInstance?.getActiveElement?.();
      return el ? el.getAttribute('data-on-click') : null;
    })).toBe('toggleVaultSwitcher');
  });
});
