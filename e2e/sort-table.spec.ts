import { test, expect } from './fixtures';
import { createLocalWorkspace, dismissOverlays } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Sort' });

async function seedSegnature(page, righe: Array<{ segnatura: string; lastModified?: number; titolo?: string }>) {
  await page.evaluate(async (righe) => {
    // @ts-ignore
    const data = appData;
    for (const r of righe) {
      data.manoscritti.push({
        id: crypto.randomUUID(),
        cartella: '',
        tipoDocumento: 'manoscritto',
        segnatura: r.segnatura,
        titolo: r.titolo || '',
        tags: '',
        allegati: [],
        lastModified: r.lastModified ?? Date.now(),
        creatoDa: 'Anonimo',
        modificatoDa: 'Anonimo',
      });
    }
    await (window as any).Store.commit();
  }, righe);
}

async function segnatureRenderizzate(page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.card-scheda')).map((el) => {
      const cella = el.querySelector('.cella-segnatura, .card-title');
      return (cella ? cella.textContent : '').replace(/^[●○]\s*/, '').trim();
    })
  );
}

test.describe('Ordinamento e vista tabella', () => {
  test('la griglia ordina le segnature in modo naturale (MS 2 prima di MS 10)', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [
      { segnatura: 'MS 10' },
      { segnatura: 'MS 2' },
      { segnatura: 'MS 1' },
      { segnatura: 'MS 100' },
    ]);

    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['MS 1', 'MS 2', 'MS 10', 'MS 100']);
  });

  test('invertire la direzione capovolge l ordine', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [{ segnatura: 'MS 1' }, { segnatura: 'MS 2' }, { segnatura: 'MS 10' }]);

    await page.locator('#btn-ordinamento-dir').click();
    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['MS 10', 'MS 2', 'MS 1']);
  });

  test('ordinamento per data di modifica, con le schede senza valore in coda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [
      { segnatura: 'Vecchia', lastModified: 1_000_000_000_000 },
      { segnatura: 'Recente', lastModified: 2_000_000_000_000 },
      { segnatura: 'Media', lastModified: 1_500_000_000_000 },
    ]);

    await page.evaluate(() => (window as any).impostaOrdinamento('lastModified', 'desc'));
    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['Recente', 'Media', 'Vecchia']);

    await page.evaluate(() => (window as any).impostaOrdinamento('lastModified', 'asc'));
    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['Vecchia', 'Media', 'Recente']);
  });

  test('le segnature vuote restano in coda in entrambe le direzioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [{ segnatura: 'MS 1' }, { segnatura: '' }, { segnatura: 'MS 2' }]);

    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['MS 1', 'MS 2', '']);
    await page.locator('#btn-ordinamento-dir').click();
    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['MS 2', 'MS 1', '']);
  });

  test('il toggle mostra la tabella al posto della griglia, con le stesse schede', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [{ segnatura: 'MS 2' }, { segnatura: 'MS 10' }, { segnatura: 'MS 1' }]);

    await expect(page.locator('#manoscritti-grid')).toBeVisible();
    await expect(page.locator('#manoscritti-table-wrap')).toBeHidden();

    await page.locator('#btn-vista-tabella').click();

    await expect(page.locator('#manoscritti-table-wrap')).toBeVisible();
    await expect(page.locator('#manoscritti-grid')).toBeHidden();
    await expect(page.locator('#manoscritti-table tbody tr')).toHaveCount(3);
    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['MS 1', 'MS 2', 'MS 10']);
  });

  test('cliccando l header della tabella si ordina per quella colonna', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [
      { segnatura: 'MS 1', lastModified: 2_000_000_000_000 },
      { segnatura: 'MS 2', lastModified: 1_000_000_000_000 },
    ]);
    await page.locator('#btn-vista-tabella').click();

    await page.locator('#manoscritti-table thead th', { hasText: /Modificato|Modified/ }).click();
    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['MS 2', 'MS 1']);

    await page.locator('#manoscritti-table thead th', { hasText: /Modificato|Modified/ }).click();
    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['MS 1', 'MS 2']);
  });

  test('la riga della tabella si seleziona come una card', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [{ segnatura: 'MS 1' }, { segnatura: 'MS 2' }]);
    await page.locator('#btn-vista-tabella').click();

    await page.locator('#manoscritti-table tbody tr').first().click();

    await expect(page.locator('#selection-indicator')).toBeVisible();
    expect(await page.evaluate(() => (window as any).selectedRecords.length)).toBe(1);
  });

  test('in tabella spariscono select e freccia: si ordina dalle intestazioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [{ segnatura: 'MS 1' }, { segnatura: 'MS 2' }]);

    await expect(page.locator('#select-ordinamento')).toBeVisible();
    await expect(page.locator('#btn-ordinamento-dir')).toBeVisible();

    await page.locator('#btn-vista-tabella').click();

    await expect(page.locator('#select-ordinamento')).toBeHidden();
    await expect(page.locator('#btn-ordinamento-dir')).toBeHidden();

    const header = page.locator('#manoscritti-table thead th', { hasText: /Segnatura/i });
    await header.click();
    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['MS 2', 'MS 1']);

    await page.locator('#btn-vista-griglia').click();
    await expect(page.locator('#select-ordinamento')).toBeVisible();
  });

  test('la barra distingue le azioni primarie dal resto, che vive nel menu', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [{ segnatura: 'MS 1' }]);

    await expect(page.locator('#btn-tab-add')).toBeVisible();
    await expect(page.locator('#btn-nuova-scheda-tipo')).toBeVisible();

    const barra = page.locator('#context-actions');
    await expect(barra.locator('button', { hasText: /^Importa$/ })).toHaveCount(0);

    await page.locator('#context-overflow-slot button').click();
    const menu = page.locator('#custom-context-menu');
    await expect(menu).toBeVisible();
    for (const voce of [/Nuova cartella/, /Elimina quest/]) {
      await expect(menu.locator('button', { hasText: voce })).toHaveCount(1);
    }
    await expect(menu.locator('button', { hasText: /^Cestino$/ })).toHaveCount(1);
    await expect(menu.locator('button', { hasText: /Colonne/ })).toHaveCount(0);

    await menu.locator('button', { hasText: /^Importa$/ }).click();
    const subImport = page.locator('#custom-context-menu-1');
    await expect(subImport.locator('button[title="Importa un backup ZIP di ArchiView"]')).toHaveCount(1);
    await expect(subImport.locator('button[title="Importa da CSV"]')).toHaveCount(1);

    await menu.locator('button', { hasText: /^Esporta$/ }).click();
    const subExport = page.locator('#custom-context-menu-1');
    await expect(subExport.locator('button', { hasText: /Esporta/ })).toHaveCount(4);
    await expect(subExport.locator('button[title="Esporta Cartella in CSV"]')).toHaveCount(1);
    await expect(subExport.locator('button[title="Esporta Cartella in TSV"]')).toHaveCount(1);
    await expect(subExport.locator('button[title="Esporta testo e citazioni"]')).toHaveCount(1);
    await expect(subExport.locator('button[title="Stampa e PDF"]')).toHaveCount(1);
  });

  test('il segmento vista dichiara quale vista è attiva', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [{ segnatura: 'MS 1' }]);

    await expect(page.locator('#btn-vista-griglia')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#btn-vista-tabella')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('#btn-vista-tabella').click();

    await expect(page.locator('#btn-vista-tabella')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#btn-vista-griglia')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('#btn-vista-tabella').hover();
    await page.waitForTimeout(300);
    const sfondi = await page.evaluate(() => ({
      attivo: getComputedStyle(document.getElementById('btn-vista-tabella')).backgroundColor,
      inattivo: getComputedStyle(document.getElementById('btn-vista-griglia')).backgroundColor,
    }));
    expect(sfondi.attivo).not.toBe(sfondi.inattivo);
    expect(sfondi.attivo).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('il chevron di Nuova scheda apre il form già sul tipo scelto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await page.evaluate(async () => {
      // @ts-ignore
      appData.tipiDocumento.push({ id: 'fiscali-test', nome: 'Fiscali test', campi: ['dichiarante'] });
      await (window as any).Store.commit();
    });

    await page.locator('#btn-nuova-scheda-tipo').click();
    await page.locator('#custom-context-menu button', { hasText: 'Fiscali test' }).click();

    await expect(page.locator('#view-add')).toBeVisible();
    await expect(page.locator('#form-tipo-documento')).toHaveValue('fiscali-test');
    await expect(page.locator('#form-dynamic-fields')).toContainText(/Dichiarante/i);
  });

  test('si ordina anche per una colonna non prevista dal menu a tendina', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await page.evaluate(async () => {
      // @ts-ignore
      const data = appData;
      data.tipiDocumento.push({ id: 'fiscali-test', nome: 'Fiscali test', campi: ['dichiarante'] });
      for (const [seg, dich] of [['MS 1', 'Zanobi'], ['MS 2', 'Alberto'], ['MS 3', 'Michele']]) {
        data.manoscritti.push({
          id: crypto.randomUUID(), cartella: '', tipoDocumento: 'fiscali-test',
          segnatura: seg, dichiarante: dich, tags: '', allegati: [],
          lastModified: Date.now(), creatoDa: 'Anonimo', modificatoDa: 'Anonimo',
        });
      }
      await (window as any).Store.commit();
    });

    await page.locator('#btn-vista-tabella').click();
    await page.locator('#manoscritti-table thead th', { hasText: /Dichiarante/i }).click();

    await expect.poll(() => segnatureRenderizzate(page)).toEqual(['MS 2', 'MS 3', 'MS 1']);
  });

  test('il menu di ordinamento elenca i campi delle schede presenti, non altri', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await page.evaluate(async () => {
      // @ts-ignore
      const data = appData;
      data.tipiDocumento.push({ id: 'fiscali-test', nome: 'Fiscali test', campi: ['dichiarante'] });
      data.manoscritti.push({
        id: crypto.randomUUID(), cartella: '', tipoDocumento: 'fiscali-test',
        segnatura: '638', dichiarante: 'Michele Iacopo', tags: '', allegati: [],
        lastModified: Date.now(), creatoDa: 'Anonimo', modificatoDa: 'Anonimo',
      });
      await (window as any).Store.commit();
    });

    const criteri = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('#select-ordinamento option')).map((o) => (o as HTMLOptionElement).value)
      );

    await expect.poll(criteri).toContain('dichiarante');
    await expect.poll(criteri).not.toContain('autore');
    expect(await criteri()).toEqual(expect.arrayContaining(['segnatura', 'lastModified', 'allegati']));
  });

  test('il selettore colonne mostra e nasconde una colonna, e persiste', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [{ segnatura: 'MS 1', titolo: 'Rogito notarile' }]);

    await page.locator('#btn-vista-tabella').click();

    const intestazioni = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('#manoscritti-table thead th')).map((th) =>
          (th.textContent || '').replace(/[▲▼]/g, '').trim()
        )
      );

    expect(await intestazioni()).toContain('Titolo / Cont.');
    await expect(page.locator('#manoscritti-table tbody td', { hasText: 'Rogito notarile' })).toBeVisible();

    await page.locator('#context-overflow-slot button').click();
    await page.locator('#custom-context-menu button', { hasText: /Colonne/ }).click();
    await page.locator('#custom-context-menu-1 button', { hasText: 'Titolo / Cont.' }).click();

    await expect.poll(intestazioni).not.toContain('Titolo / Cont.');
    expect(await page.evaluate(() => (window as any).colonneTabella)).toBeTruthy();
  });

  test('ordinamento e vista sopravvivono al riavvio', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Sort');
    await seedSegnature(page, [{ segnatura: 'MS 1' }, { segnatura: 'MS 2' }, { segnatura: 'MS 10' }]);

    await page.evaluate(() => (window as any).impostaOrdinamento('segnatura', 'desc'));
    await page.locator('#btn-vista-tabella').click();
    await page.evaluate(async () => {
      await (window as any).flushSalvataggio();
      await (window as any).salvaStatoPosizione();
    });

    const { launchApp, closeApp } = await import('./fixtures');
    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);

    await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await page2.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await dismissOverlays(page2);

    await expect(page2.locator('#manoscritti-table-wrap')).toBeVisible();
    await expect.poll(() => segnatureRenderizzate(page2)).toEqual(['MS 10', 'MS 2', 'MS 1']);

    await closeApp(app2);
  });
});
