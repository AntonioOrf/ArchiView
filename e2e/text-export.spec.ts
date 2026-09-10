import { test, expect } from './fixtures';
import { stubDialog } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Fasi 2.5 e 2.6 — export della trascrizione (HTML, Markdown, RTF) e citazioni (BibTeX, RIS).
 *
 * Come per il CSV (2.1) e la stampa (2.2), il dialogo nativo è stubbato nel main e il file
 * viene scritto DAVVERO su disco: si asserisce sul contenuto. È l'unico modo di accorgersi
 * che il main ha letto il database di prima del salvataggio, o che la trascrizione è
 * arrivata al file senza passare dal sanificatore — due difetti che a livello di IPC si
 * presentano entrambi come `success: true`.
 */
type Riga = { segnatura: string; cartella?: string; [k: string]: any };

async function seed(page, righe: Riga[]) {
  await page.evaluate(async (righe) => {
    // @ts-ignore -- `appData` è una `let` globale (script classico), non window.appData.
    const data = appData;
    for (const r of righe) {
      data.manoscritti.push(Object.assign({
        id: crypto.randomUUID(),
        cartella: '',
        tipoDocumento: 'manoscritto',
        tags: '',
        allegati: [],
        trascrizione: '',
        lastModified: Date.UTC(2026, 0, 2),
        creatoDa: 'Anonimo',
        modificatoDa: 'Anonimo',
      }, r));
      if (r.cartella && !data.cartelle.includes(r.cartella)) data.cartelle.push(r.cartella);
    }
    await (window as any).Store.commit();
  }, righe);
}

async function leggiFile(percorso: string): Promise<string> {
  await expect.poll(() => fs.existsSync(percorso), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => (fs.existsSync(percorso) ? fs.statSync(percorso).size : 0), { timeout: 15_000 })
    .toBeGreaterThan(0);
  return fs.readFileSync(percorso, 'utf8');
}

/** Apre il modale sulla selezione, sceglie il formato ed esporta. */
async function esporta(page, ids: string[], formato: string) {
  return page.evaluate(async ({ ids, formato }) => {
    const w = window as any;
    w.selectedRecords = ids;
    w.apriEsportaTesto('selezione', formato);
    return await w.esportaTesto();
  }, { ids, formato });
}

