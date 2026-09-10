import { test, expect } from './fixtures';
import { stubDialog } from './fixtures';
import { createLocalWorkspace, getAppData, dismissOverlays } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Fase 3.1 — campi tipizzati.
 *
 * Il modulo puro è coperto da `test/model.test.js`; qui si verifica il giro che quel test
 * non può vedere: il tipo dichiarato nel modale dei modelli → il controllo giusto nel form
 * → il valore scritto nel record **nel suo tipo** → e di nuovo nel form riaprendo la
 * scheda. È il percorso in cui un valore booleano torna facilmente stringa senza che nulla
 * segnali l'errore.
 */

/** Crea un tipo documento con tre campi tipizzati, passando dalla UI vera. */
async function creaTipoConCampi(page) {
  await page.evaluate(() => (window as any).apriNewTypeModal());
  await expect(page.locator('#new-type-modal')).toBeVisible();
  await page.locator('#custom-type-name').fill('Codice tipizzato');

  for (const nome of ['carte', 'supporto', 'digitalizzato', 'permalink']) {
    await page.locator('#custom-type-extra-input').fill(nome);
    await page.evaluate(() => (window as any).aggiungiCampoCustom());
  }

  const configura = async (campo: string, tipo: string, extra: (p) => Promise<void> = async () => {}) => {
    await page.evaluate((c) => {
      const pill = document.querySelector(`.custom-field-item[data-val="${c}"]`);
      (pill!.querySelector('.pill-config') as HTMLButtonElement).click();
    }, campo);
    await expect(page.locator('#campo-editor')).toBeVisible();
    await page.locator('#campo-editor-tipo').selectOption(tipo);
    await extra(page);
    await page.evaluate(() => (window as any).confermaEditorCampo());
    await expect(page.locator('#campo-editor')).toBeHidden();
  };

  await configura('carte', 'number', async (p) => { await p.locator('#campo-editor-obbligatorio').check(); });
  await configura('supporto', 'enum', async (p) => { await p.locator('#campo-editor-opzioni').fill('pergamena\ncarta'); });
  await configura('digitalizzato', 'boolean');
  await configura('permalink', 'url');

  await page.evaluate(() => (window as any).confermaCreaTipo());
  await expect(page.locator('#new-type-modal')).toBeHidden();
}

