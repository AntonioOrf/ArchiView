import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type DialogResult = { canceled?: boolean; filePaths?: string[]; filePath?: string };

type ArchiViewFixtures = {
  /** userData temporanea, isolata per ogni test. */
  userDataDir: string;
  /** Istanza Electron già avviata sull'app buildata. */
  electronApp: ElectronApplication;
  /** Prima (unica) finestra del renderer. */
  page: Page;
};

const repoRoot = path.resolve(__dirname, '..');

/**
 * Avvia l'app Electron con una userData temporanea e la env var di isolamento.
 * Riutilizzabile per i test di riavvio (stessa userDataDir → il workspace persiste).
 */
export async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
  // ELECTRON_RUN_AS_NODE, se ereditato dall'ambiente, fa girare Electron come Node puro
  // (require('electron') → stringa, `app` undefined): l'app non parte. Va rimosso.
  const cleanEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue;
    cleanEnv[k] = v;
  }

  const app = await electron.launch({
    args: ['.'],
    cwd: repoRoot,
    env: {
      ...cleanEnv,
      ARCHIVIEW_E2E_USER_DATA: userDataDir,
      // Deterministico: nessun download di browser Playwright serve per Electron.
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

/**
 * Chiude l'app con fallback a kill del processo, per non appendere il teardown.
 * Idempotente: se l'app è già stata chiusa a mano nel test (es. per un riavvio),
 * il teardown automatico della fixture la richiama e non deve esplodere.
 */
export async function closeApp(app: ElectronApplication): Promise<void> {
  let proc: ReturnType<ElectronApplication['process']> | null = null;
  try {
    proc = app.process();
  } catch {
    return; // già chiusa: niente da fare
  }
  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('close timeout')), 8_000)),
    ]);
  } catch {
    try { proc?.kill(); } catch { /* già morto */ }
  }
}

/**
 * Stub dei dialog nativi (non pilotabili da Playwright) nel main process.
 * `showOpenDialog`/`showSaveDialog`/`showMessageBox*` ritornano il risultato fornito.
 */
export async function stubDialog(app: ElectronApplication, result: DialogResult): Promise<void> {
  await app.evaluate(({ dialog }, res) => {
    dialog.showOpenDialog = async () => res as any;
    dialog.showSaveDialog = async () => res as any;
    dialog.showMessageBox = async () => ({ response: 0 } as any);
    dialog.showMessageBoxSync = () => 0;
  }, result);
}

export const test = base.extend<ArchiViewFixtures>({
  userDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-e2e-'));
    await use(dir);
    // Teardown: rimuovi la userData temporanea (best-effort).
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch { /* i lock di Chromium possono ritardare la rimozione: ignora */ }
  },

  electronApp: async ({ userDataDir }, use) => {
    const { app } = await launchApp(userDataDir);
    await use(app);
    await closeApp(app);
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await use(page);
  },
});

export { expect } from '@playwright/test';
