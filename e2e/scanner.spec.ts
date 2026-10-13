import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';

test.use({ seedWorkspace: 'Scanner' });

declare const appData: any;

// PIANO-SCANNER Fase 2: il pannello "Scansioni in arrivo" trasforma i lotti ricevuti dal
// telefono in carte di una scheda (nuova o esistente). Il lotto si scrive su disco come lo
// lascerebbe la ricezione da Drive; la ricezione stessa è coperta da test/arrivoLotti.test.js.

function png(): Buffer {
  const blocco = (tipo: string, dati: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dati.length);
    const td = Buffer.concat([Buffer.from(tipo), dati]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE((zlib as any).crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])),
    blocco('IDAT', zlib.deflateSync(Buffer.from([0, 200, 100, 50]))),
    blocco('IEND', Buffer.alloc(0))
  ]);
}

function lottoInArrivo(ws: string, id: string, titolo: string, etichette: string[], destinazione: any = { tipo: 'nessuna' }, extra: any = {}, note: string[] = []) {
  const dir = path.join(ws, '.archiview', 'scanner', 'arrivo', id);
  fs.mkdirSync(dir, { recursive: true });
  const b = png();
  const sha = crypto.createHash('sha256').update(b).digest('hex');
  const pagine = etichette.map((etichetta, i) => {
    const file = `p000${i + 1}.png`;
    fs.writeFileSync(path.join(dir, file), b);
    return { file, sha256: sha, byte: b.length, modalita: 'documento', etichetta, ...(note[i] ? { nota: note[i] } : {}) };
  });
  fs.writeFileSync(path.join(dir, 'lotto.json'), JSON.stringify({
    formato: 'archiview-scanner/lotto', versione: 1, id, creatoIl: '2026-10-09T10:00:00+02:00',
    titolo, nota: 'legatura fragile', destinazione, pagine, ...extra
  }));
  return dir;
}

