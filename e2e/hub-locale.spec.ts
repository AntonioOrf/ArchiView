import { test, expect, launchApp, closeApp } from './fixtures';
import { createLocalWorkspace } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Prove M3 di PIANO-PROVE-MANUALI.md contro il Worker VERO in locale (`wrangler dev`, D1 locale):
// due istanze dell'app, A proprietario e B membro, sullo stesso repository. Senza Google: gli
// allegati Hub (link Drive) e le notifiche Pusher restano fuori.
//
//   cd cloudflare-hub && npm run migrate:local
//   npx wrangler d1 execute archiview-hub --local --command "DELETE FROM rate_counters"   (quota 20 repo/giorno per IP)
//   npx wrangler dev --local --port 8787 --ip 127.0.0.1 --var CREATE_SECRET:dev-secret
//   ARCHIVIEW_HUB_LOCALE=http://127.0.0.1:8787 npx playwright test --project=manuali hub-locale
//
// Il Worker limita a 5 creazioni di repository al minuto per IP: un repository per test.

const HUB = process.env.ARCHIVIEW_HUB_LOCALE || '';
const SEGRETO = process.env.ARCHIVIEW_HUB_SECRET || 'dev-secret';

test.skip(!HUB, 'serve ARCHIVIEW_HUB_LOCALE (wrangler dev)');
test.use({ seedWorkspace: 'HubA' });

const appVersion: string = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

type Repo = { repoId: string; ownerKey: string; memberId: string; memberKey: string; encKey: string };

