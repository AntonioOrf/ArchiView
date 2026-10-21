import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';

const TOKEN = process.env.ARCHIVIEW_DRIVE_REFRESH_TOKEN || '';
const PREFISSO = 'CI-Drive-';
const VECCHIA_MS = 60 * 60 * 1000;

test.skip(!TOKEN, 'serve ARCHIVIEW_DRIVE_REFRESH_TOKEN (account Google di prova)');

async function collegaDrive(electronApp: ElectronApplication) {
  await electronApp.evaluate(({ app }, token) => {
    const { createRequire } = (process as any).mainModule.require('module');
    const auth = createRequire(app.getAppPath() + '/out/main/main.js')('./ipc/drive/auth');
    auth.writeTokenFile(auth.getGlobalTokenPath(), {
      refresh_token: token,
      scope: 'https://www.googleapis.com/auth/drive.file',
      token_type: 'Bearer',
    });
  }, TOKEN);
}

async function pulisciDrive(electronApp: ElectronApplication, nome: string) {
  return electronApp.evaluate(async ({ app }, { prefisso, nome, primaDi }) => {
    const { createRequire } = (process as any).mainModule.require('module');
    const auth = createRequire(app.getAppPath() + '/out/main/main.js')('./ipc/drive/auth');
    if (!auth.loadSavedTokens()) return [];
    const r = await auth.driveState.drive.files.list({
      q: `name contains '${prefisso}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, createdTime)',
    });
    const tolte: string[] = [];
    for (const f of r.data.files || []) {
      if (f.name !== `${nome}_ArchiView` && Date.parse(f.createdTime) > primaDi) continue;
      await auth.driveState.drive.files.delete({ fileId: f.id });
      tolte.push(f.name);
    }
    return tolte;
  }, { prefisso: PREFISSO, nome, primaDi: Date.now() - VECCHIA_MS });
}

async function aggiungiScheda(page: Page, segnatura: string) {
  await page.evaluate(async (segnatura) => {
    const w = window as any;
    w.appData.manoscritti.push({
      id: crypto.randomUUID(), segnatura, cartella: '', tipoDocumento: 'manoscritto',
      tags: '', allegati: [], trascrizione: '', lastModified: Date.now(),
    });
    await w.Store.commit();
  }, segnatura);
}

const drive = (page: Page, metodo: string, ...args: unknown[]) =>
  page.evaluate(([metodo, args]) => (window as any).apiDrive[metodo as string](...(args as unknown[])), [metodo, args] as const);

test.describe('Google Drive reale', () => {
  test.describe.configure({ timeout: 120_000 });

  let nome = '';
  test.beforeEach(async ({ page, electronApp, userDataDir }, info) => {
    nome = `${PREFISSO}${Date.now()}-${info.workerIndex}`;
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), nome);
    await collegaDrive(electronApp);
    expect(await drive(page, 'checkAuth')).toBe(true);
  });

  test.afterEach(async ({ electronApp }) => {
    try {
      await pulisciDrive(electronApp, nome);
    } catch (e) {
      console.warn(`[drive-reale] pulizia di ${nome} non riuscita, la toglie il giro successivo:`, e);
    }
  });

  test('invio, elenco archivi, ricezione, ora di modifica e storico versioni', async ({ page }) => {
    await aggiungiScheda(page, 'DRIVE-1');
    const t1 = await drive(page, 'sync', null) as number;
    expect(t1).toBeGreaterThan(0);

    const archivi = await drive(page, 'listVaults') as any[];
    const cartella = archivi.find((a) => a.name === `${nome}_ArchiView`);
    expect(cartella, 'cartella dell\'archivio su Drive').toBeTruthy();

    const ricevuto = await drive(page, 'pull', cartella.id) as any;
    expect(ricevuto.database.manoscritti.map((m: any) => m.segnatura)).toContain('DRIVE-1');
    expect(ricevuto.driveModifiedTime).toBeGreaterThan(0);

    expect(await drive(page, 'checkUpdates', cartella.id)).toBe(ricevuto.driveModifiedTime);

    await aggiungiScheda(page, 'DRIVE-2');
    await drive(page, 'sync', ricevuto.driveModifiedTime);
    const dopo = await drive(page, 'pull', cartella.id) as any;
    expect(dopo.database.manoscritti.map((m: any) => m.segnatura).sort()).toEqual(['DRIVE-1', 'DRIVE-2']);

    const fileId = await drive(page, 'getDbFileId');
    expect(fileId).toBeTruthy();
    await expect.poll(async () => ((await drive(page, 'listRevisions', fileId)) as any[]).length, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);
  });

  test('un invio basato su una versione più vecchia di quella su Drive viene rifiutato con 409', async ({ page }) => {
    await aggiungiScheda(page, 'BASE');
    const t1 = await drive(page, 'sync', null) as number;

    await aggiungiScheda(page, 'IN RITARDO');
    const errore = await page.evaluate((t) => (window as any).apiDrive.sync(t - 60_000).then(() => '', (e: any) => String(e?.message || e)), t1);
    expect(errore).toContain('409_CONFLICT');
  });
});
