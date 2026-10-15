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

    const btnLocale = page.locator('button[data-resolve-scelta="local"]').first();
    const btnCloud = page.locator('button[data-resolve-scelta="external"]').first();
    await expect(btnLocale).toHaveAttribute('aria-pressed', 'false');
    await expect(btnCloud).toHaveAttribute('aria-pressed', 'false');

    await btnLocale.click();
    await expect(btnLocale).toHaveAttribute('aria-pressed', 'true');
    await expect(btnCloud).toHaveAttribute('aria-pressed', 'false');

    for (const tema of ['light', 'dark', 'amber-light', 'blue-dark']) {
      // Il cambio di tema avvia transizioni di colore: anche a 0,01 ms (reduced motion) il primo
      // getComputedStyle può cadere prima del frame che le chiude e leggere il tema precedente.
      // Sotto il carico della suite completa succedeva. Si aspetta che finiscano.
      await page.evaluate(async (t) => {
        (window as any).applicaTema(t);
        await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
      }, tema);
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

  // Audit front-end P1-2: la card era role="button" con un <button> dentro (controllo annidato,
  // due pulsanti annunciati per la stessa scelta). Ora il controllo è solo il pulsante, e dopo
  // la scelta il fuoco resta lì invece di cadere sul body col re-render.
  test('accessibilità da tastiera: la scelta si fa col pulsante, senza controlli annidati, e il fuoco resta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    const annidati = await page.evaluate(() => Array.from(
      document.querySelectorAll('#merge-conflict-modal [role="button"], #merge-conflict-modal [tabindex]'))
      .filter(el => el.querySelector('button, a[href], input, select, textarea, [tabindex]')).length);
    expect(annidati).toBe(0);

    await page.locator('button[data-resolve-scelta="local"]').first().focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#btn-resolve-all')).toBeEnabled();
    await expect.poll(() => page.evaluate(() =>
      (document.activeElement as HTMLElement)?.getAttribute('data-resolve-scelta'))).toBe('local');

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

  // Audit sync S1: chiudere un modale di risoluzione lasciava partire l'upload del DB locale non
  // fuso, che sovrascriveva su Drive tutte le modifiche dei colleghi.
  for (const avvio of ['sincronizzaGoogleDrive', 'caricaSulCloud']) {
    for (const caso of ['conflitti', 'cancellazioni']) {
      test(`${avvio}: annullare il modale delle ${caso} non carica nulla su Drive`, async ({ page, userDataDir }) => {
        await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');

        await page.evaluate(({ avvio, caso }) => {
          const w = window as any;
          const locale = { id: 'ann-1', segnatura: 'Locale', cartella: '', lastModified: 1000 };
          const remoto = caso === 'conflitti'
            ? { manoscritti: [{ ...locale, segnatura: 'Remoto' }], cartelle: [] }
            // Una cartella nuova dal remoto: annullando non deve entrare nell'archivio (prima
            // la struttura si fondeva subito, prima della domanda sulle cancellazioni).
            : { manoscritti: [], cartelle: ['Remota'], deletedIds: ['ann-1'] };
          w.appData.manoscritti = [locale];
          w.appData.baseObjects = {};
          w.appData.baseHashes = {};
          w.hubConfig = null;
          w.hasFetchedBeforeDownload = true;
          w.__e2eSync = 0;
          w.getApiCloud = async () => ({
            pull: async () => ({ database: remoto, driveModifiedTime: 5000 }),
            sync: async () => { w.__e2eSync++; return 6000; },
            syncAttachments: async () => {}
          });
          w.__e2eFine = w[avvio](false);
        }, { avvio, caso });

        const modale = caso === 'conflitti' ? '#merge-conflict-modal' : '#deletion-conflict-modal';
        const annulla = caso === 'conflitti' ? 'annullaSincronizzazioneConflitto' : 'annullaSincronizzazioneDeletions';
        await expect(page.locator(modale)).toBeVisible();
        await page.locator(`${modale} button[data-on-click="${annulla}"]`).click();
        await expect(page.locator(modale)).toBeHidden();

        const esito = await page.evaluate(async () => {
          const w = window as any;
          await w.__e2eFine;
          return {
            sync: w.__e2eSync,
            segnatura: w.appData.manoscritti.find((m: any) => m.id === 'ann-1')?.segnatura,
            cartelle: w.appData.cartelle
          };
        });
        expect(esito.sync).toBe(0);
        expect(esito.segnatura).toBe('Locale');
        expect(esito.cartelle).not.toContain('Remota');
      });
    }
  }

  for (const avvio of ['sincronizzaGoogleDrive', 'caricaSulCloud']) {
    test(`${avvio}: senza conflitti fonde, carica una volta e prende l'ora del server`, async ({ page, userDataDir }) => {
      await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');

      const esito = await page.evaluate(async (avvio) => {
        const w = window as any;
        w.appData.manoscritti = [{ id: 'ok-1', segnatura: 'Locale', cartella: '', lastModified: 1000 }];
        w.appData.baseObjects = {};
        w.appData.baseHashes = {};
        w.hubConfig = null;
        let sync = 0, parent: any = null;
        w.getApiCloud = async () => ({
          pull: async () => ({ database: { manoscritti: [{ id: 'ok-2', segnatura: 'Collega', cartella: '', lastModified: 2000 }], cartelle: [] }, driveModifiedTime: 5000 }),
          sync: async (p: number) => { sync++; parent = p; return 6000; },
          syncAttachments: async () => {}
        });
        await w[avvio](true);
        return { sync, parent, ultimo: w.ultimoCaricamento, ids: w.appData.manoscritti.map((m: any) => m.id).sort() };
      }, avvio);

      expect(esito).toEqual({ sync: 1, parent: 5000, ultimo: 6000, ids: ['ok-1', 'ok-2'] });
    });
  }

  // Audit sync S2/S10: il merge proprio dell'Hub scartava le schede remote più vecchie
  // dell'ultimo pull e ignorava vocabolari e authority; il push successivo li cancellava dal server.
  // contextBridge congela apiBrowser: l'Hub si simula sugli handler IPC del main.
  const simulaHub = (electronApp: any, database: any) => electronApp.evaluate(({ ipcMain }: any, database: any) => {
    const g = globalThis as any;
    const h: Record<string, (...a: any[]) => any> = {
      'hub-pull': () => ({ ok: true, data: { version: 4, database } }),
      'hub-push': (_e: any, _p: number, db: any) => { g.__e2eHubPushed = db; return { ok: true, data: { version: 5 } }; },
      'save-hub-config': () => true,
      'hub-sync-attachments': () => ({ ok: true })
    };
    for (const [c, fn] of Object.entries(h)) { ipcMain.removeHandler(c); ipcMain.handle(c, fn); }
  }, database);

  test('Hub: ricevere conserva schede vecchie e vocabolari dei colleghi, e l\'invio li rimanda', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await simulaHub(electronApp, {
      manoscritti: [{ id: 'hub-2', segnatura: 'Collega', cartella: '', lastModified: 2000 }],
      cartelle: [],
      vocabolari: { 'voc-x': { id: 'voc-x', nome: 'Materiali', valori: ['pergamena'], modificato: 2000 } }
    });

    const esito = await page.evaluate(async () => {
      const w = window as any;
      w.appData.manoscritti = [{ id: 'hub-1', segnatura: 'Mia', cartella: '', lastModified: 1000 }];
      w.appData.baseObjects = {};
      w.appData.baseHashes = {};
      w.hubConfig = { version: 3, lastLoadedAt: 9000 };
      await w.riceviModificheHub(false);
      const dopo = { ids: w.appData.manoscritti.map((m: any) => m.id).sort(), voc: !!w.appData.vocabolari?.['voc-x'], version: w.hubConfig.version };
      await w.inviaModificheHub();
      return dopo;
    });
    const pushed: any = await electronApp.evaluate(() => (globalThis as any).__e2eHubPushed);

    expect(esito).toEqual({ ids: ['hub-1', 'hub-2'], voc: true, version: 4 });
    expect(pushed.manoscritti.map((m: any) => m.id).sort()).toEqual(['hub-1', 'hub-2']);
    expect(pushed.vocabolari['voc-x'].valori).toEqual(['pergamena']);
  });

  // Audit A6: il ripristino di una versione Hub segue le regole del ripristino locale
  // (`ripristinaDatabase`): schede rifirmate e tombstone per quelle nate dopo, o il merge dei
  // colleghi le terrebbe com'erano.
  test('Hub: ripristinare una versione rifirma le schede e mette i tombstone', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await electronApp.evaluate(({ ipcMain }: any) => {
      const g = globalThis as any;
      const h: Record<string, (...a: any[]) => any> = {
        'hub-pull': () => ({ ok: true, data: { version: 3, unchanged: true } }),
        'hub-version': () => ({ ok: true, data: { version: 2, database: {
          manoscritti: [{ id: 'v-1', segnatura: 'Vecchia', cartella: '', lastModified: 1000 }], cartelle: [] } } }),
        'hub-push': (_e: any, _p: number, db: any) => { g.__e2eHubPushed = db; return { ok: true, data: { version: 4 } }; },
        'save-hub-config': () => true
      };
      for (const [c, fn] of Object.entries(h)) { ipcMain.removeHandler(c); ipcMain.handle(c, fn); }
    });

    const ok = await page.evaluate(async () => {
      const w = window as any;
      w.appData.manoscritti = [
        { id: 'v-1', segnatura: 'Nuova', cartella: '', lastModified: 3000 },
        { id: 'v-2', segnatura: 'Creata dopo', cartella: '', lastModified: 3000 }
      ];
      w.hubConfig = { version: 3, lastLoadedAt: 0 };
      return w.ripristinaVersioneHub(2);
    });
    const pushed: any = await electronApp.evaluate(() => (globalThis as any).__e2eHubPushed);

    expect(ok).toBe(true);
    expect(pushed.manoscritti.map((m: any) => [m.id, m.segnatura])).toEqual([['v-1', 'Vecchia']]);
    expect(pushed.manoscritti[0].lastModified).toBeGreaterThan(3000);
    expect(pushed.deletedIds).toContain('v-2');
  });

  // Prova manuale M3.10 (Hub locale, 12/10): dopo un invio riuscito la base non si aggiornava.
  // Una scheda creata e inviata da me, poi modificata, alla ricezione successiva era "senza
  // base" e ogni differenza dal server diventava un conflitto sulla MIA scheda.
  test('Hub: una scheda inviata e poi modificata non diventa un conflitto alla ricezione', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await electronApp.evaluate(({ ipcMain }: any) => {
      const g = globalThis as any;
      g.__e2eHub = { version: 3, database: { manoscritti: [], cartelle: [] } };
      const h: Record<string, (...a: any[]) => any> = {
        'hub-pull': () => ({ ok: true, data: structuredClone(g.__e2eHub) }),
        'hub-push': (_e: any, p: number, db: any) => {
          if (p !== g.__e2eHub.version) return { ok: false, status: 409 };
          g.__e2eHub = { version: p + 1, database: structuredClone(db) };
          return { ok: true, data: { version: p + 1 } };
        },
        'save-hub-config': () => true,
        'hub-sync-attachments': () => ({ ok: true })
      };
      for (const [c, fn] of Object.entries(h)) { ipcMain.removeHandler(c); ipcMain.handle(c, fn); }
    });

    await page.evaluate(async () => {
      const w = window as any;
      w.appData.manoscritti = [{ id: 'mia', segnatura: 'Mia', cartella: '', lastModified: 1000 }];
      w.appData.baseObjects = {};
      w.appData.baseHashes = {};
      w.hubConfig = { version: 3, lastLoadedAt: 0 };
      await w.inviaModificheHub();
      w.appData.manoscritti[0] = { ...w.appData.manoscritti[0], titolo: 'Dopo l\'invio', lastModified: 2000 };
    });
    // Un collega aggiunge una scheda sopra la mia versione.
    await electronApp.evaluate(() => {
      const g = globalThis as any;
      g.__e2eHub.database.manoscritti.push({ id: 'coll', segnatura: 'Collega', cartella: '', lastModified: 3000 });
      g.__e2eHub.version++;
    });
    await page.evaluate(() => { (window as any).__e2eFine = (window as any).riceviModificheHub(false); });
    await page.waitForTimeout(500);
    await expect(page.locator('#merge-conflict-modal')).toBeHidden();
    const esito = await page.evaluate(async () => {
      const w = window as any;
      await w.__e2eFine;
      return w.appData.manoscritti.map((m: any) => [m.id, m.titolo || '']).sort();
    });
    expect(esito).toEqual([['coll', ''], ['mia', 'Dopo l\'invio']]);
  });

  test('Drive: una scheda caricata e poi modificata non diventa un conflitto alla sync successiva', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await page.evaluate(async () => {
      const w = window as any;
      w.appData.manoscritti = [{ id: 'mia', segnatura: 'Mia', cartella: '', lastModified: 1000 }];
      w.appData.baseObjects = {};
      w.appData.baseHashes = {};
      w.hubConfig = null;
      w.hasFetchedBeforeDownload = true;
      // Il main carica il DB dal disco: qui basta lo stato in memoria al momento del caricamento.
      w.__e2eDrive = { manoscritti: [], cartelle: [] };
      w.getApiCloud = async () => ({
        pull: async () => ({ database: structuredClone(w.__e2eDrive), driveModifiedTime: 5000 }),
        sync: async () => { w.__e2eDrive = { manoscritti: structuredClone(w.appData.manoscritti), cartelle: [] }; return 6000; },
        syncAttachments: async () => {}
      });
      await w.caricaSulCloud(true);
      w.appData.manoscritti[0] = { ...w.appData.manoscritti[0], titolo: 'Dopo il caricamento', lastModified: 7000 };
      w.__e2eDrive.manoscritti.push({ id: 'coll', segnatura: 'Collega', cartella: '', lastModified: 8000 });
      w.__e2eFine = w.sincronizzaGoogleDrive(true);
    });
    await page.waitForTimeout(500);
    await expect(page.locator('#merge-conflict-modal')).toBeHidden();
    const esito = await page.evaluate(async () => {
      const w = window as any;
      await w.__e2eFine;
      return w.appData.manoscritti.map((m: any) => [m.id, m.titolo || '']).sort();
    });
    expect(esito).toEqual([['coll', ''], ['mia', 'Dopo il caricamento']]);
  });

  test('Hub: annullare il modale dei conflitti non tocca la versione né i dati', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await simulaHub(electronApp, { manoscritti: [{ id: 'hc-1', segnatura: 'Remoto', cartella: '', lastModified: 1000 }], cartelle: [] });

    await page.evaluate(() => {
      const w = window as any;
      w.appData.manoscritti = [{ id: 'hc-1', segnatura: 'Locale', cartella: '', lastModified: 1000 }];
      w.appData.baseObjects = {};
      w.appData.baseHashes = {};
      w.hubConfig = { version: 3, lastLoadedAt: 0 };
      w.__e2eFine = w.riceviModificheHub(false);
    });

    await expect(page.locator('#merge-conflict-modal')).toBeVisible();
    await page.locator('#merge-conflict-modal button[data-on-click="annullaSincronizzazioneConflitto"]').click();
    const esito = await page.evaluate(async () => {
      const w = window as any;
      await w.__e2eFine;
      return { version: w.hubConfig.version, segnatura: w.appData.manoscritti[0].segnatura };
    });
    expect(esito).toEqual({ version: 3, segnatura: 'Locale' });
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
