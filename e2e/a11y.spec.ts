import { test, expect } from './fixtures';
import { createLocalWorkspace, createFolder, seedItems } from './helpers';
import { preparaSchermateSecondarie } from './a11ySchermate';
import * as path from 'path';

test.use({ seedWorkspace: 'A11y' });

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

  test('5.3 — l overlay di accesso negato è un dialog bloccante con focus intrappolato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    await page.evaluate(() => (window as any).mostraErroreAccessoNegato('ospite@esempio.it'));
    const overlay = page.locator('#accesso-negato-overlay');
    const finestra = overlay.locator('.modal-window');
    await expect(overlay).toBeVisible();

    // Semantica applicata da a11yModal via MutationObserver: nessun codice dedicato.
    await expect(finestra).toHaveAttribute('role', 'dialog');
    await expect(finestra).toHaveAttribute('aria-modal', 'true');
    const titolo = await finestra.evaluate((el) =>
      document.getElementById(el.getAttribute('aria-labelledby') || '')?.textContent);
    expect(titolo).toContain('Accesso Negato');
    await expect.poll(() => page.evaluate(() =>
      document.getElementById('accesso-negato-overlay')!.contains(document.activeElement))).toBe(true);

    // Il Tab gira tra i due pulsanti e non raggiunge l'app sotto.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      const dentro = await page.evaluate(() =>
        document.getElementById('accesso-negato-overlay')!.contains(document.activeElement));
      expect(dentro, `Tab #${i + 1} è uscito dall'overlay`).toBe(true);
    }

    // Esc non deve lasciare l'utente davanti a un vault non autorizzato.
    await page.keyboard.press('Escape');
    await expect(overlay).toBeVisible();
  });

  test('5.6 — nessun controllo senza nome accessibile e nessuna icona letta dallo screen reader', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');
    const secondarie = await preparaSchermateSecondarie(page, electronApp, userDataDir);
    await page.evaluate(() => (window as any).renderMain());

    // Lucide mette aria-hidden sulle icone da sé (v1.x): il rischio vero è il bottone che
    // contiene SOLO un'icona e nessun nome, annunciato come "pulsante" e basta (4.1.2).
    const scansiona = () => page.evaluate(() => {
      const problemi: string[] = [];
      document.querySelectorAll('svg.lucide').forEach(s => {
        if (s.getClientRects().length && s.getAttribute('aria-hidden') !== 'true' && !s.closest('[aria-hidden="true"]')
            && !s.getAttribute('aria-label') && !s.closest('[role="img"]')) problemi.push('icona esposta: ' + s.outerHTML.slice(0, 80));
      });
      document.querySelectorAll('button, [role="button"], a[href]').forEach((b: any) => {
        if (!b.getClientRects().length || b.closest('[aria-hidden="true"]')) return;
        const nome = b.getAttribute('aria-label') || b.getAttribute('aria-labelledby') || b.getAttribute('title') || (b.innerText || '').trim();
        if (!nome) problemi.push('senza nome: ' + b.outerHTML.slice(0, 120).replace(/\s+/g, ' '));
      });
      return problemi;
    });

    const problemi: string[] = [];
    const raccogli = async (dove: string) => (await scansiona()).forEach(p => problemi.push(dove + ' · ' + p));
    await raccogli('lista');
    await page.evaluate(() => (window as any).cambiaVistaLista('tabella'));
    await raccogli('tabella');
    await page.evaluate(() => (window as any).switchTab('add'));
    await raccogli('form');
    for (const [dove, apri] of [
      ['impostazioni', 'apriImpostazioni'], ['cloud', 'apriCloudModal'], ['tag', 'apriGestioneTag'],
      ['nuovo-tipo', 'apriNewTypeModal'], ['cestino', 'apriCestino'],
    ] as const) {
      // Attese su condizioni e non a tempo: sotto il carico della suite completa il modale
      // precedente poteva essere ancora aperto e la scansione ne vedeva due sovrapposti.
      await page.evaluate((f) => (window as any)[f](), apri);
      await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay')).filter(m => m.getClientRects().length && !m.classList.contains('hidden-tab')).length)).toBe(1);
      await raccogli(dove);
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay')).filter(m => m.getClientRects().length && !m.classList.contains('hidden-tab')).length)).toBe(0);
    }
    for (const s of secondarie) {
      await s.apri();
      await raccogli(s.nome);
      await s.chiudi();
    }
    expect(problemi).toEqual([]);
  });

  test('5.7 — WCAG 3.2.2: scorrere i tipi con le frecce non cancella ciò che si è scritto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');

    // Form della scheda: su Windows ogni freccia su una <select> chiusa emette `change`.
    await page.evaluate(() => (window as any).switchTab('add'));
    const tipo = page.locator('#form-tipo-documento');
    const iniziale = await tipo.inputValue();
    const campo = page.locator('[id^="dyn-"][type=text]').first();
    const idCampo = (await campo.getAttribute('id'))!;
    await campo.fill('Ser Piero di Antonio');
    await tipo.focus();
    await page.keyboard.press('ArrowDown');
    expect(await tipo.inputValue()).not.toBe(iniziale);
    await page.keyboard.press('ArrowUp');
    expect(await tipo.inputValue()).toBe(iniziale);
    await expect(page.locator('#' + idCampo)).toHaveValue('Ser Piero di Antonio');
    await expect(tipo).toBeFocused();

    // La memoria vale per UNA compilazione: una scheda nuova riparte vuota.
    await page.evaluate(() => (window as any).resetForm?.());
    await page.evaluate(() => (window as any).switchTab('add'));
    if (await page.locator('#' + idCampo).count()) await expect(page.locator('#' + idCampo)).toHaveValue('');

    // Nuovo tipo: passare su un modello predefinito e tornare a "personalizzato" ritrova
    // nome e campi in costruzione.
    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#custom-type-name').fill('Registro dei battesimi');
    await page.locator('#custom-type-extra-input').fill('Padrino');
    await page.locator('#custom-type-extra-input').press('Enter');
    const modello = page.locator('#new-type-select');
    await modello.focus();
    await page.keyboard.press('ArrowDown');
    expect(await modello.inputValue()).not.toBe('custom');
    await modello.selectOption('custom');
    await expect(page.locator('#custom-type-name')).toHaveValue('Registro dei battesimi');
    await expect(page.locator('.custom-field-item[data-val="Padrino"]')).toHaveCount(1);
  });

  test('5.8 — WCAG 2.4.1: il primo Tab mostra lo skip link, Invio porta al contenuto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');
    const link = page.locator('.skip-link');

    // A riposo è fuori dallo schermo.
    expect((await link.boundingBox())!.y).toBeLessThan(0);

    await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.focus(); });
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(link).toBeInViewport();

    await page.keyboard.press('Enter');
    await expect(page.locator('#contenuto-principale')).toBeFocused();
    // Il Tab successivo prosegue DENTRO il contenuto, non torna all'intestazione.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.getElementById('contenuto-principale')!.contains(document.activeElement))).toBe(true);
  });

  test('5.9 — WCAG 2.5.8: nessun bersaglio sotto 24px senza lo spazio che lo compensa', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');
    const secondarie = await preparaSchermateSecondarie(page, electronApp, userDataDir);
    await seedItems(page, 3, { tagPrefix: 't' });
    await page.evaluate(() => (window as any).renderMain());

    // Regola del criterio: sotto 24×24 va bene solo se un cerchio da 24px centrato sul
    // bersaglio non tocca altri bersagli. Esclusi i link dentro il testo e i controlli
    // sr-only (il bersaglio vero è la loro etichetta visibile).
    const scansiona = (dove: string) => page.evaluate((dove) => {
      const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=menuitem], [tabindex]:not([tabindex="-1"])';
      const tutti = Array.from(document.querySelectorAll(sel))
        .filter((e: any) => e.getClientRects().length && !e.closest('[aria-hidden="true"], .hidden-tab, [inert]') && getComputedStyle(e).visibility !== 'hidden')
        // Un controllo dentro un <label> si attiva anche cliccando l'etichetta: il bersaglio
        // è l'etichetta intera (è anche la regola "label + controllo, un solo bersaglio").
        .map((e: any) => ({ e, r: (e.closest('label') || e).getBoundingClientRect() as DOMRect }))
        .filter(x => x.r.width > 1 && x.r.height > 1);
      const out: string[] = [];
      for (const t of tutti) {
        if (t.r.width >= 23.5 && t.r.height >= 23.5) continue;
        if (t.e.tagName === 'A' && getComputedStyle(t.e).display === 'inline') continue;
        const cx = t.r.left + t.r.width / 2, cy = t.r.top + t.r.height / 2;
        const tocca = tutti.some(o => {
          if (o === t || o.e.contains(t.e) || t.e.contains(o.e)) return false;
          if (o.r.width < 23.5 || o.r.height < 23.5) return Math.hypot(cx - (o.r.left + o.r.width / 2), cy - (o.r.top + o.r.height / 2)) < 24;
          const dx = Math.max(o.r.left - cx, 0, cx - o.r.right), dy = Math.max(o.r.top - cy, 0, cy - o.r.bottom);
          return Math.hypot(dx, dy) < 12;
        });
        if (tocca) out.push(dove + ' · ' + Math.round(t.r.width) + 'x' + Math.round(t.r.height) + ' ' + t.e.outerHTML.slice(0, 90).replace(/\s+/g, ' '));
      }
      return out;
    }, dove);

    const problemi: string[] = [];
    problemi.push(...await scansiona('lista'));
    await page.evaluate(() => (window as any).cambiaVistaLista('tabella'));
    problemi.push(...await scansiona('tabella'));
    await page.evaluate(() => (window as any).switchTab('add'));
    problemi.push(...await scansiona('form'));
    for (const [dove, apri] of [['impostazioni', 'apriImpostazioni'], ['tag', 'apriGestioneTag'], ['cloud', 'apriCloudModal']] as const) {
      await page.evaluate((f) => (window as any)[f](), apri);
      await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay')).filter(m => m.getClientRects().length && !m.classList.contains('hidden-tab')).length)).toBe(1);
      problemi.push(...await scansiona(dove));
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay')).filter(m => m.getClientRects().length && !m.classList.contains('hidden-tab')).length)).toBe(0);
    }
    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#new-type-select').selectOption('custom');
    await page.locator('#custom-type-extra-input').fill('Campo');
    await page.locator('#custom-type-extra-input').press('Enter');
    problemi.push(...await scansiona('nuovo-tipo'));
    await page.keyboard.press('Escape');
    for (const s of secondarie) {
      await s.apri();
      problemi.push(...await scansiona(s.nome));
      await s.chiudi();
    }
    expect(problemi).toEqual([]);
  });

  test('5.10 — ogni vista ha un solo h1 e i titoli non saltano livelli', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');
    // La sidebar precede <main> nel DOM, quindi il primo titolo del documento è un h2: è
    // una risalita di livello, permessa. Ciò che conta è un solo h1 visibile e nessun SALTO
    // in discesa (h2 → h4) dentro una stessa regione.
    const titoli = () => page.evaluate(() => {
      const dentro = (h: Element) => (h.closest('main') && 'main') || (h.closest('aside') && 'aside') || (h.closest('header') && 'header') || 'altro';
      return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .filter(h => h.getClientRects().length && !h.closest('[aria-hidden="true"], .hidden-tab, [inert]'))
        .map(h => ({ livello: Number(h.tagName[1]), regione: dentro(h), testo: (h.textContent || '').trim().slice(0, 30) }));
    });

    for (const vista of ['list', 'add'] as const) {
      await page.evaluate((v) => (window as any).switchTab(v), vista);
      const h = await titoli();
      expect(h.filter(x => x.livello === 1), `h1 visibili nella vista ${vista}: ${JSON.stringify(h)}`).toHaveLength(1);
      expect(h.find(x => x.regione === 'main')?.livello, `il primo titolo del contenuto in ${vista} non è l h1`).toBe(1);
      for (const regione of ['main', 'aside', 'header']) {
        const r = h.filter(x => x.regione === regione);
        for (let i = 1; i < r.length; i++) {
          expect(r[i].livello - r[i - 1].livello, `salto di livello prima di «${r[i].testo}» (${regione}, ${vista})`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test('5.11 — le segnature sono escluse dalla traduzione automatica (translate="no")', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');
    await seedItems(page, 3);
    await page.evaluate(() => (window as any).renderMain());

    // Un traduttore del browser riscriverebbe "Seed-001" o "Reg. 12 c. 4v" come testo
    // qualunque. Ogni nodo di testo che È una segnatura deve stare sotto un translate="no";
    // si misura sul DOM reale perché la sidebar passa da DOMPurify, che potrebbe toglierlo.
    const scoperte = () => page.evaluate(() => {
      const out: string[] = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode;
        const el = n.parentElement!;
        if (!/Seed-\d{3}/.test(n.textContent || '') || !el.getClientRects().length) continue;
        if (!el.closest('[translate="no"]')) out.push(el.tagName.toLowerCase() + '.' + Array.from(el.classList).slice(0, 3).join('.') + ' «' + n.textContent!.trim().slice(0, 30) + '»');
      }
      return out;
    });

    await expect(page.locator('.card-title', { hasText: 'Seed-000' })).toBeVisible();
    const problemi = (await scoperte()).map(p => 'griglia · ' + p);
    await page.evaluate(() => (window as any).cambiaVistaLista('tabella'));
    await expect(page.locator('td.cella-segnatura', { hasText: 'Seed-000' })).toBeVisible();
    problemi.push(...(await scoperte()).map(p => 'tabella · ' + p));
    expect(problemi).toEqual([]);
  });

  test('5.12 — WCAG 1.4.10: un nome di cartella lungo non fa scorrere la vista in orizzontale', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11y');
    // Senza spazi: è il caso in cui un figlio flex senza min-width:0 non si restringe più.
    const cartella = 'Fondo' + '_Notarile_Antecosimiano'.repeat(4);
    await createFolder(page, cartella);
    await seedItems(page, 2, { cartella });
    await page.evaluate((c) => { (window as any).cartellaAttuale = c; (window as any).renderMain(); }, cartella);
    await expect(page.locator('#titolo-cartella-attuale')).toContainText('Antecosimiano');

    const scorre = () => page.evaluate(() => {
      const m = document.querySelector('main')!;
      return m.scrollWidth - m.clientWidth;
    });
    expect(await scorre(), 'griglia: <main> più largo del suo spazio').toBeLessThanOrEqual(1);
    await page.evaluate(() => (window as any).cambiaVistaLista('tabella'));
    expect(await scorre(), 'tabella: <main> più largo del suo spazio').toBeLessThanOrEqual(1);
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
