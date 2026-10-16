import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, seedItems } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Menu' });

test.describe('Menu contestuale e overflow', () => {
  test('il "⋯" della card apre il menu con Esporta ed Elimina', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    await seedItems(page, 1);

    const overflow = page.locator('.card-scheda .card-overflow-btn').first();
    await expect(overflow).toBeVisible();
    await overflow.click();

    const menu = page.locator('#custom-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Esporta');
    await expect(menu).toContainText('Elimina');
    await expect(menu.locator('[role="menuitem"]').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(overflow).toBeFocused();

    await overflow.click();
    await menu.locator('[role="menuitem"]', { hasText: 'Copia' }).click();
    await expect(menu).toBeHidden();
    await expect(page.locator('#toast-container')).toContainText('copiat');
  });

  test('le frecce scorrono le voci e Invio esegue l\'azione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    await seedItems(page, 1);

    await page.locator('.card-scheda .card-overflow-btn').first().click();
    const voci = page.locator('#custom-context-menu [role="menuitem"]');
    await expect(voci.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(voci.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(voci.first()).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#custom-context-menu')).toBeHidden();
    await expect(page.locator('#manoscritto-form')).toBeVisible();
  });

  test('il "⋯" della cartella in sidebar espone rinomina e apri in Esplora', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    await createFolder(page, 'Notarile');

    const riga = page.locator('#folder-list .sidebar-row', { hasText: 'Notarile' }).first();
    await riga.hover();
    const overflow = riga.locator('button[aria-haspopup="menu"]');
    await expect(overflow).toBeVisible();
    await overflow.click();

    const menu = page.locator('#custom-context-menu');
    await expect(menu).toContainText('Rinomina');
    await expect(menu).toContainText('Esplora risorse');
    await expect(menu).toContainText('Nuova scheda');
    await expect(menu.locator('[title="Rinomina cartella"]')).toHaveCount(1);
  });

  test('le azioni multiple stanno nel tasto destro, non in una barra', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    const ids = await seedItems(page, 3);

    const indicatore = page.locator('#selection-indicator');
    await expect(indicatore).toBeHidden();

    await page.evaluate((recIds) => {
      (window as any).selectedRecords = recIds;
      (window as any).aggiornaStatoSelezione();
    }, ids.slice(0, 2));

    await expect(indicatore).toBeVisible();
    await expect(indicatore).toContainText('2');
    await expect(page.locator('#selection-bar')).toHaveCount(0);

    await page.locator(`#card-${ids[0]}`).click({ button: 'right' });
    const menu = page.locator('#custom-context-menu');
    await expect(menu).toBeVisible();
    for (const voce of ['Copia (2)', 'Taglia (2)', 'Esporta (2)', 'Elimina (2)']) {
      await expect(menu.locator('button', { hasText: voce })).toHaveCount(1);
    }
    await menu.locator('button', { hasText: 'Esporta (2)' }).click();
    await expect(page.locator('#custom-context-menu-1')).toContainText('Esporta ZIP (2)');
    await page.keyboard.press('Escape');
    await expect(page.locator('#custom-context-menu-1')).toHaveCount(0);
    await expect(menu).toBeVisible();

    await menu.locator('button', { hasText: /Deseleziona/ }).click();
    await expect(indicatore).toBeHidden();
    expect(await page.evaluate(() => (window as any).selectedRecords.length)).toBe(0);
  });

  test('il sottomenu si apre e si chiude da tastiera senza portarsi via il padre', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    await seedItems(page, 1);

    await page.locator('.card-scheda .card-overflow-btn').first().click();
    const menu = page.locator('#custom-context-menu');
    const gruppo = menu.locator('button', { hasText: /^Esporta$/ });
    await gruppo.focus();
    await page.keyboard.press('ArrowRight');

    const sub = page.locator('#custom-context-menu-1');
    await expect(sub).toBeVisible();
    await expect(sub.locator('[role="menuitem"]').first()).toBeFocused();
    await expect(gruppo).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('ArrowLeft');
    await expect(sub).toHaveCount(0);
    await expect(menu).toBeVisible();
    await expect(gruppo).toBeFocused();
    await expect(gruppo).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('uno scroll vero chiude il menu, un evento di scroll in ritardo no', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    const ids = await seedItems(page, 8);
    const menu = page.locator('#custom-context-menu');

    await page.evaluate((id) => {
      const card = document.getElementById('card-' + id)!;
      document.querySelector('main')!.scrollTop = 40;
      const r = card.getBoundingClientRect();
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 20, button: 2 }));
    }, ids[0]);
    await page.waitForTimeout(300);
    await expect(menu).toBeVisible();

    await page.evaluate(() => { document.querySelector('main')!.scrollTop += 120; });
    await expect(menu).toHaveCount(0);
  });

  test('il click su una voce del sottomenu esegue il comando', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    const [id] = await seedItems(page, 1);
    await expect.poll(() => page.evaluate(async (rid) =>
      ((await (window as any).apiSicurezza.storiaRecord(String(rid)))?.tappe || []).length, id)).toBeGreaterThan(0);

    await page.locator('.card-scheda .card-overflow-btn').first().click();
    await page.locator('#custom-context-menu button', { hasText: /^Vedi$/ }).click();
    await page.locator('#custom-context-menu-1 button', { hasText: /Cronologia/ }).click();
    await expect(page.locator('#custom-context-menu')).toBeHidden();
    await expect(page.locator('#custom-context-menu-1')).toHaveCount(0);
    await expect(page.locator('#record-history-modal')).toBeVisible();
  });

  test('nessun menu supera 11 voci al primo livello', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    await createFolder(page, 'Notarile');
    const ids = await seedItems(page, 1);

    const conteggi = await page.evaluate((recId) => {
      const w = window as any;
      w.selectedRecords = [recId];
      const primoLivello = (voci: any[]) => voci.filter(v => v && !v.separator && !v.heading).length;
      return {
        record: primoLivello(w.vociMenuRecord(recId)),
        cartella: primoLivello(w.vociMenuCartella('Notarile'))
      };
    }, ids[0]);

    expect(conteggi.record).toBeLessThanOrEqual(11);
    expect(conteggi.cartella).toBeLessThanOrEqual(11);

    await page.locator('#context-overflow-slot button').click();
    expect(await page.locator('#custom-context-menu [role="menuitem"]').count()).toBeLessThanOrEqual(11);
  });
});
