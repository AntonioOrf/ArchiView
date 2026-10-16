import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, getAppData, openView } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Ocr' });

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');

const TESTO_OCR = 'Instrumentum venditionis notarii Bartholomei de Perusio';
const HTML_OCR = '<p class="ocr-origine"><em>Bozza generata da OCR (ita)</em></p>\n<p>' + TESTO_OCR + '</p>';

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

async function chiamateMotore(app): Promise<any[]> {
  return app.evaluate(() => (globalThis as any).__ocrChiamate || []);
}

async function azzeraChiamate(app) {
  await app.evaluate(() => { (globalThis as any).__ocrChiamate = []; });
}

async function stubSenzaLingue(app) {
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('ocr-lingue');
    ipcMain.handle('ocr-lingue', () => ({ ok: true, lingue: [] }));
  });
}

async function eseguiOcr(page, id: string, opzioni: { bozza: boolean; indice: boolean }) {
  await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
  await expect(page.locator('#ocr-modal')).toBeVisible();
  await expect(page.locator('#ocr-confirm')).toBeEnabled();
  await page.locator('#ocr-dest-bozza').setChecked(opzioni.bozza);
  await page.locator('#ocr-dest-indice').setChecked(opzioni.indice);
  await page.locator('#ocr-confirm').click();
}

