import { expect, type Page, type ElectronApplication } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { stubDialog } from './fixtures';
import { createItemWithAttachment } from './helpers';

/**
 * Schermate secondarie per i test di accessibilità (contrasto 7.1, nomi 5.6, bersagli 5.9):
 * welcome, wizard di import CSV, IIIF, OCR, stampa, condivisione. Un unico elenco, così un
 * modale nuovo si aggiunge qui e finisce in tutte e tre le misure.
 *
 * Va chiamata subito dopo aver creato il workspace, con la lista a schermo: crea una scheda
 * con un'immagine allegata (serve a OCR e stampa). Stubba nel main il dialogo di apertura
 * (il wizard CSV chiede il file prima di aprirsi) e l'elenco delle lingue OCR: senza lingue
 * installate il modale OCR mostra solo l'avviso, e la sua parte principale non si misura.
 */
export type Schermata = { nome: string; radice: string; apri: () => Promise<void>; chiudi: () => Promise<void> };

export const modaliAperti = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.modal-overlay'))
    .filter(m => m.getClientRects().length && !m.classList.contains('hidden-tab')).length);

export async function preparaSchermateSecondarie(page: Page, app: ElectronApplication, dir: string): Promise<Schermata[]> {
  const id = await createItemWithAttachment(page, 'A11Y-ALLEGATO', path.join(__dirname, 'fixtures', 'sample.png'));

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

  return [
    modale('welcome', '#welcome-modal', () => w('mostraWelcomeModal')),
    modale('import-csv-modello', '#import-csv-modal', () => w('apriImportCsv'),
      () => expect(page.locator('#import-csv-step-modello')).toBeVisible()),
    modale('import-csv-mappatura', '#import-csv-modal', () => w('apriImportCsv'), async () => {
      await page.locator('#import-csv-continua').click();
      await expect(page.locator('#import-csv-step-mappatura')).toBeVisible();
    }),
    modale('iiif', '#iiif-modal', () => w('apriImportIiif')),
    // apriOcrModal è asincrona: il pulsante si abilita dopo aver letto le lingue dal main.
    modale('ocr', '#ocr-modal', () => w('apriOcrModal', id, 0),
      () => expect(page.locator('#ocr-confirm')).toBeEnabled()),
    modale('stampa', '#print-modal', () => page.evaluate((rid) => {
      (window as any).selectedRecords = [rid];
      (window as any).apriStampa('selezione');
    }, id)),
    modale('condivisione', '#share-modal', () => w('apriShareModal')),
  ];
}
