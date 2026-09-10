import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, getAppData, openView } from './helpers';
import * as path from 'path';

/**
 * Fase 2.3 — OCR degli allegati.
 *
 * Il MOTORE è stubbato (gli handler IPC sostituiti nel main, vedi `stubMotore`) e non è un
 * compromesso: eseguire Tesseract davvero richiederebbe di scaricare decine di MB di dati
 * di lingua a ogni run di CI, durerebbe minuti per test e verificherebbe la qualità del
 * riconoscimento — che non è codice di questo progetto. Ciò che invece è codice di questo
 * progetto, e che qui si verifica sul serio, è tutto il resto: dove finisce il testo, che
 * cosa NON viene sovrascritto, e se la scheda diventa trovabile cercando una parola che
 * compare solo dentro la scansione.
 *
 * Il post-processing (sillabazione, paragrafi, marcatura dell'incertezza) è coperto a
 * freddo da `test/ocrText.test.js`, che esegue il modulo reale.
 */

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');

const TESTO_OCR = 'Instrumentum venditionis notarii Bartholomei de Perusio';
const HTML_OCR = '<p class="ocr-origine"><em>Bozza generata da OCR (ita)</em></p>\n<p>' + TESTO_OCR + '</p>';

/**
 * Sostituisce i due handler IPC del motore NEL MAIN, non l'oggetto `window.apiOcr`.
 *
 * Non è un dettaglio: gli oggetti esposti da `contextBridge` sono congelati, quindi un
 * `apiOcr.esegui = ...` nel renderer non solleva errori e non ha alcun effetto — il primo
 * tentativo di scrivere questi test è fallito esattamente così, con lo stub inerte e il
 * pulsante disabilitato per mancanza di lingue vere. Stubbando nel main, il test attraversa
 * per intero preload, canale IPC e ritorno dei dati: l'unica cosa finta è il motore.
 */
async function stubMotore(app, opzioni: { piano?: string; html?: string; confidenza?: number } = {}) {
  await app.evaluate(({ ipcMain }, o) => {
    (globalThis as any).__ocrChiamate = [];

    ipcMain.removeHandler('ocr-esegui');
    ipcMain.handle('ocr-esegui', (_evento: any, parametri: any) => {
      (globalThis as any).__ocrChiamate.push(parametri);
      return {
        ok: true,
        piano: o.piano,
        html: o.html,
        confidenza: o.confidenza,
        lingue: parametri.lingue,
        motore: 'tesseract',
        pagine: [{ numero: 1, origine: 'ocr', confidenza: o.confidenza }],
        paginePdf: 1,
        pagineElaborate: 1,
        caratteri: (o.piano || '').length
      };
    });

    // Una lingua installata: è lo stato di chi ha già usato la funzione. Senza, il pulsante
    // resta disabilitato e non ci sarebbe null'altro da verificare.
    ipcMain.removeHandler('ocr-lingue');
    ipcMain.handle('ocr-lingue', () => ({
      ok: true,
      lingue: [
        { codice: 'ita', nome: 'Italiano', installata: true, dimensione: 4000000 },
        { codice: 'lat', nome: 'Latino', installata: false, dimensione: 0 }
      ]
    }));
  }, { piano: opzioni.piano ?? TESTO_OCR, html: opzioni.html ?? HTML_OCR, confidenza: opzioni.confidenza ?? 92 });
}

/** Parametri con cui il renderer ha invocato il motore, letti dal main. */
async function chiamateMotore(app): Promise<any[]> {
  return app.evaluate(() => (globalThis as any).__ocrChiamate || []);
}

async function azzeraChiamate(app) {
  await app.evaluate(() => { (globalThis as any).__ocrChiamate = []; });
}

/** Nessuna lingua installata: il caso in cui il riconoscimento non può partire. */
async function stubSenzaLingue(app) {
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('ocr-lingue');
    ipcMain.handle('ocr-lingue', () => ({ ok: true, lingue: [] }));
  });
}

/** Apre il modale sulla scheda e lancia il riconoscimento con le opzioni date. */
async function eseguiOcr(page, id: string, opzioni: { bozza: boolean; indice: boolean }) {
  await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
  await expect(page.locator('#ocr-modal')).toBeVisible();
  // `apriOcrModal` è asincrona (interroga il main per l'elenco lingue) e abilita il pulsante
  // solo dopo: attendere la visibilità del modale non basta sotto carico, ed è la causa di
  // un flaky osservato una volta sul gruppo `data` a otto worker.
  await expect(page.locator('#ocr-confirm')).toBeEnabled();
  await page.locator('#ocr-dest-bozza').setChecked(opzioni.bozza);
  await page.locator('#ocr-dest-indice').setChecked(opzioni.indice);
  await page.locator('#ocr-confirm').click();
}

