import { test, expect } from './fixtures';
import { stubDialog } from './fixtures';
import { createLocalWorkspace, seedItems, getAppData } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

// `appData` vive nello scope del bundle del renderer, non su `window`: dentro page.evaluate
// e' una variabile globale come le altre, e va solo dichiarata al compilatore dello spec.
declare const appData: any;

// Fase 2.4 — Import CSV con mappatura e dry-run.
//
// L'analisi e la costruzione delle schede hanno i loro unit (`test/csvImport.test.js`), che
// coprono virgolette, tipi, doppioni e andata-e-ritorno con l'export. Qui si prova ciò che
// gli unit non possono provare: che il file venga letto DAVVERO dal disco, che l'anteprima
// mostri ciò che poi entra in archivio, che nulla sia scritto finché non si conferma, e che
// l'import si annulli in un colpo solo.
//
// In ogni semina c'è una scheda-esca che l'import NON deve toccare.

/** Scrive un CSV nella cartella temporanea del test e stubba il dialogo del main. */
async function preparaCsv(electronApp: any, userDataDir: string, nome: string, contenuto: string): Promise<string> {
  const percorso = path.join(userDataDir, nome);
  fs.writeFileSync(percorso, contenuto, 'utf8');
  await stubDialog(electronApp, { canceled: false, filePaths: [percorso] });
  return percorso;
}

/**
 * Una tessera del riepilogo dell'anteprima. Il riepilogo è fatto di tessere e non di una
 * frase (`<strong>2</strong><span>nuove</span>`), quindi il testo del nodo è "2nuove": si
 * asserisce sul numero dentro la tessera giusta, che è anche più preciso.
 */
function tessera(page: any, quale: 'new' | 'upd' | 'skip' | 'warn') {
  return page.locator('.import-chip.is-' + quale);
}

/**
 * Apre il wizard e supera il PASSO 1 (la scelta del modello), che dalla revisione del
 * 2026-09-10 e' la prima cosa che il wizard chiede: senza una scelta esplicita nove import
 * su dieci finivano nel modello dell'ultima volta senza che nessuno avesse deciso niente.
 * I test che non riguardano quel passo lo attraversano con il modello proposto.
 */
async function apriWizard(page: any) {
  await page.evaluate(() => (window as any).apriImportCsv());
  await expect(page.locator('#import-csv-modal')).toBeVisible();
  await expect(page.locator('#import-csv-step-modello')).toBeVisible();
  await page.locator('#import-csv-continua').click();
  await expect(page.locator('#import-csv-step-mappatura')).toBeVisible();
}

/** Le segnature in archivio, ordinate. */
async function segnature(page: any): Promise<string[]> {
  return page.evaluate(() => appData.manoscritti.map((m: any) => String(m.segnatura)).sort());
}

