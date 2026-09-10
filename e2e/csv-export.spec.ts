import { test, expect } from './fixtures';
import { stubDialog } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Fase 2.1 — esportazione CSV/TSV.
 *
 * Il dialogo nativo è stubbato nel main (stubDialog): il file viene scritto DAVVERO su
 * disco e qui si asserisce sul suo contenuto, non sulla chiamata IPC. È l'unico modo per
 * accorgersi di una regressione su BOM, quoting o colonne — cioè su tutto ciò che rende
 * il file apribile o meno in Excel.
 */
type Riga = { segnatura: string; cartella?: string; tags?: string; tipoDocumento?: string; [k: string]: any };

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
        lastModified: Date.UTC(2026, 0, 2, 3, 4, 5),
        creatoDa: 'Anonimo',
        modificatoDa: 'Anonimo',
      }, r));
      if (r.cartella && !data.cartelle.includes(r.cartella)) data.cartelle.push(r.cartella);
    }
    await (window as any).Store.commit();
  }, righe);
}

/** Righe di dati: BOM e preambolo `sep=` sono intestazione tecnica, non contenuto. */
function righeDati(testo: string): string[] {
  return testo.replace(/^﻿/, '').replace(/^sep=./, '').replace(/^\r\n/, '').trim().split('\r\n');
}

async function leggiExport(percorso: string): Promise<string> {
  await expect.poll(() => fs.existsSync(percorso), { timeout: 10_000 }).toBe(true);
  // Attesa della chiusura della scrittura: un file appena creato può essere ancora vuoto.
  await expect.poll(() => fs.readFileSync(percorso, 'utf8').length, { timeout: 10_000 }).toBeGreaterThan(0);
  return fs.readFileSync(percorso, 'utf8');
}

test.describe('Esportazione CSV/TSV', () => {

  test('2.1.1 — CSV della cartella: BOM, intestazioni e una riga per scheda', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Csv');
    await seed(page, [
      { segnatura: 'ASP, 12', cartella: 'Fondo', tags: 'notaio,vendita', autore: 'Anonimo' },
      { segnatura: 'ASP-13', cartella: 'Fondo/1340', autore: 'Bartolo' },
      { segnatura: 'FUORI-1' },
    ]);

    const out = path.join(userDataDir, 'fondo.csv');
    await stubDialog(electronApp, { canceled: false, filePath: out });
    await page.evaluate(() => (window as any).esportaCartellaCsvSpecifica('Fondo', 'csv'));

    const testo = await leggiExport(out);
    expect(testo.charCodeAt(0)).toBe(0xFEFF); // BOM: senza, Excel sbaglia le diacritiche
    // Preambolo: senza, Excel con separatore di lista italiano (';') non spezza le colonne.
    expect(testo.slice(1).startsWith('sep=,')).toBe(true);
    const righe = righeDati(testo);
    expect(righe).toHaveLength(3); // intestazione + le 2 schede del Fondo (sottocartella inclusa)
    expect(righe[0].startsWith('Segnatura')).toBe(true); // l'ID tecnico sta in coda, non in testa
    expect(righe[0]).toContain('Autore/i');
    expect(righe[0].endsWith('ID')).toBe(true);
    expect(righe[1]).toContain('"ASP, 12"'); // la virgola nella segnatura forza il quoting
    expect(testo).not.toContain('FUORI-1'); // la scheda fuori cartella non entra nell'export
  });

  test('2.1.2 — colonne = unione dei tipi presenti nella selezione', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Csv');
    await seed(page, [
      { segnatura: 'M-1', autore: 'Anonimo' },
      { segnatura: 'I-1', tipoDocumento: 'imbreviature', Notaio: 'Pietro', attori_dinamici: [{ k: 'Venditore', v: 'Bartolo' }] },
    ]);

    const out = path.join(userDataDir, 'union.csv');
    await stubDialog(electronApp, { canceled: false, filePath: out });
    await page.evaluate(() => (window as any).esportaCartellaCsv('csv'));

    const righe = righeDati(await leggiExport(out));
    expect(righe[0]).toContain('Autore/i');           // dal tipo manoscritto
    expect(righe[0]).toContain('Notaio');             // dal tipo imbreviature
    expect(righe[0]).not.toContain('Dichiarante');    // tipo fiscali: assente dalla selezione
    expect(righe.join('\n')).toContain('Venditore: Bartolo'); // lista dinamica appiattita
  });

  test('2.1.3 — Ctrl+Maiusc+E esporta solo la selezione', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Csv');
    await seed(page, [{ segnatura: 'SEL-1' }, { segnatura: 'SEL-2' }, { segnatura: 'ESCA' }]);

    const dati = await getAppData(page);
    const ids = dati.manoscritti.filter((m: any) => m.segnatura.startsWith('SEL-')).map((m: any) => m.id);
    await page.evaluate((ids) => {
      (window as any).selectedRecords = ids;
      (window as any).aggiornaStatoSelezione();
    }, ids);

    const out = path.join(userDataDir, 'selezione.csv');
    await stubDialog(electronApp, { canceled: false, filePath: out });
    // Niente click per prendere il focus: nella lista finirebbe su una scheda e la
    // selezione verrebbe sostituita da quella sola.
    await page.keyboard.press('Control+Shift+E');

    const testo = await leggiExport(out);
    expect(testo).toContain('SEL-1');
    expect(testo).toContain('SEL-2');
    expect(testo).not.toContain('ESCA'); // la scheda non selezionata resta fuori
    // A differenza dello ZIP, l'export CSV non azzera la selezione.
    expect(await page.evaluate(() => (window as any).selectedRecords.length)).toBe(2);
  });

  test('2.1.4 — TSV: delimitatore tab', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Csv');
    await seed(page, [{ segnatura: 'TSV-1', autore: 'Anonimo' }]);

    const out = path.join(userDataDir, 'tabella.tsv');
    await stubDialog(electronApp, { canceled: false, filePath: out });
    await page.evaluate(() => (window as any).esportaCartellaCsv('tsv'));

    const righe = righeDati(await leggiExport(out));
    expect(righe[0]).toContain('\t');
    expect(righe[0]).not.toContain(',');
    expect(righe[1].split('\t')).toContain('TSV-1');
  });

  test('2.1.5 — le voci CSV sono raggiungibili da menu e palette', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Csv');
    await seed(page, [{ segnatura: 'MENU-1' }]);

    // "⋯" della barra: export CSV e TSV della cartella.
    await page.locator('#context-overflow-slot button').click();
    const menu = page.locator('#custom-context-menu');
    // Etichetta breve a schermo, dizione estesa nel `title` (il menu tronca a 280px).
    await expect(menu).toContainText('Esporta CSV');
    await expect(menu).toContainText('Esporta TSV');
    await expect(menu.locator('button[title="Esporta Cartella in CSV"]')).toHaveCount(1);
    await page.keyboard.press('Escape');

    // Palette: il comando esiste ed è filtrabile per "csv".
    await page.keyboard.press('Control+K');
    await page.locator('#cp-input').fill('csv');
    await expect(page.locator('#cp-lista')).toContainText('CSV');
    await page.keyboard.press('Escape');
  });
});