test.describe('Export della trascrizione e citazioni', () => {

  test('2.5.1 — HTML autonomo: solo le schede in ambito, testo sanificato', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Export');
    await seed(page, [
      { segnatura: 'TX-1', trascrizione: '<p>In nomine <b>Domini</b></p><script>alert(1)</script>' },
      { segnatura: 'TX-2', trascrizione: '<p>amen</p>' },
      { segnatura: 'ESCA', trascrizione: '<p>fuori ambito</p>' },
    ]);
    const dati = await getAppData(page);
    const ids = dati.manoscritti.filter((m: any) => m.segnatura.startsWith('TX-')).map((m: any) => m.id);

    const out = path.join(userDataDir, 'trascrizioni.html');
    await stubDialog(electronApp, { canceled: false, filePath: out });
    const esito = await esporta(page, ids, 'html');
    expect(esito.success).toBe(true);
    expect(esito.count).toBe(2);   // con un ambito inerte sarebbero 3

    const testo = await leggiFile(out);
    expect(testo.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(testo).toContain("default-src 'none'");   // seconda difesa dopo la whitelist
    expect(testo).toContain('In nomine <b>Domini</b>');
    expect(testo).toContain('TX-2');
    expect(testo).not.toContain('fuori ambito');
    expect(testo).not.toContain('alert(1)');
  });

  test('2.5.2 — Markdown e RTF dallo stesso testo, con le carte separate', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Export');
    // Trascrizione per allegato (2.3-bis): due carte, due sezioni nel file.
    await seed(page, [{
      segnatura: 'CARTE-1',
      dataTopica: 'Perùgia',
      allegati: [
        { originalName: 'c1r.jpg', trascrizione: '<p>Testo del <i>recto</i></p>' },
        { originalName: 'c1v.jpg', trascrizione: '<p>Testo del verso</p>' },
      ],
      trascrizione: '<p>forma derivata</p>',
    }]);
    const dati = await getAppData(page);
    const ids = [dati.manoscritti[0].id];

    const md = path.join(userDataDir, 'trascrizione.md');
    await stubDialog(electronApp, { canceled: false, filePath: md });
    expect((await esporta(page, ids, 'md')).success).toBe(true);
    const testoMd = await leggiFile(md);
    expect(testoMd).toContain('## CARTE-1');
    expect(testoMd).toContain('### c1r.jpg');
    expect(testoMd).toContain('### c1v.jpg');
    expect(testoMd).toContain('*recto*');
    expect(testoMd).toContain('Perùgia');           // l'intestazione è attiva per default
    expect(testoMd).not.toContain('forma derivata'); // non si legge la concatenazione

    const rtf = path.join(userDataDir, 'trascrizione.rtf');
    await stubDialog(electronApp, { canceled: false, filePath: rtf });
    expect((await esporta(page, ids, 'rtf')).success).toBe(true);
    const testoRtf = await leggiFile(rtf);
    expect(testoRtf.startsWith('{\\rtf1\\ansi')).toBe(true);
    expect(testoRtf).toContain('Testo del');
    // La ù non può viaggiare come byte grezzo: Word leggerebbe un carattere a caso.
    expect(testoRtf).toContain('\\u249?');
    expect(testoRtf).not.toContain('Perùgia');
  });

  test('2.6.1 — BibTeX e RIS con la mappatura archivistica', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Export');
    await seed(page, [{
      segnatura: 'ASP, Notarile 12', cartella: 'Fondo', autore: 'Bartolo da Sassoferrato',
      titolo: 'Vendita di una casa', dataCronica: '12 maggio 1340', dataTopica: 'Perugia',
      tags: 'notaio,vendita',
    }]);
    const dati = await getAppData(page);
    const ids = [dati.manoscritti[0].id];

    // Il fondo viene dalle impostazioni di stampa: è la stessa intestazione, compilata una
    // volta sola. Se qui arrivasse vuoto, `organization` sparirebbe dalla voce.
    await page.evaluate(() => { (window as any).impostazioniStampa.fondo = 'ASP'; });

    const bib = path.join(userDataDir, 'citazione.bib');
    await stubDialog(electronApp, { canceled: false, filePath: bib });
    expect((await esporta(page, ids, 'bibtex')).success).toBe(true);
    const testoBib = await leggiFile(bib);
    expect(testoBib.startsWith('@misc{')).toBe(true);
    expect(testoBib).toContain('Sassoferrato1340');
    expect(testoBib).toContain('title = {{Vendita di una casa}}');
    expect(testoBib).toContain('number = {ASP, Notarile 12}');
    expect(testoBib).toContain('organization = {ASP}');
    expect(testoBib).toContain('year = {1340}');

    const ris = path.join(userDataDir, 'citazione.ris');
    await stubDialog(electronApp, { canceled: false, filePath: ris });
    expect((await esporta(page, ids, 'ris')).success).toBe(true);
    const testoRis = await leggiFile(ris);
    expect(testoRis.startsWith('TY  - MANSCPT')).toBe(true);
    expect(testoRis).toContain('AU  - Bartolo da Sassoferrato');
    expect(testoRis).toContain('AN  - ASP, Notarile 12');
    expect(testoRis).toContain('ER  - ');
  });

  test('2.5.3 — si esporta ciò che è a schermo, non ciò che è su disco da prima', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Export');
    await seed(page, [{ segnatura: 'PENDENTE', trascrizione: '<p>vecchio testo</p>' }]);
    const dati = await getAppData(page);
    const id = dati.manoscritti[0].id;

    // Modifica pendente nell'editor, come dopo aver battuto una riga senza salvare: il main
    // legge il DB dal disco, e senza il salvataggio esporterebbe la versione precedente.
    await page.evaluate((id) => {
      const w = window as any;
      w.apriTrascrizione(id);
    }, id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await page.evaluate(() => {
      const w = window as any;
      document.getElementById('trascrizione-editor')!.innerHTML = '<p>riga appena battuta</p>';
      w.trascrizioneNonSalvata = true;
    });

    const out = path.join(userDataDir, 'pendente.md');
    await stubDialog(electronApp, { canceled: false, filePath: out });
    const esito = await page.evaluate(async () => {
      const w = window as any;
      w.apriEsportaTesto('corrente', 'md');
      return await w.esportaTesto();
    });
    expect(esito.success).toBe(true);

    const testo = await leggiFile(out);
    expect(testo).toContain('riga appena battuta');
    expect(testo).not.toContain('vecchio testo');
  });

  test('2.5.4 — l\'annullamento non scrive nulla e non è un errore', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Export');
    await seed(page, [{ segnatura: 'ANN-1', trascrizione: '<p>x</p>' }]);
    const dati = await getAppData(page);

    const out = path.join(userDataDir, 'mai-scritto.html');
    await stubDialog(electronApp, { canceled: true });
    await esporta(page, [dati.manoscritti[0].id], 'html');

    expect(fs.existsSync(out)).toBe(false);
    await expect(page.locator('#toast-container')).not.toContainText('Esportazione non riuscita');
  });

  test('2.5.5 — ambito, conteggio e formato preferito sopravvivono al riavvio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Export');
    await seed(page, [
      { segnatura: 'C-1', cartella: 'Fondo', trascrizione: '<p>testo</p>' },
      { segnatura: 'C-2', cartella: 'Fondo' },
      { segnatura: 'C-3', cartella: 'Fondo' },
    ]);
    const dati = await getAppData(page);
    const uno = dati.manoscritti.filter((m: any) => m.segnatura === 'C-1').map((m: any) => m.id);
    await page.evaluate((ids) => {
      const w = window as any;
      w.selectedRecords = ids;
      w.aggiornaStatoSelezione();
      w.apriEsportaTesto('selezione');
    }, uno);

    await expect(page.locator('#export-text-modal')).toBeVisible();
    // Due numeri: quante schede e quante hanno testo. Con l'ambito inerte non cambierebbero.
    await expect(page.locator('#tx-count')).toContainText('1');
    await page.locator('#tx-scope').selectOption('cartella');
    await expect(page.locator('#tx-count')).toContainText('3');
    await expect(page.locator('#tx-count')).toContainText('1');   // solo una ha trascrizione

    // Passando a una citazione l'intestazione sparisce: in BibTeX i metadati SONO il file.
    await page.locator('#tx-format-bibtex').check();
    await expect(page.locator('#tx-opt-header')).toHaveCount(0);

    await page.evaluate(() => (window as any).chiudiEsportaTesto());
    const stato = await page.evaluate(async () => {
      const s = await (window as any).apiSettings.get();
      return s.appState && s.appState.esportaTesto;
    });
    expect(stato.formato).toBe('bibtex');
  });

  test('2.5.6 — le voci sono raggiungibili da menu, palette e vista trascrizione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Export');
    await seed(page, [{ segnatura: 'MENU-TX' }]);

    await page.locator('#context-overflow-slot button').click();
    await expect(page.locator('#custom-context-menu')).toContainText('Esporta testo');
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+K');
    await page.locator('#cp-input').fill('bibtex');
    await expect(page.locator('#cp-lista')).toContainText('BibTeX');
    await page.keyboard.press('Escape');

    const dati = await getAppData(page);
    await page.evaluate((id) => (window as any).apriTrascrizione(id), dati.manoscritti[0].id);
    await expect(page.locator('#btn-export-trasc')).toBeVisible();
  });
});