test.describe('Import CSV (2.4)', () => {

  test('il wizard legge il file, propone la mappatura e importa ciò che ha mostrato', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await seedItems(page, 1);   // l'esca: non deve essere toccata da nulla

    await preparaCsv(electronApp, userDataDir, 'schede.csv',
      'Segnatura,Archivio,Tag,Notaio\r\nASP 100,Notarile,pergamena,Rossi\r\nASP 101,Notarile,carta,Bianchi\r\n');

    await apriWizard(page);

    // La mappatura è stata proposta da sola: nessuna tendina su "non importare".
    await expect(page.locator('#import-csv-map')).toContainText('Segnatura');
    const destinazioni = await page.locator('#import-csv-map select').evaluateAll(
      (els: any[]) => els.map(e => e.value));
    expect(destinazioni).toEqual(['segnatura', 'cartella', 'tags', 'Notaio']);

    // L'anteprima annuncia due schede nuove…
    await expect(page.locator('#import-csv-preview')).toContainText('ASP 100');
    await expect(tessera(page, 'new')).toContainText('2');

    // …e finché non si conferma, in archivio non è cambiato nulla.
    expect(await segnature(page)).toEqual(['Seed-000']);

    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();

    expect(await segnature(page)).toEqual(['ASP 100', 'ASP 101', 'Seed-000']);
    const dati = await getAppData(page);
    // L'archivio nominato nel file è stato creato, o le schede sarebbero irraggiungibili.
    expect(dati.cartelle).toContain('Notarile');
    const importata = dati.manoscritti.find((m: any) => m.segnatura === 'ASP 100');
    expect(importata.Notaio).toBe('Rossi');
    expect(importata.cartella).toBe('Notarile');
  });

  test('il primo passo chiede il modello e ne sa creare uno nuovo', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'catasto.csv', 'Segnatura,Uso\r\nASP 1,abitazione\r\n');

    await page.evaluate(() => (window as any).apriImportCsv());
    // Il wizard si apre sul passo 1: la mappatura non è ancora visibile.
    await expect(page.locator('#import-csv-step-modello')).toBeVisible();
    await expect(page.locator('#import-csv-step-mappatura')).toBeHidden();
    await expect(page.locator('#import-csv-confirm')).toBeHidden();

    await page.locator('.import-scelta[data-valore="__nuovo__"]').click();
    // Il nome proposto è quello del file senza estensione: è come l'utente chiama già quel
    // materiale, e riscriverlo a mano è il primo attrito di chi arriva da un foglio.
    await expect(page.locator('#import-csv-nome-modello')).toHaveValue('catasto');
    await page.locator('#import-csv-nome-modello').fill('Catasto fiorentino');
    await page.locator('#import-csv-continua').click();

    // Il modello non esiste ancora: nulla è scritto finché non si conferma.
    let tipi = await page.evaluate(() => appData.tipiDocumento.map((t: any) => t.nome));
    expect(tipi).not.toContain('Catasto fiorentino');

    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();

    const dati = await getAppData(page);
    const nuovo = dati.tipiDocumento.find((t: any) => t.nome === 'Catasto fiorentino');
    expect(nuovo).toBeTruthy();
    // …e la scheda importata è di QUEL modello, non di quello dell'ultima volta.
    expect(dati.manoscritti[0].tipoDocumento).toBe(nuovo.id);

    // L'annullamento toglie anche il modello, non solo le schede.
    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(async () => {
      const d = await getAppData(page);
      return d.tipiDocumento.some((t: any) => t.nome === 'Catasto fiorentino');
    }).toBe(false);
  });

  test('la destinazione non è mai un archivio che l\'utente non vede', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    // Una scheda in un percorso MAI registrato fra gli archivi: succede, e la sidebar ce la
    // porta comunque. Il wizard prendeva `cartellaAttuale` così com'era, il `<select>` non
    // trovava l'opzione e mostrava "Radice" mentre ogni scheda finiva nel percorso
    // invisibile — annunciato come "verrà creato 1 archivio".
    await page.evaluate(async () => {
      appData.manoscritti.push({ id: 'x1', cartella: 'Catasto/165 (Fiesole)', tipoDocumento: 'imbreviature', segnatura: 'ESCA', tags: '', allegati: [], lastModified: 1 });
      await (window as any).Store.commit();
      (window as any).cartellaAttuale = 'Catasto/165 (Fiesole)';
    });

    await preparaCsv(electronApp, userDataDir, 'dest.csv', 'Segnatura\r\nASP 1\r\n');
    await apriWizard(page);

    // Ciò che il menu mostra è ciò che verrà usato: la radice.
    expect(await page.locator('#import-csv-cartella-slot select').inputValue()).toBe('');
    await expect(page.locator('#import-csv-preview')).not.toContainText('Fiesole');

    await page.locator('#import-csv-confirm').click();
    const dati = await getAppData(page);
    expect(dati.manoscritti.find((m: any) => m.segnatura === 'ASP 1').cartella).toBe('');
    expect(dati.cartelle).not.toContain('Catasto/165 (Fiesole)');
  });

  test('con molte colonne il modale resta dentro lo schermo, scorre, e i pulsanti restano fermi', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    // Venti colonne e trenta righe: la finestra supera di molto l'altezza dello schermo.
    const intestazioni = Array.from({ length: 20 }, (_, i) => 'Col ' + (i + 1)).join(',');
    const righe = Array.from({ length: 30 }, (_, r) =>
      Array.from({ length: 20 }, (_, c) => 'v' + r + '-' + c).join(',')).join('\r\n');
    await preparaCsv(electronApp, userDataDir, 'largo.csv', intestazioni + '\r\n' + righe + '\r\n');

    await apriWizard(page);
    const finestra = page.locator('#import-csv-modal .modal-window');
    await expect(finestra).toBeVisible();

    // Prima del tetto d'altezza su `.modal-window` la finestra cresceva quanto il contenuto e
    // ciò che sforava finiva fuori dallo schermo, irraggiungibile: né rotella né tastiera.
    // `page.viewportSize()` è null su Electron (la finestra non la gestisce Playwright):
    // l'altezza vera è quella del documento.
    const altezzaSchermo = await page.evaluate(() => window.innerHeight);
    const box = await finestra.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(altezzaSchermo);
    expect(box!.y).toBeGreaterThanOrEqual(0);

    // Il corpo scorre davvero…
    const corpo = page.locator('#import-csv-modal .modal-body');
    const scorribile = await corpo.evaluate((el: any) => el.scrollHeight > el.clientHeight + 1);
    expect(scorribile).toBe(true);

    // …e il pulsante di conferma è visibile senza doverci scorrere fino in fondo.
    await expect(page.locator('#import-csv-confirm')).toBeInViewport();
  });

  test('cambiare una tendina cambia l\'anteprima, e l\'import segue l\'anteprima', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'due.csv', 'Colonna A,Notaio\r\nASP 200,Rossi\r\n');

    await apriWizard(page);
    // "Colonna A" non somiglia a niente: il wizard NON deve indovinare.
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
    // L'esca resta: annullare l'import non deve toccare ciò che c'era prima.
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
    // Nessun doppione: la scheda è una sola e ha il notaio nuovo…
    expect(dati.manoscritti.filter((m: any) => m.segnatura === 'ASP 1')).toHaveLength(1);
    const agg = dati.manoscritti.find((m: any) => m.id === 'e1');
    expect(agg.Notaio).toBe('Bianchi');
    // …e l'archivio, che il file non nomina, non è stato azzerato.
    expect(agg.cartella).toBe('Vecchia');
    // L'esca è intatta.
    expect(dati.manoscritti.find((m: any) => m.id === 'esca').Notaio).toBe('Verdi');
  });

  test('le righe senza un campo obbligatorio sono elencate come scartate e non entrano', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    // Un tipo con un campo obbligatorio, creato dal modello condiviso come farebbe la UI.
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
    // La riga scartata è nominata con il numero che l'utente vede in Excel (intestazione = 1).
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

    // La riga di intestazione riconosciuta è la seconda, non il titolo: le colonne hanno
    // un nome e la segnatura è stata mappata da sola.
    await expect(page.locator('#import-csv-map')).toContainText('Segnatura');
    await expect(page.locator('#import-csv-map')).not.toContainText('Colonna 2');
    expect(await page.locator('#import-csv-map select').first().inputValue()).toBe('segnatura');
    // Due schede, non tre: la riga di intestazione non è un dato.
    await expect(tessera(page, 'new')).toContainText('2');

    // …e resta un'ipotesi che si può ribaltare a mano.
    await page.locator('#import-csv-riga-slot select').selectOption('0');
    await expect(page.locator('#import-csv-map')).toContainText('CATASTO DI FIESOLE');
  });

  test('una colonna senza destinazione può diventare un campo nuovo del modello', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaCsv(electronApp, userDataDir, 'nuovo.csv',
      'Segnatura,Numero di carta\r\nASP 1,12\r\n');

    await apriWizard(page);
    const tendina = page.locator('#import-csv-map select').nth(1);
    expect(await tendina.inputValue()).toBe('');   // "Numero di carta" non esiste ancora

    await tendina.selectOption('__nuovo__');
    const box = page.locator('.import-nuovo-campo');
    await expect(box).toBeVisible();
    // Il nome è proposto uguale a quello della colonna: campo e colonna restano chiamati uguali.
    await expect(box.locator('input')).toHaveValue('Numero di carta');
    await box.locator('select').selectOption('number');
    await box.locator('button', { hasText: 'Crea' }).click();

    // Il campo compare come destinazione scelta, e l'anteprima annuncia che verrà creato.
    await expect(page.locator('#import-csv-preview')).toContainText('Numero di carta');
    // Nulla è ancora scritto: il modello non ha il campo finché non si conferma.
    let tipi = await page.evaluate(() => appData.tipiDocumento.map((t: any) => (t.campi || []).slice()));
    expect(JSON.stringify(tipi)).not.toContain('Numero di carta');

    await page.locator('#import-csv-confirm').click();
    await expect(page.locator('#import-csv-modal')).toBeHidden();

    const dati = await getAppData(page);
    const scheda = dati.manoscritti.find((m: any) => m.segnatura === 'ASP 1');
    // Numero e non stringa: il tipo scelto nel wizard vale davvero.
    expect(scheda['Numero di carta']).toBe(12);
    const tipo = dati.tipiDocumento.find((t: any) => t.id === scheda.tipoDocumento);
    expect(tipo.campi).toContain('Numero di carta');
    expect(tipo.campiDef['Numero di carta'].tipo).toBe('number');

    // E l'annullamento riporta indietro anche il modello, non solo le schede.
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

    // Il campo entra nel modello PREDEFINITO proposto: è il caso normale, ed è quello che
    // prima si rompeva in due modi insieme.
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

    // 1. Il campo NON sparisce alla riapertura. `applicaModelliPredefiniti` girava a ogni
    //    avvio e riportava `campi` all'elenco del modello, cancellando l'aggiunta: il campo
    //    spariva e i valori restavano nei record come chiavi orfane invisibili.
    const sopravvive = await page.evaluate((id: string) => {
      (window as any).Model.applicaModelliPredefiniti(appData);
      const t = appData.tipiDocumento.find((x: any) => x.id === id);
      return (t.campi || []).includes('Carta');
    }, tipoId);
    expect(sopravvive).toBe(true);

    // 2. Il modello si può aprire e il campo si può ritipizzare. Prima i predefiniti erano
    //    marcati "Non modificabile" e non avevano nemmeno il pulsante.
    await page.evaluate(() => (window as any).apriManageTypesModal());
    await page.evaluate((id: string) => (window as any).modificaTipoDocumento(id), tipoId);
    await expect(page.locator('#new-type-modal')).toBeVisible();
    await expect(page.locator('#type-locked-note')).toBeVisible();

    const pillCarta = page.locator('.custom-field-item[data-val="Carta"]');
    await expect(pillCarta).toBeVisible();
    // Il campo aggiunto dall'utente è configurabile…
    await pillCarta.locator('.pill-config').click();
    await page.locator('#campo-editor-tipo').selectOption('text');
    await page.locator('#btn-campo-editor-ok').click();
    await page.locator('#btn-salva-tipo').click();

    const tipoFinale = await page.evaluate((id: string) => {
      const t = appData.tipiDocumento.find((x: any) => x.id === id);
      return (t.campiDef && t.campiDef.Carta && t.campiDef.Carta.tipo) || 'text';
    }, tipoId);
    expect(tipoFinale).toBe('text');

    // …mentre i campi d'origine del modello restano bloccati: toglierli sarebbe una modifica
    // che si disfa da sola al riavvio successivo.
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
    // L'esca è la virgola dentro la cella: con il separatore indovinato male finirebbe a
    // spezzare la colonna e il notaio sarebbe "Perùgia".
    await expect(tessera(page, 'new')).toContainText('1');
    await page.locator('#import-csv-confirm').click();

    const dati = await getAppData(page);
    expect(dati.manoscritti[0].Notaio).toBe('Perùgia, Niccolò');
  });
});
