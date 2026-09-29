import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

test.use({ seedWorkspace: 'TestArchive' });

// `appData` vive nello scope del bundle del renderer, non su `window`.
declare const appData: any;

// Import IIIF.
//
// La normalizzazione del manifest ha i suoi unit (`test/iiifManifest.test.js`), che coprono
// v2/v3, Choice, etichette multilingua e costruzione degli URL. Qui si prova ciò che gli
// unit non possono provare: che il manifest venga scaricato DAVVERO dalla rete dal main, che
// le carte remote non scrivano un solo byte nella cartella allegati, che il protocollo
// `iiif-img:` serva l'immagine al renderer nonostante la CSP, e che materializzare una carta
// la trasformi in un allegato vero con il suo hash.
//
// Il server è locale e vive il tempo del test: dipendere da Gallica renderebbe la suite
// rossa ogni volta che una biblioteca svizzera fa manutenzione.

/** Un PNG 1x1 valido: basta a provare che l'immagine arriva fino al renderer. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

type ServerIiif = {
  url: string;
  chiudi: () => Promise<void>;
  richieste: string[];
  /** Se vero, ogni size diversa da `full` risponde 504, come iiif.bodleian.ox.ac.uk. */
  rompiMisure: boolean;
};

/**
 * Un server IIIF minimo: `/manifest.json` e un Image API che risponde a qualunque
 * `/iiif/<id>/full/<size>/0/default.jpg`. Tiene traccia delle richieste ricevute, cosi' il
 * test puo' verificare CHE COSA e' stato chiesto al server e non solo cosa si vede.
 */
async function avviaServerIiif(): Promise<ServerIiif> {
  const richieste: string[] = [];
  const stato = { rompiMisure: false };

  const server = http.createServer((req, res) => {
    richieste.push(req.url || '');
    const base = `http://127.0.0.1:${(server.address() as any).port}`;

    if ((req.url || '').startsWith('/manifest.json')) {
      const manifest = {
        '@context': 'http://iiif.io/api/presentation/3/context.json',
        id: `${base}/manifest.json`,
        type: 'Manifest',
        label: { it: ['Codice di prova'] },
        requiredStatement: { label: { en: ['Attribution'] }, value: { en: ['Biblioteca di prova'] } },
        rights: 'http://creativecommons.org/licenses/by/4.0/',
        items: [1, 2, 3].map(n => ({
          id: `${base}/canvas/${n}`,
          type: 'Canvas',
          label: { none: [`${n}r`] },
          width: 1000,
          height: 1400,
          items: [{
            type: 'AnnotationPage',
            items: [{
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: `${base}/iiif/c${n}/full/max/0/default.jpg`,
                type: 'Image',
                format: 'image/jpeg',
                width: 1000,
                height: 1400,
                service: [{ id: `${base}/iiif/c${n}`, type: 'ImageService3', profile: 'level2' }]
              }
            }]
          }]
        }))
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifest));
      return;
    }

    const misura = /\/iiif\/.+\/full\/([^/]+)\/0\/default\.jpg$/.exec(req.url || '');
    if (misura) {
      // Il difetto di Bodleian: la size vincolata non viene servita, la massima si'.
      if (stato.rompiMisure && misura[1] !== 'full' && misura[1] !== 'max') {
        res.writeHead(504);
        res.end('gateway timeout');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(PNG_1X1.length) });
      res.end(PNG_1X1);
      return;
    }

    res.writeHead(404);
    res.end('no');
  });

  await new Promise<void>(risolvi => server.listen(0, '127.0.0.1', risolvi));
  const porta = (server.address() as any).port;

  return {
    url: `http://127.0.0.1:${porta}`,
    richieste,
    get rompiMisure() { return stato.rompiMisure; },
    set rompiMisure(v: boolean) { stato.rompiMisure = v; },
    chiudi: () => new Promise<void>(risolvi => server.close(() => risolvi()))
  };
}

/** Apre il modale, legge il manifest e attende l'anteprima. */
async function leggiManifest(page: any, url: string) {
  await page.evaluate(() => (window as any).apriImportIiif());
  await expect(page.locator('#iiif-modal')).toBeVisible();
  await page.locator('#iiif-url').fill(url);
  await page.locator('#iiif-leggi').click();
  await expect(page.locator('#iiif-anteprima')).toBeVisible({ timeout: 15_000 });
}

