import { type ElectronApplication, type Page, expect } from '@playwright/test';
import * as path from 'path';
import { seededWorkspaces } from './fixtures';

export async function createLocalWorkspace(
  page: Page,
  basePath: string,
  name = 'TestArchive',
): Promise<string> {
  const seeded = seededWorkspaces.get(page);
  if (seeded !== undefined) {
    const richiesto = path.join(basePath, name);
    if (path.resolve(richiesto) !== path.resolve(seeded)) {
      throw new Error(`createLocalWorkspace: richiesto ${richiesto} ma la fixture ha seminato ${seeded}. ` +
        `Allinea test.use({ seedWorkspace }) al nome usato nello spec, o toglilo.`);
    }
    await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });
    await expect(page.locator('#welcome-modal')).toBeHidden();
    await dismissOverlays(page, { attendiChangelog: false });
    return seeded;
  }

  await expect(page.locator('#welcome-modal')).toBeVisible();

  await page.waitForFunction(
    () => typeof (window as any).t === 'function' && typeof (window as any).creaCartellaIniziale === 'function',
    null,
    { timeout: 15_000 },
  );

  await page.locator('#welcome-buttons button', { hasText: 'Crea Nuova Cartella Locale' }).click();
  await expect(page.locator('#welcome-create-form')).toBeVisible();

  await page.locator('#welcome-new-folder-name').fill(name);
  await page.locator('#welcome-new-folder-path').evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, basePath);

  await page.evaluate(() => { setTimeout(() => (window as any).creaCartellaIniziale(), 0); });

  await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#welcome-modal')).toBeHidden();

  await page.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 15_000 });

  await dismissOverlays(page);

  return path.join(basePath, name);
}

export async function createFolder(page: Page, folderName: string): Promise<void> {
  await page.evaluate(() => (window as any).aggiungiCartella());
  await expect(page.locator('#folder-modal')).toBeVisible();
  await page.locator('#folder-name-input').fill(folderName);
  await page.evaluate(() => (window as any).confermaAggiungiCartella());
  await expect(page.locator('#folder-modal')).toBeHidden();
}

export async function dismissOverlays(page: Page, { attendiChangelog = true } = {}): Promise<void> {
  const changelog = page.locator('#changelog-modal');
  if (attendiChangelog) {
    try {
      await changelog.waitFor({ state: 'visible', timeout: 3_000 });
    } catch {}
  }

  await page.evaluate(() => {
    (window as any).chiudiChangelogModal?.();
    (window as any).nascondiMessaggi?.();
  }).catch(() => {});

  await expect(changelog).toBeHidden();
}

export async function seedItems(
  page: Page,
  count: number,
  opts: { cartella?: string; tipoDocumento?: string; tagPrefix?: string } = {},
): Promise<string[]> {
  return page.evaluate(async ({ count, opts }) => {
    // @ts-ignore
    const data = appData;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      data.manoscritti.push({
        id,
        cartella: opts.cartella ?? '',
        tipoDocumento: opts.tipoDocumento || 'manoscritto',
        segnatura: `Seed-${String(i).padStart(3, '0')}`,
        tags: opts.tagPrefix ? `${opts.tagPrefix}-${i % 3}` : '',
        allegati: [],
        lastModified: Date.now(),
        creatoDa: 'Anonimo',
        modificatoDa: 'Anonimo',
      });
    }
    await (window as any).Store.commit();
    return ids;
  }, { count, opts });
}

export async function createItemViaForm(page: Page, segnatura: string): Promise<void> {
  await page.locator('#btn-tab-add').click();
  await expect(page.locator('#manoscritto-form')).toBeVisible();
  await page.locator('#form-segnatura').fill(segnatura);
  await page.locator('#btn-submit-form').click();
  await expect(page.locator('main')).toContainText(segnatura, { timeout: 10_000 });
}

export async function createItemWithAttachment(
  page: Page,
  segnatura: string,
  fixturePath: string,
): Promise<string> {
  await page.locator('#btn-tab-add').click();
  await expect(page.locator('#manoscritto-form')).toBeVisible();
  await page.locator('#form-segnatura').fill(segnatura);
  await page.locator('#form-allegato').setInputFiles(fixturePath);
  await expect(page.locator('#form-allegati-new-preview')).toContainText(path.basename(fixturePath));
  await page.locator('#btn-submit-form').click();
  await expect(page.locator('main')).toContainText(segnatura, { timeout: 10_000 });

  return page.evaluate((seg) => {
    // @ts-ignore
    const rec = appData.manoscritti.find((m: any) => m.segnatura === seg);
    return rec.id;
  }, segnatura);
}

export async function openSettings(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).apriImpostazioni());
  await expect(page.locator('#settings-modal')).toBeVisible();
}

export async function closeSettings(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).chiudiImpostazioni());
  await expect(page.locator('#settings-modal')).toBeHidden();
}

export async function openView(page: Page, tab: 'list' | 'add' | 'trascrizione'): Promise<void> {
  await page.evaluate((t) => (window as any).switchTab(t), tab);
  await expect(page.locator(`#view-${tab}`)).toBeVisible();
}

export async function openSidebarPanel(
  page: Page,
  panel: 'folders' | 'search' | 'tags' | 'source-control' | 'history',
): Promise<void> {
  await page.evaluate((p) => (window as any).switchSidebarTab(p), panel);
  await expect(page.locator(`#sidebar-${panel}`)).toBeVisible();
}

export async function getAppData(page: Page): Promise<any> {
  // @ts-ignore
  return page.evaluate(() => appData);
}

export async function expectToast(page: Page, text?: string): Promise<void> {
  const toast = text
    ? page.locator('#toast-container', { hasText: text })
    : page.locator('#toast-container');
  await expect(toast).toBeVisible({ timeout: 8_000 });
}

export async function injectConflict(page: Page, campo = 'segnatura'): Promise<void> {
  await page.evaluate((campoConflitto) => {
    const w = window as any;
    const base = { id: 'conflict-1', segnatura: 'Base', cartella: '', tipoDocumento: 'manoscritto' };
    const baseHash = w.getRecordHash(base);
    const local = { ...base, [campoConflitto]: 'Valore Locale' };
    const external = { ...base, [campoConflitto]: 'Valore Cloud' };

    const conflitti = w.rilevaConflitti([local], [external], 0, { [base.id]: baseHash });
    w.__e2eResolved = undefined;
    w.apriMergeConflictModal(conflitti, (resolved: any) => {
      w.__e2eResolved = resolved;
    });
  }, campo);
  await expect(page.locator('#merge-conflict-modal')).toBeVisible();
}
