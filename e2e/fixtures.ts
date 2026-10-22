import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type DialogResult = { canceled?: boolean; filePaths?: string[]; filePath?: string };

type ArchiViewOptions = {
  seedWorkspace: string | undefined;
  vistaIniziale: 'griglia' | 'tabella' | null;
};

type ArchiViewFixtures = {
  userDataDir: string;
  electronApp: ElectronApplication;
  page: Page;
};

const repoRoot = path.resolve(__dirname, '..');
const appVersion: string = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;

export const seededWorkspaces = new WeakMap<Page, string>();

export function seedWorkspaceOnDisk(userDataDir: string, name: string): string {
  const ws = path.join(userDataDir, 'ws', name);
  fs.mkdirSync(ws, { recursive: true });
  fs.writeFileSync(
    path.join(userDataDir, 'settings.json'),
    JSON.stringify({ workspacePath: ws, recentWorkspaces: [ws], lastSeenVersion: appVersion }, null, 2),
  );
  return ws;
}

export async function launchApp(userDataDir: string, argsExtra: string[] = []): Promise<{ app: ElectronApplication; page: Page }> {
  const cleanEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue;
    cleanEnv[k] = v;
  }

  const exe = process.env.ARCHIVIEW_E2E_EXE;
  const asar = process.env.ARCHIVIEW_E2E_ASAR;
  const app = await electron.launch({
    ...(exe ? { executablePath: path.resolve(repoRoot, exe), args: [...argsExtra] }
      : { args: [asar ? path.resolve(repoRoot, asar) : '.', ...argsExtra] }),
    cwd: repoRoot,
    env: {
      ...cleanEnv,
      ARCHIVIEW_E2E_USER_DATA: userDataDir,
      ...(process.env.ARCHIVIEW_E2E_VISIBLE || process.env.PWDEBUG ? {} : { ARCHIVIEW_E2E_BACKGROUND: '1' }),
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
    },
  });
  const page = await app.firstWindow();
  await page.waitForURL(/index\.html$/, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  let proc: ReturnType<ElectronApplication['process']> | null = null;
  try {
    proc = app.process();
  } catch {
    return;
  }
  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('close timeout')), 8_000)),
    ]);
  } catch {
    try { proc?.kill(); } catch {}
  }
}

export async function stubDialog(app: ElectronApplication, result: DialogResult): Promise<void> {
  await app.evaluate(({ dialog }, res) => {
    dialog.showOpenDialog = async () => res as any;
    dialog.showSaveDialog = async () => res as any;
    dialog.showMessageBox = async () => ({ response: 0 } as any);
    dialog.showMessageBoxSync = () => 0;
  }, result);
}

export const test = base.extend<ArchiViewFixtures & ArchiViewOptions>({
  seedWorkspace: [undefined, { option: true }],
  vistaIniziale: ['griglia', { option: true }],

  userDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-e2e-'));
    await use(dir);
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {}
  },

  electronApp: async ({ userDataDir, seedWorkspace }, use) => {
    if (seedWorkspace) seedWorkspaceOnDisk(userDataDir, seedWorkspace);
    const { app } = await launchApp(userDataDir);
    await use(app);
    await closeApp(app);
  },

  page: async ({ electronApp, userDataDir, seedWorkspace, vistaIniziale }, use) => {
    const page = await electronApp.firstWindow();
    if (vistaIniziale) {
      const imposta = (v: string) => { (window as any).vistaLista = (window as any).vistaLista || v; };
      await page.addInitScript(imposta, vistaIniziale);
      await page.evaluate((v) => {
        (window as any).vistaLista = v;
        if (typeof (window as any).renderMain === 'function' && document.getElementById('search-input')) (window as any).renderMain();
      }, vistaIniziale);
    }
    if (seedWorkspace) seededWorkspaces.set(page, path.join(userDataDir, 'ws', seedWorkspace));
    await use(page);
  },
});

export { expect } from '@playwright/test';
