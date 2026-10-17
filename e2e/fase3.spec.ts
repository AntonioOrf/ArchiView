import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Fase3' });

declare const appData: any;

async function semina(page: any, righe: any[]) {
  await page.evaluate(async (dati: any[]) => {
    const w = window as any;
    for (const r of dati) {
      appData.manoscritti.push(Object.assign({
        id: crypto.randomUUID(), cartella: '', tipoDocumento: 'imbreviature',
        allegati: [], lastModified: Date.now()
      }, r));
    }
    await w.Store.commit();
  }, righe);
}

async function legaCampo(page: any, campo: string, vocabolario: string) {
  await page.evaluate(async (arg: any) => {
    const w = window as any;
    const tipo = appData.tipiDocumento.find((t: any) => t.id === 'imbreviature');
    if (!tipo.campi.includes(arg.campo)) tipo.campi.push(arg.campo);
    tipo.campiDef = tipo.campiDef || {};
    tipo.campiDef[arg.campo] = { id: arg.campo, tipo: 'enum', vocabolario: arg.vocabolario };
    await w.Store.commit();
  }, { campo, vocabolario });
}

async function scheda(page: any, segnatura: string) {
  return page.evaluate((seg: string) =>
    appData.manoscritti.find((m: any) => m.segnatura === seg) || null, segnatura);
}

