import { test, expect } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

test.use({ seedWorkspace: 'TestArchive' });

declare const appData: any;

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

type ServerIiif = {
  url: string;
  chiudi: () => Promise<void>;
  richieste: string[];
  rompiMisure: boolean;
};

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
    chiudi: () => new Promise<void>(risolvi => { server.close(() => risolvi()); server.closeAllConnections(); })
  };
}

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
    await expect(page.locator('#iiif-diritti')).toContainText('Biblioteca di prova');

    const primaMiniatura = page.locator('#iiif-miniature img').first();
    await expect(primaMiniatura).toHaveAttribute('src', /^iiif-img:\/\//);
    await expect.poll(
      () => primaMiniatura.evaluate((el: HTMLImageElement) => el.naturalWidth),
      { timeout: 15_000 }
    ).toBeGreaterThan(0);

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

    expect(m.allegati.every((a: any) => a.remoto === true)).toBe(true);
    expect(m.allegati.every((a: any) => !a.hash)).toBe(true);
    expect(m.allegati[0].originalName).toBe('1r');

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
    expect(carta.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(carta.iiif).toBeUndefined();
    expect(fs.existsSync(path.join(ws, 'allegati_manoscritti', carta.nome))).toBe(true);
    expect(m.allegati[1].remoto).toBe(true);
    expect(fs.readdirSync(path.join(ws, 'allegati_manoscritti'))).toEqual([carta.nome]);
  });

  test('F8 — la scheda sostituita durante lo scaricamento riceve comunque la carta', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await leggiManifest(page, `${srv.url}/manifest.json`);
    await page.locator('#iiif-conferma').click();
    await expect(page.locator('#iiif-modal')).toBeHidden();
    await electronApp.evaluate(({ ipcMain }) => {
      (globalThis as any).__iiifRilascia = false;
      (globalThis as any).__iiifChiamato = false;
      ipcMain.removeHandler('iiif-materializza');
      ipcMain.handle('iiif-materializza', async (_e: any, richieste: any[]) => {
        (globalThis as any).__iiifChiamato = true;
        while (!(globalThis as any).__iiifRilascia) await new Promise(r => setTimeout(r, 20));
        return { ok: true, risultati: richieste.map(r => ({ ok: true, nome: r.nome, hash: 'a'.repeat(64) })) };
      });
    });
    const id = (await getAppData(page)).manoscritti[0].id;
    const fatto = page.evaluate((idScheda) => (window as any).materializzaCarteIiif(idScheda, [0]), id);
    await expect.poll(() => electronApp.evaluate(() => (globalThis as any).__iiifChiamato)).toBe(true);
    await page.evaluate(() => {
      // @ts-ignore
      appData.manoscritti[0] = structuredClone(appData.manoscritti[0]);
    });
    await electronApp.evaluate(() => { (globalThis as any).__iiifRilascia = true; });
    await fatto;
    const carta = (await getAppData(page)).manoscritti[0].allegati[0];
    expect(carta.remoto).toBeUndefined();
    expect(carta.hash).toBe('a'.repeat(64));
  });

  test('si importano solo le carte scelte', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await leggiManifest(page, `${srv.url}/manifest.json`);

    await expect(page.locator('#iiif-selezionate')).toContainText('3');
    await expect(page.locator('#iiif-miniature .iiif-carta')).toHaveCount(3);

    await page.locator('#iiif-intervallo').fill('1, 3');
    await expect(page.locator('#iiif-selezionate')).toContainText('2');

    await page.locator('#iiif-conferma').click();
    await expect(page.locator('#iiif-modal')).toBeHidden();

    const m = (await getAppData(page)).manoscritti[0];
    expect(m.allegati.length).toBe(2);
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
    await expect(page.locator('#iiif-url')).toHaveValue(/manifest\.json$/);
    await expect(page.locator('#iiif-campi-scheda')).toBeHidden();

    await page.locator('#iiif-leggi').click();
    await expect(page.locator('#iiif-anteprima')).toBeVisible({ timeout: 15_000 });
    await page.locator('#iiif-intervallo').fill('2-3');
    await page.locator('#iiif-conferma').click();
    await expect(page.locator('#iiif-modal')).toBeHidden();

    const m = (await getAppData(page)).manoscritti[0];
    expect(m.allegati.length).toBe(3);
    expect(m.allegati.map((a: any) => a.originalName)).toEqual(['1r', '2r', '3r']);
    expect((await getAppData(page)).manoscritti.length).toBe(1);
  });

  test('una misura che il server non sa servire ripiega, non lascia il vuoto', async ({ page, userDataDir }) => {
    srv.rompiMisure = true;
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await leggiManifest(page, `${srv.url}/manifest.json`);

    const primaMiniatura = page.locator('#iiif-miniature img').first();
    await expect.poll(
      () => primaMiniatura.evaluate((el: HTMLImageElement) => el.naturalWidth),
      { timeout: 20_000 }
    ).toBeGreaterThan(0);

    expect(srv.richieste.some(u => u.includes('/full/140,/'))).toBe(true);
    expect(srv.richieste.some(u => u.includes('/full/max/'))).toBe(true);
  });

  test("un indirizzo che non e' un manifest viene spiegato, non importato", async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'));
    await page.evaluate(() => (window as any).apriImportIiif());
    await page.locator('#iiif-url').fill(`${srv.url}/pagina-html`);
    await page.locator('#iiif-leggi').click();

    await expect(page.locator('#iiif-errore')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#iiif-anteprima')).toBeHidden();
    await expect(page.locator('#iiif-conferma')).toBeDisabled();
  });
});