test.describe('Campi tipizzati', () => {

  test('3.1.1 — il tipo dichiarato finisce in campiDef, non dentro campi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    const tipo = await page.evaluate(() => {
      // @ts-ignore -- `appData` è una `let` globale (script classico).
      const d = appData as any;
      return d.tipiDocumento.find((t: any) => t.nome === 'Codice tipizzato');
    });
    // ⚠️ `campi` resta un elenco di STRINGHE: un oggetto qui manderebbe in errore ogni
    // versione precedente alla 3.1, che fa `campoId.replace(...)` — su un archivio
    // condiviso, il form di un collega che non ha aggiornato.
    expect(tipo.campi).toEqual(['carte', 'supporto', 'digitalizzato', 'permalink']);
    expect(tipo.campi.every((c: any) => typeof c === 'string')).toBe(true);
    expect(tipo.campiDef.carte.tipo).toBe('number');
    expect(tipo.campiDef.carte.obbligatorio).toBe(true);
    expect(tipo.campiDef.supporto.opzioni).toEqual(['pergamena', 'carta']);
    expect(tipo.campiDef.digitalizzato.tipo).toBe('boolean');
    expect(tipo.campiDef.permalink.tipo).toBe('url');
  });

  test('3.1.2 — il form rende il controllo giusto per ogni tipo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-tipo-documento').selectOption({ label: 'Codice tipizzato' });
    await page.evaluate(() => (window as any).renderDynamicFields());

    // Un numero è un `input[type=number]`, non un campo di testo che accetta "dodici".
    await expect(page.locator('#dyn-carte')).toHaveAttribute('type', 'number');
    await expect(page.locator('#dyn-digitalizzato')).toHaveAttribute('type', 'checkbox');
    await expect(page.locator('#dyn-permalink')).toHaveAttribute('type', 'url');
    // L'elenco a scelta ha una voce vuota in testa: senza, aprire una scheda nuova
    // equivarrebbe ad aver già scelto il primo valore.
    const opzioni = await page.locator('#dyn-supporto option').allTextContents();
    expect(opzioni.length).toBe(3);
    expect(opzioni.slice(1)).toEqual(['pergamena', 'carta']);
    // L'obbligo si vede prima di salvare, non solo quando blocca.
    await expect(page.locator('label', { hasText: 'carte' }).first()).toContainText('*');
  });

  test('3.1.3 — i valori si salvano nel loro tipo e tornano nel form', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-tipo-documento').selectOption({ label: 'Codice tipizzato' });
    await page.evaluate(() => (window as any).renderDynamicFields());
    await page.locator('#form-segnatura').fill('TIP-1');
    await page.locator('#dyn-carte').fill('12');
    await page.locator('#dyn-supporto').selectOption('pergamena');
    await page.locator('#dyn-digitalizzato').check();
    await page.locator('#dyn-permalink').fill('https://archivio.example/12');
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const m = (await getAppData(page)).manoscritti[0];
    // Il punto della fase: 12 è un numero e "sì" è un booleano. Come stringhe, l'ordinamento
    // metterebbe "12" prima di "9" e il filtro non saprebbe distinguere un sì da un no.
    expect(m.carte).toBe(12);
    expect(typeof m.carte).toBe('number');
    expect(m.digitalizzato).toBe(true);
    expect(typeof m.digitalizzato).toBe('boolean');
    expect(m.supporto).toBe('pergamena');

    // Riaprendo la scheda i controlli devono ritrovare il proprio valore: `el.value = true`
    // su una casella non la spunta, e salvando si cancellerebbe il sì.
    await page.evaluate((id) => (window as any).editItem(id), m.id);
    await expect(page.locator('#dyn-carte')).toHaveValue('12');
    await expect(page.locator('#dyn-digitalizzato')).toBeChecked();
    await expect(page.locator('#dyn-supporto')).toHaveValue('pergamena');
  });

  test('3.1.4 — obbligatorio blocca, unico avvisa e lascia salvare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-tipo-documento').selectOption({ label: 'Codice tipizzato' });
    await page.evaluate(() => (window as any).renderDynamicFields());
    await page.locator('#form-segnatura').fill('OBB-1');
    // `carte` è obbligatorio e resta vuoto.
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));

    await expect(page.locator('#toast-container')).toContainText('obbligatorio');
    expect((await getAppData(page)).manoscritti.length).toBe(0);

    // Un numero non numerico non passa (il controllo `number` lo rifiuta a monte, quindi si
    // prova la strada che un utente ha davvero: valore valido → la scheda si salva).
    await page.locator('#dyn-carte').fill('7');
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
  });

  test('3.1.5 — un valore ripetuto in un campo unico avvisa ma NON blocca', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');

    // Un tipo con un solo campo, dichiarato unico.
    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#custom-type-name').fill('Con inventario');
    await page.locator('#custom-type-extra-input').fill('inventario');
    await page.evaluate(() => (window as any).aggiungiCampoCustom());
    await page.evaluate(() => {
      const pill = document.querySelector('.custom-field-item[data-val="inventario"]');
      (pill!.querySelector('.pill-config') as HTMLButtonElement).click();
    });
    await page.locator('#campo-editor-unico').check();
    await page.evaluate(() => (window as any).confermaEditorCampo());
    await page.evaluate(() => (window as any).confermaCreaTipo());

    const salva = async (segnatura: string, inventario: string) => {
      await page.evaluate(() => (window as any).switchTab('add'));
      await page.locator('#form-tipo-documento').selectOption({ label: 'Con inventario' });
      await page.evaluate(() => (window as any).renderDynamicFields());
      await page.locator('#form-segnatura').fill(segnatura);
      await page.locator('#dyn-inventario').fill(inventario);
      await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
        .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
    };

    await salva('U-1', 'ASP 1');
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    await salva('U-2', 'asp 1');

    // ⚠️ La seconda scheda ESISTE: un fondo reale contiene segnature ripetute per errori di
    // inventariazione antecedenti alla schedatura, e rifiutarle costringerebbe l'archivista
    // a falsificare il dato per poter salvare. Si avvisa e si salva.
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(2);
    await expect(page.locator('#toast-container')).toContainText('U-1');
  });

  test('3.1.6 — i valori tipizzati arrivano leggibili nella lista e nel CSV', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    await page.evaluate(async () => {
      const w = window as any;
      // @ts-ignore -- `appData` è una `let` globale.
      const d = appData as any;
      const tipo = d.tipiDocumento.find((t: any) => t.nome === 'Codice tipizzato');
      d.manoscritti.push(w.Model.creaScheda({
        segnatura: 'CSV-1', tipoDocumento: tipo.id,
        carte: 12, supporto: 'pergamena', digitalizzato: false, permalink: 'https://archivio.example/1'
      }));
      await w.Store.commit();
      await w.flushSalvataggio();
    });

    // Nella scheda a video un "no" è un dato: senza il ramo dedicato la riga sparirebbe,
    // cioè la scheda direbbe "non digitalizzato" tacendo.
    await expect(page.locator('#card-' + (await getAppData(page)).manoscritti[0].id)).toContainText('No');

    const out = path.join(userDataDir, 'tipizzato.csv');
    await stubDialog(electronApp, { canceled: false, filePath: out });
    await page.evaluate(() => (window as any).esportaCartellaCsv('csv'));
    await expect.poll(() => fs.existsSync(out), { timeout: 10_000 }).toBe(true);
    const csv = fs.readFileSync(out, 'utf8');
    // `false` in una cella di Excel è gergo, e in italiano non è nemmeno un valore logico.
    expect(csv).toContain('No');
    expect(csv).not.toContain('false');
    expect(csv).toContain('12');
    expect(csv).toContain('pergamena');
  });

  test('3.1.8 — il modello della tendina e quello installato hanno gli stessi campi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');

    // ⚠️ Il difetto che questo test esiste per intercettare: i tre modelli predefiniti erano
    // scritti in TRE posti (il valore iniziale di appData, `initData` e il modale dei tipi).
    // Bastava aggiungerne un campo a uno e dimenticarne una copia perché il tipo creato dalla
    // tendina avesse campi diversi dal tipo che l'app installa da sola, con lo stesso nome e
    // senza alcun errore.
    for (const modello of ['imbreviature', 'atti', 'fiscali']) {
      await page.evaluate(() => (window as any).apriNewTypeModal());
      await page.locator('#new-type-select').selectOption(modello);
      await page.evaluate(() => (window as any).applicaModello());
      const dallaTendina = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.custom-field-item')).map((p: any) => p.dataset.val));
      await page.evaluate(() => (window as any).chiudiNewTypeModal());

      const installato = await page.evaluate((id) => {
        // @ts-ignore -- `appData` è una `let` globale.
        return (appData as any).tipiDocumento.find((t: any) => t.id === id).campi;
      }, modello);
      expect(dallaTendina, `modello ${modello}`).toEqual(installato);
    }

    // `dataCronica` è dichiarata `date` (Fase 3.1): oggi si comporta come testo, ma è ciò
    // che permetterà alla 3.2 di trovare i campi da convertire. `dataTopica` resta testo
    // perché è un LUOGO, non una data.
    const tipi = await page.evaluate(() => {
      const w = window as any;
      // @ts-ignore -- `appData` è una `let` globale.
      const t = (appData as any).tipiDocumento.find((x: any) => x.id === 'imbreviature');
      return {
        cronica: w.Model.definizioneCampo(t, 'dataCronica', w.CONFIG_CAMPI).tipo,
        topica: w.Model.definizioneCampo(t, 'dataTopica', w.CONFIG_CAMPI).tipo,
        attori: w.Model.definizioneCampo(t, 'attori_dinamici', w.CONFIG_CAMPI).tipo
      };
    });
    expect(tipi.cronica).toBe('date');
    expect(tipi.topica).toBe('text');
    expect(tipi.attori).toBe('dynamic_list');
  });

  test('3.1.7 — un tipo riaperto conserva le definizioni dei campi', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);
    const id = await page.evaluate(() => {
      // @ts-ignore -- `appData` è una `let` globale.
      return (appData as any).tipiDocumento.find((t: any) => t.nome === 'Codice tipizzato').id;
    });

    // Riaprire il tipo per rinominarlo non deve azzerare i tipi dei suoi campi: la pillola
    // ricostruita partirebbe da `text`, e il salvataggio li perderebbe tutti in silenzio.
    await page.evaluate((id) => (window as any).modificaTipoDocumento(id), id);
    await expect(page.locator('#new-type-modal')).toBeVisible();
    await page.locator('#custom-type-name').fill('Codice tipizzato bis');
    await page.evaluate(() => (window as any).confermaCreaTipo());

    const tipo = await page.evaluate((id) => {
      // @ts-ignore -- `appData` è una `let` globale.
      return (appData as any).tipiDocumento.find((t: any) => t.id === id);
    }, id);
    expect(tipo.nome).toBe('Codice tipizzato bis');
    expect(tipo.campiDef.carte.tipo).toBe('number');
    expect(tipo.campiDef.supporto.opzioni).toEqual(['pergamena', 'carta']);
    expect(tipo.campiDef.digitalizzato.tipo).toBe('boolean');
  });
});
