import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, getAppData } from './helpers';
import * as path from 'path';

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'sample.pdf');

test.describe('Vista Trascrizione', () => {
  test('apertura con allegato immagine mostra editor e anteprima', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-IMG', FIXTURE_PNG);

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await expect(page.locator('#trasc-img-preview')).toBeVisible();
    const src = await page.locator('#trasc-img-preview').getAttribute('src');
    expect(src).toBeTruthy();

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Nota di trascrizione');
    await expect(page.locator('#trascrizione-editor')).toContainText('Nota di trascrizione');
  });

  test('apertura con allegato PDF mostra la preview PDF', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-PDF', FIXTURE_PDF);

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-pdf-preview')).toBeVisible();
    const src = await page.locator('#trasc-pdf-preview').getAttribute('src');
    expect(src).toBeTruthy();
  });

  test('thumbnails e navigazione tra due allegati', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-MULTI', FIXTURE_PNG);

    // Aggiunge un secondo allegato tramite l'editor di trascrizione.
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#trascrizione-thumbnails')).toBeVisible();
    await expect(page.locator('#trascrizione-thumbnails .allegato-btn')).toHaveCount(2);

    await expect(page.locator('#btn-next-allegato')).toBeVisible();
    await page.locator('#btn-next-allegato').click();
    await expect(page.locator('#trasc-pdf-preview')).toBeVisible();

    await page.locator('#btn-prev-allegato').click();
    await expect(page.locator('#trasc-img-preview')).toBeVisible();
  });

  test('Alt+ArrowRight cambia allegato da tastiera', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-KEY', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#trascrizione-thumbnails .allegato-btn')).toHaveCount(2);

    await page.locator('#view-trascrizione').click();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.locator('#trasc-pdf-preview')).toBeVisible();

    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.locator('#trasc-img-preview')).toBeVisible();
  });

  test('Ctrl+S salva la trascrizione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-SAVE', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Testo da salvare');
    await page.keyboard.press('Control+s');

    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 8_000 });
    const appData = await getAppData(page);
    const rec = appData.manoscritti.find((m: any) => m.id === id);
    expect(rec.trascrizione).toContain('Testo da salvare');
  });

  test('Alt+F attiva/disattiva il fullscreen dell\'editor', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-FULL', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    const isHidden = () => page.evaluate(() =>
      document.getElementById('trascrizione-editor-panel')!.classList.contains('hidden'),
    );

    // Alt da solo attiva il menu nativo su Windows/Electron: dispatch diretto
    // dell'evento invece di keyboard.press, per testare l'handler in isolamento.
    const dispatchAltF = () => page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', altKey: true, bubbles: true }));
    });

    await dispatchAltF();
    await expect.poll(isHidden).toBe(true);

    await dispatchAltF();
    await expect.poll(isHidden).toBe(false);
  });

  test('#btn-collapse-editor collassa e riespande il pannello editor', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-COLLAPSE', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    const isHidden = () => page.evaluate(() =>
      document.getElementById('trascrizione-editor-panel')!.classList.contains('hidden'),
    );

    await page.locator('#btn-collapse-editor').click();
    await expect.poll(isHidden).toBe(true);

    await page.locator('#btn-collapse-editor').click();
    await expect.poll(isHidden).toBe(false);
  });

  test('uscire con modifiche non salvate mostra il modal di conferma', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-DIRTY', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Non salvato');

    await page.locator('#btn-back-to-list-trasc').click();
    await expect(page.locator('#unsaved-modal')).toBeVisible();

    await page.evaluate(() => (window as any).confermaUscitaTrascrizione());
    await expect(page.locator('#view-list')).toBeVisible();
  });

  // --- Fase 2.3-bis: trascrizione per allegato --------------------------------
  //
  // Il difetto segnalato: con più carte, cambiando allegato il pannello di sinistra
  // restava fermo sul testo precedente. La trascrizione appartiene ora alla carta.

  /** Scheda con due allegati (immagine + PDF). Ritorna l'id. */
  async function creaConDueAllegati(page: any, segnatura: string): Promise<string> {
    await page.locator('#btn-tab-add').click();
    await expect(page.locator('#manoscritto-form')).toBeVisible();
    await page.locator('#form-segnatura').fill(segnatura);
    await page.locator('#form-allegato').setInputFiles([FIXTURE_PNG, FIXTURE_PDF]);
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('main')).toContainText(segnatura, { timeout: 10_000 });
    return page.evaluate((seg: string) => {
      // @ts-ignore -- `appData` è una `let` globale.
      return appData.manoscritti.find((m: any) => m.segnatura === seg).id;
    }, segnatura);
  }

  async function vaiAllaCarta(page: any, segnatura: string, indice: number) {
    await page.evaluate((args: any) => {
      // @ts-ignore
      const m = appData.manoscritti.find((x: any) => x.segnatura === args.seg);
      return (window as any).cambiaAllegatoTrascrizione(m.allegati[args.i].nome, m.allegati[args.i].tipo, args.i);
    }, { seg: segnatura, i: indice });
  }

  async function scriviNellEditor(page: any, testo: string) {
    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type(testo);
  }

  test('cambiando carta l\'editor segue l\'allegato mostrato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-CARTE-1');
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();

    await scriviNellEditor(page, 'Testo della prima carta');

    // Seconda carta: l'editor dev'essere vuoto, non mostrare il testo della prima.
    await vaiAllaCarta(page, 'MS-CARTE-1', 1);
    await expect(page.locator('#trascrizione-editor')).not.toContainText('Testo della prima carta');

    await scriviNellEditor(page, 'Testo della seconda carta');

    // Ritorno alla prima: il testo di prima dev'essere ancora lì, e da solo.
    await vaiAllaCarta(page, 'MS-CARTE-1', 0);
    await expect(page.locator('#trascrizione-editor')).toContainText('Testo della prima carta');
    await expect(page.locator('#trascrizione-editor')).not.toContainText('Testo della seconda carta');
  });

  test('il salvataggio conserva il testo di TUTTE le carte, non solo di quella a schermo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-CARTE-2');
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);

    await scriviNellEditor(page, 'Carta uno');
    await vaiAllaCarta(page, 'MS-CARTE-2', 1);
    await scriviNellEditor(page, 'Carta due');
    await page.evaluate(() => (window as any).salvaTrascrizione());

    const dati = await getAppData(page);
    const rec = dati.manoscritti.find((m: any) => m.id === id);
    expect(rec.allegati[0].trascrizione).toContain('Carta uno');
    expect(rec.allegati[1].trascrizione).toContain('Carta due');
    // `m.trascrizione` resta popolata come forma derivata: è ciò che tiene in piedi
    // ricerca, filtro "ha trascrizione" e diff del merge senza modificarli, ed è ciò che
    // mostra il testo a un collega con una versione precedente dell'app.
    expect(rec.trascrizione).toContain('Carta uno');
    expect(rec.trascrizione).toContain('Carta due');
  });

  test('la ricerca trova la scheda per il testo di qualunque carta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-CARTE-3');
    // Scheda-esca: senza, l'asserzione passerebbe anche a indice inerte.
    await createItemWithAttachment(page, 'ESCA-CARTE', FIXTURE_PNG);

    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await vaiAllaCarta(page, 'MS-CARTE-3', 1);
    await scriviNellEditor(page, 'Bartholomeus notarius');
    await page.evaluate(() => (window as any).salvaTrascrizione());

    const trovati = await page.evaluate(() => {
      const tokens = (window as any).tokenizzaRicerca('bartholomeus');
      // @ts-ignore
      return appData.manoscritti
        .filter((m: any) => (window as any).objectMatchesTokens(m, tokens))
        .map((m: any) => m.segnatura);
    });
    expect(trovati).toEqual(['MS-CARTE-3']);
  });

  test('una trascrizione dell\'archivio vecchio migra sulla prima carta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-CARTE-4');

    // Stato "archivio vecchio": testo sul record, nessun campo sulle carte.
    await page.evaluate(async (recId: string) => {
      // @ts-ignore
      const m = appData.manoscritti.find((x: any) => x.id === recId);
      m.trascrizione = '<p>Lettura fatta prima dell aggiornamento</p>';
      for (const a of m.allegati) delete a.trascrizione;
      await (window as any).Store.commit();
    }, id);

    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trascrizione-editor')).toContainText('Lettura fatta prima');

    await page.evaluate(() => (window as any).salvaTrascrizione());
    const dati = await getAppData(page);
    const rec = dati.manoscritti.find((m: any) => m.id === id);
    expect(rec.allegati[0].trascrizione).toContain('Lettura fatta prima');
  });

  test('l\'etichetta dice quale carta si sta trascrivendo, e solo con più carte', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const due = await creaConDueAllegati(page, 'MS-CARTE-5');
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), due);
    await expect(page.locator('#trascrizione-carta')).toBeVisible();
    await expect(page.locator('#trascrizione-carta')).toContainText('1');

    await vaiAllaCarta(page, 'MS-CARTE-5', 1);
    await expect(page.locator('#trascrizione-carta')).toContainText('2');

    // Con UNA sola carta l'etichetta sarebbe una riga che ripete l'ovvio.
    await page.evaluate(() => (window as any).chiudiTrascrizione());
    const una = await createItemWithAttachment(page, 'MS-CARTE-6', FIXTURE_PNG);
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), una);
    await expect(page.locator('#trascrizione-carta')).toBeHidden();
  });
});