test.describe('OCR degli allegati', () => {

  test('2.3.1 — il testo riconosciuto viene salvato sull\'allegato', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-1', FIXTURE_PNG);
    await stubMotore(electronApp);

    await eseguiOcr(page, id, { bozza: false, indice: true });
    await expect(page.locator('#ocr-result')).toBeVisible();

    const dati = await getAppData(page);
    const rec = dati.manoscritti.find((m: any) => m.id === id);
    expect(rec.allegati[0].ocr.testo).toBe(TESTO_OCR);
    expect(rec.allegati[0].ocr.lingue).toBe('ita');
    expect(rec.allegati[0].ocr.confidenza).toBe(92);
    expect(rec.allegati[0].ocr.motore).toBe('tesseract');
    // Solo indice: la trascrizione non è stata toccata.
    expect((rec.trascrizione || '').trim()).toBe('');
  });

  test('2.3.2 — la scheda diventa trovabile cercando una parola presente solo nella scansione', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-2', FIXTURE_PNG);
    // Scheda-esca: ha un allegato ma NON l'OCR, e non contiene la parola cercata. Senza,
    // un'asserzione sul conteggio passerebbe anche a indicizzazione inerte.
    await createItemWithAttachment(page, 'ESCA-1', FIXTURE_PNG);

    await stubMotore(electronApp);
    await eseguiOcr(page, id, { bozza: false, indice: true });
    await expect(page.locator('#ocr-result')).toBeVisible();

    // `Bartholomei` compare SOLO nel testo OCR: non è in segnatura, titolo o note.
    const trovati = await page.evaluate(() => {
      const tokens = (window as any).tokenizzaRicerca('bartholomei');
      // @ts-ignore -- `appData` è una `let` globale.
      return appData.manoscritti
        .filter((m: any) => (window as any).objectMatchesTokens(m, tokens))
        .map((m: any) => m.segnatura);
    });
    expect(trovati).toEqual(['OCR-2']);
  });

  test('2.3.3 — la bozza entra nella trascrizione quando era vuota', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-3', FIXTURE_PNG);
    await stubMotore(electronApp);

    await eseguiOcr(page, id, { bozza: true, indice: true });
    await expect(page.locator('#ocr-result')).toBeVisible();

    const dati = await getAppData(page);
    const rec = dati.manoscritti.find((m: any) => m.id === id);
    expect(rec.trascrizione).toContain(TESTO_OCR);
    // La provenienza resta nel testo salvato: fra un anno deve essere ancora leggibile
    // che quel testo non l'ha battuto nessuno.
    expect(rec.trascrizione).toContain('ocr-origine');
  });

  test('2.3.4 — una trascrizione esistente non viene sovrascritta senza conferma', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-4', FIXTURE_PNG);

    const ORIGINALE = '<p>Lettura fatta a mano, ore di lavoro.</p>';
    await page.evaluate(async ({ rid, testo }) => {
      // @ts-ignore -- `appData` è una `let` globale.
      const rec = appData.manoscritti.find((m: any) => m.id === rid);
      rec.trascrizione = testo;
      await (window as any).Store.commit();
    }, { rid: id, testo: ORIGINALE });

    await stubMotore(electronApp);
    await eseguiOcr(page, id, { bozza: true, indice: true });

    // Il modale di conferma DEVE comparire: è la garanzia che rende la funzione usabile
    // su un archivio vero.
    await expect(page.locator('#ocr-overwrite-modal')).toBeVisible();
    await page.locator('#ocr-ow-cancel').click();
    await expect(page.locator('#ocr-result')).toBeVisible();

    const dati = await getAppData(page);
    const rec = dati.manoscritti.find((m: any) => m.id === id);
    expect(rec.trascrizione).toBe(ORIGINALE);
    // Annullare la bozza NON annulla il testo cercabile: sono due destinazioni distinte.
    expect(rec.allegati[0].ocr.testo).toBe(TESTO_OCR);
  });

  test('2.3.5 — "Aggiungi in fondo" conserva il testo esistente', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-5', FIXTURE_PNG);

    const ORIGINALE = '<p>Prima carta, già trascritta.</p>';
    await page.evaluate(async ({ rid, testo }) => {
      // @ts-ignore -- `appData` è una `let` globale.
      const rec = appData.manoscritti.find((m: any) => m.id === rid);
      rec.trascrizione = testo;
      await (window as any).Store.commit();
    }, { rid: id, testo: ORIGINALE });

    await stubMotore(electronApp);
    await eseguiOcr(page, id, { bozza: true, indice: false });
    await expect(page.locator('#ocr-overwrite-modal')).toBeVisible();
    await page.locator('#ocr-ow-append').click();
    await expect(page.locator('#ocr-result')).toBeVisible();

    const dati = await getAppData(page);
    const rec = dati.manoscritti.find((m: any) => m.id === id);
    expect(rec.trascrizione).toContain('gia');
    expect(rec.trascrizione).toContain(TESTO_OCR);
    expect(rec.trascrizione.indexOf('gia')).toBeLessThan(rec.trascrizione.indexOf(TESTO_OCR));
  });

  test('2.3.6 — il filtro "senza OCR" distingue le schede fatte da quelle da fare', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'FATTA-1', FIXTURE_PNG);
    await createItemWithAttachment(page, 'DAFARE-1', FIXTURE_PNG);

    await stubMotore(electronApp);
    await eseguiOcr(page, id, { bozza: false, indice: true });
    await expect(page.locator('#ocr-result')).toBeVisible();
    await page.locator('#ocr-modal [data-modal-cancel]').click();

    const conta = async (valore: string) => page.evaluate((v) => {
      // @ts-ignore -- `appData` è una `let` globale.
      return appData.manoscritti
        .filter((m: any) => (window as any).recordPassaFiltri(m, { ocr: v }))
        .map((m: any) => m.segnatura);
    }, valore);

    expect(await conta('si')).toEqual(['FATTA-1']);
    expect(await conta('no')).toEqual(['DAFARE-1']);
  });

  test('2.3.7 — il pulsante OCR non compare su una scheda senza allegati', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('NUDA-1');
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('main')).toContainText('NUDA-1', { timeout: 10_000 });

    const id = await page.evaluate(() => {
      // @ts-ignore -- `appData` è una `let` globale.
      return appData.manoscritti.find((m: any) => m.segnatura === 'NUDA-1').id;
    });

    await page.evaluate((rid) => (window as any).apriTrascrizione(rid), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    // `hidden-tab` e non `hidden`: `.btn` imposta display:inline-flex e batterebbe
    // l'utility Tailwind a parità di specificità (lezione della 1.1).
    await expect(page.locator('#btn-ocr-trasc')).toBeHidden();

    // E il modale non si apre nemmeno forzando la chiamata: niente da riconoscere.
    await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
    await expect(page.locator('#ocr-modal')).toBeHidden();
  });

  test('2.3.8 — il pulsante OCR compare quando la scheda ha un allegato', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-8', FIXTURE_PNG);
    await page.evaluate((rid) => (window as any).apriTrascrizione(rid), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await expect(page.locator('#btn-ocr-trasc')).toBeVisible();
  });

  test('2.3.9 — le lingue scelte arrivano al motore e vengono ricordate', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-9', FIXTURE_PNG);
    await stubMotore(electronApp);

    await eseguiOcr(page, id, { bozza: false, indice: true });
    await expect(page.locator('#ocr-result')).toBeVisible();

    const chiamate = await chiamateMotore(electronApp);
    expect(chiamate).toHaveLength(1);
    expect(chiamate[0].lingue).toEqual(['ita']);
    expect(chiamate[0].tipo).toBe('immagine');
    expect(chiamate[0].dpi).toBe(300);

    // La preferenza sta in localStorage, NON in appData: finirebbe nel database e quindi
    // nel sync, imponendo ai colleghi lingue che sulla loro macchina possono non esistere.
    const salvata = await page.evaluate(() => localStorage.getItem('archiview.ocr.lingue'));
    expect(salvata).toBe('ita');
    const dati = await getAppData(page);
    expect(dati.ocrLingue).toBeUndefined();
  });

  test('2.3.10 — OCR in massa salta gli allegati già riconosciuti', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const idFatta = await createItemWithAttachment(page, 'MASSA-1', FIXTURE_PNG);
    const idDaFare = await createItemWithAttachment(page, 'MASSA-2', FIXTURE_PNG);

    await stubMotore(electronApp);
    await eseguiOcr(page, idFatta, { bozza: false, indice: true });
    await expect(page.locator('#ocr-result')).toBeVisible();
    await page.locator('#ocr-modal [data-modal-cancel]').click();

    // Azzera il registro delle chiamate: contano solo quelle dell'esecuzione in massa.
    await azzeraChiamate(electronApp);
    await page.evaluate((ids) => {
      (window as any).selectedRecords = ids;
    }, [idFatta, idDaFare]);

    await page.evaluate(() => (window as any).ocrSelezionati());
    await expect(page.locator('#ocr-bulk-modal')).toBeHidden({ timeout: 15_000 });

    // Una sola chiamata: rifare l'OCR di ciò che è già fatto è ore di CPU per nulla.
    const chiamate = await chiamateMotore(electronApp);
    expect(chiamate).toHaveLength(1);

    const dati = await getAppData(page);
    expect(dati.manoscritti.find((m: any) => m.id === idDaFare).allegati[0].ocr.testo).toBe(TESTO_OCR);
  });

  test('2.3.11 — senza lingue installate il riconoscimento non parte', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-11', FIXTURE_PNG);

    await stubSenzaLingue(electronApp);
    await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
    await expect(page.locator('#ocr-modal')).toBeVisible();

    // Disabilitato e non nascosto: l'utente deve vedere che cosa manca, e accanto ha il
    // pulsante per rimediare.
    await expect(page.locator('#ocr-confirm')).toBeDisabled();
    await expect(page.locator('#ocr-body')).toContainText('Nessuna lingua installata');
  });
});
