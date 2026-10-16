import { test, expect } from './fixtures';
import { stubDialog } from './fixtures';
import { createLocalWorkspace, seedItems, getAppData } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

test.use({ seedWorkspace: 'Imp' });

declare const appData: any;

async function preparaCsv(electronApp: any, userDataDir: string, nome: string, contenuto: string): Promise<string> {
  const percorso = path.join(userDataDir, nome);
  fs.writeFileSync(percorso, contenuto, 'utf8');
  await stubDialog(electronApp, { canceled: false, filePaths: [percorso] });
  return percorso;
}

function tessera(page: any, quale: 'new' | 'upd' | 'skip' | 'warn') {
  return page.locator('.import-chip.is-' + quale);
}

async function apriWizard(page: any) {
  await page.evaluate(() => (window as any).apriImportCsv());
  await expect(page.locator('#import-csv-modal')).toBeVisible();
  await expect(page.locator('#import-csv-step-modello')).toBeVisible();
  await page.locator('#import-csv-continua').click();
  await expect(page.locator('#import-csv-step-mappatura')).toBeVisible();
}

async function segnature(page: any): Promise<string[]> {
  return page.evaluate(() => appData.manoscritti.map((m: any) => String(m.segnatura)).sort());
}

test.describe('Import CSV (2.4)', () => {

  test('il wizard legge il file, propone la mappatura e importa ciò che ha mostrato', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await seedItems(page, 1);

    await preparaCsv(electronApp, userDataDir, 'schede.csv',
      'Segnatura,Archivio,Tag,Notaio\r\nASP 100,Notarile,pergamena,Rossi\r\nASP 101,Notarile,carta,Bianchi\r\n');

    await apriWizard(page);

    await expect(page.locator('#import-csv-map')).toContainText('Segnatura');
    const destinazioni = await page.locator('#import-csv-map select').evaluateAll(
      (els: any[]) => els.map(e => e.value));
    expect(destinazioni).toEqual(['segnatura', 'cartella', 'tags', 'Notaio']);

    await expect(page.locator('#import-csv-preview')).toContainText('ASP 100');
    await expect(tessera(page, 'new')).toContainText('2');

    expect(await segnature(page)).toEqual(['Seed-000']);

    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();

    expect(await segnature(page)).toEqual(['ASP 100', 'ASP 101', 'Seed-000']);
    const dati = await getAppData(page);
    expect(dati.cartelle).toContain('Notarile');
    const importata = dati.manoscritti.find((m: any) => m.segnatura === 'ASP 100');
    expect(importata.Notaio).toBe('Rossi');
    expect(importata.cartella).toBe('Notarile');
  });

  test('il ridisegno del wizard non toglie il fuoco a chi usa la tastiera', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'schede.csv',
      'Segnatura,Archivio,Tag,Notaio\r\nASP 100,Notarile,pergamena,Rossi\r\n');
    await page.evaluate(() => (window as any).apriImportCsv());

    const scelta = page.locator('.import-scelta[data-valore="__nuovo__"]');
    await scelta.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.import-scelta[data-valore="__nuovo__"]')).toBeFocused();

    await page.locator('#import-csv-continua').click();
    await expect(page.locator('#import-csv-step-mappatura')).toBeVisible();
    const terza = page.locator('#import-csv-map select').nth(2);
    await terza.focus();
    await terza.selectOption({ index: 1 });
    await expect(page.locator('#import-csv-map select').nth(2)).toBeFocused();
  });

  test('il primo passo chiede il modello e ne sa creare uno nuovo', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'catasto.csv', 'Segnatura,Uso\r\nASP 1,abitazione\r\n');

    await page.evaluate(() => (window as any).apriImportCsv());
    await expect(page.locator('#import-csv-step-modello')).toBeVisible();
    await expect(page.locator('#import-csv-step-mappatura')).toBeHidden();
    await expect(page.locator('#import-csv-confirm')).toBeHidden();

    await page.locator('.import-scelta[data-valore="__nuovo__"]').click();
    await expect(page.locator('#import-csv-nome-modello')).toHaveValue('catasto');
    await page.locator('#import-csv-nome-modello').fill('Catasto fiorentino');
    await page.locator('#import-csv-continua').click();

    let tipi = await page.evaluate(() => appData.tipiDocumento.map((t: any) => t.nome));
    expect(tipi).not.toContain('Catasto fiorentino');

    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();

    const dati = await getAppData(page);
    const nuovo = dati.tipiDocumento.find((t: any) => t.nome === 'Catasto fiorentino');
    expect(nuovo).toBeTruthy();
    expect(dati.manoscritti[0].tipoDocumento).toBe(nuovo.id);

    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(async () => {
      const d = await getAppData(page);
      return d.tipiDocumento.some((t: any) => t.nome === 'Catasto fiorentino');
    }).toBe(false);
  });

  test('la destinazione non è mai un archivio che l\'utente non vede', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await page.evaluate(async () => {
      appData.manoscritti.push({ id: 'x1', cartella: 'Catasto/165 (Fiesole)', tipoDocumento: 'imbreviature', segnatura: 'ESCA', tags: '', allegati: [], lastModified: 1 });
      await (window as any).Store.commit();
      (window as any).cartellaAttuale = 'Catasto/165 (Fiesole)';
    });

    await preparaCsv(electronApp, userDataDir, 'dest.csv', 'Segnatura\r\nASP 1\r\n');
    await apriWizard(page);

    expect(await page.locator('#import-csv-cartella-slot select').inputValue()).toBe('');
    await expect(page.locator('#import-csv-preview')).not.toContainText('Fiesole');

    await page.locator('#import-csv-confirm').click();
    const dati = await getAppData(page);
    expect(dati.manoscritti.find((m: any) => m.segnatura === 'ASP 1').cartella).toBe('');
    expect(dati.cartelle).not.toContain('Catasto/165 (Fiesole)');
  });

  test('con molte colonne il modale resta dentro lo schermo, scorre, e i pulsanti restano fermi', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    const intestazioni = Array.from({ length: 20 }, (_, i) => 'Col ' + (i + 1)).join(',');
    const righe = Array.from({ length: 30 }, (_, r) =>
      Array.from({ length: 20 }, (_, c) => 'v' + r + '-' + c).join(',')).join('\r\n');
    await preparaCsv(electronApp, userDataDir, 'largo.csv', intestazioni + '\r\n' + righe + '\r\n');

    await apriWizard(page);
    const finestra = page.locator('#import-csv-modal .modal-window');
    await expect(finestra).toBeVisible();

    const altezzaSchermo = await page.evaluate(() => window.innerHeight);
    const box = await finestra.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(altezzaSchermo);
    expect(box!.y).toBeGreaterThanOrEqual(0);

    const corpo = page.locator('#import-csv-modal .modal-body');
    const scorribile = await corpo.evaluate((el: any) => el.scrollHeight > el.clientHeight + 1);
    expect(scorribile).toBe(true);

    await expect(page.locator('#import-csv-confirm')).toBeInViewport();
  });

  test('cambiare una tendina cambia l\'anteprima, e l\'import segue l\'anteprima', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'due.csv', 'Colonna A,Notaio\r\nASP 200,Rossi\r\n');

    await apriWizard(page);
    expect(await page.locator('#import-csv-map select').first().inputValue()).toBe('');

    await page.locator('#import-csv-map select').first().selectOption('segnatura');
    await expect(page.locator('#import-csv-preview')).toContainText('ASP 200');

    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();
    expect(await segnature(page)).toEqual(['ASP 200']);
  });

  test('l\'intero import si annulla in un colpo solo', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await seedItems(page, 1);
    await preparaCsv(electronApp, userDataDir, 'tre.csv',
      'Segnatura\r\nA-1\r\nA-2\r\nA-3\r\n');

    await apriWizard(page);
    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();
    expect(await segnature(page)).toEqual(['A-1', 'A-2', 'A-3', 'Seed-000']);

    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(() => segnature(page)).toEqual(['Seed-000']);
  });

  test('in modalità aggiornamento la riga corregge la scheda esistente invece di duplicarla', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await page.evaluate(async () => {
      appData.manoscritti.push(
        { id: 'e1', cartella: 'Vecchia', tipoDocumento: 'imbreviature', segnatura: 'ASP 1', Notaio: 'Rossi', tags: '', allegati: [], lastModified: 1 },
        { id: 'esca', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'ESCA', Notaio: 'Verdi', tags: '', allegati: [], lastModified: 1 }
      );
      appData.cartelle.push('Vecchia');
      await (window as any).Store.commit();
    });

    await preparaCsv(electronApp, userDataDir, 'agg.csv', 'Segnatura,Notaio\r\nASP 1,Bianchi\r\n');
    await apriWizard(page);
    await page.locator('#import-csv-aggiorna').check();
    await expect(tessera(page, 'new')).toContainText('0');
    await expect(tessera(page, 'upd')).toContainText('1');

    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();

    const dati = await getAppData(page);
    expect(dati.manoscritti.filter((m: any) => m.segnatura === 'ASP 1')).toHaveLength(1);
    const agg = dati.manoscritti.find((m: any) => m.id === 'e1');
    expect(agg.Notaio).toBe('Bianchi');
    expect(agg.cartella).toBe('Vecchia');
    expect(dati.manoscritti.find((m: any) => m.id === 'esca').Notaio).toBe('Verdi');
  });

  test('le righe senza un campo obbligatorio sono elencate come scartate e non entrano', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await page.evaluate(async () => {
      const tipo: any = { id: 'obblig', nome: 'Con obbligo', campi: [] };
      (window as any).Model.impostaCampi(tipo, [{ id: 'Notaio', tipo: 'text', obbligatorio: true }]);
      appData.tipiDocumento.push(tipo);
      await (window as any).Store.commit();
    });

    await preparaCsv(electronApp, userDataDir, 'misto.csv',
      'Segnatura,Tipo documento,Notaio\r\nBUONA,Con obbligo,Rossi\r\nSCARTATA,Con obbligo,\r\n');

    await apriWizard(page);
    await expect(tessera(page, 'new')).toContainText('1');
    await expect(tessera(page, 'skip')).toContainText('1');
    await expect(page.locator('#import-csv-preview')).toContainText('riga 3');

    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();
    expect(await segnature(page)).toEqual(['BUONA']);
  });

  test('un foglio che comincia con un titolo: l\'intestazione vera viene riconosciuta e si può cambiare', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'titolo.csv',
      'CATASTO DI FIESOLE,,,\r\nSegnatura,Uso,TEMA,Note\r\nCG,abitazione,x,y\r\nCH,orto,z,w\r\n');

    await apriWizard(page);

    await expect(page.locator('#import-csv-map')).toContainText('Segnatura');
    await expect(page.locator('#import-csv-map')).not.toContainText('Colonna 2');
    expect(await page.locator('#import-csv-map select').first().inputValue()).toBe('segnatura');
    await expect(tessera(page, 'new')).toContainText('2');

    await page.locator('#import-csv-riga-slot select').selectOption('0');
    await expect(page.locator('#import-csv-map')).toContainText('CATASTO DI FIESOLE');
  });

  test('una colonna senza destinazione può diventare un campo nuovo del modello', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'nuovo.csv',
      'Segnatura,Numero di carta\r\nASP 1,12\r\n');

    await apriWizard(page);
    const tendina = page.locator('#import-csv-map select').nth(1);
    expect(await tendina.inputValue()).toBe('');

    await tendina.selectOption('__nuovo__');
    const box = page.locator('.import-nuovo-campo');
    await expect(box).toBeVisible();
    await expect(box.locator('input')).toHaveValue('Numero di carta');
    await box.locator('select').selectOption('number');
    await box.locator('button', { hasText: 'Crea' }).click();

    await expect(page.locator('#import-csv-preview')).toContainText('Numero di carta');
    let tipi = await page.evaluate(() => appData.tipiDocumento.map((t: any) => (t.campi || []).slice()));
    expect(JSON.stringify(tipi)).not.toContain('Numero di carta');

    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();

    const dati = await getAppData(page);
    const scheda = dati.manoscritti.find((m: any) => m.segnatura === 'ASP 1');
    expect(scheda['Numero di carta']).toBe(12);
    const tipo = dati.tipiDocumento.find((t: any) => t.id === scheda.tipoDocumento);
    expect(tipo.campi).toContain('Numero di carta');
    expect(tipo.campiDef['Numero di carta'].tipo).toBe('number');

    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(async () => {
      const d = await getAppData(page);
      const t = d.tipiDocumento.find((x: any) => (x.campi || []).includes('Numero di carta'));
      return t ? 'presente' : 'assente';
    }).toBe('assente');
  });

  test('un campo creato dall\'import resta modificabile e sopravvive al riavvio', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'carta.csv', 'Segnatura,Carta\r\nASP 1,39\r\n');

    await apriWizard(page);
    await page.locator('#import-csv-map select').nth(1).selectOption('__nuovo__');
    const box = page.locator('.import-nuovo-campo');
    await box.locator('select').selectOption('number');
    await box.locator('button', { hasText: 'Crea' }).click();
    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();

    const tipoId = await page.evaluate(() => appData.manoscritti[0].tipoDocumento);
    const predefinito = await page.evaluate((id: string) => !!(window as any).Model.modelloPredefinito(id), tipoId);
    expect(predefinito).toBe(true);

    const sopravvive = await page.evaluate((id: string) => {
      (window as any).Model.applicaModelliPredefiniti(appData);
      const t = appData.tipiDocumento.find((x: any) => x.id === id);
      return (t.campi || []).includes('Carta');
    }, tipoId);
    expect(sopravvive).toBe(true);

    await page.evaluate(() => (window as any).apriManageTypesModal());
    await page.evaluate((id: string) => (window as any).modificaTipoDocumento(id), tipoId);
    await expect(page.locator('#new-type-modal')).toBeVisible();
    await expect(page.locator('#type-locked-note')).toBeVisible();

    const pillCarta = page.locator('.custom-field-item[data-val="Carta"]');
    await expect(pillCarta).toBeVisible();
    await pillCarta.locator('.pill-config').click();
    await page.locator('#campo-editor-tipo').selectOption('text');
    await page.locator('#btn-campo-editor-ok').click();
    await page.locator('#btn-salva-tipo').click();

    const tipoFinale = await page.evaluate((id: string) => {
      const t = appData.tipiDocumento.find((x: any) => x.id === id);
      return (t.campiDef && t.campiDef.Carta && t.campiDef.Carta.tipo) || 'text';
    }, tipoId);
    expect(tipoFinale).toBe('text');

    await page.evaluate((id: string) => (window as any).modificaTipoDocumento(id), tipoId);
    const campoOrigine = await page.evaluate((id: string) => (window as any).Model.modelloPredefinito(id).campi[0], tipoId);
    const pillBloccata = page.locator(`.custom-field-item[data-val="${campoOrigine}"]`);
    await expect(pillBloccata.locator('.pill-rimuovi')).toHaveCount(0);
    await expect(pillBloccata.locator('.pill-config')).toHaveCount(0);
  });

  test('un file salvato da Excel in italiano (`sep=;`, BOM, accenti) entra corretto', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'excel.csv',
      '﻿sep=;\r\nSegnatura;Notaio\r\nASP 1;Perùgia, Niccolò\r\n');

    await apriWizard(page);
    await expect(tessera(page, 'new')).toContainText('1');
    await page.locator('#import-csv-confirm').click();

    const dati = await getAppData(page);
    expect(dati.manoscritti[0].Notaio).toBe('Perùgia, Niccolò');
  });
});
