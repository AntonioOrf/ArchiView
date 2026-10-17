import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Palette' });

async function seed(page, segnature: string[], cartella = '') {
  await page.evaluate(async ({ segnature, cartella }) => {
    // @ts-ignore
    const data = appData;
    for (const s of segnature) {
      data.manoscritti.push({
        id: crypto.randomUUID(),
        cartella,
        tipoDocumento: 'manoscritto',
        segnatura: s,
        titolo: '',
        tags: '',
        allegati: [],
        trascrizione: '',
        lastModified: Date.now(),
        creatoDa: 'Anonimo',
        modificatoDa: 'Anonimo',
      });
    }
    if (cartella && !data.cartelle.includes(cartella)) data.cartelle.push(cartella);
    await (window as any).Store.commit();
  }, { segnature, cartella });
}

async function voci(page): Promise<string[]> {
  return page.locator('#cp-lista .cp-voce').evaluateAll((els) =>
    els.map((el) => (el.querySelector('div.truncate') as HTMLElement).textContent!.trim())
  );
}

test.describe('Command palette e scorciatoie', () => {
  test('Ctrl+K apre la palette, Esc la chiude e restituisce il fuoco', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');

    await expect(page.locator('#command-palette')).toHaveCount(0);
    await page.locator('#btn-tab-add').focus();
    await page.keyboard.press('Control+k');

    await expect(page.locator('#command-palette')).toBeVisible();
    await expect(page.locator('#cp-input')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('#command-palette')).toHaveCount(0);
    await expect(page.locator('#btn-tab-add')).toBeFocused();
  });

  test('Ctrl+K funziona anche nella vista trascrizione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');
    await seed(page, ['MS TRASC']);

    await page.evaluate(() => {
      // @ts-ignore
      (window as any).apriTrascrizione(appData.manoscritti[0].id);
    });
    await expect(page.locator('#view-trascrizione')).toBeVisible();

    await page.keyboard.press('Control+k');
    await expect(page.locator('#command-palette')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('la palette non si apre sopra un modale', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await expect(page.locator('#settings-modal')).toBeVisible();

    await page.keyboard.press('Control+k');
    await expect(page.locator('#command-palette')).toHaveCount(0);
    await expect(page.locator('#settings-modal')).toBeVisible();
  });

  test('digitando si filtrano i comandi e il primo è il più pertinente', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');

    await page.keyboard.press('Control+k');
    const iniziali = await voci(page);
    expect(iniziali.length).toBeGreaterThan(5);

    await page.locator('#cp-input').fill('impost');
    const filtrate = await voci(page);
    expect(filtrate.length).toBeLessThan(iniziali.length);
    expect(filtrate[0]).toMatch(/Impostazioni|Settings/);

    await page.locator('#cp-input').fill('zzzznessuncomando');
    await expect(page.locator('#cp-vuoto')).toBeVisible();
    expect(await voci(page)).toEqual([]);
  });

  test('cerca fra le schede e Invio salta a quella scelta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');
    await seed(page, ['MS PERUGIA', 'MS ESCA']);
    await page.evaluate(() => {
      // @ts-ignore
      const m = appData.manoscritti.find((x) => x.segnatura === 'MS PERUGIA');
      m.titolo = 'Atto rogato a Perùgia';
      // @ts-ignore
      if (typeof (window as any).invalidaCacheRicerca === 'function') (window as any).invalidaCacheRicerca();
    });

    await page.keyboard.press('Control+k');
    await page.locator('#cp-input').fill('perugia');

    const elencate = await voci(page);
    expect(elencate).toContain('MS PERUGIA');
    expect(elencate).not.toContain('MS ESCA');

    await page.keyboard.press('Enter');
    await expect(page.locator('#command-palette')).toHaveCount(0);
    await expect(page.locator('#view-list')).toBeVisible();
    await expect(page.locator('.card-scheda').filter({ hasText: 'MS PERUGIA' })).toHaveCount(1);
  });

  test('le frecce spostano la selezione e Invio esegue quella evidenziata', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');

    await page.keyboard.press('Control+k');
    const prima = page.locator('#cp-lista .cp-voce').first();
    await expect(prima).toHaveClass(/cp-attiva/);

    await page.keyboard.press('ArrowDown');
    await expect(prima).not.toHaveClass(/cp-attiva/);
    await expect(page.locator('#cp-lista .cp-voce').nth(1)).toHaveClass(/cp-attiva/);

    await page.keyboard.press('ArrowUp');
    await expect(prima).toHaveClass(/cp-attiva/);

    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#cp-lista .cp-voce').last()).toHaveClass(/cp-attiva/);
  });

  test('vai alla cartella: la palette porta nel ramo scelto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');
    await createFolder(page, 'Notarile');

    await page.keyboard.press('Control+k');
    await page.locator('#cp-input').fill('Notarile');
    const elencate = await voci(page);
    expect(elencate).toContain('Notarile');

    await page.keyboard.press('Enter');
    await expect(page.locator('#command-palette')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).cartellaAttuale)).toBe('Notarile');
  });

  test('cambia vista dalla palette, e il comando proposto è quello NON attivo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');
    await seed(page, ['MS 1']);

    await page.keyboard.press('Control+k');
    await page.locator('#cp-input').fill('vista');
    let elencate = await voci(page);
    expect(elencate.some((v) => /tabella|table/i.test(v))).toBe(true);
    expect(elencate.some((v) => /schede|card/i.test(v))).toBe(false);

    await page.keyboard.press('Enter');
    await expect(page.locator('#manoscritti-table-wrap')).toBeVisible();

    await page.keyboard.press('Control+k');
    await page.locator('#cp-input').fill('vista');
    elencate = await voci(page);
    expect(elencate.some((v) => /schede|card/i.test(v))).toBe(true);
    expect(elencate.some((v) => /tabella|table/i.test(v))).toBe(false);
    await page.keyboard.press('Escape');
  });

  test('"?" apre l\'elenco delle scorciatoie, ma non mentre si scrive', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');

    await page.evaluate(() => (window as any).apriSidebarTab('search'));
    await page.locator('#search-input').fill('');
    await page.locator('#search-input').press('?');
    await expect(page.locator('#shortcuts-modal')).toBeHidden();
    expect(await page.locator('#search-input').inputValue()).toBe('?');

    await page.locator('#search-input').fill('');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('?');
    await expect(page.locator('#shortcuts-modal')).toBeVisible();

    const attese = await page.evaluate(() =>
      (window as any).SCORCIATOIE.reduce((n, s) => n + s.voci.length, 0)
    );
    await expect(page.locator('#shortcuts-body dl > div')).toHaveCount(attese);
    await expect(page.locator('#shortcuts-body')).toContainText('Ctrl');
    await expect(page.locator('#shortcuts-body kbd', { hasText: /^K$/ })).toHaveCount(2);

    await page.keyboard.press('Escape');
    await expect(page.locator('#shortcuts-modal')).toBeHidden();
  });

  test('palette e scorciatoie sono raggiungibili anche col mouse, dal "⋯" della barra', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Palette');

    await page.locator('#context-overflow-slot button').click();
    const menu = page.locator('#custom-context-menu');
    await expect(menu).toBeVisible();

    const vociMenu = menu.locator('[role="menuitem"]', { hasText: /Comandi|Commands/ });
    await expect(vociMenu).toHaveCount(1);
    await expect(vociMenu.locator('kbd')).toHaveText('Ctrl+K');

    await vociMenu.click();
    await expect(page.locator('#command-palette')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
