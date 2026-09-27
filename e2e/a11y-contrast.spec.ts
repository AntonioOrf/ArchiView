import { test, expect } from './fixtures';
import { createLocalWorkspace, seedItems, openView, openSidebarPanel } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

// WCAG 1.4.3 — contrasto del testo misurato sul rendering reale, nei quattro temi.
// Le classi Tailwind da sole non dicono nulla: style.css rimappa .text-stone-* sui token del
// tema (con !important) e i modali scuri hanno un secondo remap. Si misura quindi il colore
// CALCOLATO contro lo sfondo EFFETTIVO, risalendo gli antenati e componendo le trasparenze.

const TEMI = ['light', 'dark', 'amber-light', 'blue-dark'] as const;

type Violazione = { schermata: string; elemento: string; testo: string; fg: string; bg: string; ratio: number; minimo: number };

// Eseguita nella pagina. modo 'testo' (1.4.3): testi e placeholder sotto il minimo.
// modo 'bordi' (1.4.11): campi di input il cui contorno non si stacca di 3:1 dall'intorno.
function scansiona({ radiceSel, modo }: { radiceSel: string; modo: 'testo' | 'bordi' }): Omit<Violazione, 'schermata'>[] {
  // Tailwind v4 calcola i colori in oklch(): nessun parsing a mano, li converte il browser
  // disegnandoli su un canvas 1×1 (sRGB), qualunque sia la sintassi (oklch, color-mix, rgb).
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const cache = new Map<string, any>();
  const parse = (c: string) => {
    if (!c) return null;
    if (cache.has(c)) return cache.get(c);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const v = { r, g, b, a: a / 255 };
    cache.set(c, v);
    return v;
  };
  const sopra = (f: any, b: any) => ({
    r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1,
  });
  const lum = (c: any) => {
    const t = [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
  };
  const hex = (c: any) => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

  // Sfondo effettivo: pila dei background-color dagli antenati fino al primo opaco.
  function sfondo(el: Element): any | 'immagine' {
    const pila: any[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none' && !s.backgroundImage.startsWith('url(')) return 'immagine';
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { pila.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = pila.length - 1; i >= 0; i--) bg = sopra(pila[i], bg);
    return bg;
  }
  function opacitaCumulata(el: Element) {
    let o = 1;
    for (let n: Element | null = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || '1');
    return o;
  }
  const descrivi = (el: Element) => {
    const id = el.id ? '#' + el.id : '';
    const cls = Array.from(el.classList).filter(c => /^(text-|bg-|btn|card|form|cp-|modal|pill|badge|chip)/.test(c)).slice(0, 4).join('.');
    return el.tagName.toLowerCase() + id + (cls ? '.' + cls : '');
  };

  const radice = document.querySelector(radiceSel);
  if (!radice) return [];
  const out: Omit<Violazione, 'schermata'>[] = [];
  const contrasto = (a: any, b: any) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  if (modo === 'bordi') {
    // Il campo si riconosce dal bordo OPPURE dal fondo diverso dall'intorno: basta uno dei
    // due a 3:1. Un campo senza né bordo né fondo propri (la ricerca, bg-transparent) ha il
    // contorno sul contenitore: si misura quello, fino a due livelli sopra.
    const bordoVisibile = (st: CSSStyleDeclaration) => ['Top', 'Right', 'Bottom', 'Left']
      .filter(l => parseFloat((st as any)['border' + l + 'Width']) >= 1 && (st as any)['border' + l + 'Style'] !== 'none')
      .map(l => parse((st as any)['border' + l + 'Color'])).filter(c => c && c.a > 0);
    radice.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=range]), select, textarea').forEach((campo) => {
      if (!campo.getClientRects().length || (campo as HTMLInputElement).disabled) return;
      if (campo.closest('[aria-hidden="true"], .sr-only, .hidden-tab')) return;
      let el: Element = campo;
      for (let i = 0; i < 3 && el; i++) {
        const st = getComputedStyle(el);
        const proprio = parse(st.backgroundColor);
        if (bordoVisibile(st).length || (proprio && proprio.a > 0) || st.boxShadow !== 'none') break;
        el = el.parentElement!;
      }
      const st = getComputedStyle(el);
      const fuori = sfondo(el.parentElement!);
      if (fuori === 'immagine') return;
      const proprio = parse(st.backgroundColor);
      const dentro = proprio && proprio.a > 0 ? sopra(proprio, fuori) : fuori;
      const bordi = bordoVisibile(st).map(c => contrasto(sopra(c, fuori), fuori));
      const migliore = Math.max(contrasto(dentro, fuori), ...bordi, 0);
      if (migliore < 3) {
        const colBordo = bordoVisibile(st)[0];
        out.push({
          elemento: descrivi(campo) + (el !== campo ? ' (contenitore ' + descrivi(el) + ')' : ''),
          testo: (campo as HTMLInputElement).placeholder || campo.id || '',
          fg: colBordo ? hex(sopra(colBordo, fuori)) : hex(dentro), bg: hex(fuori),
          ratio: Math.round(migliore * 100) / 100, minimo: 3,
        });
      }
    });
    return out;
  }

  const candidati: { el: Element; testo: string; placeholder?: boolean }[] = [];
  const walker = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
  const visti = new Set<Element>();
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent!.trim();
    const el = walker.currentNode.parentElement;
    if (!t || !el || visti.has(el)) continue;
    visti.add(el);
    candidati.push({ el, testo: t });
  }
  radice.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
    const i = el as HTMLInputElement;
    if (!i.value) candidati.push({ el, testo: i.placeholder, placeholder: true });
  });

  for (const { el, testo, placeholder } of candidati) {
    if (!el.getClientRects().length) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || el.closest('[aria-hidden="true"], .sr-only')) continue;
    if ((el as HTMLButtonElement).disabled || el.closest(':disabled, [aria-disabled="true"]')) continue; // esenti (1.4.3)
    const bg = sfondo(el);
    if (bg === 'immagine') continue;
    const fgRaw = parse(placeholder ? getComputedStyle(el, '::placeholder').color : s.color);
    if (!fgRaw) continue;
    fgRaw.a *= opacitaCumulata(el);
    const fg = sopra(fgRaw, bg);
    const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const px = parseFloat(s.fontSize);
    const grande = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    if (ratio < minimo) {
      out.push({
        elemento: descrivi(el) + (placeholder ? '::placeholder' : ''),
        testo: testo.slice(0, 50), fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio * 100) / 100, minimo,
      });
    }
  }
  return out;
}

