import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

// `appData` vive nello scope del bundle del renderer, non su `window`: dentro page.evaluate
// è una variabile globale come le altre, e va solo dichiarata al compilatore dello spec.
declare const appData: any;

// Fasi 3.3 (vocabolari controllati), 3.5 (relazioni e anagrafica) e 3.6 (segnature
// ripetute), provate nell'app vera.
//
// In ogni semina c'è una scheda-esca che NON deve corrispondere: senza, un'asserzione su un
// conteggio passerebbe anche a operazione inerte.

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

/** Lega un campo del tipo `imbreviature` a un vocabolario d'archivio. */
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

  // --- 3.3 -------------------------------------------------------------------

  test('3.3 — l\'archivio nasce con i vocabolari predefiniti, non legati a nessun campo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    const esito = await page.evaluate(() => {
      const w = window as any;
      const tipo = appData.tipiDocumento.find((t: any) => t.id === 'imbreviature');
      return {
        versione: appData.schemaVersion,
        ids: Object.keys(w.Model.vocabolari(appData)).sort(),
        // `tipo_di_atto` è un campo del modello predefinito: deve essere rimasto TESTO,
        // o ogni valore già scritto in archivio risulterebbe "non previsto".
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
    // Prima voce vuota + i valori del vocabolario predefinito (4).
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
    // Un doppione di sola maiuscola non deve allungare la lista.
    const dopo = await page.evaluate(async () => {
      await (window as any).aggiungiValoreVocabolario('supporto', 'Cartapecora');
      return (window as any).Model.valoriVocabolario(appData, 'supporto').length;
    });
    expect(dopo).toBe(valori.length);
  });

  test('3.3 — rinominare un valore lo aggiorna in tutte le schede legate', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await legaCampo(page, 'supporto', 'supporto');
    await semina(page, [
      { segnatura: 'A', supporto: 'pergamena' },
      { segnatura: 'B', supporto: 'pergamena' },
      // L'esca porta lo STESSO valore, ma in un campo che al vocabolario non è legato:
      // una rinomina che spazzasse tutti i campi di testo la toccherebbe lo stesso.
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

  // --- 3.6 -------------------------------------------------------------------

  test('3.6 — il rilevatore trova le segnature ripetute e ignora le altre', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [
      { segnatura: 'ASP 12' },
      { segnatura: 'asp  12' },   // stessa segnatura: maiuscole e spazi doppi non contano
      { segnatura: 'ESCA' },
      { segnatura: '' }           // le schede non ancora inventariate non sono duplicate fra loro
    ]);

    await page.evaluate(() => (window as any).apriDuplicati());
    await expect(page.locator('#duplicati-modal')).toBeVisible();
    await expect(page.locator('#duplicati-list .dup-gruppo')).toHaveCount(1);
    await expect(page.locator('#duplicati-list .dup-gruppo').first()).toContainText('ASP 12');
    await expect(page.locator('#duplicati-list')).not.toContainText('ESCA');
  });

  // --- 3.5 -------------------------------------------------------------------

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
        // La scheda di arrivo NON viene toccata: il verso opposto è calcolato.
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

    // Riaprendola, il collegamento deve tornare nel form: se non tornasse, il primo
    // salvataggio successivo lo cancellerebbe senza che nessuno se ne accorga.
    const id = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'NUOVA').id);
    await page.evaluate((rid: string) => (window as any).editItem(rid), id);
    await expect(page.locator('#form-relazioni-list .rel-riga')).toHaveCount(1);
  });

  test('3.5 — persone e luoghi si raccolgono dalle schede, con il conteggio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase3');
    await semina(page, [
      { segnatura: 'A', attori_dinamici: [{ k: 'Venditore', v: 'Bartolo' }], dataTopica: 'Perugia' },
      { segnatura: 'B', attori_dinamici: [{ k: 'Teste', v: 'bartolo' }], dataTopica: 'Perùgia' },
      // Esca: il ruolo NON deve finire in anagrafica, e un campo non marcato nemmeno.
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

    // Dal lato che PORTA il rimando: compare fra gli uscenti.
    await page.evaluate(() => {
      const w = window as any;
      w.apriCollegamenti(appData.manoscritti.find((m: any) => m.segnatura === 'COPIA').id);
    });
    await expect(page.locator('#relazioni-modal')).toBeVisible();
    await expect(page.locator('#relazioni-body')).toContainText('ORIGINALE');
    await expect(page.locator('#relazioni-body')).not.toContainText('ESCA');

    // Dal lato PUNTATO: il rimando non è nel suo record, eppure deve vedersi. È
    // l'asserzione che distingue un backlink calcolato da un dato mai mostrato.
    await page.evaluate(() => {
      const w = window as any;
      w.chiudiCollegamenti();
      w.apriCollegamenti(appData.manoscritti.find((m: any) => m.segnatura === 'ORIGINALE').id);
    });
    const entranti = page.locator('#relazioni-body .rel-riga');
    await expect(entranti).toHaveCount(1);
    await expect(entranti.first()).toContainText('COPIA');

    // E porta davvero alla scheda: il collegamento serve a arrivarci.
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

    // "Con collegamenti" deve prendere DUE schede: A, che porta il rimando, e B, che è solo
    // puntata — se ne prendesse una, il filtro guarderebbe il solo verso uscente.
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

    // Due badge: uno sulla scheda che rimanda, uno su quella richiamata.
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

    // Si toglie l'unico collegamento e si salva.
    await page.locator('#form-relazioni-list .rel-riga button').click();
    await expect(page.locator('#form-relazioni-list .rel-riga')).toHaveCount(0);
    await page.locator('#btn-submit-form').click();

    // ⚠️ L'asserzione della regressione: il salvataggio di una scheda esistente è un MERGE,
    // e un merge non sa esprimere una cancellazione. Senza il contratto "undefined = togli
    // la chiave" (vedi Store.updateManoscritto), `relazioni` restava quella vecchia e il
    // rimando ricompariva — dal record, dal badge e dal backlink dell'altra scheda.
    await expect.poll(async () => {
      const m = await scheda(page, 'A');
      return m ? (m.relazioni || []).length : -1;
    }).toBe(0);

    // E sparisce anche il verso entrante, che è calcolato: se restasse, vorrebbe dire che
    // il dato è ancora lì.
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
      // L'esca: un secondo rimando da A che NON deve sparire con l'eliminazione dell'altro.
      await w.collegaSchede(a.id, esca.id, 'stessa mano');
      await w.Store.deleteManoscritto(bersaglio.id);

      const dopo = appData.manoscritti.find((m: any) => m.segnatura === 'A');
      return {
        restanti: w.Model.relazioni(dopo).map((r: any) => r.tipo),
        tombstone: (appData.deletedIds || []).includes(bersaglio.id)
      };
    });

    expect(esito.tombstone).toBe(true);
    // Resta solo il rimando all'esca: un elenco di collegamenti che non portano da nessuna
    // parte avrebbe lo stesso aspetto di quelli buoni.
    expect(esito.restanti).toEqual(['stessa mano']);
  });

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

    // Tre nodi e due archi: la scheda ISOLATA non entra, o su un archivio vero il grafo
    // sarebbe una nuvola di puntini fermi intorno alla figura che interessa.
    await expect(page.locator('#grafo-svg .grafo-nodo')).toHaveCount(3);
    await expect(page.locator('#grafo-svg .grafo-arco')).toHaveCount(2);
    await expect(page.locator('#grafo-svg')).not.toContainText('ISOLATA');
    await expect(page.locator('#grafo-riassunto')).toContainText('3');

    // Un clic su A la sceglie: A e il PERNO restano accesi, B si spegne.
    const idA = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'A').id);
    await page.locator('#grafo-svg .grafo-nodo[data-id="' + idA + '"] circle').click();
    await expect(page.locator('#grafo-svg .grafo-nodo.scelto')).toHaveCount(1);
    await expect(page.locator('#grafo-svg .grafo-nodo.spento')).toHaveCount(1);
    // Il riquadro laterale dice a che cosa è collegata, nei due versi.
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
    // Una tela vuota è indistinguibile da un errore: il messaggio dice anche DOVE si
    // aggiungono i collegamenti.
    await expect(page.locator('#grafo-avviso')).toBeVisible();
    await expect(page.locator('#grafo-svg .grafo-nodo')).toHaveCount(0);
  });
});
