import { test, expect } from './fixtures';
import { stubDialog } from './fixtures';
import { createLocalWorkspace, getAppData } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

test.use({ seedWorkspace: 'Imp' });

async function preparaZip(electronApp: any, dir: string, voci: Record<string, string | Buffer>): Promise<void> {
  const archiver = require('archiver');
  const percorso = path.join(dir, 'import.zip');
  await new Promise<void>((ok, ko) => {
    const out = fs.createWriteStream(percorso);
    const zip = new archiver.ZipArchive({ store: true });
    out.on('close', () => ok());
    zip.on('error', ko);
    zip.pipe(out);
    for (const [nome, contenuto] of Object.entries(voci)) zip.append(contenuto, { name: nome });
    zip.finalize();
  });
  await stubDialog(electronApp, { canceled: false, filePaths: [percorso] });
}

const modale = (page: any) => page.locator('#import-zip-modal');

test.describe('Import ZIP: avanzamento ed esito', () => {

  test('a import riuscito mostra il riepilogo e porta alle schede', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    const scheda = (id: string, segnatura: string, file: string) => ({
      id, cartella: 'Fondo/Filza 1', segnatura, allegati: [{ nome: file, tipo: 'pdf' }]
    });
    await preparaZip(electronApp, userDataDir, {
      'schedatura.json': JSON.stringify({ manoscritti: [scheda('z1', 'Atto 1', 'gs_a.pdf'), scheda('z2', 'Atto 2', 'gs_b.pdf')] }),
      'allegati/gs_a.pdf': '%PDF-1.4 a',
      'allegati/gs_b.pdf': '%PDF-1.4 b',
    });

    await page.evaluate(() => (window as any).importaManoscritto());

    await expect(modale(page)).toBeVisible();
    await expect(page.locator('#iz-titolo')).toHaveText('Importazione completata');
    await expect(page.locator('#iz-riepilogo')).toHaveText('2 schede aggiunte all\'archivio, in una cartella.');
    await expect(page.locator('#iz-copiati')).toHaveText('2');
    await expect(page.locator('#iz-saltati')).toHaveText('0');
    const data = await getAppData(page);
    expect(data.manoscritti.map((m: any) => m.segnatura).sort()).toEqual(['Atto 1', 'Atto 2']);

    await modale(page).getByRole('button', { name: 'Mostra le schede' }).click();
    await expect(modale(page)).toBeHidden();
  });

  test('D10/D23 — omonimi rinominati, rimandi rimappati, tag registrati, cartella fuori dai tombstone', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    const dirAllegati = path.join(userDataDir, 'ws', 'Imp', 'allegati_manoscritti');
    fs.mkdirSync(dirAllegati, { recursive: true });
    fs.writeFileSync(path.join(dirAllegati, 'gs_a.pdf'), 'locale');
    await page.evaluate(async () => {
      // @ts-ignore
      appData.manoscritti.push({ id: 'z1', segnatura: 'Locale 1', cartella: '' }, { id: 'z2', segnatura: 'Locale 2', cartella: '' });
      // @ts-ignore
      appData.deletedCartelle = ['Fondo', 'Fondo/Filza 1'];
      await (window as any).Store.commit();
    });
    await preparaZip(electronApp, userDataDir, {
      'schedatura.json': JSON.stringify({ manoscritti: [
        { id: 'z1', cartella: 'Fondo/Filza 1', segnatura: 'Atto 1', tags: 'notarile', relazioni: [{ id: 'z2' }], allegati: [{ nome: 'gs_a.pdf', tipo: 'pdf' }] },
        { id: 'z2', cartella: 'Fondo/Filza 1', segnatura: 'Atto 2' }] }),
      'allegati/gs_a.pdf': '%PDF-1.4 zip',
    });

    await page.evaluate(() => (window as any).importaManoscritto());
    await expect(page.locator('#iz-titolo')).toHaveText('Importazione completata');

    const data = await getAppData(page);
    const atto1 = data.manoscritti.find((m: any) => m.segnatura === 'Atto 1');
    const atto2 = data.manoscritti.find((m: any) => m.segnatura === 'Atto 2');
    expect(atto1.id).not.toBe('z1');
    expect(atto1.relazioni).toEqual([{ id: atto2.id }]);
    expect(atto1.allegati[0].nome).not.toBe('gs_a.pdf');
    expect(fs.readFileSync(path.join(dirAllegati, atto1.allegati[0].nome), 'utf8')).toBe('%PDF-1.4 zip');
    expect(fs.readFileSync(path.join(dirAllegati, 'gs_a.pdf'), 'utf8')).toBe('locale');
    expect(Object.values(data.tagsAnagrafica || {}).map((t: any) => t.nome)).toContain('notarile');
    expect(data.deletedCartelle || []).toEqual([]);
  });

  test('a import fallito spiega la causa, tiene i dettagli e offre di riprovare', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await preparaZip(electronApp, userDataDir, { 'allegati/x.pdf': '%PDF-1.4' });

    await page.evaluate(() => (window as any).importaManoscritto());

    await expect(page.locator('#iz-titolo')).toHaveText('Importazione non riuscita');
    await expect(page.locator('#iz-causa')).toHaveText('Lo ZIP non contiene un\'esportazione di ArchiView.');
    await page.locator('.iz-dettagli summary').click();
    await expect(page.locator('#iz-dettaglio')).toContainText('schedatura.json');
    await expect(modale(page).getByRole('button', { name: 'Riprova' })).toBeVisible();
    expect((await getAppData(page)).manoscritti).toHaveLength(0);

    await page.keyboard.press('Escape');
    await expect(modale(page)).toBeHidden();
  });

  test('durante l\'estrazione Esc non chiude l\'avanzamento', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Imp');
    await page.evaluate(() => (window as any).importZipAvanzamento({ nome: 'grande.zip', fatte: 120, totale: 431 }));

    await expect(page.locator('#iz-titolo')).toHaveText('Importazione in corso');
    await expect(page.locator('#iz-file')).toHaveText('File 120 di 431…');
    await expect(page.locator('#iz-percento')).toHaveText('28%');
    await expect(page.locator('#iz-barra')).toHaveAttribute('aria-valuenow', '28');

    await page.keyboard.press('Escape');
    await expect(modale(page)).toBeVisible();
    await expect(modale(page).getByRole('button')).toHaveCount(0);
  });
});