test.describe('Accessibilità: contrasto del testo', () => {
  test('7.1 — nessun testo sotto il minimo WCAG AA in nessuno dei quattro temi', async ({ page, userDataDir }) => {
    test.setTimeout(180_000);
    // Transizioni di colore azzerate: altrimenti dopo il cambio tema si misurano valori a metà.
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
      // Stati hover: la scansione a riposo non li vede, ed è lì che i remap per tema mancano
      // più facilmente (hover:bg-stone-100 in sidebar era quasi bianco nei temi scuri).
      // Il puntatore resta sull'elemento durante la scansione: page.evaluate non lo sposta.
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
        // Conferma distruttiva: l'unica superficie comune con .btn-danger.
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
    ];

    const risultati: Record<string, Violazione[]> = {};
    const bordi: (Violazione & { tema: string })[] = [];
    const anelli: string[] = [];
    for (const tema of TEMI) {
      await page.evaluate((t) => (window as any).applicaTema(t), tema);
      // Anello di focus (1.4.11): --color-primary contro ogni sfondo su cui può cadere.
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
        await page.waitForTimeout(150); // transizioni di colore (0.2s) concluse o quasi
        const v = await page.evaluate(scansiona, { radiceSel: s.radice, modo: 'testo' as const });
        lista.push(...v.map(x => ({ schermata: s.nome, ...x })));
        const b = await page.evaluate(scansiona, { radiceSel: s.radice, modo: 'bordi' as const });
        bordi.push(...b.map(x => ({ schermata: s.nome, tema, ...x })));
        if (s.chiudi) await s.chiudi();
        // Sotto carico il modale appena chiuso poteva essere ancora a schermo alla schermata
        // successiva: si aspetta che non ce ne sia più nessuno.
        await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay, .cp-box, #pannello-filtri'))
          .filter(m => m.getClientRects().length && !m.classList.contains('hidden-tab')).length)).toBe(0);
      }
      await openView(page, 'list');
      risultati[tema] = lista;
    }

    const dest = process.env.CONTRASTO_OUT;
    if (dest) fs.writeFileSync(dest, JSON.stringify(risultati, null, 2));
    for (const t of TEMI) console.log(`[contrasto] ${t}: ${risultati[t].length} violazioni`);

    // Un elenco leggibile nel messaggio d'errore vale più di un conteggio: dice subito
    // quale token del tema correggere.
    const righe = TEMI.flatMap(t => risultati[t].map(v =>
      `${t} · ${v.schermata} · ${v.elemento} «${v.testo}» ${v.fg} su ${v.bg} = ${v.ratio}:1 (min ${v.minimo})`));
    expect.soft([...new Set(righe)], 'testi sotto il contrasto minimo').toEqual([]);

    const righeBordi = bordi.map(v =>
      `${v.tema} · ${v.schermata} · ${v.elemento} «${v.testo}» ${v.fg} su ${v.bg} = ${v.ratio}:1 (min 3)`);
    expect.soft([...new Set(righeBordi)], 'campi il cui contorno non si distingue (1.4.11)').toEqual([]);
    expect.soft(anelli, 'anelli di focus poco visibili (1.4.11)').toEqual([]);
  });
});