test.describe('Fase 3 — vocabolari, relazioni, anagrafica, duplicati', () => {

  test('3.3 — l\'archivio nasce con i vocabolari predefiniti, non legati a nessun campo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    const esito = await page.evaluate(() => {
      const w = window as any;
      const tipo = appData.tipiDocumento.find((t: any) => t.id === 'imbreviature');
      return {
        versione: appData.schemaVersion,
        ids: Object.keys(w.Model.vocabolari(appData)).sort(),
        tipoCampo: w.Model.definizioneCampo(tipo, 'tipo_di_atto', w.CONFIG_CAMPI, appData).tipo
      };
    });
    expect(esito.versione).toBe(4);
    expect(esito.ids).toContain('supporto');
    expect(esito.ids).toContain('relazione');
    expect(esito.tipoCampo).not.toBe('enum');
  });

  test('3.3 — un campo legato al vocabolario diventa una tendina con i suoi valori', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await legaCampo(page, 'supporto', 'supporto');

    await page.evaluate(() => (window as any).switchTab('add'));
    const select = page.locator('#dyn-supporto');
    await expect(select).toBeVisible();
    await expect(select.locator('option')).toHaveCount(5);
    await expect(select.locator('option', { hasText: 'pergamena' })).toHaveCount(1);
  });

  test('3.3 — l\'aggiunta al volo entra nel vocabolario, quindi la vedono tutti', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await legaCampo(page, 'supporto', 'supporto');

    await page.evaluate(async () => {
      await (window as any).aggiungiValoreVocabolario('supporto', 'cartapecora');
    });
    const valori = await page.evaluate(() => (window as any).Model.valoriVocabolario(appData, 'supporto'));
    expect(valori).toContain('cartapecora');
    const dopo = await page.evaluate(async () => {
      await (window as any).aggiungiValoreVocabolario('supporto', 'Cartapecora');
      return (window as any).Model.valoriVocabolario(appData, 'supporto').length;
    });
    expect(dopo).toBe(valori.length);
  });

  test('3.3 — eliminare un vocabolario o un suo valore si annulla dal messaggio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await legaCampo(page, 'supporto', 'supporto');
    const stato = () => page.evaluate(() => {
      const tipo = appData.tipiDocumento.find((t: any) => t.id === 'imbreviature');
      return {
        valori: (window as any).Model.valoriVocabolario(appData, 'supporto'),
        legame: tipo.campiDef.supporto.vocabolario || null,
        opzioni: tipo.campiDef.supporto.opzioni || null,
      };
    });
    const prima = await stato();
    expect(prima.legame).toBe('supporto');
    const annulla = page.locator('#toast-container button', { hasText: /annulla/i }).last();

    await page.evaluate(() => (window as any).eliminaValoreVocabolario('supporto', 'pergamena'));
    expect((await stato()).valori).not.toContain('pergamena');
    await annulla.click();
    await expect.poll(async () => (await stato()).valori).toEqual(prima.valori);

    await page.evaluate(() => (window as any).eliminaVocabolarioArchivio('supporto'));
    const dopo = await stato();
    expect(dopo.legame).toBeNull();
    expect(dopo.opzioni).toEqual(prima.valori);
    await annulla.click();
    await expect.poll(stato).toEqual(prima);
  });

  test('3.3 — rinominare un valore lo aggiorna in tutte le schede legate', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await legaCampo(page, 'supporto', 'supporto');
    await semina(page, [
      { segnatura: 'A', supporto: 'pergamena' },
      { segnatura: 'B', supporto: 'pergamena' },
      { segnatura: 'ESCA', oggetto: 'pergamena' }
    ]);

    await page.evaluate(async () => {
      await (window as any).rinominaValoreVocabolario('supporto', 'pergamena', 'membrana');
    });

    expect((await scheda(page, 'A')).supporto).toBe('membrana');
    expect((await scheda(page, 'B')).supporto).toBe('membrana');
    expect((await scheda(page, 'ESCA')).oggetto).toBe('pergamena');
    expect(await page.evaluate(() => (window as any).Model.valoriVocabolario(appData, 'supporto')))
      .toContain('membrana');
  });

  test('3.3 — il pannello elenca i vocabolari e i valori del selezionato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await page.evaluate(() => (window as any).apriVocabolari('supporto'));

    await expect(page.locator('#vocab-modal')).toBeVisible();
    await expect(page.locator('#vocab-list .vocab-riga')).toHaveCount(6);
    await expect(page.locator('#vocab-values .vocab-valore')).toHaveCount(4);

    await page.locator('#vocab-new-value').fill('cartapecora');
    await page.locator('#vocab-new-value').press('Enter');
    await expect(page.locator('#vocab-values .vocab-valore')).toHaveCount(5);

    await page.locator('#vocab-modal [data-modal-cancel]').click();
    await expect(page.locator('#vocab-modal')).toBeHidden();
  });

  test('3.6 — il rilevatore trova le segnature ripetute e ignora le altre', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [
      { segnatura: 'ASP 12' },
      { segnatura: 'asp  12' },
      { segnatura: 'ESCA' },
      { segnatura: '' }
    ]);

    await page.evaluate(() => (window as any).apriDuplicati());
    await expect(page.locator('#duplicati-modal')).toBeVisible();
    await expect(page.locator('#duplicati-list .dup-gruppo')).toHaveCount(1);
    await expect(page.locator('#duplicati-list .dup-gruppo').first()).toContainText('ASP 12');
    await expect(page.locator('#duplicati-list')).not.toContainText('ESCA');
  });

  test('3.5 — il rimando si scrive su una scheda sola e il verso opposto si calcola', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A' }, { segnatura: 'B' }, { segnatura: 'ESCA' }]);

    const esito = await page.evaluate(async () => {
      const w = window as any;
      const a = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      const b = appData.manoscritti.find((m: any) => m.segnatura === 'B');
      await w.collegaSchede(a.id, b.id, 'copia di');
      const risolte = w.relazioniRisolte(b.id);
      return {
        uscentiA: w.Model.relazioni(a).length,
        chiaveSuB: Object.prototype.hasOwnProperty.call(b, 'relazioni'),
        entrantiB: risolte.entranti.map((r: any) => r.scheda.segnatura + '|' + r.tipo),
        entrantiEsca: w.relazioniRisolte(appData.manoscritti.find((m: any) => m.segnatura === 'ESCA').id).entranti.length
      };
    });

    expect(esito.uscentiA).toBe(1);
    expect(esito.chiaveSuB).toBe(false);
    expect(esito.entrantiB).toEqual(['A|copia di']);
    expect(esito.entrantiEsca).toBe(0);
  });

  test('F2 — annullare l\'eliminazione o ripristinare dal cestino rimette i rimandi entranti', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A' }, { segnatura: 'B' }]);

    const elimina = () => page.evaluate(async () => {
      const w = window as any;
      const b = appData.manoscritti.find((m: any) => m.segnatura === 'B');
      (document.getElementById('delete-item-id') as HTMLInputElement).value = b.id;
      await w.confermaEliminazione();
      return b.id;
    });
    const rimandiDiA = () => page.evaluate(() => (window as any).Model.relazioni(
      appData.manoscritti.find((m: any) => m.segnatura === 'A')).map((r: any) => r.tipo));

    await page.evaluate(async () => {
      const a = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      const b = appData.manoscritti.find((m: any) => m.segnatura === 'B');
      await (window as any).collegaSchede(a.id, b.id, 'copia di');
    });

    await elimina();
    expect(await rimandiDiA()).toEqual([]);
    await page.keyboard.press('Control+z');
    await expect.poll(rimandiDiA).toEqual(['copia di']);

    const idB = await elimina();
    expect(await rimandiDiA()).toEqual([]);
    await page.evaluate((id) => (window as any).ripristinaDalCestino([id]), idB);
    expect(await rimandiDiA()).toEqual(['copia di']);
  });

  test('3.5 — il collegamento è annullabile', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A' }, { segnatura: 'B' }]);

    const dopo = await page.evaluate(async () => {
      const w = window as any;
      const a = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      const b = appData.manoscritti.find((m: any) => m.segnatura === 'B');
      await w.collegaSchede(a.id, b.id, 'copia di');
      const prima = w.Model.relazioni(a).length;
      await w.gestoreAnnullamento.annullaUltimaAzione();
      const rimessa = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      return { prima, dopo: w.Model.relazioni(rimessa).length };
    });
    expect(dopo.prima).toBe(1);
    expect(dopo.dopo).toBe(0);
  });

  test('3.5 — il form salva i collegamenti e li ricarica riaprendo la scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'BERSAGLIO' }]);

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-segnatura').fill('NUOVA');
    await page.evaluate(() => (window as any).aggiornaSelettoriRelazione());
    const bersaglioId = await page.evaluate(() =>
      appData.manoscritti.find((m: any) => m.segnatura === 'BERSAGLIO').id);
    await page.locator('#form-relazione-target').selectOption(bersaglioId);
    await page.locator('#form-relazione-tipo').selectOption('copia di');
    await page.locator('#form-relazioni-list').waitFor();
    await page.evaluate(() => (window as any).aggiungiRelazioneForm());
    await expect(page.locator('#form-relazioni-list .rel-riga')).toHaveCount(1);

    await page.locator('#btn-submit-form').click();
    await expect.poll(async () => {
      const m = await scheda(page, 'NUOVA');
      return m ? (m.relazioni || []).length : 0;
    }).toBe(1);

    const id = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'NUOVA').id);
    await page.evaluate((rid: string) => (window as any).editItem(rid), id);
    await expect(page.locator('#form-relazioni-list .rel-riga')).toHaveCount(1);
  });

  test('3.5 — persone e luoghi si raccolgono dalle schede, con il conteggio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [
      { segnatura: 'A', attori_dinamici: [{ k: 'Venditore', v: 'Bartolo' }], dataTopica: 'Perugia' },
      { segnatura: 'B', attori_dinamici: [{ k: 'Teste', v: 'bartolo' }], dataTopica: 'Perùgia' },
      { segnatura: 'ESCA', oggetto: 'Bartolo' }
    ]);

    await page.evaluate(() => (window as any).apriAnagrafica('persona'));
    await expect(page.locator('#authority-modal')).toBeVisible();
    const righe = page.locator('#authority-list .tag-manager-row');
    await expect(righe).toHaveCount(1);
    await expect(righe.first()).toContainText('Bartolo');
    await expect(righe.first()).toContainText('2');
    await expect(page.locator('#authority-list')).not.toContainText('Venditore');

    await page.locator('#authority-tab-luogo').click();
    await expect(page.locator('#authority-list .tag-manager-row')).toHaveCount(1);
    await expect(page.locator('#authority-list')).toContainText('Perugia');
  });

  test('3.5 — rinominare in anagrafica riscrive il nome in tutte le schede', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [
      { segnatura: 'A', attori_dinamici: [{ k: 'Venditore', v: 'Bartolus de Saxoferrato' }] },
      { segnatura: 'B', attori_dinamici: [{ k: 'Teste', v: 'bartolus de saxoferrato' }] },
      { segnatura: 'ESCA', attori_dinamici: [{ k: 'Teste', v: 'Pietro' }] }
    ]);

    await page.evaluate(async () => {
      await (window as any).rinominaAuthorityArchivio('persona', 'Bartolus de Saxoferrato', 'Bartolo da Sassoferrato');
    });

    expect((await scheda(page, 'A')).attori_dinamici[0].v).toBe('Bartolo da Sassoferrato');
    expect((await scheda(page, 'B')).attori_dinamici[0].v).toBe('Bartolo da Sassoferrato');
    expect((await scheda(page, 'ESCA')).attori_dinamici[0].v).toBe('Pietro');
  });

  test('3.5 — il pannello mostra i due versi e porta alla scheda collegata', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'ORIGINALE' }, { segnatura: 'COPIA' }, { segnatura: 'ESCA' }]);

    await page.evaluate(async () => {
      const w = window as any;
      const copia = appData.manoscritti.find((m: any) => m.segnatura === 'COPIA');
      const orig = appData.manoscritti.find((m: any) => m.segnatura === 'ORIGINALE');
      await w.collegaSchede(copia.id, orig.id, 'copia di');
    });

    await page.evaluate(() => {
      const w = window as any;
      w.apriCollegamenti(appData.manoscritti.find((m: any) => m.segnatura === 'COPIA').id);
    });
    await expect(page.locator('#relazioni-modal')).toBeVisible();
    await expect(page.locator('#relazioni-body')).toContainText('ORIGINALE');
    await expect(page.locator('#relazioni-body')).not.toContainText('ESCA');

    await page.evaluate(() => {
      const w = window as any;
      w.chiudiCollegamenti();
      w.apriCollegamenti(appData.manoscritti.find((m: any) => m.segnatura === 'ORIGINALE').id);
    });
    const entranti = page.locator('#relazioni-body .rel-riga');
    await expect(entranti).toHaveCount(1);
    await expect(entranti.first()).toContainText('COPIA');

    await entranti.first().click();
    await expect(page.locator('#relazioni-modal')).toBeHidden();
    await expect(page.locator('#form-segnatura')).toHaveValue('COPIA');
  });

  test('3.5 — il filtro "senza collegamenti" conta entrambi i versi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A' }, { segnatura: 'B' }, { segnatura: 'ESCA' }]);
    await page.evaluate(async () => {
      const w = window as any;
      const a = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      const b = appData.manoscritti.find((m: any) => m.segnatura === 'B');
      await w.collegaSchede(a.id, b.id, 'copia di');
    });

    await page.evaluate(() => (window as any).applicaFiltriAvanzati({ collegamenti: 'si' }));
    await expect(page.locator('.card-scheda')).toHaveCount(2);
    await expect(page.locator('#main-view, #manoscritti-grid')).not.toContainText('ESCA');

    await page.evaluate(() => (window as any).applicaFiltriAvanzati({ collegamenti: 'no' }));
    await expect(page.locator('.card-scheda')).toHaveCount(1);
  });

  test('3.5 — la card mostra il numero dei collegamenti, nei due versi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A' }, { segnatura: 'B' }, { segnatura: 'ESCA' }]);
    await page.evaluate(async () => {
      const w = window as any;
      const a = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      const b = appData.manoscritti.find((m: any) => m.segnatura === 'B');
      await w.collegaSchede(a.id, b.id, 'copia di');
    });

    await expect(page.locator('.card-scheda .card-badge-link')).toHaveCount(2);
    const idEsca = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'ESCA').id);
    await expect(page.locator('#card-' + idEsca + ' .card-badge-link')).toHaveCount(0);
  });

  test('3.5 — togliere l\'ULTIMO collegamento lo cancella davvero, e non ricompare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A' }, { segnatura: 'B' }]);
    await page.evaluate(async () => {
      const w = window as any;
      const a = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      const b = appData.manoscritti.find((m: any) => m.segnatura === 'B');
      await w.collegaSchede(a.id, b.id, 'copia di');
    });

    const idA = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'A').id);
    await page.evaluate((rid: string) => (window as any).editItem(rid), idA);
    await expect(page.locator('#form-relazioni-list .rel-riga')).toHaveCount(1);

    await page.locator('#form-relazioni-list .rel-riga button').click();
    await expect(page.locator('#form-relazioni-list .rel-riga')).toHaveCount(0);
    await page.locator('#btn-submit-form').click();

    await expect.poll(async () => {
      const m = await scheda(page, 'A');
      return m ? (m.relazioni || []).length : -1;
    }).toBe(0);

    const entranti = await page.evaluate(() => {
      const w = window as any;
      const b = appData.manoscritti.find((m: any) => m.segnatura === 'B');
      return w.relazioniRisolte(b.id).entranti.length;
    });
    expect(entranti).toBe(0);
    await expect(page.locator('.card-scheda .card-badge-link')).toHaveCount(0);
  });

  test('3.5 — eliminare una scheda toglie i rimandi che puntavano a lei', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A' }, { segnatura: 'BERSAGLIO' }, { segnatura: 'ESCA' }]);

    const esito = await page.evaluate(async () => {
      const w = window as any;
      const a = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      const bersaglio = appData.manoscritti.find((m: any) => m.segnatura === 'BERSAGLIO');
      const esca = appData.manoscritti.find((m: any) => m.segnatura === 'ESCA');
      await w.collegaSchede(a.id, bersaglio.id, 'copia di');
      await w.collegaSchede(a.id, esca.id, 'stessa mano');
      await w.Store.deleteManoscritto(bersaglio.id);

      const dopo = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      return {
        restanti: w.Model.relazioni(dopo).map((r: any) => r.tipo),
        tombstone: (appData.deletedIds || []).includes(bersaglio.id)
      };
    });

    expect(esito.tombstone).toBe(true);
    expect(esito.restanti).toEqual(['stessa mano']);
  });

  for (const via of ['selezione', 'cartella']) {
    test(`3.5 — eliminare per ${via} toglie i rimandi che puntavano alle schede eliminate`, async ({ page, userDataDir }) => {
      await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
      await semina(page, [{ segnatura: 'A' }, { segnatura: 'BERSAGLIO' }, { segnatura: 'ESCA' }]);

      await page.evaluate(async (via) => {
        const w = window as any;
        const a = appData.manoscritti.find((m: any) => m.segnatura === 'A');
        const bersaglio = appData.manoscritti.find((m: any) => m.segnatura === 'BERSAGLIO');
        const esca = appData.manoscritti.find((m: any) => m.segnatura === 'ESCA');
        await w.collegaSchede(a.id, bersaglio.id, 'copia di');
        await w.collegaSchede(a.id, esca.id, 'stessa mano');
        if (via === 'selezione') {
          w.selectedRecords = [bersaglio.id];
          w.eliminaSelezionati();
        } else {
          await w.Store.updateManoscritto(bersaglio.id, { cartella: 'Fondo' });
          w.eliminaCartellaDaSidebar('Fondo');
        }
      }, via);
      await page.locator('#btn-bottom-confirm-yes').click();

      await expect.poll(() => page.evaluate(() =>
        appData.manoscritti.some((m: any) => m.segnatura === 'BERSAGLIO'))).toBe(false);
      const esito = await page.evaluate(() => {
        const w = window as any;
        const a = appData.manoscritti.find((m: any) => m.segnatura === 'A');
        return w.Model.relazioni(a).map((r: any) => r.tipo);
      });
      expect(esito).toEqual(['stessa mano']);
    });
  }

  test('3.5 — il grafo disegna nodi e archi, e il clic isola il nodo coi suoi vicini', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'PERNO' }, { segnatura: 'A' }, { segnatura: 'B' }, { segnatura: 'ISOLATA' }]);
    await page.evaluate(async () => {
      const w = window as any;
      const id = (s: string) => appData.manoscritti.find((m: any) => m.segnatura === s).id;
      await w.collegaSchede(id('A'), id('PERNO'), 'copia di');
      await w.collegaSchede(id('PERNO'), id('B'), 'stessa mano');
    });

    await page.evaluate(() => (window as any).apriGrafo());
    await expect(page.locator('#grafo-modal')).toBeVisible();

    await expect(page.locator('#grafo-svg .grafo-nodo')).toHaveCount(3);
    await expect(page.locator('#grafo-svg .grafo-arco')).toHaveCount(2);
    await expect(page.locator('#grafo-svg')).not.toContainText('ISOLATA');
    await expect(page.locator('#grafo-riassunto')).toContainText('3');

    const idA = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'A').id);
    await page.locator('#grafo-svg .grafo-nodo[data-id="' + idA + '"] circle').click();
    await expect(page.locator('#grafo-svg .grafo-nodo.scelto')).toHaveCount(1);
    await expect(page.locator('#grafo-svg .grafo-nodo.spento')).toHaveCount(1);
    await expect(page.locator('#grafo-dettaglio')).toContainText('PERNO');
  });

  test('3.5 — la casella "mostra anche le isolate" le fa comparire', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A' }, { segnatura: 'B' }, { segnatura: 'ISOLATA' }]);
    await page.evaluate(async () => {
      const w = window as any;
      const id = (s: string) => appData.manoscritti.find((m: any) => m.segnatura === s).id;
      await w.collegaSchede(id('A'), id('B'), 'copia di');
    });

    await page.evaluate(() => (window as any).apriGrafo());
    await expect(page.locator('#grafo-svg .grafo-nodo')).toHaveCount(2);
    await page.locator('#grafo-isolate').check();
    await expect(page.locator('#grafo-svg .grafo-nodo')).toHaveCount(3);
  });

  test('3.5 — senza collegamenti il grafo lo dice invece di restare vuoto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A' }, { segnatura: 'B' }]);

    await page.evaluate(() => (window as any).apriGrafo());
    await expect(page.locator('#grafo-avviso')).toBeVisible();
    await expect(page.locator('#grafo-svg .grafo-nodo')).toHaveCount(0);
  });

  test('P9 — collazione dalle schede collegate: luoghi varianti, apparato e varianti grafiche', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [
      { segnatura: 'TEST-A', trascrizione: '<p>In principio erat</p><p>uerbum et uerbum</p>' },
      { segnatura: 'TEST-B', trascrizione: '<p>In principio fuit</p><p>verbum et verbum dei</p>' },
      { segnatura: 'ESCA' }
    ]);
    await page.evaluate(async () => {
      const w = window as any;
      const per = (s: string) => appData.manoscritti.find((m: any) => m.segnatura === s).id;
      await w.collegaSchede(per('TEST-B'), per('TEST-A'), 'copia di');
      await w.collegaSchede(per('ESCA'), per('TEST-A'));
      w.apriCollegamenti(per('TEST-A'));
    });

    await page.locator('#btn-collaziona').click();
    const modal = page.locator('#collazione-modal');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await page.locator('.card-scheda', { hasText: 'TEST-A' }).locator('.card-overflow-btn').click();
    await page.locator('#custom-context-menu button', { hasText: /^Vedi$/ }).click();
    await page.locator('#custom-context-menu-1 button', { hasText: /Collazione/ }).click();
    await expect(modal).toBeVisible();
    await expect(page.locator('#coll-testimoni input')).toHaveCount(2);
    const voci = page.locator('#coll-apparato li');
    await expect(voci).toHaveCount(2);
    await expect(voci.nth(0)).toHaveText('erat ] fuit TEST-B');
    await expect(voci.nth(1)).toHaveText('add. ] dei TEST-B');
    await expect(page.locator('#coll-testi .collazione-colonna')).toHaveCount(2);
    await expect(page.locator('#coll-testi .collazione-colonna').first()).toContainText('erat');
    await expect(page.locator('#coll-testi .collazione-var').first()).toHaveText('erat');

    await page.locator('#coll-grafiche').uncheck();
    await expect(voci.nth(0)).toHaveText('erat uerbum ] fuit verbum TEST-B');

    await page.locator('#coll-grafiche').check();
    await page.locator('#coll-base').selectOption({ label: 'TEST-B' });
    await expect(voci.nth(1)).toHaveText('dei ] om. TEST-A');

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('P10 — una voce d\'anagrafica si collega a Wikidata (e VIAF) e si scollega', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [{ segnatura: 'A', attori_dinamici: [{ k: 'Teste', v: 'Bartolo' }] }]);
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('authority-cerca');
      ipcMain.removeHandler('authority-dettagli');
      ipcMain.handle('authority-cerca', () => ({ ok: true, candidati: [
        { id: 'Q312599', etichetta: 'Bartolo da Sassoferrato', descrizione: 'giurista (1313-1357)' },
        { id: 'Q999', etichetta: 'Bartolo', descrizione: '<img src=x onerror=alert(1)>' }
      ] }));
      ipcMain.handle('authority-dettagli', (_e: any, id: string) => ({ ok: true, wikidata: id, viaf: '100185495', varianti: ['Bartolus de Saxoferrato'] }));
    });

    await page.locator('#btn-tab-tags').click();
    await page.locator('#btn-anagrafica').click();
    await page.locator('#authority-list .tag-manager-row button[aria-label^="Collega a Wikidata"]').click();
    const candidati = page.locator('#authority-collega-risultati button');
    await expect(candidati).toHaveCount(2);
    await expect(candidati.nth(1)).toContainText('<img');
    await candidati.nth(0).click();

    await expect(page.locator('#authority-elenco')).toBeVisible();
    const riga = page.locator('#authority-list .tag-manager-row').first();
    await expect(riga.locator('a.auth-id')).toHaveText(['Q312599', 'VIAF 100185495']);
    await expect(riga.locator('a.auth-id').first()).toHaveAttribute('href', 'https://www.wikidata.org/wiki/Q312599');
    await expect(riga.locator('.auth-nome')).toHaveAttribute('title', /Bartolus de Saxoferrato/);
    const voce = await page.evaluate(() => (window as any).Model.voceAuthority(appData, 'persona', 'Bartolo'));
    expect([voce.wikidata, voce.viaf]).toEqual(['Q312599', '100185495']);

    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('authority-cerca');
      ipcMain.handle('authority-cerca', () => ({ ok: false, codice: 'rete' }));
    });
    await riga.locator('button[aria-label^="Collega a Wikidata"]').click();
    await expect(page.locator('#authority-collega-esito')).toContainText('non raggiungibile');
    await page.locator('#authority-scollega').click();
    await expect(page.locator('#authority-list .tag-manager-row a.auth-id')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).Model.voceAuthority(appData, 'persona', 'Bartolo').wikidata)).toBeUndefined();
  });

  test('F19 — il conteggio dei collegamenti delle card coincide con relazioniRisolte, ed è nel badge', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    const esito = await page.evaluate(async () => {
      const w = window as any;
      // @ts-ignore
      appData.manoscritti.push(
        { id: 'r-a', segnatura: 'RA', cartella: '', relazioni: [{ id: 'r-b' }, { id: 'r-b' }, { id: 'r-a' }, { id: 'fantasma' }] },
        { id: 'r-b', segnatura: 'RB', cartella: '', relazioni: [{ id: 'r-a', tipo: 'copia' }] },
        { id: 'r-c', segnatura: 'RC', cartella: '', relazioni: [{ id: 'r-b' }] },
        { id: 'r-d', segnatura: 'RD', cartella: '' });
      await w.Store.commit();
      // @ts-ignore
      const indice = w.contaCollegamenti(appData.manoscritti);
      return ['r-a', 'r-b', 'r-c', 'r-d'].map(id => {
        const r = w.relazioniRisolte(id);
        return [id, indice.get(id) || 0, r.uscenti.length + r.entranti.length];
      });
    });
    for (const [id, indice, atteso] of esito) expect(indice, id).toBe(atteso);
    await expect(page.locator('#card-r-b .card-badge-link')).toContainText('3');
  });
});
