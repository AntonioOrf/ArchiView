import { test, expect } from './fixtures';
import { createLocalWorkspace, injectConflict } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Merge' });

test.describe('Conflitti di merge (dati iniettati)', () => {
  test('rilevaConflitti individua un conflitto 3-way sul campo modificato da entrambi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');

    const conflitti = await page.evaluate(() => {
      const w = window as any;
      const base = { id: '1', segnatura: 'Base', cartella: '' };
      const baseHash = w.getRecordHash(base);
      const local = { ...base, segnatura: 'Locale' };
      const external = { ...base, segnatura: 'Esterno' };
      return w.rilevaConflitti([local], [external], 0, { '1': baseHash });
    });

    expect(conflitti).toHaveLength(1);
    expect(conflitti[0].campiConflitto).toContain('segnatura');
  });

  test('rilevaConflitti non segnala nulla se le versioni sono identiche', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');

    const conflitti = await page.evaluate(() => {
      const w = window as any;
      const record = { id: '1', segnatura: 'Uguale', cartella: '' };
      const baseHash = w.getRecordHash(record);
      return w.rilevaConflitti([record], [record], 0, { '1': baseHash });
    });

    expect(conflitti).toHaveLength(0);
  });

  test('apriMergeConflictModal mostra la lista e il dettaglio del conflitto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    // Il campo in conflitto di default è proprio "segnatura": la card in lista
    // mostra il valore locale (quello con cui la risoluzione parte precompilata).
    await expect(page.locator('#conflict-list')).toContainText('Valore Locale');
    await expect(page.locator('#conflict-detail')).toContainText('Valore Locale');
    await expect(page.locator('#conflict-detail')).toContainText('Valore Cloud');
    await expect(page.locator('#btn-resolve-all')).toBeDisabled();
  });

  test('risolvere un singolo campo abilita via via il conteggio, e Applica risoluzione chiude il modal', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    await page.locator('button[data-resolve-scelta="local"]').first().click();
    await expect(page.locator('#btn-resolve-all')).toBeEnabled();

    await page.locator('#btn-resolve-all').click();
    await expect(page.locator('#merge-conflict-modal')).toBeHidden();

    const resolved = await page.evaluate(() => (window as any).__e2eResolved);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].segnatura).toBe('Valore Locale');
  });

  test('scegliere la versione cloud produce la risoluzione con il valore esterno', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    await page.locator('button[data-resolve-scelta="external"]').first().click();
    await page.locator('#btn-resolve-all').click();

    const resolved = await page.evaluate(() => (window as any).__e2eResolved);
    expect(resolved[0].segnatura).toBe('Valore Cloud');
  });

  test('annullare la sincronizzazione chiude il modal e segnala l\'annullamento alla callback', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    await page.evaluate(() => (window as any).annullaSincronizzazioneConflitto());
    await expect(page.locator('#merge-conflict-modal')).toBeHidden();

    const resolved = await page.evaluate(() => (window as any).__e2eResolved);
    expect(resolved).toBeNull();
  });

  test('cliccare direttamente sulla SCHEDA (card intera, non solo il bottone) seleziona la scelta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    // Clic sul corpo della scheda locale (div[data-resolve-card]) e NON sul button
    const cardLocale = page.locator('div[data-resolve-card="true"][data-resolve-scelta="local"]').first();
    await expect(cardLocale).toBeVisible();
    await cardLocale.click();

    await expect(page.locator('#btn-resolve-all')).toBeEnabled();

    // Clic sul corpo della scheda cloud per cambiare scelta
    const cardCloud = page.locator('div[data-resolve-card="true"][data-resolve-scelta="external"]').first();
    await expect(cardCloud).toBeVisible();
    await cardCloud.click();

    await page.locator('#btn-resolve-all').click();
    await expect(page.locator('#merge-conflict-modal')).toBeHidden();

    const resolved = await page.evaluate(() => (window as any).__e2eResolved);
    expect(resolved[0].segnatura).toBe('Valore Cloud');
  });

  // Audit front-end P1-1: il pulsante "scelto" portava bg-amber-500/text-white, ma .btn-secondary
  // (style.css, fuori da @layer) vince sulle utility v4 e lo rendeva identico all'altro.
  test('la scelta fatta si vede in ogni tema e si annuncia con aria-pressed', async ({ page, userDataDir }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    const cardLocale = page.locator('div[data-resolve-card="true"][data-resolve-scelta="local"]').first();
    const cardCloud = page.locator('div[data-resolve-card="true"][data-resolve-scelta="external"]').first();
    await expect(cardLocale).toHaveAttribute('aria-pressed', 'false');
    await expect(cardCloud).toHaveAttribute('aria-pressed', 'false');

    await page.locator('button[data-resolve-scelta="local"]').first().click();
    await expect(cardLocale).toHaveAttribute('aria-pressed', 'true');
    await expect(cardCloud).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('button[data-resolve-scelta="local"]').first()).toHaveAttribute('aria-pressed', 'true');

    for (const tema of ['light', 'dark', 'amber-light', 'blue-dark']) {
      await page.evaluate((t) => (window as any).applicaTema(t), tema);
      const m = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
        const rgb = (c: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data); };
        const lum = (c: number[]) => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const scelto = document.querySelector('button[data-resolve-scelta="local"]')!;
        const altro = document.querySelector('button[data-resolve-scelta="external"]')!;
        const s = getComputedStyle(scelto), a = getComputedStyle(altro);
        return {
          diversi: s.backgroundColor !== a.backgroundColor,
          testo: ratio(rgb(s.color), rgb(s.backgroundColor)),
          // il pulsante scelto deve staccarsi da quello non scelto (1.4.11: 3:1)
          stacco: ratio(rgb(s.backgroundColor), rgb(a.backgroundColor)),
        };
      });
      expect(m.diversi, `${tema}: pulsante scelto identico all'altro`).toBe(true);
      expect(m.testo, `${tema}: testo del pulsante scelto`).toBeGreaterThanOrEqual(4.5);
      expect(m.stacco, `${tema}: stacco scelto/non scelto`).toBeGreaterThanOrEqual(3);
    }
  });

  test('accessibilità da tastiera: Enter o Spazio sulla scheda attiva la selezione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    const cardLocale = page.locator('div[data-resolve-card="true"][data-resolve-scelta="local"]').first();
    await cardLocale.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#btn-resolve-all')).toBeEnabled();

    await page.locator('#btn-resolve-all').click();
    const resolved = await page.evaluate(() => (window as any).__e2eResolved);
    expect(resolved[0].segnatura).toBe('Valore Locale');
  });

  test('deletionConflictModal: i pulsanti Mantieni ed Elimina sono cliccabili ed abilitano la conferma', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');

    await page.evaluate(() => {
      const w = window as any;
      w.__e2eDeletionsResolved = undefined;
      const fakeDeletions = [
        { id: 'del-1', segnatura: 'Doc Da Eliminare 1' },
        { id: 'del-2', segnatura: 'Doc Da Eliminare 2' }
      ];
      w.apriDeletionConflictModal(fakeDeletions, (res: any) => {
        w.__e2eDeletionsResolved = res;
      });
    });

    await expect(page.locator('#deletion-conflict-modal')).toBeVisible();
    await expect(page.locator('#btn-resolve-deletions')).toBeDisabled();

    // Clicca Mantieni sul primo e Elimina sul secondo
    const btnMantieni = page.locator('button[data-deletion-id="del-1"][data-deletion-action="keep"]');
    const btnElimina = page.locator('button[data-deletion-id="del-2"][data-deletion-action="delete"]');

    await expect(btnMantieni).toBeVisible();
    await expect(btnElimina).toBeVisible();

    await btnMantieni.click();
    await expect(page.locator('#btn-resolve-deletions')).toBeDisabled(); // Ancora 1 pendente

    await btnElimina.click();
    await expect(page.locator('#btn-resolve-deletions')).toBeEnabled(); // Tutti risolti!

    await page.locator('#btn-resolve-deletions').click();
    await expect(page.locator('#deletion-conflict-modal')).toBeHidden();

    const res = await page.evaluate(() => (window as any).__e2eDeletionsResolved);
    expect(res).toEqual({ 'del-1': 'keep', 'del-2': 'delete' });
  });

  test('salvaguardia dati locali: allegati e trascrizioni locali sollevano conflitto e preservano i dati nel merge', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');

    await page.evaluate(() => {
      const w = window as any;
      const localCard = {
        id: 'test-safe-1',
        segnatura: 'Doc Protetto',
        trascrizione: '<p>Trascrizione preziosa</p>',
        allegati: [{ nome: 'foto.jpg', hash: 'abc' }],
        lastModified: 1000
      };
      w.appData.manoscritti = [localCard];
      w.appData.baseHashes = {};
      w.appData.baseObjects = {};

      const externalCard = {
        id: 'test-safe-1',
        segnatura: 'Doc Protetto',
        trascrizione: '',
        allegati: [],
        lastModified: 2000
      };

      // Avvia la sincronizzazione in background
      w.sincronizzaEUnisciDati({
        manoscritti: [externalCard],
        cartelle: []
      });
    });

    // Il conflitto viene rilevato e il modale si apre per chiedere all'utente invece di sovrascrivere alla cieca!
    await expect(page.locator('#merge-conflict-modal')).toBeVisible();

    // Clicca sulla scheda locale per ciascun campo in conflitto per mantenere il lavoro locale
    const cardsLocale = page.locator('div[data-resolve-card="true"][data-resolve-scelta="local"]');
    const count = await cardsLocale.count();
    for (let i = 0; i < count; i++) {
      await cardsLocale.nth(i).click();
    }

    // Applica risoluzione
    await expect(page.locator('#btn-resolve-all')).toBeEnabled();
    await page.locator('#btn-resolve-all').click();
    await expect(page.locator('#merge-conflict-modal')).toBeHidden();

    // Verifica che i dati locali siano preservati intatti
    const merged = await page.evaluate(() => {
      const w = window as any;
      return w.appData.manoscritti.find((m: any) => m.id === 'test-safe-1');
    });

    expect(merged.allegati).toHaveLength(1);
    expect(merged.trascrizione).toContain('Trascrizione preziosa');
  });

  test('caricamento fallito dopo la sync: alla sync successiva con remoto invariato le modifiche locali restano', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');

    const esito = await page.evaluate(async () => {
      const w = window as any;
      const remoto = { id: 'upl-1', segnatura: 'Originale', cartella: '', lastModified: 1000 };
      w.appData.manoscritti = [{ ...remoto, segnatura: 'Modifica locale', lastModified: 3000 }];
      w.appData.baseObjects = { 'upl-1': { ...remoto } };
      w.appData.baseHashes = { 'upl-1': w.getRecordHash(remoto) };

      // Sync 1: la base viene salvata, il caricamento sul server NON avviene
      // (sincronizzaEUnisciDati non carica: simula offline / upload fallito).
      await w.sincronizzaEUnisciDati({ manoscritti: [{ ...remoto }], cartelle: [] });
      const dopoPrima = w.appData.manoscritti.find((m: any) => m.id === 'upl-1').segnatura;
      const base = w.appData.baseObjects['upl-1'].segnatura;

      // Sync 2: il remoto è rimasto quello di prima.
      await w.sincronizzaEUnisciDati({ manoscritti: [{ ...remoto }], cartelle: [] });
      const dopoSeconda = w.appData.manoscritti.find((m: any) => m.id === 'upl-1').segnatura;
      return { dopoPrima, base, dopoSeconda };
    });

    await expect(page.locator('#merge-conflict-modal')).toBeHidden();
    expect(esito.dopoPrima).toBe('Modifica locale');
    // La base è la versione remota, non lo stato fuso
    expect(esito.base).toBe('Originale');
    expect(esito.dopoSeconda).toBe('Modifica locale');
  });
});
