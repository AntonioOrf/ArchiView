import { test, expect } from './fixtures';
import { createLocalWorkspace, dismissOverlays } from './helpers';
import * as path from 'path';

/**
 * Semina schede con proprietà CONTROLLATE per i filtri della Fase 1.3.
 * `seedItems` di helpers.ts non basta: genera record tutti uguali, cioè un seme su cui
 * un filtro inerte passerebbe lo stesso. Ogni test qui semina almeno una scheda-esca
 * che NON deve corrispondere, così l'asserzione sul conteggio distingue davvero il
 * filtro attivo dal filtro assente.
 */
type Riga = {
  segnatura: string;
  cartella?: string;
  tipoDocumento?: string;
  allegati?: any[];
  trascrizione?: string;
  lastModified?: number;
  tags?: string;
  extra?: Record<string, any>;
};

async function seed(page, righe: Riga[]) {
  await page.evaluate(async (righe) => {
    // @ts-ignore -- `appData` è una `let` globale (script classico), non window.appData.
    const data = appData;
    for (const r of righe) {
      data.manoscritti.push(
        Object.assign(
          {
            id: crypto.randomUUID(),
            cartella: r.cartella ?? '',
            tipoDocumento: r.tipoDocumento || 'manoscritto',
            segnatura: r.segnatura,
            titolo: '',
            tags: r.tags || '',
            allegati: r.allegati || [],
            trascrizione: r.trascrizione || '',
            lastModified: r.lastModified ?? Date.now(),
            creatoDa: 'Anonimo',
            modificatoDa: 'Anonimo',
          },
          r.extra || {}
        )
      );
      if (r.cartella && !data.cartelle.includes(r.cartella)) data.cartelle.push(r.cartella);
    }
    await (window as any).Store.commit();
  }, righe);
}

/** Segnature effettivamente renderizzate, griglia o tabella che sia. */
async function segnature(page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.card-scheda')).map((el) => {
      const cella = el.querySelector('.cella-segnatura, .card-title');
      return (cella ? cella.textContent : '').replace(/^[●○]\s*/, '').trim();
    })
  );
}

async function cerca(page, testo: string) {
  // Il campo di ricerca vive in un pannello della sidebar: se il pannello attivo è un
  // altro, l'input esiste ma non è raggiungibile. `apriSidebarTab` e NON l'helper
  // `openSidebarPanel`: quello passa da `switchSidebarTab`, che è un TOGGLE, e alla
  // seconda ricerca dello stesso test richiuderebbe il pannello appena aperto.
  await page.evaluate(() => (window as any).apriSidebarTab('search'));
  await expect(page.locator('#sidebar-search')).toBeVisible();
  await page.locator('#search-input').fill(testo);
  // Il render della ricerca è debounced a 150 ms.
  await page.waitForTimeout(300);
}

