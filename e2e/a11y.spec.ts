import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, seedItems } from './helpers';
import * as path from 'path';

// Fase 5 — coerenza tecnica e accessibilità.
test.describe('Accessibilità e scala z-index', () => {
  test('5.1 — nessun z-index numerico fuori scala e ordine dei livelli rispettato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    const livelli = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const val = (n: string) => parseInt(root.getPropertyValue(n));
      return {
        dropdown: val('--z-dropdown'),
        modal: val('--z-modal'),
        nested: val('--z-modal-nested'),
        alert: val('--z-modal-alert'),
        critical: val('--z-modal-critical'),
        toast: val('--z-toast'),
        menu: val('--z-menu'),
        // Un modale reale deve pescare dalla scala, non da un numero scritto a mano.
        settings: getComputedStyle(document.getElementById('settings-modal')!).zIndex,
        conflitto: getComputedStyle(document.getElementById('merge-conflict-modal')!).zIndex,
        toastBox: getComputedStyle(document.getElementById('toast-container')!).zIndex,
      };
    });

    expect(livelli.dropdown).toBeLessThan(livelli.modal);
    expect(livelli.modal).toBeLessThan(livelli.nested);
    expect(livelli.nested).toBeLessThan(livelli.alert);
    expect(livelli.alert).toBeLessThan(livelli.critical);
    expect(livelli.critical).toBeLessThan(livelli.toast);
    expect(livelli.toast).toBeLessThan(livelli.menu);
    expect(livelli.settings).toBe(String(livelli.modal));
    expect(livelli.conflitto).toBe(String(livelli.critical));
    expect(livelli.toastBox).toBe(String(livelli.toast));
  });

  test('5.2 — i 5 pulsanti sono un tablist e le frecce spostano il fuoco', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    const tablist = page.locator('#sidebar-tablist');
    await expect(tablist).toHaveAttribute('role', 'tablist');
    await expect(page.locator('#sidebar-folders')).toHaveAttribute('role', 'tabpanel');
    await expect(page.locator('#sidebar-folders')).toHaveAttribute('aria-labelledby', 'btn-tab-folders');

    await page.evaluate(() => (window as any).switchSidebarTab('tags'));
    await expect(page.locator('#btn-tab-tags')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#btn-tab-folders')).toHaveAttribute('aria-selected', 'false');
    // Roving tabindex: solo il tab selezionato è in sequenza di tabulazione.
    await expect(page.locator('#btn-tab-tags')).toHaveAttribute('tabindex', '0');
    await expect(page.locator('#btn-tab-folders')).toHaveAttribute('tabindex', '-1');

    await page.locator('#btn-tab-tags').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#btn-tab-search')).toBeFocused();
    // Manual activation: la freccia sposta il fuoco ma non cambia pannello.
    await expect(page.locator('#btn-tab-tags')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page.locator('#btn-tab-search')).toHaveAttribute('aria-selected', 'true');

    // Sidebar chiusa: nessun tab selezionato, ma il gruppo resta raggiungibile da Tab.
    await page.evaluate(() => (window as any).switchSidebarTab('search'));
    await expect(page.locator('#btn-tab-search')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#btn-tab-folders')).toHaveAttribute('tabindex', '0');
  });

  test('5.3 — Esc chiude il modale in cima passando dal suo handler dedicato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-modal')).toBeHidden();
  });

  test('5.3 — Esc non chiude gli overlay di operazione in corso', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    await page.evaluate(() => document.getElementById('cloud-progress-overlay')!.classList.remove('hidden-tab'));
    await expect(page.locator('#cloud-progress-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#cloud-progress-overlay')).toBeVisible();
  });

  test('5.3 — il focus entra nel modale e torna al trigger alla chiusura', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    await page.locator('#btn-tab-add').focus();
    await page.evaluate(() => (window as any).apriImpostazioni());
    await expect(page.locator('#settings-modal')).toBeVisible();
    const dentro = await page.evaluate(() =>
      document.getElementById('settings-modal')!.contains(document.activeElement));
    expect(dentro).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('#btn-tab-add')).toBeFocused();
  });

  test('5.4 — i pulsanti icona compressi hanno un target di almeno 32px', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');
    await seedItems(page, 1);

    // 31.9 e non 32: 2rem arrotondati dal layout danno 31.999984
    const overflowCard = await page.locator('.card-scheda .card-overflow-btn').first().boundingBox();
    expect(overflowCard!.width).toBeGreaterThanOrEqual(31.9);
    expect(overflowCard!.height).toBeGreaterThanOrEqual(31.9);

    // L'albero mostra solo cartelle: senza crearne una non ci sono righe da misurare.
    await createFolder(page, 'Notarile');
    const riga = page.locator('#folder-list .sidebar-row').first();
    await riga.hover();
    const overflowCartella = await riga.locator('button[aria-haspopup="menu"]').boundingBox();
    expect(overflowCartella!.width).toBeGreaterThanOrEqual(31.9);
    expect(overflowCartella!.height).toBeGreaterThanOrEqual(31.9);

    const tab = await page.locator('#btn-tab-folders').boundingBox();
    expect(tab!.width).toBeGreaterThanOrEqual(31.9);
    expect(tab!.height).toBeGreaterThanOrEqual(31.9);
  });

  test('5.5 — il modale Cloud prende il fuoco, lo restituisce ed è etichettato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    await page.locator('#btn-tab-add').focus();
    await page.evaluate(() => (window as any).apriCloudModal());
    await expect(page.locator('#cloud-modal')).toBeVisible();

    const dentro = await page.evaluate(() =>
      document.getElementById('cloud-modal')!.contains(document.activeElement));
    expect(dentro).toBe(true);

    // aria-labelledby deve puntare a un titolo con testo reale, non a un id orfano.
    const win = page.locator('#cloud-modal .modal-window');
    await expect(win).toHaveAttribute('role', 'dialog');
    await expect(win).toHaveAttribute('aria-modal', 'true');
    const etichetta = await page.evaluate(() => {
      const w = document.querySelector('#cloud-modal .modal-window')!;
      const id = w.getAttribute('aria-labelledby');
      return id ? (document.getElementById(id)?.textContent || '').trim() : '';
    });
    expect(etichetta.length).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('#cloud-modal')).toBeHidden();
    await expect(page.locator('#btn-tab-add')).toBeFocused();
  });

  test('5.5 — le icone decorative del modale Cloud non sono nell albero di accessibilità', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    await page.evaluate(() => (window as any).apriCloudModal());
    await expect(page.locator('#cloud-modal')).toBeVisible();

    // lucide sostituisce <i data-lucide> con <svg>: controlliamo entrambe le forme.
    const senzaAriaHidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#cloud-modal i[data-lucide], #cloud-modal svg'))
        .filter(el => el.getAttribute('aria-hidden') !== 'true').length);
    expect(senzaAriaHidden).toBe(0);
  });

  test('5.5 — il progresso cloud viene annunciato dalla live region condivisa', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    const live = page.locator('#a11y-live-polite');
    await expect(live).toHaveAttribute('aria-live', 'polite');

    await page.evaluate(() => (window as any).mostraProgressoCloud('Backup', 'Caricamento dati'));
    await expect(live).toHaveText('Backup — Caricamento dati');

    // L'overlay non deve avere una live region propria: competerebbe con quella condivisa.
    const liveInterne = await page.evaluate(() =>
      document.querySelectorAll('#cloud-progress-overlay [aria-live], #cloud-progress-overlay [role="status"]').length);
    expect(liveInterne).toBe(0);

    await page.evaluate(() => (window as any).nascondiProgressoCloud());
    await expect(live).not.toHaveText('Backup — Caricamento dati');
  });

  test('5.5 — le opzioni avanzate sono un target utilizzabile', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    // La sezione avanzata vive nel ramo "cloud attivo": la mostriamo senza toccare il vault.
    await page.evaluate(() => (window as any).apriCloudModal());
    await page.evaluate(() => {
      document.getElementById('cloud-local-section')!.classList.add('hidden-tab');
      document.getElementById('cloud-shared-section')!.classList.remove('hidden-tab');
    });

    const summary = page.locator('#cloud-shared-section summary');
    const box = await summary.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(24);

    // <details> espone lo stato nativamente: deve aprirsi da tastiera.
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#btn-disconnect-cloud')).toBeVisible();
  });
});
