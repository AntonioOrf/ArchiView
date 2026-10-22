import { test, expect } from './fixtures';
import { stubDialog } from './fixtures';
import { createLocalWorkspace, getAppData, dismissOverlays } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

test.use({ seedWorkspace: 'Tipi' });

async function creaTipoConCampi(page) {
  await page.evaluate(() => (window as any).apriNewTypeModal());
  await expect(page.locator('#new-type-modal')).toBeVisible();
  await page.locator('#custom-type-name').fill('Codice tipizzato');

  for (const nome of ['carte', 'supporto', 'digitalizzato', 'permalink']) {
    await page.locator('#custom-type-extra-input').fill(nome);
    await page.evaluate(() => (window as any).aggiungiCampoCustom());
  }

  const configura = async (campo: string, tipo: string, extra: (p) => Promise<void> = async () => {}) => {
    await page.evaluate((c) => {
      const pill = document.querySelector(`.custom-field-item[data-val="${c}"]`);
      (pill!.querySelector('.pill-config') as HTMLButtonElement).click();
    }, campo);
    await expect(page.locator('#campo-editor')).toBeVisible();
    await page.locator('#campo-editor-tipo').selectOption(tipo);
    await extra(page);
    await page.evaluate(() => (window as any).confermaEditorCampo());
    await expect(page.locator('#campo-editor')).toBeHidden();
  };

  await configura('carte', 'number', async (p) => { await p.locator('#campo-editor-obbligatorio').check(); });
  await configura('supporto', 'enum', async (p) => { await p.locator('#campo-editor-opzioni').fill('pergamena\ncarta'); });
  await configura('digitalizzato', 'boolean');
  await configura('permalink', 'url');

  await page.evaluate(() => (window as any).confermaCreaTipo());
  await expect(page.locator('#new-type-modal')).toBeHidden();
}

