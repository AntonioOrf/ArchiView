import { expect, type Page, type ElectronApplication } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { stubDialog } from './fixtures';
import { createItemWithAttachment } from './helpers';

export type Schermata = { nome: string; radice: string; apri: () => Promise<void>; chiudi: () => Promise<void> };

export const modaliAperti = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.modal-overlay'))
    .filter(m => m.getClientRects().length && !m.classList.contains('hidden-tab')).length);

export async function preparaSchermateSecondarie(page: Page, app: ElectronApplication, dir: string): Promise<Schermata[]> {
  const id = await createItemWithAttachment(page, 'A11Y-ALLEGATO', path.join(__dirname, 'fixtures', 'sample.png'));
  await page.locator('#btn-tab-add').click();
  await page.locator('#form-segnatura').fill('A11Y-VUOTA');
  await page.locator('#btn-submit-form').click();
  await expect(page.locator('#view-list')).toContainText('A11Y-VUOTA');
  // @ts-ignore
  const vuota: string = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'A11Y-VUOTA').id);

  const csv = path.join(dir, 'a11y-import.csv');
  fs.writeFileSync(csv, 'Segnatura,Archivio,Tag,Notaio\r\nASP 100,Notarile,pergamena,Rossi\r\n', 'utf8');
  await stubDialog(app, { canceled: false, filePaths: [csv] });
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('ocr-lingue');
    ipcMain.handle('ocr-lingue', () => ({
      ok: true,
      lingue: [
        { codice: 'ita', nome: 'Italiano', installata: true, dimensione: 4000000 },
        { codice: 'lat', nome: 'Latino', installata: false, dimensione: 0 },
      ],
    }));
  });

  const chiudi = async () => {
    await page.keyboard.press('Escape');
    await expect.poll(() => modaliAperti(page)).toBe(0);
  };
  const modale = (nome: string, sel: string, apri: () => Promise<unknown>, pronto?: () => Promise<unknown>): Schermata => ({
    nome, radice: sel, chiudi,
    apri: async () => {
      await apri();
      await expect(page.locator(sel)).toBeVisible();
      if (pronto) await pronto();
      await expect.poll(() => modaliAperti(page)).toBe(1);
    },
  });
  const w = (f: string, ...args: unknown[]) => page.evaluate(([f, args]) => (window as any)[f as string](...(args as unknown[])), [f, args] as const);
  const trascrizione = (nome: string, rid: string): Schermata => ({
    nome, radice: '#view-trascrizione',
    apri: async () => {
      await w('apriTrascrizione', rid);
      await expect(page.locator('#view-trascrizione')).toBeVisible();
    },
    chiudi: async () => {
      await w('confermaUscitaTrascrizione');
      await expect(page.locator('#view-trascrizione')).toBeHidden();
    },
  });

  return [
    modale('welcome', '#welcome-modal', () => w('mostraWelcomeModal')),
    modale('import-csv-modello', '#import-csv-modal', () => w('apriImportCsv'),
      () => expect(page.locator('#import-csv-step-modello')).toBeVisible()),
    modale('import-csv-mappatura', '#import-csv-modal', () => w('apriImportCsv'), async () => {
      await page.locator('#import-csv-continua').click();
      await expect(page.locator('#import-csv-step-mappatura')).toBeVisible();
    }),
    modale('iiif', '#iiif-modal', () => w('apriImportIiif')),
    modale('ocr', '#ocr-modal', () => w('apriOcrModal', id, 0),
      () => expect(page.locator('#ocr-confirm')).toBeEnabled()),
    modale('stampa', '#print-modal', () => page.evaluate((rid) => {
      (window as any).selectedRecords = [rid];
      (window as any).apriStampa('selezione');
    }, id)),
    modale('condivisione', '#share-modal', () => w('apriShareModal')),
    modale('grafo', '#grafo-modal', () => w('apriGrafo')),
    modale('anagrafiche', '#authority-modal', () => w('apriAnagrafica')),
    modale('esporta-testo', '#export-text-modal', () => w('apriEsportaTesto', 'tutto')),
    modale('confronto-carte', '#confronto-modal', () => w('apriConfrontoCarte')),
    modale('scansioni', '#scanner-modal', () => w('apriScansioni')),
    modale('import-zip-esito', '#import-zip-modal',
      () => w('importZipRiuscito', { schede: 136, cartelle: 31, copiati: 430, saltati: 0, primaScheda: null })),
    modale('import-zip-errore', '#import-zip-modal',
      () => w('importZipFallito', { codice: 'spazio', dettaglio: 'ENOSPC: no space left on device' }),
      () => page.evaluate(() => { (document.querySelector('.iz-dettagli') as HTMLDetailsElement).open = true; })),
    {
      ...modale('import-zip-corso', '#import-zip-modal',
        () => w('importZipAvanzamento', { nome: 'genius scan - per ArchiView.zip', fatte: 120, totale: 431 })),
      chiudi: async () => { await w('importZipFallito', { codice: 'altro' }); await chiudi(); },
    },
    trascrizione('trascrizione', id),
    trascrizione('trascrizione-senza-allegati', vuota),
    {
      nome: 'trascrizione-scheda', radice: '#view-trascrizione',
      apri: async () => {
        await w('apriTrascrizione', id);
        await w('mostraSchedaTrascrizione', 'scheda');
        await expect(page.locator('#trasc-pannello-scheda #form-segnatura')).toBeVisible();
      },
      chiudi: async () => {
        await w('mostraSchedaTrascrizione', 'testo');
        await w('confermaUscitaTrascrizione');
        await expect(page.locator('#view-trascrizione')).toBeHidden();
      },
    },
    {
      nome: 'documento-scheda', radice: '#doc-scheda',
      apri: async () => {
        await w('editItem', id);
        await w('alternaDocumentoScheda');
        await expect(page.locator('#doc-scheda')).toBeVisible();
      },
      chiudi: async () => {
        await w('alternaDocumentoScheda');
        await w('switchTab', 'list');
        await expect(page.locator('#doc-scheda')).toBeHidden();
      },
    },
  ];
}