async function creaRepo(): Promise<Repo> {
  const r = await fetch(`${HUB}/api/repos`, {
    method: 'POST', headers: { 'X-Create-Secret': SEGRETO, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'prove-manuali' }),
  });
  expect(r.status, 'creazione repository (rate-limit 5/min?)').toBe(201);
  const { repoId, ownerKey } = await r.json() as any;
  const m = await fetch(`${HUB}/api/repos/${repoId}/members`, {
    method: 'POST', headers: { Authorization: `Bearer ${ownerKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'Collega B' }),
  });
  const { memberId, memberKey } = await m.json() as any;
  return { repoId, ownerKey, memberId, memberKey, encKey: crypto.randomBytes(32).toString('base64url') };
}

/** Collega l'archivio aperto al repository e carica la config nel renderer (come all'avvio). */
async function collega(page: Page, ws: string, repo: Repo, chiave: string) {
  fs.writeFileSync(path.join(ws, '.archiview-hub.json'), JSON.stringify({
    hubUrl: HUB, repoId: repo.repoId, repoKey: chiave, encKey: repo.encKey, version: 0, attachmentsMode: 'off',
  }));
  await page.evaluate(async () => { const w = window as any; w.hubConfig = await w.apiBrowser.loadHubConfig(); });
}

/** Seconda istanza (B) con il suo archivio, già pronta. */
async function apriB(): Promise<{ app: ElectronApplication; page: Page; dir: string; ws: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-e2e-b-'));
  const ws = path.join(dir, 'ws', 'HubB');
  fs.mkdirSync(ws, { recursive: true });
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ workspacePath: ws, recentWorkspaces: [ws], lastSeenVersion: appVersion }));
  const { app, page } = await launchApp(dir);
  await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 20_000 });
  return { app, page, dir, ws };
}

const w = (page: Page, f: string, ...args: unknown[]) =>
  page.evaluate(([f, args]) => (window as any)[f as string](...(args as unknown[])), [f, args] as const);
const scheda = (page: Page, id: string, campi: Record<string, string>) => page.evaluate(async ([id, campi]) => {
  const w = window as any;
  const m = w.appData.manoscritti.find((x: any) => x.id === id);
  if (m) Object.assign(m, campi, { lastModified: Date.now() });
  else w.appData.manoscritti.push({ id, cartella: '', tipoDocumento: 'manoscritto', allegati: [], lastModified: Date.now(), ...campi });
  await w.Store.commit();
}, [id, campi] as const);
const segnature = (page: Page) => page.evaluate(() => (window as any).appData.manoscritti.map((m: any) => m.segnatura).sort());
const campo = (page: Page, id: string, k: string) => page.evaluate(([id, k]) => (window as any).appData.manoscritti.find((m: any) => m.id === id)?.[k], [id, k]);
const versione = (page: Page) => page.evaluate(() => (window as any).hubConfig.version);
const toast = (page: Page, testo: string) => expect(page.locator('#toast-container', { hasText: testo })).toBeVisible({ timeout: 10_000 });

test.describe('Hub locale, due istanze', () => {
  let B: Awaited<ReturnType<typeof apriB>> | null = null;
  test.afterEach(async () => {
    if (!B) return;
    await closeApp(B.app);
    try { fs.rmSync(B.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* lock */ }
    B = null;
  });

  test('M3.8/M3.10/M3.9 — scheda e vocabolario del collega, invii quasi insieme, conflitto annullato', async ({ page, userDataDir }) => {
    test.setTimeout(120_000);
    const repo = await creaRepo();
    const wsA = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'HubA');
    await collega(page, wsA, repo, repo.ownerKey);
    B = await apriB();
    await collega(B.page, B.ws, repo, repo.memberKey);

    // M3.8: A crea una scheda e un valore di vocabolario, invia; B riceve.
    await scheda(page, 'a1', { segnatura: 'HUB-A1', titolo: 'Base' });
    await page.evaluate(async () => {
      const w = window as any;
      w.appData.vocabolari = { ...(w.appData.vocabolari || {}), 'voc-hub': { id: 'voc-hub', nome: 'Materiali', valori: ['pergamena'], modificato: Date.now() } };
      await w.Store.commit();
    });
    await w(page, 'inviaModificheHub');
    await toast(page, 'Modifiche inviate');
    await w(B.page, 'riceviModificheHub');
    await expect.poll(() => segnature(B!.page)).toEqual(['HUB-A1']);
    expect(await B.page.evaluate(() => (window as any).appData.vocabolari?.['voc-hub']?.valori)).toEqual(['pergamena']);
    // Poi B invia una sua scheda; A riceve e ha ancora la sua scheda e il valore.
    await scheda(B.page, 'b1', { segnatura: 'HUB-B1' });
    await w(B.page, 'inviaModificheHub');
    await toast(B.page, 'Modifiche inviate');
    await w(page, 'riceviModificheHub');
    await expect.poll(() => segnature(page)).toEqual(['HUB-A1', 'HUB-B1']);
    expect(await page.evaluate(() => (window as any).appData.vocabolari?.['voc-hub']?.valori)).toEqual(['pergamena']);

    // M3.10: A e B inviano quasi insieme da versioni uguali: uno passa, l'altro riceve il 409.
    expect(await versione(page)).toBe(await versione(B.page));
    await scheda(page, 'a1', { titolo: 'Da A' });
    await scheda(B.page, 'b1', { titolo: 'Da B' });
    // Prima del fix (12/10) chi perdeva era B, la ricezione apriva un conflitto falso su HUB-B1
    // (scheda sua, inviata e poi modificata, senza base): ora nessun modale.
    await Promise.all([w(page, 'inviaModificheHub'), w(B.page, 'inviaModificheHub')]);
    const vA = await versione(page), vB = await versione(B.page);
    expect(vA === vB, 'una sola delle due versioni avanza').toBe(false);
    const [vince, perde] = vA > vB ? [page, B.page] : [B.page, page];
    await toast(perde, 'Un collega ha appena salvato');
    await w(perde, 'riceviModificheHub');
    await expect(perde.locator('#merge-conflict-modal')).toBeHidden();
    await w(perde, 'inviaModificheHub');
    await toast(perde, 'Modifiche inviate');
    await w(vince, 'riceviModificheHub');
    for (const p of [page, B.page]) {
      // Nessun pull ha svuotato l'archivio: entrambe le modifiche ci sono, da entrambe le parti.
      expect(await segnature(p)).toEqual(['HUB-A1', 'HUB-B1']);
      expect(await campo(p, 'a1', 'titolo')).toBe('Da A');
      expect(await campo(p, 'b1', 'titolo')).toBe('Da B');
    }

    // M3.9: stesso campo modificato dai due; B riceve e annulla il modale dei conflitti.
    await scheda(page, 'a1', { titolo: 'Versione di A' });
    await w(page, 'inviaModificheHub');
    await toast(page, 'Modifiche inviate');
    const vServer = await versione(page);
    await scheda(B.page, 'a1', { titolo: 'Versione di B' });
    const vPrimaB = await versione(B.page);
    await B.page.evaluate(() => { (window as any).riceviModificheHub(); });
    await expect(B.page.locator('#merge-conflict-modal')).toBeVisible({ timeout: 10_000 });
    await w(B.page, 'annullaSincronizzazioneConflitto');
    await expect(B.page.locator('#merge-conflict-modal')).toBeHidden();
    expect(await campo(B.page, 'a1', 'titolo'), 'B resta con la sua').toBe('Versione di B');
    expect(await versione(B.page), 'annullato: versione locale invariata').toBe(vPrimaB);
    const sulServer = await page.evaluate(() => (window as any).apiBrowser.hubPull());
    expect(sulServer.data.version, 'nessun caricamento da B').toBe(vServer);
    expect(sulServer.data.database.manoscritti.find((m: any) => m.id === 'a1').titolo).toBe('Versione di A');
  });

  test('M6.6 — storico Hub: confronto e ripristino di una versione, poi il collega la riceve', async ({ page, userDataDir }) => {
    test.setTimeout(90_000);
    const repo = await creaRepo();
    const wsA = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'HubA');
    await collega(page, wsA, repo, repo.ownerKey);
    await scheda(page, 'a1', { segnatura: 'STORICO-1' });
    await w(page, 'inviaModificheHub');
    await toast(page, 'Modifiche inviate');
    const v1 = await versione(page);
    await scheda(page, 'a2', { segnatura: 'STORICO-2' });
    await w(page, 'inviaModificheHub');
    await expect.poll(() => versione(page)).toBeGreaterThan(v1);
    // Il collega ha già ricevuto la versione con entrambe le schede.
    B = await apriB();
    await collega(B.page, B.ws, repo, repo.memberKey);
    await w(B.page, 'riceviModificheHub');
    await expect.poll(() => segnature(B!.page)).toEqual(['STORICO-1', 'STORICO-2']);

    const elenco = await w(page, 'elencaVersioniHub') as any;
    expect(elenco.versions.map((v: any) => v.version)).toContain(v1);
    const snap = await w(page, 'caricaVersioneHub', v1) as any;
    expect(snap.database.manoscritti.map((m: any) => m.segnatura)).toEqual(['STORICO-1']);

    // Ripristino dal pannello: conferma, Esc annulla; poi il ripristino vero.
    await page.evaluate((v) => (window as any).apriConfermaRipristino('v' + v, () => (window as any).ripristinaVersioneHub(v)), v1);
    const conferma = page.locator('#history-restore-confirm');
    await expect(conferma).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(conferma).toHaveCount(0);
    expect(await segnature(page)).toEqual(['STORICO-1', 'STORICO-2']);
    expect(await w(page, 'ripristinaVersioneHub', v1)).toBe(true);
    expect(await segnature(page)).toEqual(['STORICO-1']);
    const dopo = await w(page, 'elencaVersioniHub') as any;
    expect(dopo.currentVersion).toBeGreaterThan(v1 + 1);

    // Il collega riceve il ripristino: la scheda nata dopo arriva come eliminata sul server
    // (tombstone) e, come ogni eliminazione remota, chiede conferma (M6.4).
    await B!.page.evaluate(() => { (window as any).__e2eFine = (window as any).riceviModificheHub(); });
    const eliminate = B!.page.locator('#deletion-conflict-modal');
    await expect(eliminate).toContainText('STORICO-2', { timeout: 10_000 });
    await B!.page.locator('button[data-deletion-id="a2"][data-deletion-action="delete"]').click();
    await B!.page.locator('#btn-resolve-deletions').click();
    await B!.page.evaluate(() => (window as any).__e2eFine);
    await expect.poll(() => segnature(B!.page)).toEqual(['STORICO-1']);
  });

  test('M3.5 — membro revocato: non riceve né invia', async ({ page, userDataDir }) => {
    const repo = await creaRepo();
    const wsA = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'HubA');
    await collega(page, wsA, repo, repo.ownerKey);
    await scheda(page, 'a1', { segnatura: 'REV-A1' });
    await w(page, 'inviaModificheHub');
    await toast(page, 'Modifiche inviate');
    B = await apriB();
    await collega(B.page, B.ws, repo, repo.memberKey);
    await w(B.page, 'riceviModificheHub');
    await expect.poll(() => segnature(B!.page)).toEqual(['REV-A1']);

    const r = await fetch(`${HUB}/api/repos/${repo.repoId}/members/${repo.memberId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${repo.ownerKey}` } });
    expect(r.status).toBe(200);
    await scheda(page, 'a2', { segnatura: 'REV-A2' });
    await w(page, 'inviaModificheHub');
    await toast(page, 'Modifiche inviate');

    const pull = await B.page.evaluate(() => (window as any).apiBrowser.hubPull());
    expect(pull.ok).toBe(false);
    // 403, non 401: l'app distingue "accesso revocato" da "chiave non valida".
    expect(pull.status).toBe(403);
    await w(B.page, 'riceviModificheHub');
    await toast(B.page, 'revocato');
    expect(await segnature(B.page)).toEqual(['REV-A1']);
    await scheda(B.page, 'b1', { segnatura: 'REV-B1' });
    const v = await versione(B.page);
    await w(B.page, 'inviaModificheHub');
    expect(await versione(B.page)).toBe(v);
    const server = await page.evaluate(() => (window as any).apiBrowser.hubPull());
    expect(server.data.database.manoscritti.map((m: any) => m.segnatura).sort()).toEqual(['REV-A1', 'REV-A2']);
  });
});