test.describe('OCR degli allegati', () => {

  test('host PDF in sandbox: apre il PDF, legge il testo e disegna una pagina', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    await createItemWithAttachment(page, 'OCR-HOST', path.join(__dirname, 'fixtures', 'multipage.pdf'));
    const nome = (await getAppData(page)).manoscritti.find((m: any) => m.segnatura === 'OCR-HOST').allegati[0].nome;

    const esito = await electronApp.evaluate(async ({ BrowserWindow }, n) => {
      const cache = (process as any).mainModule.constructor._cache;
      const host = cache[Object.keys(cache).find((k) => /[\\/]ocr[\\/]pdfHost\.js$/.test(k))!].exports;
      const apertura = await host.apriPdf(n);
      const testo = await host.testoPagina(1);
      const img = await host.immaginePagina(1, 72);
      await host.chiudiPdf();
      const finestra = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith(host.SCHEMA + ':'));
      const sandbox = finestra ? finestra.webContents.getLastWebPreferences().sandbox : null;
      return { apertura, testoOk: !!(testo && testo.ok), pngOk: !!(img && img.ok && img.png && img.png.length > 100), sandbox };
    }, nome);
    expect(esito.apertura.ok).toBe(true);
    expect(esito.testoOk).toBe(true);
    expect(esito.pngOk).toBe(true);
    expect(esito.sandbox).toBe(true);
  });

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
    expect((rec.trascrizione || '').trim()).toBe('');
  });

  test('2.3.2 — la scheda diventa trovabile cercando una parola presente solo nella scansione', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-2', FIXTURE_PNG);
    await createItemWithAttachment(page, 'ESCA-1', FIXTURE_PNG);

    await stubMotore(electronApp);
    await eseguiOcr(page, id, { bozza: false, indice: true });
    await expect(page.locator('#ocr-result')).toBeVisible();

    const trovati = await page.evaluate(() => {
      const tokens = (window as any).tokenizzaRicerca('bartholomei');
      // @ts-ignore
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
    expect(rec.trascrizione).toContain('ocr-origine');
  });

  test('2.3.4 — una trascrizione esistente non viene sovrascritta senza conferma', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-4', FIXTURE_PNG);

    const ORIGINALE = '<p>Lettura fatta a mano, ore di lavoro.</p>';
    await page.evaluate(async ({ rid, testo }) => {
      // @ts-ignore
      const rec = appData.manoscritti.find((m: any) => m.id === rid);
      rec.trascrizione = testo;
      await (window as any).Store.commit();
    }, { rid: id, testo: ORIGINALE });

    await stubMotore(electronApp);
    await eseguiOcr(page, id, { bozza: true, indice: true });

    await expect(page.locator('#ocr-overwrite-modal')).toBeVisible();
    await page.locator('#ocr-ow-cancel').click();
    await expect(page.locator('#ocr-result')).toBeVisible();

    const dati = await getAppData(page);
    const rec = dati.manoscritti.find((m: any) => m.id === id);
    expect(rec.trascrizione).toBe(ORIGINALE);
    expect(rec.allegati[0].ocr.testo).toBe(TESTO_OCR);
  });

  test('2.3.5 — "Aggiungi in fondo" conserva il testo esistente', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-5', FIXTURE_PNG);

    const ORIGINALE = '<p>Prima carta, già trascritta.</p>';
    await page.evaluate(async ({ rid, testo }) => {
      // @ts-ignore
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
      // @ts-ignore
      return appData.manoscritti
        .filter((m: any) => (window as any).recordPassaFiltri(m, { ocr: v }))
        .map((m: any) => m.segnatura);
    }, valore);

    expect(await conta('si')).toEqual(['FATTA-1']);
    expect(await conta('no')).toEqual(['DAFARE-1']);
  });

  test('2.3.6b — installata una lingua dal gestore, il modale OCR si abilita senza riaprirlo', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-PRIMO-USO', FIXTURE_PNG);
    await electronApp.evaluate(({ ipcMain }) => {
      let installata = false;
      ipcMain.removeHandler('ocr-lingue');
      ipcMain.handle('ocr-lingue', () => ({
        ok: true,
        lingue: [{ codice: 'ita', nome: 'Italiano', installata, dimensione: installata ? 2600000 : 0 }],
      }));
      ipcMain.removeHandler('ocr-installa-lingua');
      ipcMain.handle('ocr-installa-lingua', () => { installata = true; return { ok: true }; });
    });

    await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
    await expect(page.locator('#ocr-modal')).toBeVisible();
    await expect(page.locator('#ocr-confirm')).toBeDisabled();

    await page.locator('#ocr-modal button', { hasText: 'Gestisci lingue' }).click();
    await expect(page.locator('#ocr-langs-modal')).toBeVisible();
    await page.locator('#ocr-langs-modal button', { hasText: 'Installa' }).click();
    await expect(page.locator('#ocr-langs-modal button', { hasText: 'Rimuovi' })).toBeVisible();
    await page.locator('#ocr-langs-modal button', { hasText: 'Chiudi' }).click();
    await expect(page.locator('#ocr-langs-modal')).toBeHidden();

    await expect(page.locator('#ocr-modal')).toBeVisible();
    await expect(page.locator('#ocr-confirm')).toBeEnabled();
    await expect(page.locator('#ocr-modal')).not.toContainText('Nessuna lingua installata');
  });

  test('2.3.7 — il pulsante OCR non compare su una scheda senza allegati', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('NUDA-1');
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('main')).toContainText('NUDA-1', { timeout: 10_000 });

    const id = await page.evaluate(() => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.segnatura === 'NUDA-1').id;
    });

    await page.evaluate((rid) => (window as any).apriTrascrizione(rid), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await expect(page.locator('#btn-ocr-trasc')).toBeHidden();

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

    await expect.poll(async () => (await page.evaluate(() => (window as any).apiSettings.get())).ocrLingue).toEqual(['ita']);
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

    await azzeraChiamate(electronApp);
    await page.evaluate((ids) => {
      (window as any).selectedRecords = ids;
    }, [idFatta, idDaFare]);

    await page.evaluate(() => (window as any).ocrSelezionati());
    await expect(page.locator('#ocr-bulk-modal')).toBeHidden({ timeout: 15_000 });

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

    await expect(page.locator('#ocr-confirm')).toBeDisabled();
    await expect(page.locator('#ocr-body')).toContainText('Nessuna lingua installata');
  });

  test('2.3.12 — su un PDF ogni pagina riconosciuta va sulla trascrizione della sua pagina', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-PDF', path.join(__dirname, 'fixtures', 'multipage.pdf'));
    await stubMotore(electronApp);
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('ocr-esegui');
      ipcMain.handle('ocr-esegui', () => ({
        ok: true,
        piano: 'Uno\n\nTre',
        html: '<p class="ocr-origine"><em>Bozza OCR</em></p>\n<p class="ocr-pagina"><strong>[p. 1]</strong></p>\n<p>Uno</p>\n<p class="ocr-pagina"><strong>[p. 3]</strong></p>\n<p>Tre</p>',
        confidenza: 90,
        lingue: ['ita'],
        motore: 'tesseract',
        pagine: [
          { numero: 1, origine: 'ocr', confidenza: 90, html: '<p>Uno</p>' },
          { numero: 2, origine: 'ocr', confidenza: 0, html: '' },
          { numero: 3, origine: 'ocr', confidenza: 90, html: '<p>Tre</p>' }
        ],
        paginePdf: 3,
        pagineElaborate: 3,
        caratteri: 8
      }));
    });

    await page.evaluate((rid) => (window as any).apriTrascrizione(rid), id);
    await expect(page.locator('#trasc-pdf-totale')).toHaveText('/ 3');
    await page.evaluate(() => (window as any).cambiaPaginaPdf(3));
    await expect(page.locator('#trasc-pdf-pagina')).toHaveValue('3');
    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Letto a mano');

    await eseguiOcr(page, id, { bozza: true, indice: false });
    await expect(page.locator('#ocr-overwrite-modal')).toBeVisible();
    await page.locator('#ocr-ow-append').click();
    await expect(page.locator('#ocr-result')).toBeVisible();

    const rec = (await getAppData(page)).manoscritti.find((m: any) => m.id === id);
    const pagine = rec.allegati[0].pagine;
    expect(pagine[0]).toContain('Uno');
    expect(pagine[0]).toContain('ocr-origine');
    expect(pagine[1] || '').toBe('');
    expect(pagine[2]).toContain('Letto a mano');
    expect(pagine[2]).toContain('Tre');
    expect(pagine[2].indexOf('Letto a mano')).toBeLessThan(pagine[2].indexOf('Tre'));
    expect(pagine[2]).not.toContain('ocr-origine');
    await expect(page.locator('#trascrizione-editor')).toContainText('Tre');
  });

  test('2.3.13 — PDF ricercabile: dialogo prima dell\'OCR, motore con pdf, record intatto', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-PDF', FIXTURE_PNG);
    await stubMotore(electronApp);
    await electronApp.evaluate(({ ipcMain }) => {
      (globalThis as any).__pdfChiamate = [];
      ipcMain.removeHandler('ocr-pdf-inizia');
      ipcMain.handle('ocr-pdf-inizia', (_e: any, nome: string) => {
        (globalThis as any).__pdfChiamate.push({ inizia: nome, ocrGiaFatti: (globalThis as any).__ocrChiamate.length });
        return { ok: true };
      });
      ipcMain.removeHandler('ocr-pdf-concludi');
      ipcMain.handle('ocr-pdf-concludi', (_e: any, scarta: boolean) => {
        (globalThis as any).__pdfChiamate.push({ concludi: scarta });
        return { ok: true, pagine: 1, nome: 'carta - OCR.pdf' };
      });
    });
    const prima = (await getAppData(page)).manoscritti.find((m: any) => m.id === id);

    await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
    await expect(page.locator('#ocr-confirm')).toBeEnabled();
    await page.locator('#ocr-dest-bozza').setChecked(false);
    await page.locator('#ocr-dest-indice').setChecked(false);
    await page.locator('#ocr-dest-pdf').setChecked(true);
    await page.locator('#ocr-confirm').click();
    await expect(page.locator('#ocr-result')).toContainText('carta - OCR.pdf');

    const pdf = await electronApp.evaluate(() => (globalThis as any).__pdfChiamate);
    expect(pdf).toHaveLength(2);
    expect(pdf[0].inizia).toMatch(/ - OCR\.pdf$/);
    expect(pdf[0].ocrGiaFatti).toBe(0);
    expect(pdf[1]).toEqual({ concludi: false });
    const chiamate = await chiamateMotore(electronApp);
    expect(chiamate).toHaveLength(1);
    expect(chiamate[0].pdf).toBe(true);

    const dopo = (await getAppData(page)).manoscritti.find((m: any) => m.id === id);
    expect(dopo.allegati[0].ocr).toBeUndefined();
    expect(dopo.lastModified).toBe(prima.lastModified);
  });

  test('2.3.15 — raddrizzamento: attivo con osd, comunicato nel risultato; spento senza', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-GIRATA', FIXTURE_PNG);
    await stubMotore(electronApp);

    await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
    await expect(page.locator('#ocr-confirm')).toBeEnabled();
    await expect(page.locator('#ocr-raddrizza')).toBeDisabled();
    await expect(page.locator('#ocr-raddrizza')).not.toBeChecked();
    await page.evaluate(() => (window as any).chiudiOcrModal());

    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('ocr-lingue');
      ipcMain.handle('ocr-lingue', () => ({
        ok: true,
        lingue: [
          { codice: 'ita', nome: 'Italiano', installata: true, dimensione: 4000000 },
          { codice: 'osd', nome: 'Rilevamento orientamento', installata: true, dimensione: 10000000 }
        ]
      }));
      ipcMain.removeHandler('ocr-esegui');
      ipcMain.handle('ocr-esegui', (_e: any, parametri: any) => {
        (globalThis as any).__ocrChiamate.push(parametri);
        return {
          ok: true, piano: 'Testo', html: '<p>Testo</p>', confidenza: 90, lingue: parametri.lingue, motore: 'tesseract',
          pagine: [{ numero: 1, origine: 'ocr', confidenza: 90, rotazione: 90, orientamentoIncerto: false }],
          paginePdf: 1, pagineElaborate: 1, caratteri: 5
        };
      });
    });
    await azzeraChiamate(electronApp);
    await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
    await expect(page.locator('#ocr-confirm')).toBeEnabled();
    await expect(page.locator('#ocr-raddrizza')).toBeEnabled();
    await expect(page.locator('#ocr-raddrizza')).toBeChecked();
    await expect(page.locator('#ocr-lang-osd')).toHaveCount(0);
    await page.locator('#ocr-dest-bozza').setChecked(false);
    await page.locator('#ocr-confirm').click();
    await expect(page.locator('#ocr-result')).toContainText('Pagine raddrizzate: 1');
    const chiamate = await chiamateMotore(electronApp);
    expect(chiamate[0].raddrizza).toBe(true);
    expect(chiamate[0].lingue).toEqual(['ita']);
  });

  test('2.3.14 — PDF ricercabile: dialogo annullato, l\'OCR non parte', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Ocr');
    const id = await createItemWithAttachment(page, 'OCR-PDF-NO', FIXTURE_PNG);
    await stubMotore(electronApp);
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('ocr-pdf-inizia');
      ipcMain.handle('ocr-pdf-inizia', () => ({ ok: false, canceled: true }));
    });

    await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
    await expect(page.locator('#ocr-confirm')).toBeEnabled();
    await page.locator('#ocr-dest-pdf').setChecked(true);
    await page.locator('#ocr-confirm').click();
    await expect(page.locator('#ocr-confirm')).toBeEnabled();
    expect(await chiamateMotore(electronApp)).toHaveLength(0);
    await expect(page.locator('#ocr-result')).toBeHidden();
  });
});
