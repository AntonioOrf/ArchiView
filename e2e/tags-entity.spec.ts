import { test, expect } from './fixtures';
import { createLocalWorkspace, openSidebarPanel } from './helpers';
import * as path from 'path';

// `appData` vive nello scope del bundle del renderer, non su `window`: dentro page.evaluate
// e' una variabile globale come le altre, e va solo dichiarata al compilatore dello spec.
declare const appData: any;

// Fase 3.4 — Tag come entità. Copre le tre cose che prima non esistevano o mentivano:
// il filtro per corrispondenza esatta (il tag `not` selezionava anche `notaio`),
// l'anagrafica con rinomina/fusione/colore propagati a tutto l'archivio, e la
// migrazione v3, che deve costruire l'anagrafica SENZA toccare un solo record.
//
// In ogni semina c'è una scheda-esca che NON deve corrispondere: senza, un'asserzione su
// un conteggio passerebbe anche a filtro inerte.

/** Semina schede con i tag indicati e ricarica la vista. */
async function semina(page: any, righe: { segnatura: string; tags: string }[]) {
  await page.evaluate(async (dati: any[]) => {
    const w = window as any;
    for (const r of dati) {
      appData.manoscritti.push({
        id: crypto.randomUUID(), cartella: '', tipoDocumento: 'imbreviature',
        segnatura: r.segnatura, tags: r.tags, allegati: [], lastModified: Date.now()
      });
    }
    await w.Store.commit();
  }, righe);
}

/** I tag di una scheda, letti dal database in memoria. */
async function tagsDi(page: any, segnatura: string): Promise<string> {
  return page.evaluate((seg: string) => {
    const w = window as any;
    const m = appData.manoscritti.find((x: any) => x.segnatura === seg);
    return m ? String(m.tags ?? '') : '<assente>';
  }, segnatura);
}