test.describe('Filtri avanzati e ricerche salvate', () => {
  test('la barra azioni sta su una riga sola nella vista a schede', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [{ segnatura: 'MS 1' }]);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Una riga sola = la barra è alta quanto il suo figlio più alto. Confrontare le
    // altezze e non i `top` dei figli: `items-center` li allinea a 1-2px di scarto, e un
    // confronto esatto fallirebbe su una barra che sta perfettamente su una riga.
    const misura = async () => page.evaluate(() => {
      const barra = document.getElementById('context-actions')!;
      const figli = Array.from(barra.children) as HTMLElement[];
      return {
        barra: Math.round(barra.getBoundingClientRect().height),
        figlioPiuAlto: Math.round(Math.max(...figli.map(e => e.getBoundingClientRect().height))),
      };
    });

    let m = await misura();
    expect(m.barra).toBe(m.figlioPiuAlto);

    // Regge anche su una finestra da portatile stretto: è la larghezza a cui la barra
    // andava a capo prima che "Filtri" perdesse l'etichetta e il cestino finisse nel "⋯".
    await page.setViewportSize({ width: 1100, height: 800 });
    m = await misura();
    expect(m.barra).toBe(m.figlioPiuAlto);

    // "Filtri" resta un'icona sola, ma con un nome accessibile: senza, per uno screen
    // reader il pulsante sarebbe muto.
    await expect(page.locator('#btn-filtri')).toHaveAttribute('aria-label', /Filtri|Filters/);
  });

  test('il pannello si apre dal pulsante Filtri e si chiude con Esc', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [{ segnatura: 'MS 1' }]);

    await expect(page.locator('#pannello-filtri')).toHaveCount(0);
    await page.locator('#btn-filtri').click();

    const pannello = page.locator('#pannello-filtri');
    await expect(pannello).toBeVisible();
    await expect(page.locator('#btn-filtri')).toHaveAttribute('aria-expanded', 'true');
    // I cinque controlli devono essere davvero raggiungibili, non solo presenti nel DOM:
    // è la trappola già vista con il viewport delle immagini (un contenitore che ritaglia).
    for (const id of ['#filtro-tipo', '#filtro-sottocartelle', '#filtro-da-data', '#filtro-a-data', '#filtro-allegati', '#filtro-trascrizione']) {
      await expect(pannello.locator(id)).toBeVisible();
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('#pannello-filtri')).toHaveCount(0);
    await expect(page.locator('#btn-filtri')).toHaveAttribute('aria-expanded', 'false');
  });

  test('filtro "con allegati": esclude le schede senza', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [
      { segnatura: 'CON', allegati: [{ nome: 'a.jpg', tipo: 'image/jpeg' }] },
      { segnatura: 'SENZA' }, // esca
    ]);
    await expect.poll(() => segnature(page)).toEqual(['CON', 'SENZA']);

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-allegati').selectOption('si');

    await expect.poll(() => segnature(page)).toEqual(['CON']);

    await page.locator('#filtro-allegati').selectOption('no');
    await expect.poll(() => segnature(page)).toEqual(['SENZA']);
  });

  test('filtro "con trascrizione": il markup vuoto non conta come trascritto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [
      { segnatura: 'TRASCRITTA', trascrizione: '<p>In nomine Domini</p>' },
      // Esca: aperta in trascrizione e richiusa senza scrivere nulla. Senza lo strip
      // dei tag risulterebbe trascritta come la prima.
      { segnatura: 'VUOTA', trascrizione: '<p><br></p>' },
    ]);

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-trascrizione').selectOption('si');

    await expect.poll(() => segnature(page)).toEqual(['TRASCRITTA']);
  });

  test('filtro per tipo documento', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    const tipi = await page.evaluate(() =>
      // @ts-ignore
      appData.tipiDocumento.map((t: any) => t.id)
    );
    expect(tipi.length).toBeGreaterThan(1);

    await seed(page, [
      { segnatura: 'PRIMO', tipoDocumento: tipi[0] },
      { segnatura: 'SECONDO', tipoDocumento: tipi[1] }, // esca
    ]);

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-tipo').selectOption(tipi[0]);

    await expect.poll(() => segnature(page)).toEqual(['PRIMO']);
  });

  test('intervallo di data modifica, inclusivo sugli estremi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [
      { segnatura: 'DENTRO', lastModified: Date.parse('2026-03-10T12:00:00') },
      { segnatura: 'PRIMA', lastModified: Date.parse('2026-01-01T12:00:00') }, // esca
      { segnatura: 'DOPO', lastModified: Date.parse('2026-06-01T12:00:00') }, // esca
    ]);

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-da-data').fill('2026-03-10');
    await page.locator('#filtro-a-data').fill('2026-03-10');
    // `fill` su input[type=date] non emette sempre `change` da solo.
    await page.locator('#filtro-a-data').dispatchEvent('change');
    await page.locator('#filtro-da-data').dispatchEvent('change');

    await expect.poll(() => segnature(page)).toEqual(['DENTRO']);
  });

  test('"includi sottoarchivi" allarga la cartella al suo ramo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [
      { segnatura: 'PADRE', cartella: 'Notarile' },
      { segnatura: 'FIGLIA', cartella: 'Notarile/Imbreviature' },
      // Esca: prefisso simile ma ramo diverso, non deve entrare.
      { segnatura: 'ALTRO', cartella: 'Notarile2' },
    ]);
    await page.evaluate(() => {
      (window as any).cartellaAttuale = 'Notarile';
      (window as any).renderMain();
    });

    await expect.poll(() => segnature(page)).toEqual(['PADRE']);

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-sottocartelle').check();

    await expect.poll(async () => (await segnature(page)).slice().sort()).toEqual(['FIGLIA', 'PADRE']);
  });

  test('il badge conta i filtri attivi e sparisce quando si azzerano', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [{ segnatura: 'MS 1' }]);

    await expect(page.locator('#badge-filtri')).toBeHidden();

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-allegati').selectOption('no');
    await page.locator('#filtro-sottocartelle').check();

    await expect(page.locator('#badge-filtri')).toHaveText('2');

    await page.locator('#btn-azzera-filtri-avanzati').click();
    await expect(page.locator('#badge-filtri')).toBeHidden();
  });

  test('ogni filtro attivo ha un chip che lo rimuove', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [
      { segnatura: 'CON', allegati: [{ nome: 'a.jpg', tipo: 'image/jpeg' }] },
      { segnatura: 'SENZA' },
    ]);

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-allegati').selectOption('si');
    await page.keyboard.press('Escape');

    const barra = page.locator('#active-filters');
    await expect(barra).toBeVisible();
    const chip = barra.locator('span', { hasText: /Con allegati|With attachments/ }).first();
    await expect(chip).toBeVisible();

    await chip.locator('button').click();
    await expect.poll(() => segnature(page)).toEqual(['CON', 'SENZA']);
    await expect(page.locator('#badge-filtri')).toBeHidden();
  });

  test('sintassi campo:valore nella ricerca', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [
      { segnatura: 'NOTAIO', extra: { Notaio: 'Giovanni Rossi' } },
      // Esca: contiene "rossi", ma in un altro campo. Una ricerca libera la troverebbe;
      // `notaio:rossi` no. È la differenza che questa sintassi esiste per fare.
      { segnatura: 'ESCA', extra: { titolo: 'terreno dei Rossi' } },
    ]);

    await cerca(page, 'rossi');
    await expect.poll(async () => (await segnature(page)).slice().sort()).toEqual(['ESCA', 'NOTAIO']);

    await cerca(page, 'notaio:rossi');
    await expect.poll(() => segnature(page)).toEqual(['NOTAIO']);
  });

  test('una ricerca salvata si riapplica intera: query, filtri e cartella', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [
      { segnatura: 'BERSAGLIO', cartella: 'Notarile', allegati: [{ nome: 'a.jpg', tipo: 'image/jpeg' }] },
      { segnatura: 'ESCA-SENZA-ALLEGATI', cartella: 'Notarile' },
      { segnatura: 'ESCA-ALTRA-CARTELLA', cartella: 'Fiscale', allegati: [{ nome: 'b.jpg', tipo: 'image/jpeg' }] },
    ]);
    await page.evaluate(() => {
      (window as any).cartellaAttuale = 'Notarile';
      (window as any).renderMain();
    });

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-allegati').selectOption('si');
    await expect.poll(() => segnature(page)).toEqual(['BERSAGLIO']);

    await page.locator('#input-nome-ricerca').fill('Notarile con allegati');
    await page.locator('#btn-salva-ricerca').click();
    await expect(page.locator('#elenco-ricerche-salvate button', { hasText: 'Notarile con allegati' })).toHaveCount(1);
    await page.keyboard.press('Escape');

    // Si distrugge il contesto: altra cartella e nessun filtro.
    await page.evaluate(() => {
      (window as any).azzeraFiltriAvanzati();
      (window as any).cartellaAttuale = 'Fiscale';
      (window as any).renderMain();
    });
    await expect.poll(() => segnature(page)).toEqual(['ESCA-ALTRA-CARTELLA']);

    // ...e lo si ripristina con un click sulla ricerca salvata.
    await page.locator('#btn-filtri').click();
    await page.locator('#elenco-ricerche-salvate button', { hasText: 'Notarile con allegati' }).click();

    await expect.poll(() => segnature(page)).toEqual(['BERSAGLIO']);
    expect(await page.evaluate(() => (window as any).cartellaAttuale)).toBe('Notarile');
  });

  test('le ricerche salvate e i filtri sopravvivono al riavvio', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [
      { segnatura: 'CON', allegati: [{ nome: 'a.jpg', tipo: 'image/jpeg' }] },
      { segnatura: 'SENZA' },
    ]);

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-allegati').selectOption('si');
    await page.locator('#input-nome-ricerca').fill('Solo con allegati');
    await page.locator('#btn-salva-ricerca').click();
    await page.keyboard.press('Escape');

    // Store.commit() non scrive subito su disco, e appState passa da apiSettings.save:
    // senza flush il riavvio rileggerebbe lo stato precedente.
    await page.evaluate(async () => {
      const w = window as any;
      if (typeof w.flushSalvataggio === 'function') await w.flushSalvataggio();
      await w.salvaStatoPosizione();
    });

    const { launchApp, closeApp } = await import('./fixtures');
    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);

    await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await page2.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await dismissOverlays(page2);

    await expect.poll(() => segnature(page2)).toEqual(['CON']);
    await expect(page2.locator('#badge-filtri')).toHaveText('1');

    await page2.locator('#btn-filtri').click();
    await expect(page2.locator('#elenco-ricerche-salvate button', { hasText: 'Solo con allegati' })).toHaveCount(1);

    await closeApp(app2);
  });

  test('"Azzera tutti i filtri" azzera anche quelli avanzati', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Filtri');
    await seed(page, [
      { segnatura: 'CON', allegati: [{ nome: 'a.jpg', tipo: 'image/jpeg' }] },
      { segnatura: 'SENZA' },
    ]);

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-allegati').selectOption('si');
    await page.keyboard.press('Escape');
    await cerca(page, 'MS');

    await page.locator('#active-filters button', { hasText: /Azzera tutti i filtri|Clear all filters/ }).click();

    // Lasciare in piedi il filtro avanzato dopo un "azzera tutto" è il modo più rapido
    // per far credere all'utente che l'archivio si sia svuotato.
    await expect.poll(async () => (await segnature(page)).slice().sort()).toEqual(['CON', 'SENZA']);
    await expect(page.locator('#badge-filtri')).toBeHidden();
  });
});
