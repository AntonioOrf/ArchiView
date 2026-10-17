import { test, expect } from './fixtures';
import { createLocalWorkspace, seedItems, openView, openSidebarPanel } from './helpers';
import { preparaSchermateSecondarie } from './a11ySchermate';
import { scansiona, TEMI, TEMI_SCURI, type Violazione } from './contrasto';
import * as fs from 'fs';
import * as path from 'path';

test.use({ seedWorkspace: 'Contrasto' });

test.describe('Accessibilità: contrasto del testo', () => {
  test('7.1 — nessun testo sotto il minimo WCAG AA in nessuno dei quattro temi', async ({ page, electronApp, userDataDir }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Contrasto');
    await seedItems(page, 6, { tagPrefix: 'notarile' });
    await page.evaluate(() => (window as any).renderMain());

    const sonda = async (loc: import('@playwright/test').Locator) => {
      await loc.evaluate((el) => el.setAttribute('data-sonda-hover', ''));
      await loc.hover();
      await page.waitForTimeout(100);
    };
    const fineSonda = async () => {
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.querySelectorAll('[data-sonda-hover]').forEach(e => e.removeAttribute('data-sonda-hover')));
    };

    const schermate: { nome: string; radice: string; apri: () => Promise<void>; chiudi?: () => Promise<void> }[] = [
      { nome: 'lista', radice: 'body', apri: async () => { await openView(page, 'list'); } },
      { nome: 'sidebar-ricerca', radice: '#sidebar-search', apri: () => openSidebarPanel(page, 'search') },
      { nome: 'sidebar-tag', radice: '#sidebar-tags', apri: () => openSidebarPanel(page, 'tags') },
      { nome: 'sidebar-storico', radice: '#sidebar-history', apri: () => openSidebarPanel(page, 'history') },
      { nome: 'form-aggiungi', radice: '#view-add', apri: () => openView(page, 'add') },
      {
        nome: 'impostazioni', radice: '#settings-modal',
        apri: async () => { await page.evaluate(() => (window as any).apriImpostazioni()); await expect(page.locator('#settings-modal')).toBeVisible(); },
        chiudi: async () => { await page.evaluate(() => (window as any).chiudiImpostazioni()); },
      },
      {
        nome: 'cloud', radice: '#cloud-modal',
        apri: async () => { await page.evaluate(() => (window as any).apriCloudModal()); await expect(page.locator('#cloud-modal')).toBeVisible(); },
        chiudi: async () => { await page.keyboard.press('Escape'); },
      },
      {
        nome: 'command-palette', radice: '.cp-box',
        apri: async () => { await page.evaluate(() => (window as any).apriCommandPalette()); await expect(page.locator('.cp-box')).toBeVisible(); },
        chiudi: async () => { await page.keyboard.press('Escape'); },
      },
      {
        nome: 'sidebar-riga-hover', radice: '[data-sonda-hover]',
        apri: async () => { await openSidebarPanel(page, 'folders'); await sonda(page.locator('#sidebar-folders .group.cursor-pointer', { hasText: 'Seed-001' }).first()); },
        chiudi: () => fineSonda(),
      },
      {
        nome: 'card-hover', radice: '[data-sonda-hover]',
        apri: async () => { await openView(page, 'list'); await sonda(page.locator('.card-scheda').first()); },
        chiudi: () => fineSonda(),
      },
      {
        nome: 'tabella-riga-hover', radice: '[data-sonda-hover]',
        apri: async () => { await openView(page, 'list'); await page.evaluate(() => (window as any).cambiaVistaLista('tabella')); await sonda(page.locator('main table tbody tr').first()); },
        chiudi: async () => { await fineSonda(); await page.evaluate(() => (window as any).cambiaVistaLista('griglia')); },
      },
      {
        nome: 'tabella', radice: 'main',
        apri: async () => { await openView(page, 'list'); await page.evaluate(() => (window as any).cambiaVistaLista('tabella')); await page.waitForTimeout(150); },
        chiudi: async () => { await page.evaluate(() => (window as any).cambiaVistaLista('griglia')); },
      },
      {
        nome: 'conferma-elimina', radice: '#bottom-confirm-banner',
        apri: async () => { await page.evaluate(() => (window as any).mostraBottomConfirm('Eliminare la scheda? Operazione irreversibile.',() => {})); await expect(page.locator('#bottom-confirm-banner')).toBeVisible(); },
        chiudi: async () => { await page.keyboard.press('Escape'); },
      },
      {
        nome: 'gestione-tag', radice: '#tag-manager-modal',
        apri: async () => { await page.evaluate(() => (window as any).apriGestioneTag()); await expect(page.locator('#tag-manager-modal')).toBeVisible(); },
        chiudi: async () => { await page.keyboard.press('Escape'); },
      },
      {
        nome: 'cestino', radice: '#cestino-modal',
        apri: async () => { await page.evaluate(() => (window as any).apriCestino()); await expect(page.locator('#cestino-modal')).toBeVisible(); },
        chiudi: async () => { await page.keyboard.press('Escape'); },
      },
      {
        nome: 'filtri', radice: 'body',
        apri: async () => { await openView(page, 'list'); await page.evaluate(() => (window as any).apriPannelloFiltri()); await expect(page.locator('#pannello-filtri')).toBeVisible(); },
        chiudi: async () => { await page.keyboard.press('Escape'); },
      },
      ...await preparaSchermateSecondarie(page, electronApp, userDataDir),
      {
        nome: 'allegato-rimuovi-hover', radice: '[data-sonda-hover]',
        apri: async () => {
          // @ts-ignore
          await page.evaluate(() => (window as any).editItem(appData.manoscritti.find((m: any) => m.segnatura === 'A11Y-ALLEGATO').id));
          await sonda(page.locator('[data-on-click="rimuoviAllegatoForm"]').first());
        },
        chiudi: async () => { await fineSonda(); await openView(page, 'list'); },
      },
      {
        nome: 'ricerca-salvata-elimina-hover', radice: '[data-sonda-hover]',
        apri: async () => {
          await openView(page, 'list');
          await page.evaluate(() => { (window as any).salvaRicercaCorrente('Prova a11y'); (window as any).apriPannelloFiltri(); });
          await sonda(page.locator('[data-elimina-ricerca-id]').first());
        },
        chiudi: async () => { await fineSonda(); await page.keyboard.press('Escape'); },
      },
    ];

    const risultati: Record<string, Violazione[]> = {};
    const bordi: (Violazione & { tema: string })[] = [];
    const sfondi: string[] = [];
    const anelli: string[] = [];
    for (const tema of TEMI) {
      await page.evaluate((t) => (window as any).applicaTema(t), tema);
      anelli.push(...await page.evaluate((t) => {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
        const rgb = (c: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data); };
        const lum = (c: number[]) => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const root = getComputedStyle(document.documentElement);
        const token = (n: string) => root.getPropertyValue(n).trim();
        const anello = rgb(token('--color-primary'));
        return ['--color-bg-panel', '--color-bg-base', '--color-bg-sidebar', '--color-bg-hover'].flatMap(n => {
          const [a, b] = [lum(anello), lum(rgb(token(n)))].sort((p, q) => q - p);
          const r = (a + 0.05) / (b + 0.05);
          return r < 3 ? [`${t} · anello di focus --color-primary su ${n} = ${r.toFixed(2)}:1 (min 3)`] : [];
        });
      }, tema));
      const lista: Violazione[] = [];
      for (const s of schermate) {
        await s.apri();
        await page.waitForFunction(() => document.getAnimations().every(a =>
          a.playState !== 'running' || a.effect?.getComputedTiming().endTime === Infinity));
        const v = await page.evaluate(scansiona, { radiceSel: s.radice, modo: 'testo' as const });
        lista.push(...v.map(x => ({ schermata: s.nome, ...x })));
        const b = await page.evaluate(scansiona, { radiceSel: s.radice, modo: 'bordi' as const });
        bordi.push(...b.map(x => ({ schermata: s.nome, tema, ...x })));
        if (TEMI_SCURI.includes(tema)) {
          const f = await page.evaluate(scansiona, { radiceSel: s.radice, modo: 'sfondi' as const });
          sfondi.push(...f.map(v => `${tema} · ${s.nome} · ${v.elemento} «${v.testo}» su fondo chiaro ${v.bg}`));
        }
        if (s.chiudi) await s.chiudi();
        await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay, .cp-box, #pannello-filtri'))
          .filter(m => m.getClientRects().length && !m.classList.contains('hidden-tab')).length)).toBe(0);
      }
      await openView(page, 'list');
      risultati[tema] = lista;
    }

    const dest = process.env.CONTRASTO_OUT;
    if (dest) fs.writeFileSync(dest, JSON.stringify(risultati, null, 2));
    for (const t of TEMI) console.log(`[contrasto] ${t}: ${risultati[t].length} violazioni`);

    const righe = TEMI.flatMap(t => risultati[t].map(v =>
      `${t} · ${v.schermata} · ${v.elemento} «${v.testo}» ${v.fg} su ${v.bg} = ${v.ratio}:1 (min ${v.minimo})`));
    expect.soft([...new Set(righe)], 'testi sotto il contrasto minimo').toEqual([]);

    const righeBordi = bordi.map(v =>
      `${v.tema} · ${v.schermata} · ${v.elemento} «${v.testo}» ${v.fg} su ${v.bg} = ${v.ratio}:1 (min 3)`);
    expect.soft([...new Set(righeBordi)], 'campi il cui contorno non si distingue (1.4.11)').toEqual([]);
    expect.soft(anelli, 'anelli di focus poco visibili (1.4.11)').toEqual([]);
    expect.soft([...new Set(sfondi)], 'fondi del tema chiaro nei temi scuri').toEqual([]);
  });
});
