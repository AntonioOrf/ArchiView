import { test, expect } from './fixtures';
import {
  createLocalWorkspace,
  createItemViaForm,
  createFolder,
  openSidebarPanel,
  getAppData,
  dismissOverlays,
} from './helpers';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Pannelli sidebar', () => {
  test('switchSidebarTab commuta tra i 5 pannelli', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Panels');

    for (const panel of ['search', 'tags', 'source-control', 'history', 'folders'] as const) {
      await openSidebarPanel(page, panel);
      for (const other of ['folders', 'search', 'tags', 'source-control', 'history']) {
        if (other !== panel) await expect(page.locator(`#sidebar-${other}`)).toBeHidden();
      }
    }
  });

  test('source control mostra una modifica pendente e apre il diff modal', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Panels');
    await createItemViaForm(page, 'MS-SRC-001');

    await openSidebarPanel(page, 'source-control');
    await expect(page.locator('#source-control-count')).not.toContainText('0');
    await expect(page.locator('#source-control-list')).toContainText('MS-SRC-001');

    await page.locator('#source-control-list li').first().click();
    await expect(page.locator('#diff-modal')).toBeVisible();
  });

  test('apriDiffModal mostra le differenze tra due versioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Panels');

    await page.evaluate(() => {
      (window as any).apriDiffModal(
        { segnatura: 'Vecchia' },
        { segnatura: 'Nuova' },
        'Test Diff',
      );
    });
    await expect(page.locator('#diff-modal')).toBeVisible();
    await expect(page.locator('#diff-modal')).toContainText('Test Diff');
  });

  test('history: senza cloud collegato mostra il messaggio di archivio non connesso', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Panels');

    await openSidebarPanel(page, 'history');
    await expect(page.locator('#history-list')).toBeVisible();
    await expect(page.locator('#history-list')).not.toContainText('undefined');
  });

  test('il footer mostra il nome dell\'archivio corrente', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'PanelsVault');
    await expect(page.locator('#current-vault-name')).toContainText('PanelsVault');
  });

  test('toggleVaultSwitcher apre il popover con l\'archivio corrente evidenziato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'PanelsVault2');

    await page.evaluate(() => (window as any).toggleVaultSwitcher());
    await expect(page.locator('#vault-switcher-popover')).toBeVisible();
    await expect(page.locator('#vault-switcher-list')).toContainText('PanelsVault2');
  });

  test('cambio tra due archivi tramite il vault switcher', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'wsA'), 'ArchivioA');

    await page.evaluate((basePath) =>
      (window as any).apiBrowser.createWorkspaceInPath(basePath, 'ArchivioB', null),
    path.join(userDataDir, 'wsB'));

    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);
    await expect(page.locator('#current-vault-name')).toContainText('ArchivioB');

    await page.evaluate(() => (window as any).toggleVaultSwitcher());
    await expect(page.locator('#vault-switcher-list')).toContainText('ArchivioA');
    await expect(page.locator('#vault-switcher-list')).toContainText('ArchivioB');

    await page.locator('#vault-switcher-list div', { hasText: 'ArchivioA' }).first().click();

    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);
    await expect(page.locator('#current-vault-name')).toContainText('ArchivioA');
  });

  test('un archivio recente spostato su disco si ritrova con "Cerca cartella"', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'wsA'), 'ArchivioSpostato');
    await page.evaluate((basePath) =>
      (window as any).apiBrowser.createWorkspaceInPath(basePath, 'ArchivioB4', null),
    path.join(userDataDir, 'wsB4'));
    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);

    fs.renameSync(path.join(userDataDir, 'wsA'), path.join(userDataDir, 'wsA-spostata'));
    const nuovo = path.join(userDataDir, 'wsA-spostata', 'ArchivioSpostato');

    await page.evaluate(() => (window as any).toggleVaultSwitcher());
    await page.locator('#vault-switcher-list div', { hasText: 'ArchivioSpostato' }).first().click();

    const modale = page.locator('#vault-missing-modal');
    await expect(modale).toBeVisible();
    await expect(modale).toContainText(path.join(userDataDir, 'wsA', 'ArchivioSpostato'));
    await expect(page.locator('#current-vault-name')).toContainText('ArchivioB4');

    const { stubDialog } = await import('./fixtures');
    const cerca = modale.getByRole('button', { name: /cerca cartella|locate folder/i });
    await stubDialog(electronApp, { canceled: false, filePaths: [userDataDir] });
    await cerca.click();
    await expect(modale.getByRole('alert')).toContainText(/non contiene un archivio|not an ArchiView archive/i);

    await stubDialog(electronApp, { canceled: false, filePaths: [nuovo] });
    await cerca.click();

    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);
    await expect(page.locator('#current-vault-name')).toContainText('ArchivioSpostato');
    const recenti = (await page.evaluate(() => (window as any).apiSettings.get())).recentWorkspaces;
    expect(recenti[0]).toBe(nuovo);
    expect(recenti).not.toContain(path.join(userDataDir, 'wsA', 'ArchivioSpostato'));
  });

  test('rimuovi un archivio dalla lista senza eliminarne i file', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'wsA'), 'ArchivioRimuovi');
    await page.evaluate((basePath) =>
      (window as any).apiBrowser.createWorkspaceInPath(basePath, 'ArchivioB2', null),
    path.join(userDataDir, 'wsB2'));
    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);

    await page.evaluate(() => (window as any).toggleVaultSwitcher());
    const rowRimuovi = page.locator('#vault-switcher-list div', { hasText: 'ArchivioRimuovi' }).first();
    await rowRimuovi.locator('button').click();

    await expect(page.locator('#vault-delete-modal')).toBeVisible();
    await page.locator('#btn-remove-list').click();
    await expect(page.locator('#vault-delete-modal')).toBeHidden();

    expect(fs.existsSync(path.join(userDataDir, 'wsA', 'ArchivioRimuovi'))).toBe(true);
  });

  test('elimina anche i file rimuove l\'archivio dal disco e chiude il modal', async ({ page, electronApp, userDataDir }) => {
    const { stubDialog } = await import('./fixtures');
    await stubDialog(electronApp, { canceled: true });
    await createLocalWorkspace(page, path.join(userDataDir, 'wsA'), 'ArchivioDaCancellare');
    await page.evaluate((basePath) =>
      (window as any).apiBrowser.createWorkspaceInPath(basePath, 'ArchivioB3', null),
    path.join(userDataDir, 'wsB3'));
    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);

    const percorso = path.join(userDataDir, 'wsA', 'ArchivioDaCancellare');
    expect(fs.existsSync(percorso)).toBe(true);

    await page.evaluate(() => (window as any).toggleVaultSwitcher());
    const row = page.locator('#vault-switcher-list div', { hasText: 'ArchivioDaCancellare' }).first();
    await row.locator('button').click();

    await expect(page.locator('#vault-delete-modal')).toBeVisible();
    await page.locator('#btn-delete-files').click();

    await expect(page.locator('#vault-delete-modal')).toBeHidden();
    await expect(page.locator('#vault-switcher-list')).not.toContainText('ArchivioDaCancellare');
    await expect.poll(() => fs.existsSync(percorso)).toBe(false);
  });

  async function seminaFiscali(page: any) {
    await page.evaluate(async () => {
      // @ts-ignore
      const data = appData;
      data.tipiDocumento.push({ id: 'fiscali-test', nome: 'Fiscali test', campi: ['dichiarante'] });
      for (const [seg, dich] of [['165, 579', 'Antonio di Salvestro'], ['165, 623', 'Biagio Cecco']]) {
        data.manoscritti.push({
          id: 'rec-' + seg.replace(/\D/g, ''), cartella: '', tipoDocumento: 'fiscali-test',
          segnatura: seg, dichiarante: dich, tags: '', allegati: [],
          lastModified: Date.now(), creatoDa: 'Anonimo', modificatoDa: 'Anonimo',
        });
      }
      await (window as any).Store.commit();
      (window as any).cartelleEspanse.add('');
      (window as any).renderSidebar();
    });
  }

  test('albero: di default mostra solo la segnatura', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Albero');
    await seminaFiscali(page);

    await expect(page.locator('#folder-list')).toContainText('165, 579');
    await expect(page.locator('#folder-list .sidebar-file-sub')).toHaveCount(0);
  });

  test('albero: scelto il campo, la riga mostra il dichiarante', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Albero');
    await seminaFiscali(page);

    await page.locator('#btn-albero-secondario').click();
    await page.locator('#custom-context-menu button', { hasText: /^Dichiarante$/ }).click();

    await expect(page.locator('#folder-list .sidebar-file-sub').first()).toHaveText('Antonio di Salvestro');
    await expect(page.locator('#folder-list')).toContainText('Biagio Cecco');
  });

  test('albero: cambiare il dichiarante aggiorna la riga (firma della cache)', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Albero');
    await seminaFiscali(page);
    await page.evaluate(() => (window as any).impostaAlberoSecondario('campo', 'dichiarante'));
    await expect(page.locator('#folder-list')).toContainText('Antonio di Salvestro');

    await page.evaluate(async () => {
      // @ts-ignore
      const m = appData.manoscritti.find((r: any) => r.segnatura === '165, 579');
      m.dichiarante = 'Giovanni Rinieri';
      m.lastModified = Date.now() + 1;
      await (window as any).Store.commit();
    });

    await expect(page.locator('#folder-list')).toContainText('Giovanni Rinieri');
    await expect(page.locator('#folder-list')).not.toContainText('Antonio di Salvestro');
  });

  test('albero: si ordina per etichetta secondaria e la preferenza finisce in appState', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Albero');
    await seminaFiscali(page);

    await page.evaluate(async () => {
      // @ts-ignore
      appData.manoscritti.push({
        id: 'rec-700', cartella: '', tipoDocumento: 'fiscali-test',
        segnatura: '165, 700', dichiarante: 'Alberto Neri', tags: '', allegati: [],
        lastModified: Date.now(), creatoDa: 'Anonimo', modificatoDa: 'Anonimo',
      });
      await (window as any).Store.commit();
    });

    await page.evaluate(async () => {
      (window as any).impostaAlberoSecondario('campo', 'dichiarante');
      (window as any).impostaOrdineAlbero('secondario');
      await (window as any).salvaStatoPosizione();
    });

    const sub = page.locator('#folder-list .sidebar-file-sub');
    await expect(sub.first()).toHaveText('Alberto Neri');
    await expect(sub.nth(1)).toHaveText('Antonio di Salvestro');
    await expect(sub.nth(2)).toHaveText('Biagio Cecco');

    const salvata = await page.evaluate(async () => {
      const s = await (window as any).apiSettings.get();
      return s.appState && s.appState.alberoSecondario;
    });
    expect(salvata).toMatchObject({ modo: 'campo', campo: 'dichiarante', ordina: 'secondario' });
  });
});