test.describe('Scanner — scansioni in arrivo', () => {
  test('un lotto diventa una scheda nuova, un altro si aggiunge alla scheda selezionata', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    const primo = lottoInArrivo(ws, '20261009-100000-aaaa', 'Reg. <img src=x onerror=alert(1)>', ['1r', '1v'], undefined, {}, ['', 'rifilata']);

    await page.locator('#btn-scansioni').click();
    const modal = page.locator('#scanner-modal');
    await expect(modal).toBeVisible();
    const lotto = modal.locator('.scan-lotto');
    await expect(lotto).toHaveCount(1);
    // Il titolo arriva dal telefono: testo, non HTML.
    await expect(lotto.locator('h5')).toHaveText('Reg. <img src=x onerror=alert(1)>');
    await expect(lotto.locator('figcaption')).toHaveText(['1r', '1v']);
    // Nessuna scheda scelta: «Aggiungi» resta spento finché non se ne cerca una nel pannello.
    await expect(lotto.getByRole('button', { name: 'Aggiungi', exact: true })).toBeDisabled();

    await lotto.getByRole('button', { name: 'Nuova scheda' }).click();
    await expect(modal).toBeHidden();   // si apre la scheda nuova da completare
    const nuova = await page.evaluate(() => appData.manoscritti.find((m: any) => (m.segnatura || '').startsWith('Reg.')));
    // Le note del telefono (lotto e pagine) finiscono nel campo Note.
    expect(nuova.note).toBe('legatura fragile\n\n1v: rifilata');
    expect(nuova.allegati.map((a: any) => a.originalName)).toEqual(['1r', '1v']);
    expect(fs.existsSync(primo)).toBe(false);
    const fileCarta = await page.evaluate((nome: string) => (window as any).apiBrowser.getAllegatoPath(nome), nuova.allegati[0].nome);
    expect(fs.existsSync(fileCarta)).toBe(true);
    await page.keyboard.press('Escape');

    // Secondo lotto, alla scheda appena creata (selezionata nell'elenco), come PDF unico:
    // l'opzione ora è in Impostazioni → Documenti (Fase 12), non più su ogni lotto.
    lottoInArrivo(ws, '20261009-110000-bbbb', 'Reg. 13', ['2r', '2v', ''], undefined, { nota: 'cucitura rotta' }, ['', '', 'macchia']);
    await page.evaluate(async (id: string) => {
      (window as any).selectedRecords = [id];
      await (window as any).apiSettings.patch({ scannerPdf: true });
    }, nuova.id);
    await page.locator('#btn-scansioni').click();
    const secondo = modal.locator('.scan-lotto');
    await expect(secondo).toHaveCount(1);
    await expect(secondo.getByText('Unisci in un PDF')).toHaveCount(0);
    await secondo.getByRole('button', { name: /^Aggiungi a/ }).click();
    await expect(modal.locator('.scan-lotto')).toHaveCount(0);
    const dopo = await page.evaluate((id: string) => appData.manoscritti.find((m: any) => m.id === id), nuova.id);
    expect(dopo.allegati.map((a: any) => a.tipo)).toEqual(['immagine', 'immagine', 'pdf']);
    // Scheda esistente, anche come PDF: le note si accodano; pagina senza etichetta = «p. N».
    expect(dopo.note).toBe('legatura fragile\n\n1v: rifilata\n\ncucitura rotta\n\np. 3: macchia');
    // Il registro impedisce che il lotto torni con la prossima ricezione.
    expect(fs.existsSync(path.join(ws, '.archiview', 'scanner', 'assegnati', '20261009-110000-bbbb'))).toBe(true);
  });

  test('la scheda scelta sul telefono è proposta senza selezionarla', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    await page.evaluate(async () => {
      appData.manoscritti.push({ id: 'dest-1', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'Reg. 7', allegati: [], lastModified: Date.now() });
      await (window as any).Store.commit();
    });
    lottoInArrivo(ws, '20261009-130000-dddd', 'Carte sciolte', ['5r'], { tipo: 'esistente', schedaId: 'dest-1' });
    await page.locator('#btn-scansioni').click();
    await page.locator('#scanner-modal .scan-lotto').getByRole('button', { name: 'Aggiungi a «Reg. 7»' }).click();
    await expect(page.locator('#scanner-modal .scan-lotto')).toHaveCount(0);
    const allegati = await page.evaluate(() => appData.manoscritti.find((m: any) => m.id === 'dest-1').allegati);
    expect(allegati.map((a: any) => a.originalName)).toEqual(['5r']);
  });

  test('senza scheda scelta la si cerca nel pannello, e «Aggiungi» spento si riconosce', async ({ page, userDataDir }) => {
    // M8.4 (11/10): il pulsante disattivato sembrava attivo e il pannello copre l'elenco delle schede.
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    await page.evaluate(async () => {
      appData.manoscritti.push({ id: 'dest-2', cartella: 'Serie/1', tipoDocumento: 'imbreviature', segnatura: 'Reg. 9', allegati: [], lastModified: Date.now() });
      await (window as any).Store.commit();
    });
    lottoInArrivo(ws, '20261009-140000-eeee', 'Sciolte', ['7r']);
    await page.locator('#btn-scansioni').click();
    const lotto = page.locator('#scanner-modal .scan-lotto');
    const aggiungi = lotto.getByRole('button', { name: 'Aggiungi', exact: true });
    await expect(aggiungi).toBeDisabled();
    expect(Number(await aggiungi.evaluate(el => getComputedStyle(el).opacity))).toBeLessThan(1);

    await lotto.getByLabel('Aggiungi a una scheda').fill('Reg. 9 — Serie/1');
    await expect(aggiungi).toBeEnabled();
    await aggiungi.click();
    await expect(page.locator('#scanner-modal .scan-lotto')).toHaveCount(0);
    const allegati = await page.evaluate(() => appData.manoscritti.find((m: any) => m.id === 'dest-2').allegati);
    expect(allegati.map((a: any) => a.originalName)).toEqual(['7r']);
  });

  test('durante la ricezione l\'elenco dice che sta scaricando, non "nessuna scansione"', async ({ page, electronApp, userDataDir }) => {
    // Prova a mano 11/10: "Lotto …: 4/4 pagine" in alto e "Nessuna scansione in arrivo" sotto.
    // Prova a mano 11/10 (2): con l'invio dell'elenco schede a Drive ancora in corso, «Crea
    // scheda» e «Aggiungi a» non facevano nulla (pannello "occupato", uscita silenziosa).
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('scanner-ricevi-drive');
      ipcMain.handle('scanner-ricevi-drive', () => new Promise(r => {
        (globalThis as any).__fineRicezione = () => r({ success: true, ricevuti: ['20261011-121038-hgbl'], inCaricamento: [], falliti: [] });
      }));
      ipcMain.removeHandler('scanner-pubblica-schede');
      ipcMain.handle('scanner-pubblica-schede', () => new Promise(() => {}));   // Drive che non risponde
    });
    await page.locator('#btn-scansioni').click();
    const lista = page.locator('#scan-lista');
    await expect(lista).toContainText('Nessuna scansione dal telefono');
    await page.locator('#scan-ricevi').click();
    await expect(lista).toContainText('Ricezione da Drive in corso');
    await expect(lista).not.toContainText('Nessuna scansione dal telefono');
    lottoInArrivo(ws, '20261011-121038-hgbl', 'Meme', ['1r']);
    await electronApp.evaluate(() => (globalThis as any).__fineRicezione());
    const lotto = page.locator('#scanner-modal .scan-lotto');
    await expect(lotto).toHaveCount(1);
    await expect(lista).not.toContainText('Ricezione da Drive in corso');
    await lotto.getByRole('button', { name: 'Nuova scheda' }).click();
    await expect(page.locator('#scanner-modal')).toBeHidden();
    const nuova = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'Meme'));
    expect(nuova.allegati.map((a: any) => a.originalName)).toEqual(['1r']);
  });

  test('archivio scelto sul telefono: i lotti si importano da soli, "Da smistare" resta nel pannello', async ({ page, userDataDir }) => {
    // PIANO-SCANNER Fase 10a, CONTRATTO §2.5.
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    await page.evaluate(async () => {
      appData.manoscritti.push({ id: 'dest-3', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'Reg. 3', allegati: [], lastModified: Date.now() });
      await (window as any).Store.commit();
    });
    const arch = { archivio: path.basename(ws) };
    const nuova = { tipo: 'nuova', tipoDocumento: 'imbreviature', schedaId: '3f2a9c1e-0b7d-4e55-9a10-2c4d6e8f0a1b', campi: { segnatura: 'Reg. 40' } };
    // Due scansioni della stessa scheda nuova (la seconda arrivata per prima nell'elenco), una per una esistente.
    lottoInArrivo(ws, '20261011-100500-bbbb', '', ['3r'], nuova, arch);
    lottoInArrivo(ws, '20261011-100000-aaaa', '', ['1r', '2r'], nuova, arch);
    lottoInArrivo(ws, '20261011-101000-cccc', '', ['9v'], { tipo: 'esistente', schedaId: 'dest-3' }, arch);
    lottoInArrivo(ws, '20261011-102000-dddd', 'Da smistare', ['x'], { tipo: 'nessuna' }, arch);

    await page.locator('#btn-scansioni').click();
    const lotti = page.locator('#scanner-modal .scan-lotto');
    await expect(lotti).toHaveCount(1);
    await expect(lotti.locator('h5')).toHaveText('Da smistare');
    // Fase 12: in testa al pannello, dove sono finite le pagine importate da sole.
    const importate = page.locator('#scan-importate');
    await expect(importate).toContainText('3 pagine nella scheda nuova «Reg. 40»');
    await expect(importate).toContainText('1 pagina in «Reg. 3»');
    await expect(page.locator('#scan-da-smistare-titolo')).toHaveText('Da smistare · 1');
    const [creata, esistente] = await page.evaluate(() => ['3f2a9c1e-0b7d-4e55-9a10-2c4d6e8f0a1b', 'dest-3']
      .map(id => appData.manoscritti.filter((m: any) => m.id === id)));
    expect(creata).toHaveLength(1);
    expect(creata[0].segnatura).toBe('Reg. 40');
    expect(creata[0].allegati.map((a: any) => a.originalName)).toEqual(['1r', '2r', '3r']);
    expect(esistente[0].allegati.map((a: any) => a.originalName)).toEqual(['9v']);
    // Fase 12: nell'albero a sinistra «+N» accanto alle schede che hanno ricevuto carte.
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#folder-list .sidebar-dal-telefono')]
      .map(s => `${s.parentElement!.querySelector('[translate="no"]')!.textContent} ${s.textContent}`).sort()))
      .toEqual(['Reg. 3 +1', 'Reg. 40 +3']);
    await expect(page.locator('#folder-list .sidebar-dal-telefono').first()).toHaveAttribute('aria-label', /^1 carte|^1 leaves/);
  });

  test('l\'elenco per il telefono porta titolo e cartelle vuote; la cartella di una scheda nuova entra nell\'albero', async ({ page, electronApp, userDataDir }) => {
    // PIANO-SCANNER Fase 14b, CONTRATTO §4.3.
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    await page.evaluate(async () => {
      appData.manoscritti.push({ id: 'dest-14', cartella: 'Serie', tipoDocumento: 'imbreviature', segnatura: 'Reg. 14', autore: 'Not. Rossi', allegati: [], lastModified: Date.now() });
      appData.cartelle.push('Serie', 'Mappe');
      await (window as any).Store.commit();
    });
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('scanner-ricevi-drive');
      ipcMain.handle('scanner-ricevi-drive', () => ({ success: true, ricevuti: [], inCaricamento: [], falliti: [] }));
      ipcMain.removeHandler('scanner-pubblica-schede');
      ipcMain.handle('scanner-pubblica-schede', (_e: any, schede: any, cartelle: any) => {
        (globalThis as any).__pubblicato = { schede, cartelle };
        return { success: true, schede: schede.length };
      });
    });
    // Cartella scelta sul telefono che qui non c'è (tolta nel frattempo).
    const nuova = { tipo: 'nuova', tipoDocumento: 'imbreviature', schedaId: '7b1e2c3d-4f5a-4b6c-8d9e-0a1b2c3d4e5f', cartella: 'Fondo/Serie 2', campi: { segnatura: 'Reg. 42' } };
    lottoInArrivo(ws, '20261011-140000-eeee', '', ['1r'], nuova, { archivio: path.basename(ws) });

    await page.locator('#btn-scansioni').click();
    await expect(page.locator('#scan-importate')).toContainText('«Reg. 42»');
    const creata = await page.evaluate(() => ({
      cartella: appData.manoscritti.find((m: any) => m.segnatura === 'Reg. 42').cartella,
      cartelle: appData.cartelle.slice()
    }));
    expect(creata.cartella).toBe('Fondo/Serie 2');
    expect(creata.cartelle).toContain('Fondo/Serie 2');

    await page.locator('#scan-ricevi').click();
    const pubblicato = () => electronApp.evaluate(() => (globalThis as any).__pubblicato);
    await expect.poll(async () => (await pubblicato())?.cartelle, { timeout: 10000 }).toEqual(expect.arrayContaining(['Serie', 'Mappe', 'Fondo/Serie 2']));
    expect((await pubblicato()).schede.find((s: any) => s.id === 'dest-14')).toEqual({ id: 'dest-14', segnatura: 'Reg. 14', cartella: 'Serie', titolo: 'Not. Rossi' });
  });

  /** Controllo di Drive finto: vuoto finché il test non dà un esito; prima si lascia passare quello dell'avvio (app.ts). */
  async function driveFinto(electronApp: any) {
    await electronApp.evaluate(({ ipcMain }: any) => {
      (globalThis as any).__controlli = 0;
      ipcMain.removeHandler('scanner-controlla-drive');
      ipcMain.handle('scanner-controlla-drive', () => {
        (globalThis as any).__controlli++;
        return { success: true, ...((globalThis as any).__esito || { collegato: true, qui: [], altri: [] }) };
      });
      ipcMain.removeHandler('scanner-ricevi-drive');
      ipcMain.handle('scanner-ricevi-drive', () => ({ success: true, ricevuti: [], inCaricamento: [], falliti: [] }));
      ipcMain.removeHandler('scanner-pubblica-schede');
      ipcMain.handle('scanner-pubblica-schede', () => ({ success: true, schede: 0 }));
    });
    await expect.poll(() => electronApp.evaluate(() => (globalThis as any).__controlli), { timeout: 10000 }).toBeGreaterThan(0);
    return (esito: any) => electronApp.evaluate((_e: any, x: any) => { (globalThis as any).__esito = x; }, esito);
  }

  test('all\'apertura: un solo riepilogo per tutti gli archivi, e «Più tardi» non lo ripropone', async ({ page, electronApp, userDataDir }) => {
    // Prova a mano 11/10: un avviso per ogni archivio nuovo, ripetuto a ogni apertura.
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    await page.evaluate(async () => {
      appData.manoscritti.push({ id: 'dest-41', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'Reg. 41', allegati: [], lastModified: Date.now() });
      await (window as any).Store.commit();
    });
    const esito = await driveFinto(electronApp);
    const drive = {
      collegato: true,
      qui: [{ id: 'a1', pagine: 12, destinazione: { tipo: 'esistente', schedaId: 'dest-41' } }, { id: 'a2', pagine: 5, destinazione: { tipo: 'nessuna' } }],
      altri: [{ nome: 'Catasto affitti', pagine: 4, nuovo: false, percorso: null }, { nome: 'Fondo Caracciolo', pagine: 3, nuovo: true, percorso: null }]
    };
    await esito(drive);
    const controlla = () => page.evaluate(() => (window as any).controllaScansioniAllApertura());
    const avviso = page.locator('#scan-avviso');

    controlla();
    await expect(avviso).toBeVisible();
    await expect(avviso).toContainText('Su Drive ci sono 24 pagine scansionate col telefono.');
    await expect(avviso.locator('.scan-riepilogo-riga').filter({ hasText: 'Reg. 41' })).toHaveText(/^12\s*per Reg\. 41 · entrano da sole$/);
    await expect(avviso.locator('.scan-riepilogo-riga').filter({ hasText: 'da smistare' }).locator('.scan-num')).toHaveText('5');
    await expect(avviso.locator('.scan-riepilogo-riga').filter({ hasText: 'Fondo Caracciolo' })).toContainText('nuovo');
    await avviso.getByRole('button', { name: 'Più tardi' }).click();
    await expect(avviso).toBeHidden();

    // Stesse scansioni: niente avviso (la chiamata torna senza aspettare nessuno).
    await controlla();
    await expect(avviso).toBeHidden();

    // Ne arriva un'altra: torna, e «Importa ora» apre il pannello con gli altri archivi.
    await esito({ ...drive, qui: [...drive.qui, { id: 'a3', pagine: 1, destinazione: { tipo: 'nessuna' } }] });
    controlla();
    await expect(avviso).toBeVisible();
    await avviso.getByRole('button', { name: 'Importa ora' }).click();
    await expect(avviso).toBeHidden();
    await expect(page.locator('#scanner-modal')).toBeVisible();
    await expect(page.locator('#scan-altri').getByRole('button', { name: 'Crea archivio…' })).toBeVisible();
  });

  test('il pannello elenca gli altri archivi, apribili o da creare, senza avvisi a parte', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    const esito = await driveFinto(electronApp);
    await esito({ collegato: true, qui: [], altri: [
      { nome: 'Catasto affitti', pagine: 4, nuovo: false, percorso: 'C:\\Archivi\\Catasto affitti_ArchiView' },
      { nome: 'Notai di Bologna', pagine: 3, nuovo: true, percorso: null },
      { nome: 'Lontano', pagine: 1, nuovo: false, percorso: null }
    ] });
    await page.locator('#btn-scansioni').click();
    const altri = page.locator('#scan-altri');
    await expect(altri.locator('li').filter({ hasText: 'Catasto affitti' }).getByRole('button', { name: 'Apri archivio' })).toBeVisible();
    await expect(altri.locator('li').filter({ hasText: 'Notai di Bologna' }).getByRole('button', { name: 'Crea archivio…' })).toBeVisible();
    await expect(altri.locator('li').filter({ hasText: 'Lontano' })).toContainText('si importano aprendo quell\'archivio');
    await expect(page.locator('#scan-drive-testo')).toContainText('Drive controllato alle');
    await expect(page.locator('#scan-avviso')).toBeHidden();
    // Pannello laterale: l'elenco delle schede resta cliccabile sotto lo strato del modale.
    expect(await page.locator('#scanner-modal').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  });

  test('Wi-Fi diretto: il QR compare, il server risponde solo col token e si spegne alla chiusura', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    await page.locator('#btn-scansioni').click();
    await page.locator('#scan-wifi').click();
    const qr = page.locator('#scan-wifi-qr img');
    await expect(qr).toBeVisible();
    expect(await qr.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    const info = await page.locator('#scan-wifi-info').textContent();
    const porta = Number(/:(\d+)/.exec(info || '')![1]);
    const ping = (h: Record<string, string>) => fetch(`http://127.0.0.1:${porta}/ping`, { headers: h }).then(r => r.status);
    expect(await ping({})).toBe(401);

    await page.keyboard.press('Escape');
    await expect(page.locator('#scanner-modal')).toBeHidden();
    await expect.poll(() => ping({}).catch(() => 'spento')).toBe('spento');
  });

  test('lotto da smistare senza titolo: si presenta con la nota del telefono', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    lottoInArrivo(ws, '20261011-130000-nnnn', '', ['x']);
    await page.locator('#btn-scansioni').click();
    const lotto = page.locator('#scanner-modal .scan-lotto');
    await expect(lotto.locator('h5')).toHaveText('legatura fragile');
    await expect(lotto).toHaveAttribute('aria-label', 'legatura fragile');
  });

  test('scartare un lotto chiede conferma e lo toglie', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Scanner');
    const dir = lottoInArrivo(ws, '20261009-120000-cccc', 'Da buttare', ['']);
    await page.locator('#btn-scansioni').click();
    await page.locator('#scanner-modal .scan-lotto').getByRole('button', { name: 'Scarta' }).click();
    await expect(page.locator('#bottom-confirm-banner')).toBeVisible();
    await page.locator('#btn-bottom-confirm-yes').click();
    await expect(page.locator('#scanner-modal .scan-lotto')).toHaveCount(0);
    expect(fs.existsSync(dir)).toBe(false);
  });
});