test.describe('Tag come entità (3.4)', () => {

  test('il filtro per tag è esatto: `not` non seleziona `notaio`', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'TagEnt');
    await semina(page, [
      { segnatura: 'A', tags: 'not' },
      // Le due esche: prima della 3.4 il filtro faceva `includes()` sulla stringa CSV
      // intera e le prendeva entrambe.
      { segnatura: 'ESCA-1', tags: 'notaio' },
      { segnatura: 'ESCA-2', tags: 'notarile, pergamena' }
    ]);

    await openSidebarPanel(page, 'tags');
    // L'aria-label e non il testo: il pulsante rende nome e conteggio in due span
    // adiacenti, quindi il suo textContent e' "#not1" e nessun confine di parola separa
    // il tag dal numero.
    await page.locator('#tag-list button[aria-label="#not (1)"]').click();
    await expect(page.locator('#counter-results')).toContainText('1');
    await expect(page.locator('.card-scheda').filter({ hasText: 'ESCA-1' })).toHaveCount(0);
    await expect(page.locator('.card-scheda')).toHaveCount(1);
  });

  test('la sidebar raggruppa le grafie diverse in un solo tag, con il conteggio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'TagEnt');
    await semina(page, [
      { segnatura: 'A', tags: 'Pergamena' },
      { segnatura: 'B', tags: 'pergamena' },
      { segnatura: 'C', tags: 'PERGAMENA' },
      { segnatura: 'ESCA', tags: 'carta' }
    ]);

    await openSidebarPanel(page, 'tags');
    const righe = page.locator('#tag-list button');
    await expect(righe).toHaveCount(2);
    // La grafia mostrata è la prima incontrata, non un minuscolo forzato: un tag come
    // "Notai di Perugia" non deve perdere le maiuscole solo per comparire in elenco.
    const pergamena = righe.filter({ hasText: 'Pergamena' });
    await expect(pergamena).toHaveCount(1);
    await expect(pergamena).toContainText('3');
  });

  test('rinomina dal pannello: propaga su tutte le schede, non solo sulle selezionate', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'TagEnt');
    await semina(page, [
      { segnatura: 'A', tags: 'pergamana, notaio' },
      { segnatura: 'B', tags: 'pergamana' },
      { segnatura: 'ESCA', tags: 'carta' }
    ]);

    await page.evaluate(async () => { await (window as any).rinominaTagArchivio('pergamana', 'pergamena'); });

    expect(await tagsDi(page, 'A')).toBe('pergamena, notaio');
    expect(await tagsDi(page, 'B')).toBe('pergamena');
    expect(await tagsDi(page, 'ESCA')).toBe('carta');

    // Il tag vecchio non deve sopravvivere nell'elenco: sarebbe un filtro che non
    // seleziona più nulla.
    await openSidebarPanel(page, 'tags');
    await expect(page.locator('#tag-list')).toContainText('pergamena');
    await expect(page.locator('#tag-list')).not.toContainText('pergamana');
  });

  test('fondere due tag in uno non lascia duplicati sulla scheda che li aveva entrambi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'TagEnt');
    await semina(page, [
      { segnatura: 'A', tags: 'not., notaio' },
      { segnatura: 'B', tags: 'not.' },
      { segnatura: 'ESCA', tags: 'carta' }
    ]);

    await page.evaluate(async () => { await (window as any).fondiTagArchivio(['not.'], 'notaio'); });

    expect(await tagsDi(page, 'A')).toBe('notaio');
    expect(await tagsDi(page, 'B')).toBe('notaio');
    expect(await tagsDi(page, 'ESCA')).toBe('carta');
  });

  test('il colore sta nell\'anagrafica e non tocca i record', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'TagEnt');
    await semina(page, [{ segnatura: 'A', tags: 'pergamena' }]);

    const prima = await page.evaluate(() => {
      const m = appData.manoscritti.find((x: any) => x.segnatura === 'A');
      return { lastModified: m.lastModified, tags: m.tags };
    });

    await page.evaluate(async () => { await (window as any).impostaColoreTagArchivio('pergamena', 'verde'); });

    const dopo = await page.evaluate(() => {
      const w = window as any;
      const m = appData.manoscritti.find((x: any) => x.segnatura === 'A');
      return {
        lastModified: m.lastModified,
        tags: m.tags,
        colore: w.Model.coloreTag(appData, 'pergamena'),
        classe: w.classeColoreTag('pergamena')
      };
    });

    expect(dopo.colore).toBe('verde');
    expect(dopo.classe).toContain('tag-col-verde');
    // ⚠️ L'asserzione che conta: colorare un tag NON deve marcare le schede come
    // modificate, o al primo sync mezzo archivio risulterebbe cambiato.
    expect(dopo.lastModified).toBe(prima.lastModified);
    expect(dopo.tags).toBe(prima.tags);
  });

  test('la rinomina è annullabile e riporta i tag com\'erano', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'TagEnt');
    await semina(page, [{ segnatura: 'A', tags: 'vecchio' }, { segnatura: 'ESCA', tags: 'carta' }]);

    await page.evaluate(async () => { await (window as any).rinominaTagArchivio('vecchio', 'nuovo'); });
    expect(await tagsDi(page, 'A')).toBe('nuovo');

    await page.evaluate(async () => { await (window as any).gestoreAnnullamento.annullaUltimaAzione(); });
    expect(await tagsDi(page, 'A')).toBe('vecchio');
    expect(await tagsDi(page, 'ESCA')).toBe('carta');
  });

  test('la migrazione v3 costruisce l\'anagrafica senza riscrivere i record', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'TagEnt');

    const esito = await page.evaluate(() => {
      const w = window as any;
      const grezzo = {
        schemaVersion: 2,
        cartelle: [],
        tipiDocumento: [],
        manoscritti: [{
          id: 'x', cartella: '', tipoDocumento: 'imbreviature',
          // Sporco apposta: spazi doppi, voce vuota, duplicato di sola maiuscola.
          tags: 'Pergamena,, pergamena ,  sec.  XIV', lastModified: 1000
        }]
      };
      const prima = JSON.stringify(grezzo.manoscritti);
      const migrato = w.Model.migraDatabase(grezzo);
      return {
        versione: migrato.db.schemaVersion,
        chiavi: Object.keys(migrato.db.tagsAnagrafica || {}).sort(),
        nome: (migrato.db.tagsAnagrafica || {}).pergamena?.nome,
        recordIntatti: JSON.stringify(migrato.db.manoscritti) === prima
      };
    });

    expect(esito.versione).toBe(4);
    expect(esito.chiavi).toEqual(['pergamena', 'sec. xiv']);
    expect(esito.nome).toBe('Pergamena');
    expect(esito.recordIntatti).toBe(true);
  });

  test('il pannello "Gestione tag" elenca i tag con il conteggio e si filtra', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'TagEnt');
    await semina(page, [
      { segnatura: 'A', tags: 'pergamena, notaio' },
      { segnatura: 'B', tags: 'pergamena' },
      { segnatura: 'ESCA', tags: 'carta' }
    ]);

    await openSidebarPanel(page, 'tags');
    await page.locator('#btn-tag-manager').click();
    await expect(page.locator('#tag-manager-modal')).toBeVisible();
    await expect(page.locator('#tag-manager-list .tag-manager-row')).toHaveCount(3);

    await page.locator('#tag-manager-filter').fill('perg');
    const righe = page.locator('#tag-manager-list .tag-manager-row');
    await expect(righe).toHaveCount(1);
    await expect(righe.first()).toContainText('pergamena');
    await expect(righe.first()).toContainText('2');

    await page.locator('#tag-manager-modal [data-modal-cancel]').click();
    await expect(page.locator('#tag-manager-modal')).toBeHidden();
  });
});
