import { type ElectronApplication, type Page, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Crea un archivio locale attraverso la welcome modal e attende il reload dell'app.
 * `basePath` deve puntare a una cartella temporanea isolata (es. dentro userDataDir).
 * Ritorna il percorso del workspace creato (basePath/name).
 */
export async function createLocalWorkspace(
  page: Page,
  basePath: string,
  name = 'TestArchive',
): Promise<string> {
  // La welcome modal deve essere visibile al primo avvio.
  await expect(page.locator('#welcome-modal')).toBeVisible();

  // Apri il form "Crea Nuova Cartella Locale".
  await page.locator('#welcome-buttons button', { hasText: 'Crea Nuova Cartella Locale' }).click();
  await expect(page.locator('#welcome-create-form')).toBeVisible();

  // Nome + percorso (input readonly → set via evaluate).
  await page.locator('#welcome-new-folder-name').fill(name);
  await page.locator('#welcome-new-folder-path').evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, basePath);

  // Conferma creazione. creaCartellaIniziale() gestisce l'assenza di `event`.
  await page.evaluate(() => (window as any).creaCartellaIniziale());

  // Il main process ricarica la finestra: attendi l'app pronta (header + niente welcome).
  await expect(page.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#welcome-modal')).toBeHidden();

  // Al primo avvio l'app mostra il changelog (versione mai vista) e talvolta un banner
  // di conferma: entrambi sono overlay che intercettano i click. Vanno chiusi.
  await dismissOverlays(page);

  return path.join(basePath, name);
}

/** Crea una cartella nell'archivio corrente tramite il folder modal. */
export async function createFolder(page: Page, folderName: string): Promise<void> {
  await page.evaluate(() => (window as any).aggiungiCartella());
  await expect(page.locator('#folder-modal')).toBeVisible();
  await page.locator('#folder-name-input').fill(folderName);
  await page.evaluate(() => (window as any).confermaAggiungiCartella());
  await expect(page.locator('#folder-modal')).toBeHidden();
}

/** Chiude changelog, banner di conferma e toast che potrebbero coprire elementi cliccabili. */
export async function dismissOverlays(page: Page): Promise<void> {
  // Il changelog è asincrono (dopo avviaApp): dagli il tempo di comparire, poi chiudilo.
  const changelog = page.locator('#changelog-modal');
  try {
    await changelog.waitFor({ state: 'visible', timeout: 3_000 });
  } catch { /* può non comparire: ok */ }

  await page.evaluate(() => {
    (window as any).chiudiChangelogModal?.();
    (window as any).chiudiInfoConfirm?.();
    (window as any).nascondiMessaggi?.();
  }).catch(() => { /* noop */ });

  await expect(changelog).toBeHidden();
  await expect(page.locator('#info-confirm-banner')).toBeHidden();
}

/**
 * Seed rapido di N schede: push diretto in appData.manoscritti + UN SOLO
 * Store.commit() (salva su disco e rende), molto più veloce di N submit form.
 * Ritorna gli id generati.
 */
export async function seedItems(
  page: Page,
  count: number,
  opts: { cartella?: string; tipoDocumento?: string; tagPrefix?: string } = {},
): Promise<string[]> {
  return page.evaluate(async ({ count, opts }) => {
    // @ts-ignore -- `appData` è una `let` globale (script classico), non window.appData.
    const data = appData;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      data.manoscritti.push({
        id,
        cartella: opts.cartella || 'Generale',
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

/** Crea una scheda tramite il form reale (pattern estratto da items.spec.ts). */
export async function createItemViaForm(page: Page, segnatura: string): Promise<void> {
  await page.locator('#btn-tab-add').click();
  await expect(page.locator('#manoscritto-form')).toBeVisible();
  await page.locator('#form-segnatura').fill(segnatura);
  await page.locator('#btn-submit-form').click();
  await expect(page.locator('main')).toContainText(segnatura, { timeout: 10_000 });
}

/** Crea una scheda con un allegato locale (pattern da attachments.spec.ts). Ritorna l'id creato. */
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
    // @ts-ignore -- `appData` è una `let` globale (script classico), non window.appData.
    const rec = appData.manoscritti.find((m: any) => m.segnatura === seg);
    return rec.id;
  }, segnatura);
}

/** Apre le impostazioni tramite la funzione globale (già usato in ui.spec.ts). */
export async function openSettings(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).apriImpostazioni());
  await expect(page.locator('#settings-modal')).toBeVisible();
}

export async function closeSettings(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).chiudiImpostazioni());
  await expect(page.locator('#settings-modal')).toBeHidden();
}

/** Cambia vista principale (list/add/trascrizione) tramite switchTab e attende il render. */
export async function openView(page: Page, tab: 'list' | 'add' | 'trascrizione'): Promise<void> {
  await page.evaluate((t) => (window as any).switchTab(t), tab);
  await expect(page.locator(`#view-${tab}`)).toBeVisible();
}

/** Apre un pannello della sidebar tramite switchSidebarTab. */
export async function openSidebarPanel(
  page: Page,
  panel: 'folders' | 'search' | 'tags' | 'source-control' | 'history',
): Promise<void> {
  await page.evaluate((p) => (window as any).switchSidebarTab(p), panel);
  await expect(page.locator(`#sidebar-${panel}`)).toBeVisible();
}

/** Legge la variabile globale `appData` del renderer (non è window.appData: vedi state.ts). */
export async function getAppData(page: Page): Promise<any> {
  // @ts-ignore -- `appData` è una `let` globale (script classico), non window.appData.
  return page.evaluate(() => appData);
}

/** Attende la comparsa di un toast, opzionalmente con un testo contenuto. */
export async function expectToast(page: Page, text?: string): Promise<void> {
  const toast = text
    ? page.locator('#toast-container', { hasText: text })
    : page.locator('#toast-container');
  await expect(toast).toBeVisible({ timeout: 8_000 });
}

/**
 * Costruisce due versioni divergenti (locale/esterna) di una card rispetto a un
 * baseHash noto e apre il merge conflict modal, catturando la callback di
 * risoluzione su window.__e2eResolved per poterla ispezionare dai test.
 */
export async function injectConflict(page: Page, campo = 'segnatura'): Promise<void> {
  await page.evaluate((campoConflitto) => {
    const w = window as any;
    const base = { id: 'conflict-1', segnatura: 'Base', cartella: 'Generale', tipoDocumento: 'manoscritto' };
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
