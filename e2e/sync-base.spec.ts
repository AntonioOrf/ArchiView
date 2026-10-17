import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'SyncBase' });

test.describe('Base del merge e ripristini', () => {
  test('O1: la trascrizione di una carta scritta dopo una sync sopravvive alla sync successiva', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');

    const testo = await page.evaluate(async () => {
      const w = window as any;
      const scheda = (trascrizione: string) => ({ id: 'b-1', segnatura: 'A', cartella: '', lastModified: 1000,
        allegati: [{ nome: 'b-1_c1.jpg', tipo: 'image', trascrizione }] });
      const remoto = () => scheda('del collega');
      w.appData.manoscritti = [scheda('vecchia')];
      w.appData.baseObjects = { 'b-1': scheda('vecchia') };
      w.appData.baseHashes = { 'b-1': w.getRecordHash(scheda('vecchia')) };

      await w.sincronizzaEUnisciDati({ manoscritti: [remoto()], cartelle: [] });
      const m = w.appData.manoscritti.find((x: any) => x.id === 'b-1');
      w.scriviTrascrizioneAllegato(m, 0, 'nuova', 0);

      await w.sincronizzaEUnisciDati({ manoscritti: [remoto()], cartelle: [] });
      return w.appData.manoscritti.find((x: any) => x.id === 'b-1').allegati[0].trascrizione;
    });

    expect(testo).toBe('nuova');
  });

  test('carte diverse della stessa scheda modificate dai due lati: fuse senza conflitto, trascrizione ricomposta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');

    const esito = await page.evaluate(async () => {
      const w = window as any;
      const scheda = (t1: string, t2: string, stato2?: string) => {
        const m: any = { id: 'b-2', segnatura: 'B', cartella: '', lastModified: 1000,
          allegati: [{ nome: 'c1.jpg', tipo: 'image', trascrizione: t1 }, { nome: 'c2.jpg', tipo: 'image', trascrizione: t2 }] };
        if (stato2) m.allegati[1].stato = stato2;
        m.trascrizione = w.componiTrascrizioneRecord(m);
        return m;
      };
      w.appData.manoscritti = [scheda('<p>mia</p>', '<p>due</p>')];
      w.appData.baseObjects = { 'b-2': scheda('<p>uno</p>', '<p>due</p>') };
      w.appData.baseHashes = { 'b-2': w.getRecordHash(scheda('<p>uno</p>', '<p>due</p>')) };
      let modale = false;
      const apri = w.apriMergeConflictModal;
      w.apriMergeConflictModal = (...a: any[]) => { modale = true; return apri(...a); };
      await w.sincronizzaEUnisciDati({ manoscritti: [scheda('<p>uno</p>', '<p>sua</p>', 'rivista')], cartelle: [] });
      w.apriMergeConflictModal = apri;
      const m = w.appData.manoscritti.find((x: any) => x.id === 'b-2');
      return { modale, testi: m.allegati.map((a: any) => a.trascrizione), stato: m.allegati[1].stato, derivata: m.trascrizione };
    });

    expect(esito.modale).toBe(false);
    expect(esito.testi).toEqual(['<p>mia</p>', '<p>sua</p>']);
    expect(esito.stato).toBe('rivista');
    expect(esito.derivata).toContain('mia');
    expect(esito.derivata).toContain('sua');
  });

  test('O2: ripristinare una revisione Drive rifirma le schede, mette i tombstone e carica col parent', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');
    await electronApp.evaluate(({ ipcMain }: any) => {
      ipcMain.removeHandler('drive-get-revision');
      ipcMain.handle('drive-get-revision', () => ({
        manoscritti: [{ id: 'r-1', segnatura: 'Vecchia', cartella: '', lastModified: 1000 }], cartelle: []
      }));
    });

    const esito = await page.evaluate(async () => {
      const w = window as any;
      const attuali = [
        { id: 'r-1', segnatura: 'Nuova', cartella: '', lastModified: 3000 },
        { id: 'r-2', segnatura: 'Creata dopo', cartella: '', lastModified: 3000 }
      ];
      w.appData.manoscritti = attuali.map(m => ({ ...m }));
      w.appData.baseObjects = Object.fromEntries(attuali.map(m => [m.id, { ...m }]));
      w.appData.baseHashes = Object.fromEntries(attuali.map(m => [m.id, w.getRecordHash(m)]));
      w.hubConfig = null;
      let caricato: any = null, parent: any = null;
      w.getApiCloud = async () => ({
        pull: async () => ({ database: { manoscritti: attuali.map(m => ({ ...m })), cartelle: [] }, driveModifiedTime: 5000 }),
        sync: async (p: number) => { parent = p; caricato = JSON.parse(JSON.stringify(w.databasePerDisco(w.appData))); return 6000; },
        syncAttachments: async () => {}
      });
      const ok = await w.ripristinaRevisioneCloud('file-1', 'rev-1');
      return { ok, parent, caricato, ultimo: w.ultimoCaricamento };
    });

    expect(esito.ok).toBe(true);
    expect(esito.parent).toBe(5000);
    expect(esito.ultimo).toBe(6000);
    expect(esito.caricato.manoscritti.map((m: any) => [m.id, m.segnatura])).toEqual([['r-1', 'Vecchia']]);
    expect(esito.caricato.manoscritti[0].lastModified).toBeGreaterThan(3000);
    expect(esito.caricato.deletedIds).toContain('r-2');
  });

  test('D20: se il salvataggio dopo il merge fallisce, sul cloud non si carica nulla', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');
    await electronApp.evaluate(({ ipcMain }: any) => {
      ipcMain.removeHandler('salva-dati');
      ipcMain.handle('salva-dati', () => { throw new Error('disco pieno'); });
    });

    const sync = await page.evaluate(async () => {
      const w = window as any;
      const mia = { id: 'd-1', segnatura: 'Mia', cartella: '', lastModified: 1000 };
      w.appData.manoscritti = [{ ...mia }];
      w.appData.baseObjects = { 'd-1': { ...mia } };
      w.appData.baseHashes = { 'd-1': w.getRecordHash(mia) };
      w.hubConfig = null;
      let sync = 0;
      w.getApiCloud = async () => ({
        pull: async () => ({ database: { manoscritti: [
          { id: 'd-1', segnatura: 'Mia', cartella: '', lastModified: 1000 },
          { id: 'd-2', segnatura: 'Del collega', cartella: '', lastModified: 2000 }
        ], cartelle: [] }, driveModifiedTime: 5000 }),
        sync: async () => { sync++; return 6000; },
        syncAttachments: async () => {}
      });
      await w.sincronizzaGoogleDrive(true);
      return sync;
    });

    expect(sync).toBe(0);
  });

  test('D4: una scrittura esterna del DB non sposta la base, la modifica locale non inviata resta', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');
    const fs = await import('fs');
    await page.evaluate(async () => {
      const w = window as any;
      const orig = { id: 'e-1', segnatura: 'Originale', cartella: '', lastModified: 1000 };
      w.appData.manoscritti = [{ ...orig, segnatura: 'Mia', lastModified: 2000 }];
      w.appData.baseObjects = { 'e-1': { ...orig } };
      w.appData.baseHashes = { 'e-1': w.getRecordHash(orig) };
      await w.salvaTutto();
    });
    const file = path.join(ws, 'database_manoscritti.json');
    const db = JSON.parse(fs.readFileSync(file, 'utf8'));
    db.manoscritti.push({ id: 'e-2', segnatura: 'Da fuori', cartella: '', lastModified: 3000 });
    fs.writeFileSync(file, JSON.stringify(db));
    await expect.poll(() => page.evaluate(() => (window as any).appData.manoscritti.some((m: any) => m.id === 'e-2')), { timeout: 10_000 }).toBe(true);

    const segnatura = await page.evaluate(async () => {
      const w = window as any;
      w.hubConfig = null;
      w.getApiCloud = async () => ({
        pull: async () => ({ database: { manoscritti: [{ id: 'e-1', segnatura: 'Originale', cartella: '', lastModified: 1000 }], cartelle: [] }, driveModifiedTime: 5000 }),
        sync: async () => 6000,
        syncAttachments: async () => {}
      });
      await w.scaricaDalCloud(true);
      return w.appData.manoscritti.find((m: any) => m.id === 'e-1').segnatura;
    });
    expect(segnatura).toBe('Mia');
  });

  test('D18: merge annullato prima della migrazione all\'Hub → nessun Hub creato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');
    const creati = await page.evaluate(async () => {
      const w = window as any;
      let creati = 0;
      w.hubConfig = null;
      w.driveStatus = { ...(w.driveStatus || {}), isAuthenticated: true };
      w.getApiCloud = async () => ({ pull: async () => ({ database: { manoscritti: [], cartelle: [] }, driveModifiedTime: 5000 }) });
      w.sincronizzaEUnisciDati = async () => false;
      w.creaRepositoryHub = async () => { creati++; return true; };
      await w.migraVaultSuHub(true);
      return creati;
    });
    expect(creati).toBe(0);
  });

  test('D17: il merge da solo non tocca ultimoCaricamento', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');
    const dopo = await page.evaluate(async () => {
      const w = window as any;
      w.ultimoCaricamento = 1234;
      await w.sincronizzaEUnisciDati({ manoscritti: [], cartelle: [] });
      return w.ultimoCaricamento;
    });
    expect(dopo).toBe(1234);
  });

  test('O2: una revisione illeggibile non tocca né il disco né il cloud', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');
    await electronApp.evaluate(({ ipcMain }: any) => {
      ipcMain.removeHandler('drive-get-revision');
      ipcMain.handle('drive-get-revision', () => '<html>non JSON</html>');
    });

    const esito = await page.evaluate(async () => {
      const w = window as any;
      w.appData.manoscritti = [{ id: 'x-1', segnatura: 'Intatta', cartella: '', lastModified: 1000 }];
      w.hubConfig = null;
      let sync = 0;
      w.getApiCloud = async () => ({
        pull: async () => ({ database: { manoscritti: [{ id: 'x-1', segnatura: 'Intatta', cartella: '', lastModified: 1000 }], cartelle: [] }, driveModifiedTime: 5000 }),
        sync: async () => { sync++; return 6000; },
        syncAttachments: async () => {}
      });
      let errore = '';
      try { await w.ripristinaRevisioneCloud('file-1', 'rev-1'); } catch (e: any) { errore = e.message; }
      return { errore, sync, segnatura: w.appData.manoscritti[0].segnatura };
    });

    expect(esito.errore).not.toBe('');
    expect(esito.sync).toBe(0);
    expect(esito.segnatura).toBe('Intatta');
  });

  test('O3: incollare schede copiate conserva la base del merge', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');

    const esito = await page.evaluate(async () => {
      const w = window as any;
      const m = { id: 'p-1', segnatura: 'Da copiare', cartella: '', lastModified: 1000 };
      await w.Store.addManoscritto({ ...m });
      w.appData.baseObjects = { 'p-1': { ...m } };
      w.appData.baseHashes = { 'p-1': w.getRecordHash(m) };
      w.copiedRecordIds = ['p-1'];
      w.cutRecordIds = [];
      await w.incollaRecord('');
      return {
        schede: w.appData.manoscritti.length,
        base: !!(w.appData.baseObjects && w.appData.baseObjects['p-1']),
        hash: !!(w.appData.baseHashes && w.appData.baseHashes['p-1'])
      };
    });

    expect(esito).toEqual({ schede: 2, base: true, hash: true });
  });
});

