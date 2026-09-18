import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, seedItems } from './helpers';
import * as path from 'path';

// Fase 4 — le azioni che prima esistevano solo nel tasto destro devono avere
// un accesso visibile ("⋯") e il menu deve essere navigabile da tastiera.
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
    // Il menu prende il fuoco sulla prima voce: navigabile subito da tastiera.
    await expect(menu.locator('[role="menuitem"]').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(overflow).toBeFocused();

    // Percorso mouse: il mousedown dentro il menu non lo deve chiudere prima del click.
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

    // La prima voce su selezione singola è "Modifica" (title: "Rinomina / Modifica") → form.
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
    // Etichette a una o due parole: il menu e' largo 280px e `truncate` taglia in silenzio.
    // La dizione estesa resta nel `title`, che e' cio' che l'asserzione qui sotto verifica
    // insieme all'etichetta breve.
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

    // La selezione si annuncia con un testo accanto al contatore: nessuna barra che
    // spinge in basso le schede (era il motivo per cui è stata rimossa).
    await expect(indicatore).toBeVisible();
    await expect(indicatore).toContainText('2');
    await expect(page.locator('#selection-bar')).toHaveCount(0);

    // Tasto destro su una delle schede selezionate: le azioni valgono su tutte e due.
    await page.locator(`#card-${ids[0]}`).click({ button: 'right' });
    const menu = page.locator('#custom-context-menu');
    await expect(menu).toBeVisible();
    for (const voce of ['Copia (2)', 'Taglia (2)', 'Esporta (2)', 'Elimina (2)']) {
      await expect(menu.locator('button', { hasText: voce })).toHaveCount(1);
    }
    // Il conteggio è sull'etichetta del gruppo E su quelle dentro: è lì che si decide.
    await menu.locator('button', { hasText: 'Esporta (2)' }).click();
    await expect(page.locator('#custom-context-menu-1')).toContainText('Esporta ZIP (2)');
    await page.keyboard.press('Escape');
    await expect(page.locator('#custom-context-menu-1')).toHaveCount(0);
    await expect(menu).toBeVisible();

    await menu.locator('button', { hasText: /Deseleziona/ }).click();
    await expect(indicatore).toBeHidden();
    expect(await page.evaluate(() => (window as any).selectedRecords.length)).toBe(0);
  });

  // --- Sottomenu (MENU_GROUPING_TODO) ---

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

    // Freccia sinistra: esce di UN livello e rimette il fuoco sulla voce che l'ha aperto.
    await page.keyboard.press('ArrowLeft');
    await expect(sub).toHaveCount(0);
    await expect(menu).toBeVisible();
    await expect(gruppo).toBeFocused();
    await expect(gruppo).toHaveAttribute('aria-expanded', 'false');

    // Esc al primo livello chiude tutto.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('il click su una voce del sottomenu esegue il comando', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Menu');
    await seedItems(page, 1);

    await page.locator('.card-scheda .card-overflow-btn').first().click();
    // Il mousedown dentro il SOTTOMENU non deve chiudere lo stack prima del click.
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

    // Il vincolo è sulla CRESCITA: sotto le ~12 voci il menu sta in una finestra bassa
    // senza diventare scorrevole, che è il motivo per cui i gruppi esistono.
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
