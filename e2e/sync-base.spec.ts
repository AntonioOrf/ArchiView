import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

// PIANO-OTTIMIZZAZIONE, Fase 1: la base del merge a tre vie non deve mai cambiare insieme
// alle schede vive, e un ripristino Drive segue le regole di `ripristinaDatabase`.
test.use({ seedWorkspace: 'SyncBase' });

test.describe('Base del merge e ripristini', () => {
  test('O1: la trascrizione di una carta scritta dopo una sync sopravvive alla sync successiva', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'SyncBase');

    const testo = await page.evaluate(async () => {
      const w = window as any;
      const scheda = (trascrizione: string) => ({ id: 'b-1', segnatura: 'A', cartella: '', lastModified: 1000,
        allegati: [{ nome: 'b-1_c1.jpg', tipo: 'image', trascrizione }] });
      // Un collega ha trascritto la carta: gli allegati del fuso arrivano dal remoto.
      const remoto = () => scheda('del collega');
      w.appData.manoscritti = [scheda('vecchia')];
      w.appData.baseObjects = { 'b-1': scheda('vecchia') };
      w.appData.baseHashes = { 'b-1': w.getRecordHash(scheda('vecchia')) };

      await w.sincronizzaEUnisciDati({ manoscritti: [remoto()], cartelle: [] });
      // Come l'editor della trascrizione: scrive sul record vivo.
      const m = w.appData.manoscritti.find((x: any) => x.id === 'b-1');
      w.scriviTrascrizioneAllegato(m, 0, 'nuova', 0);

      await w.sincronizzaEUnisciDati({ manoscritti: [remoto()], cartelle: [] });
      return w.appData.manoscritti.find((x: any) => x.id === 'b-1').allegati[0].trascrizione;
    });

    expect(testo).toBe('nuova');
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