test.describe('Campi tipizzati', () => {

  test('3.1.1 — il tipo dichiarato finisce in campiDef, non dentro campi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    const tipo = await page.evaluate(() => {
      // @ts-ignore
      const d = appData as any;
      return d.tipiDocumento.find((t: any) => t.nome === 'Codice tipizzato');
    });
    expect(tipo.campi).toEqual(['carte', 'supporto', 'digitalizzato', 'permalink']);
    expect(tipo.campi.every((c: any) => typeof c === 'string')).toBe(true);
    expect(tipo.campiDef.carte.tipo).toBe('number');
    expect(tipo.campiDef.carte.obbligatorio).toBe(true);
    expect(tipo.campiDef.supporto.opzioni).toEqual(['pergamena', 'carta']);
    expect(tipo.campiDef.digitalizzato.tipo).toBe('boolean');
    expect(tipo.campiDef.permalink.tipo).toBe('url');
  });

  test('3.1.2 — il form rende il controllo giusto per ogni tipo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-tipo-documento').selectOption({ label: 'Codice tipizzato' });
    await page.evaluate(() => (window as any).renderDynamicFields());

    await expect(page.locator('#dyn-carte')).toHaveAttribute('type', 'number');
    await expect(page.locator('#dyn-digitalizzato')).toHaveAttribute('type', 'checkbox');
    await expect(page.locator('#dyn-permalink')).toHaveAttribute('type', 'url');
    const opzioni = await page.locator('#dyn-supporto option').allTextContents();
    expect(opzioni.length).toBe(3);
    expect(opzioni.slice(1)).toEqual(['pergamena', 'carta']);
    await expect(page.locator('#form-dynamic-fields label', { hasText: 'carte' }).first()).toContainText('*');
  });

  test('3.1.3 — i valori si salvano nel loro tipo e tornano nel form', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-tipo-documento').selectOption({ label: 'Codice tipizzato' });
    await page.evaluate(() => (window as any).renderDynamicFields());
    await page.locator('#form-segnatura').fill('TIP-1');
    await page.locator('#dyn-carte').fill('12');
    await page.locator('#dyn-supporto').selectOption('pergamena');
    await page.locator('#dyn-digitalizzato').check();
    await page.locator('#dyn-permalink').fill('https://archivio.example/12');
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    const m = (await getAppData(page)).manoscritti[0];
    expect(m.carte).toBe(12);
    expect(typeof m.carte).toBe('number');
    expect(m.digitalizzato).toBe(true);
    expect(typeof m.digitalizzato).toBe('boolean');
    expect(m.supporto).toBe('pergamena');

    await page.evaluate((id) => (window as any).editItem(id), m.id);
    await expect(page.locator('#dyn-carte')).toHaveValue('12');
    await expect(page.locator('#dyn-digitalizzato')).toBeChecked();
    await expect(page.locator('#dyn-supporto')).toHaveValue('pergamena');
  });

  test('3.1.4 — obbligatorio blocca, unico avvisa e lascia salvare', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-tipo-documento').selectOption({ label: 'Codice tipizzato' });
    await page.evaluate(() => (window as any).renderDynamicFields());
    await page.locator('#form-segnatura').fill('OBB-1');
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));

    await expect(page.locator('#toast-container')).toContainText('obbligatorio');
    expect((await getAppData(page)).manoscritti.length).toBe(0);

    await page.locator('#dyn-carte').fill('7');
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
  });

  test('3.1.4b — WCAG 3.3.1/4.1.2: l errore sta sul campo, che ha un nome e lo annuncia', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    await page.evaluate(() => (window as any).switchTab('add'));
    await page.locator('#form-tipo-documento').selectOption({ label: 'Codice tipizzato' });
    await page.evaluate(() => (window as any).renderDynamicFields());
    const carte = page.locator('#dyn-carte');

    await expect(carte).toHaveAccessibleName(/^carte$/i);
    await expect(carte).toHaveAttribute('aria-required', 'true');

    await page.locator('#form-segnatura').fill('OBB-2');
    await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));

    await expect(carte).toBeFocused();
    await expect(carte).toHaveAttribute('aria-invalid', 'true');
    await expect(carte).toHaveAccessibleDescription(/obbligatorio/);
    await expect(page.locator('#dyn-carte-errore')).toBeVisible();
    await page.waitForTimeout(2800);
    await expect(page.locator('#dyn-carte-errore')).toBeVisible();

    await carte.fill('3');
    await expect(carte).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#dyn-carte-errore')).toHaveCount(0);
    expect(await carte.getAttribute('aria-describedby')).toBeNull();
  });

  test('3.1.5 — un valore ripetuto in un campo unico avvisa ma NON blocca', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');

    await page.evaluate(() => (window as any).apriNewTypeModal());
    await page.locator('#custom-type-name').fill('Con inventario');
    await page.locator('#custom-type-extra-input').fill('inventario');
    await page.evaluate(() => (window as any).aggiungiCampoCustom());
    await page.evaluate(() => {
      const pill = document.querySelector('.custom-field-item[data-val="inventario"]');
      (pill!.querySelector('.pill-config') as HTMLButtonElement).click();
    });
    await page.locator('#campo-editor-unico').check();
    await page.evaluate(() => (window as any).confermaEditorCampo());
    await page.evaluate(() => (window as any).confermaCreaTipo());

    const salva = async (segnatura: string, inventario: string) => {
      await page.evaluate(() => (window as any).switchTab('add'));
      await page.locator('#form-tipo-documento').selectOption({ label: 'Con inventario' });
      await page.evaluate(() => (window as any).renderDynamicFields());
      await page.locator('#form-segnatura').fill(segnatura);
      await page.locator('#dyn-inventario').fill(inventario);
      await page.evaluate(() => (document.getElementById('manoscritto-form') as HTMLFormElement)
        .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
    };

    await salva('U-1', 'ASP 1');
    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(1);
    await salva('U-2', 'asp 1');

    await expect.poll(async () => (await getAppData(page)).manoscritti.length, { timeout: 10_000 }).toBe(2);
    await expect(page.locator('#toast-container')).toContainText('U-1');
  });

  test('3.1.6 — i valori tipizzati arrivano leggibili nella lista e nel CSV', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);

    await page.evaluate(async () => {
      const w = window as any;
      // @ts-ignore
      const d = appData as any;
      const tipo = d.tipiDocumento.find((t: any) => t.nome === 'Codice tipizzato');
      d.manoscritti.push(w.Model.creaScheda({
        segnatura: 'CSV-1', tipoDocumento: tipo.id,
        carte: 12, supporto: 'pergamena', digitalizzato: false, permalink: 'https://archivio.example/1'
      }));
      await w.Store.commit();
      await w.flushSalvataggio();
    });

    await expect(page.locator('#card-' + (await getAppData(page)).manoscritti[0].id)).toContainText('No');

    const out = path.join(userDataDir, 'tipizzato.csv');
    await stubDialog(electronApp, { canceled: false, filePath: out });
    await page.evaluate(() => (window as any).esportaCartellaCsv('csv'));
    await expect.poll(() => fs.existsSync(out), { timeout: 10_000 }).toBe(true);
    const csv = fs.readFileSync(out, 'utf8');
    expect(csv).toContain('No');
    expect(csv).not.toContain('false');
    expect(csv).toContain('12');
    expect(csv).toContain('pergamena');
  });

  test('3.1.8 — il modello della tendina e quello installato hanno gli stessi campi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');

    for (const modello of ['imbreviature', 'atti', 'fiscali']) {
      await page.evaluate(() => (window as any).apriNewTypeModal());
      await page.locator('#new-type-select').selectOption(modello);
      await page.evaluate(() => (window as any).applicaModello());
      const dallaTendina = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.custom-field-item')).map((p: any) => p.dataset.val));
      await page.evaluate(() => (window as any).chiudiNewTypeModal());

      const installato = await page.evaluate((id) => {
        // @ts-ignore
        return (appData as any).tipiDocumento.find((t: any) => t.id === id).campi;
      }, modello);
      expect(dallaTendina, `modello ${modello}`).toEqual(installato);
    }

    const tipi = await page.evaluate(() => {
      const w = window as any;
      // @ts-ignore
      const t = (appData as any).tipiDocumento.find((x: any) => x.id === 'imbreviature');
      return {
        cronica: w.Model.definizioneCampo(t, 'dataCronica', w.CONFIG_CAMPI).tipo,
        topica: w.Model.definizioneCampo(t, 'dataTopica', w.CONFIG_CAMPI).tipo,
        attori: w.Model.definizioneCampo(t, 'attori_dinamici', w.CONFIG_CAMPI).tipo
      };
    });
    expect(tipi.cronica).toBe('date');
    expect(tipi.topica).toBe('text');
    expect(tipi.attori).toBe('dynamic_list');
  });

  test('3.1.7 — un tipo riaperto conserva le definizioni dei campi', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Tipi');
    await creaTipoConCampi(page);
    const id = await page.evaluate(() => {
      // @ts-ignore
      return (appData as any).tipiDocumento.find((t: any) => t.nome === 'Codice tipizzato').id;
    });

    await page.evaluate((id) => (window as any).modificaTipoDocumento(id), id);
    await expect(page.locator('#new-type-modal')).toBeVisible();
    await page.locator('#custom-type-name').fill('Codice tipizzato bis');
    await page.evaluate(() => (window as any).confermaCreaTipo());

    const tipo = await page.evaluate((id) => {
      // @ts-ignore
      return (appData as any).tipiDocumento.find((t: any) => t.id === id);
    }, id);
    expect(tipo.nome).toBe('Codice tipizzato bis');
    expect(tipo.campiDef.carte.tipo).toBe('number');
    expect(tipo.campiDef.supporto.opzioni).toEqual(['pergamena', 'carta']);
    expect(tipo.campiDef.digitalizzato.tipo).toBe('boolean');
  });
});
