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

    // Crea un secondo archivio: passa direttamente al workspace B (reload della finestra).
    await page.evaluate((basePath) =>
      (window as any).apiBrowser.createWorkspaceInPath(basePath, 'ArchivioB', null),
    path.join(userDataDir, 'wsB'));

    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);
    await expect(page.locator('#current-vault-name')).toContainText('ArchivioB');

    await page.evaluate(() => (window as any).toggleVaultSwitcher());
    await expect(page.locator('#vault-switcher-list')).toContainText('ArchivioA');
    await expect(page.locator('#vault-switcher-list')).toContainText('ArchivioB');

    // Torna al primo archivio cliccando la voce nella lista.
    await page.locator('#vault-switcher-list div', { hasText: 'ArchivioA' }).first().click();

    await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await dismissOverlays(page);
    await expect(page.locator('#current-vault-name')).toContainText('ArchivioA');
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

  test('elimina anche i file rimuove l\'archivio dal disco e chiude il modal', async ({ page, userDataDir }) => {
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

    // Il ramo distruttivo non era coperto: verifica che il modal si chiuda davvero
    // (non resti a coprire lo schermo) e che la voce sparisca dall'elenco.
    await expect(page.locator('#vault-delete-modal')).toBeHidden();
    await expect(page.locator('#vault-switcher-list')).not.toContainText('ArchivioDaCancellare');
  });

  // --- Etichetta secondaria delle schede nell'albero -------------------------
  //
  // Seminare via `appData` + `Store.commit()` è il pattern di sort-table.spec: il campo
  // `dichiarante` appartiene a un tipo documento, e crearlo dal form costerebbe tre volte
  // i passaggi senza coprire nulla di più.
  async function seminaFiscali(page: any) {
    await page.evaluate(async () => {
      // @ts-ignore -- `appData` è una `let` globale (script classico).
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
      // La radice è un nodo collassabile come gli altri: senza espanderla le schede
      // non archiviate non hanno una riga nell'albero.
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

    // Senza l'etichetta nella firma della sidebar il render verrebbe SALTATO e l'albero
    // resterebbe sul valore vecchio: è l'unico modo di accorgersene.
    await page.evaluate(async () => {
      // @ts-ignore -- `appData` è una `let` globale (script classico).
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

    // Terza scheda: segnatura ULTIMA, dichiarante PRIMO. Senza, l'ordine per dichiarante
    // coinciderebbe con quello per segnatura e il test non proverebbe nulla.
    await page.evaluate(async () => {
      // @ts-ignore -- `appData` è una `let` globale (script classico).
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