test.describe('Import IIIF', () => {
  let srv: ServerIiif;

  test.beforeEach(async () => { srv = await avviaServerIiif(); });
  test.afterEach(async () => { if (srv) await srv.chiudi(); });

  test("l'anteprima mostra le carte del manifest e l'attribuzione", async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await leggiManifest(page, `${srv.url}/manifest.json`);

    await expect(page.locator('#iiif-titolo')).toHaveText('Codice di prova');
    await expect(page.locator('#iiif-conteggio')).toContainText('3');
    // L'attribuzione non e' un ornamento: e' un obbligo della licenza, e deve vedersi
    // PRIMA di importare, non dopo.
    await expect(page.locator('#iiif-diritti')).toContainText('Biblioteca di prova');

    // Le miniature passano dal protocollo iiif-img:, cioe' la CSP le ammette e il main le
    // ha davvero scaricate. Senza, l'immagine resterebbe con naturalWidth 0.
    const primaMiniatura = page.locator('#iiif-miniature img').first();
    await expect(primaMiniatura).toHaveAttribute('src', /^iiif-img:\/\//);
    await expect.poll(
      () => primaMiniatura.evaluate((el: HTMLImageElement) => el.naturalWidth),
      { timeout: 15_000 }
    ).toBeGreaterThan(0);

    // Finche' non si conferma, in archivio non entra nulla.
    const dati = await getAppData(page);
    expect(dati.manoscritti.length).toBe(0);
  });

  test('le carte importate sono remote e non occupano spazio', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await leggiManifest(page, `${srv.url}/manifest.json`);
    await page.locator('#iiif-conferma').click();
    await expect(page.locator('#iiif-modal')).toBeHidden();

    const dati = await getAppData(page);
    expect(dati.manoscritti.length).toBe(1);
    const m = dati.manoscritti[0];
    expect(m.allegati.length).toBe(3);
    expect(m.iiifManifestUrl).toContain('/manifest.json');
    expect(m.iiifAttribuzione).toBe('Biblioteca di prova');

    // Ogni carta e' un riferimento: nome riservato, nessun hash, `remoto` alzato.
    expect(m.allegati.every((a: any) => a.remoto === true)).toBe(true);
    expect(m.allegati.every((a: any) => !a.hash)).toBe(true);
    expect(m.allegati[0].originalName).toBe('1r');

    // ⚠️ Il punto dell'intero modello ibrido: la cartella allegati e' vuota. Se qui
    // comparissero dei file, un codice da 400 carte finirebbe chunkato su Drive.
    const cartellaAllegati = path.join(ws, 'allegati_manoscritti');
    const presenti = fs.existsSync(cartellaAllegati) ? fs.readdirSync(cartellaAllegati) : [];
    expect(presenti).toEqual([]);
  });

  test('materializzare una carta la trasforma in un allegato vero', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await leggiManifest(page, `${srv.url}/manifest.json`);
    await page.locator('#iiif-conferma').click();
    await expect(page.locator('#iiif-modal')).toBeHidden();

    const id = (await getAppData(page)).manoscritti[0].id;
    await page.evaluate((idScheda) => (window as any).materializzaCarteIiif(idScheda, [0]), id);

    await expect.poll(async () => {
      const d = await getAppData(page);
      return d.manoscritti[0].allegati[0].remoto;
    }, { timeout: 20_000 }).toBeUndefined();

    const m = (await getAppData(page)).manoscritti[0];
    const carta = m.allegati[0];
    // Da qui in poi e' un allegato come tutti gli altri: ha un hash, e OCR, stampa ed
    // export non sanno ne' devono sapere che veniva da un manifest.
    expect(carta.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(carta.iiif).toBeUndefined();
    expect(fs.existsSync(path.join(ws, 'allegati_manoscritti', carta.nome))).toBe(true);
    // Le altre due restano riferimenti: si materializza cio' che si e' chiesto, non tutto.
    expect(m.allegati[1].remoto).toBe(true);
    expect(fs.readdirSync(path.join(ws, 'allegati_manoscritti'))).toEqual([carta.nome]);
  });

  test('si importano solo le carte scelte', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await leggiManifest(page, `${srv.url}/manifest.json`);

    // Si parte da tutte: chi deve scartare i piatti della legatura toglie due caselle,
    // non ne spunta cinquecento.
    await expect(page.locator('#iiif-selezionate')).toContainText('3');
    await expect(page.locator('#iiif-miniature .iiif-carta')).toHaveCount(3);

    // L'intervallo scritto comanda le caselle: su 500 carte e' l'unico modo praticabile.
    await page.locator('#iiif-intervallo').fill('1, 3');
    await expect(page.locator('#iiif-selezionate')).toContainText('2');

    await page.locator('#iiif-conferma').click();
    await expect(page.locator('#iiif-modal')).toBeHidden();

    const m = (await getAppData(page)).manoscritti[0];
    expect(m.allegati.length).toBe(2);
    // ⚠️ La numerazione NON viene rifatta: la carta 3 del manifest resta `_0003`, o due
    // colleghi che importano sottoinsiemi diversi darebbero due nomi alla stessa carta.
    expect(m.allegati.map((a: any) => a.nome.slice(-14))).toEqual(['_iiif_0001.jpg', '_iiif_0003.jpg']);
    expect(m.allegati[1].originalName).toBe('3r');
  });

  test('dalla trascrizione si aggiungono carte alla scheda aperta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await leggiManifest(page, `${srv.url}/manifest.json`);
    await page.locator('#iiif-intervallo').fill('1');
    await page.locator('#iiif-conferma').click();
    await expect(page.locator('#iiif-modal')).toBeHidden();

    const id = (await getAppData(page)).manoscritti[0].id;
    await page.evaluate((idScheda) => (window as any).apriTrascrizione(idScheda), id);
    await expect(page.locator('#btn-iiif-trasc')).toBeVisible();

    await page.locator('#btn-iiif-trasc').click();
    await expect(page.locator('#iiif-modal')).toBeVisible();
    // L'URL del manifest e' gia' quello della scheda: chi aggiunge carte allo stesso codice
    // non deve ritrovarlo e riincollarlo.
    await expect(page.locator('#iiif-url')).toHaveValue(/manifest\.json$/);
    // La scheda esiste gia': segnatura, modello e cartella non si ridecidono.
    await expect(page.locator('#iiif-campi-scheda')).toBeHidden();

    await page.locator('#iiif-leggi').click();
    await expect(page.locator('#iiif-anteprima')).toBeVisible({ timeout: 15_000 });
    await page.locator('#iiif-intervallo').fill('2-3');
    await page.locator('#iiif-conferma').click();
    await expect(page.locator('#iiif-modal')).toBeHidden();

    const m = (await getAppData(page)).manoscritti[0];
    expect(m.allegati.length).toBe(3);
    expect(m.allegati.map((a: any) => a.originalName)).toEqual(['1r', '2r', '3r']);
    // Una sola scheda: il punto del pulsante e' non doverne creare una seconda.
    expect((await getAppData(page)).manoscritti.length).toBe(1);
  });

  test('una misura che il server non sa servire ripiega, non lascia il vuoto', async ({ page, userDataDir }) => {
    // È il difetto reale di iiif.bodleian.ox.ac.uk: `/full/!2000,2000/` risponde 504 dopo
    // cinquanta secondi, `/full/full/` risponde subito. Con un solo URL il visualizzatore
    // resta vuoto e sembra un problema di CORS.
    srv.rompiMisure = true;
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await leggiManifest(page, `${srv.url}/manifest.json`);

    const primaMiniatura = page.locator('#iiif-miniature img').first();
    await expect.poll(
      () => primaMiniatura.evaluate((el: HTMLImageElement) => el.naturalWidth),
      { timeout: 20_000 }
    ).toBeGreaterThan(0);

    // La misura chiesta è stata tentata e rifiutata, poi si è ripiegato sulla massima
    // (`max` e non `full`: il servizio del manifest è un ImageService3).
    expect(srv.richieste.some(u => u.includes('/full/140,/'))).toBe(true);
    expect(srv.richieste.some(u => u.includes('/full/max/'))).toBe(true);
  });

  test("un indirizzo che non e' un manifest viene spiegato, non importato", async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await page.evaluate(() => (window as any).apriImportIiif());
    // L'inciampo piu' comune: l'URL della pagina del manoscritto al posto del manifest.
    await page.locator('#iiif-url').fill(`${srv.url}/pagina-html`);
    await page.locator('#iiif-leggi').click();

    await expect(page.locator('#iiif-errore')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#iiif-anteprima')).toBeHidden();
    await expect(page.locator('#iiif-conferma')).toBeDisabled();
  });
});
