import { test, expect } from './fixtures';
import { createLocalWorkspace, dismissOverlays } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Fase 3.0 — schema versionato e catena di migrazioni.
 *
 * Qui non si testa la funzione pura (lo fa `test/model.test.js`) ma il **giro completo**:
 * un database vecchio scritto su disco, l'app che lo apre, e il file che dopo l'apertura è
 * nella forma corrente. È l'unico modo di accorgersi che la migrazione gira ma non viene
 * scritta, o che viene scritta ma solo in memoria — due difetti che un test sul modulo
 * puro non può vedere, e che si manifestano come dati che "tornano vecchi" al riavvio.
 */

/** Riavvia l'app sullo stesso userDataDir: riapre l'ultimo archivio da sola. */
async function riavvia(electronApp, userDataDir: string) {
  const { launchApp, closeApp } = await import('./fixtures');
  await closeApp(electronApp);
  const { app, page } = await launchApp(userDataDir);
  await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
  await dismissOverlays(page);
  return { app, page };
}

function leggiDb(ws: string): any {
  return JSON.parse(fs.readFileSync(path.join(ws, 'database_manoscritti.json'), 'utf8'));
}

test.describe('Schema versionato e migrazioni', () => {

  test('3.0.1 — il database "lista piatta" viene migrato e riscritto su disco', async ({ page, electronApp, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Schema');

    // Il formato delle primissime versioni: un array nudo, senza cartelle e senza tipi.
    fs.writeFileSync(path.join(ws, 'database_manoscritti.json'), JSON.stringify([
      { id: 'vecchio-1', segnatura: 'ASP 1', dataCronica: '1340', lastModified: 111, modificatoDa: 'Rossi' },
      { id: 'vecchio-2', segnatura: 'ASP 2' }
    ]), 'utf8');
    // Lo snapshot di base resterebbe della forma vecchia: va migrato insieme ai record.
    fs.writeFileSync(path.join(ws, '.archiview-base.json'), JSON.stringify({
      'vecchio-1': { id: 'vecchio-1', segnatura: 'ASP 1', dataCronica: '1340' }
    }), 'utf8');

    const { app: app2, page: page2 } = await riavvia(electronApp, userDataDir);

    // In memoria: l'app ha aperto l'archivio vecchio senza perderne le schede.
    const stato = await page2.evaluate(() => {
      // @ts-ignore -- `appData` e' una `let` globale (script classico), non window.appData.
      const d = appData as any;
      return {
        versione: d.schemaVersion,
        segnature: d.manoscritti.map((m: any) => m.segnatura).sort(),
        primo: d.manoscritti.find((m: any) => m.id === 'vecchio-1'),
        base: d.baseObjects && d.baseObjects['vecchio-1'],
        futuro: !!(window as any).schemaDalFuturo
      };
    });
    expect(stato.versione).toBeGreaterThanOrEqual(1);
    expect(stato.segnature).toEqual(['ASP 1', 'ASP 2']);
    expect(stato.primo.cartella).toBe('');            // radice virtuale
    expect(stato.primo.tipoDocumento).not.toBe('manoscritto');
    expect(stato.futuro).toBe(false);
    // La migrazione non firma i record: la paternità e la data restano quelle.
    expect(stato.primo.lastModified).toBe(111);
    expect(stato.primo.modificatoDa).toBe('Rossi');
    // Base e record devono restare identici, o il merge a tre vie dichiarerebbe modificato
    // un archivio che nessuno ha toccato.
    expect(stato.base.tipoDocumento).toBe(stato.primo.tipoDocumento);

    // Su disco: la migrazione è stata SCRITTA, non solo applicata in memoria.
    await expect.poll(() => {
      const db = leggiDb(ws);
      return db && db.schemaVersion;
    }, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    const suDisco = leggiDb(ws);
    expect(Array.isArray(suDisco.manoscritti)).toBe(true);
    expect(Array.isArray(suDisco.cartelle)).toBe(true);
    expect(suDisco.manoscritti.find((m: any) => m.id === 'vecchio-1').cartella).toBe('');

    await closeAppSafe(app2);
  });

  test('3.0.2 — un database già alla versione corrente non viene riscritto', async ({ page, electronApp, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Schema');
    const versione = await page.evaluate(() => (window as any).Model.SCHEMA_VERSION);

    // Indentato a due spazi: se l'app lo riscrivesse, `JSON.stringify` lo renderebbe una
    // riga sola. È il modo più diretto di distinguere "aperto" da "riscritto".
    const db = {
      schemaVersion: versione,
      cartelle: ['Fondo'],
      tipiDocumento: [],
      manoscritti: [{ id: 'ok-1', segnatura: 'ASP 9', cartella: 'Fondo', tipoDocumento: 'atti', lastModified: 222 }],
      __marcatore: 'non toccare'
    };
    const file = path.join(ws, 'database_manoscritti.json');
    fs.writeFileSync(file, JSON.stringify(db, null, 2), 'utf8');
    const primaDelRiavvio = fs.readFileSync(file, 'utf8');

    const { app: app2, page: page2 } = await riavvia(electronApp, userDataDir);
    await expect.poll(async () => page2.evaluate(() => (appData as any).manoscritti.length), { timeout: 10_000 }).toBe(1);

    expect(fs.readFileSync(file, 'utf8')).toBe(primaDelRiavvio);
    // ⚠️ Se questa asserzione cade, ogni apertura dell'app marca il database come modificato
    // e lo rimanda al cloud: su un archivio condiviso significa un push a ogni avvio.
    const dopo = leggiDb(ws);
    expect(dopo.__marcatore).toBe('non toccare');

    await closeAppSafe(app2);
  });

  test('3.0.3 — un database da una versione futura non viene degradato', async ({ page, electronApp, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Schema');
    const versione = await page.evaluate(() => (window as any).Model.SCHEMA_VERSION);

    fs.writeFileSync(path.join(ws, 'database_manoscritti.json'), JSON.stringify({
      schemaVersion: versione + 5,
      cartelle: [],
      tipiDocumento: [],
      // Forma che questa versione migrerebbe: se la tocca, ha degradato un file più nuovo.
      manoscritti: [{ id: 'futuro-1', segnatura: 'F-1', tipoDocumento: 'manoscritto', campoIgnoto: 'x' }]
    }), 'utf8');

    const { app: app2, page: page2 } = await riavvia(electronApp, userDataDir);
    const stato = await page2.evaluate(() => {
      // @ts-ignore -- `appData` e' una `let` globale (script classico), non window.appData.
      const d = appData as any;
      return {
        versione: d.schemaVersion,
        futuro: !!(window as any).schemaDalFuturo,
        scheda: d.manoscritti.find((m: any) => m.id === 'futuro-1')
      };
    });
    expect(stato.versione).toBe(versione + 5);
    expect(stato.futuro).toBe(true);
    expect(stato.scheda.tipoDocumento).toBe('manoscritto');   // nessuna migrazione all'indietro
    expect(stato.scheda.campoIgnoto).toBe('x');               // nessun campo perduto

    // E se l'utente salva, la versione più alta resta: un downgrade silenzioso butterebbe
    // via dati che questa versione non sa nemmeno di avere.
    await page2.evaluate(async () => {
      const w = window as any;
      // @ts-ignore -- `appData` e' una `let` globale.
      (appData as any).manoscritti[0].segnatura = 'F-1 bis';
      await w.salvaTutto();
    });
    await expect.poll(() => leggiDb(ws).schemaVersion, { timeout: 10_000 }).toBe(versione + 5);
    expect(leggiDb(ws).manoscritti[0].campoIgnoto).toBe('x');

    await closeAppSafe(app2);
  });

  test('3.0.4 — la scheda nuova nasce dal modello condiviso', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Schema');

    // Il renderer e il main vedono lo STESSO modello: se il file condiviso non fosse
    // caricato nel bundle, `window.Model` non esisterebbe e l'app non salverebbe più nulla.
    const info = await page.evaluate(() => {
      const w = window as any;
      const m = w.Model.creaScheda({ segnatura: 'NUOVA-1', dataCronica: '1340' });
      // @ts-ignore -- `appData` e' una `let` globale.
      return { versione: w.Model.SCHEMA_VERSION, scheda: m, dbVersione: (appData as any).schemaVersion };
    });
    expect(info.versione).toBeGreaterThanOrEqual(1);
    expect(info.dbVersione).toBe(info.versione);
    expect(info.scheda.cartella).toBe('');
    expect(info.scheda.tags).toBe('');
    expect(Array.isArray(info.scheda.allegati)).toBe(true);
    expect(info.scheda.dataCronica).toBe('1340');
  });
});

/** `closeApp` sull'istanza riavviata: il fixture chiude solo quella originale. */
async function closeAppSafe(app) {
  const { closeApp } = await import('./fixtures');
  await closeApp(app);
}
