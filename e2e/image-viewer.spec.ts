import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, getAppData } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Viewer' });

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'sample.pdf');

async function nomeAllegato(page: any, segnatura: string): Promise<string> {
  const appData = await getAppData(page);
  const rec = appData.manoscritti.find((m: any) => m.segnatura === segnatura);
  return rec.allegati[0].nome;
}

async function apriImmagineNelModal(page: any, segnatura: string) {
  const nome = await nomeAllegato(page, segnatura);
  await page.evaluate((n: string) => {
    (window as any).apriModal('local-asset://' + encodeURIComponent(n), 'img');
  }, nome);
  await expect(page.locator('#image-modal')).toBeVisible();
  await expect(page.locator('#modal-img-viewport')).toBeVisible();
  await expect(page.locator('#modal-img-viewport .iv-barra')).toBeVisible();
}

const trasformazione = (page: any, sel: string) =>
  page.locator(sel).evaluate((el: HTMLElement) => el.style.transform);

test.describe('Visualizzatore immagini (Fase 1.2)', () => {
  test('il modal immagine monta il visualizzatore con la sua barra', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    await createItemWithAttachment(page, 'MS-IV-001', FIXTURE_PNG);
    await apriImmagineNelModal(page, 'MS-IV-001');

    expect(await trasformazione(page, '#modal-img')).toContain('scale(1)');
    await expect(page.locator('#modal-img-viewport [data-iv="percento"]')).not.toBeEmpty();
  });

  test('zoom avanti e indietro modificano la scala', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    await createItemWithAttachment(page, 'MS-IV-ZOOM', FIXTURE_PNG);
    await apriImmagineNelModal(page, 'MS-IV-ZOOM');

    await page.locator('#modal-img-viewport [data-iv="zoom-in"]').click();
    expect(await trasformazione(page, '#modal-img')).toContain('scale(1.2)');

    await page.locator('#modal-img-viewport [data-iv="zoom-out"]').click();
    const scala = await page.locator('#modal-img').evaluate((el: HTMLElement) => {
      const m = el.style.transform.match(/scale\(([\d.]+)\)/);
      return m ? Number(m[1]) : NaN;
    });
    expect(scala).toBeLessThan(1.01);
    expect(scala).toBeGreaterThan(0.99);
  });

  test('la rotazione ruota di 90° e il ripristino azzera tutto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    await createItemWithAttachment(page, 'MS-IV-ROT', FIXTURE_PNG);
    await apriImmagineNelModal(page, 'MS-IV-ROT');

    await page.locator('#modal-img-viewport [data-iv="rot-cw"]').click();
    expect(await trasformazione(page, '#modal-img')).toContain('rotate(90deg)');

    await page.locator('#modal-img-viewport [data-iv="rot-cw"]').click();
    expect(await trasformazione(page, '#modal-img')).toContain('rotate(180deg)');

    await page.locator('#modal-img-viewport [data-iv="rot-ccw"]').click();
    expect(await trasformazione(page, '#modal-img')).toContain('rotate(90deg)');

    await page.locator('#modal-img-viewport [data-iv="reset"]').click();
    const t = await trasformazione(page, '#modal-img');
    expect(t).toContain('rotate(0deg)');
    expect(t).toContain('scale(1)');
  });

  test('i filtri paleografici agiscono sul filtro CSS dell\'immagine', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    await createItemWithAttachment(page, 'MS-IV-FILTRI', FIXTURE_PNG);
    await apriImmagineNelModal(page, 'MS-IV-FILTRI');

    const pannello = page.locator('#modal-img-viewport [data-iv="pannello-filtri"]');
    await expect(pannello).toBeHidden();
    await page.locator('#modal-img-viewport [data-iv="filtri"]').click();
    await expect(pannello).toBeVisible();

    await page.locator('#modal-img-viewport [data-iv="contrasto"]').fill('60');
    await expect(page.locator('#modal-img-viewport [data-iv="val-contrasto"]')).toHaveText('60');
    await page.locator('#modal-img-viewport [data-iv="luminosita"]').fill('-40');
    await page.locator('#modal-img-viewport [data-iv="inverti"]').check();
    const filtro = await page.locator('#modal-img').evaluate((el: HTMLElement) => el.style.filter);
    expect(filtro).toContain('contrast(190%)');
    expect(filtro).toContain('brightness(80%)');
    expect(filtro).toContain('invert(1)');

    await page.locator('#modal-img-viewport [data-iv="zoom-in"]').click();
    await page.locator('#modal-img-viewport [data-iv="reset-filtri"]').click();
    await expect(pannello).toBeVisible();
    await expect(page.locator('#modal-img-viewport [data-iv="val-contrasto"]')).toHaveText('0');
    const azzerato = await page.locator('#modal-img').evaluate((el: HTMLElement) => ({ filter: el.style.filter, transform: el.style.transform }));
    expect(azzerato.filter).toContain('contrast(100%)');
    expect(azzerato.filter).toContain('invert(0)');
    expect(azzerato.transform).toContain('scale(1.2)');
    await page.locator('#modal-img-viewport [data-iv="contrasto"]').fill('60');

    await page.locator('#modal-img-viewport [data-iv="reset"]').click();
    await expect(pannello).toBeHidden();
    const dopo = await page.locator('#modal-img').evaluate((el: HTMLElement) => el.style.filter);
    expect(dopo).toContain('contrast(100%)');
    expect(dopo).toContain('invert(0)');
  });

  test('P4 — le elaborazioni passano dal worker, tengono lo zoom e il ripristino torna all originale', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    await createItemWithAttachment(page, 'MS-IV-P4', FIXTURE_PNG);
    await apriImmagineNelModal(page, 'MS-IV-P4');
    const img = page.locator('#modal-img');
    const originale = await img.getAttribute('src');

    await page.locator('#modal-img-viewport [data-iv="zoom-in"]').click();
    await page.locator('#modal-img-viewport [data-iv="filtri"]').click();
    await page.locator('#modal-img-viewport [data-iv="elaborazione"]').selectOption('dstretch');
    await expect(img).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('#modal-img-viewport')).not.toHaveAttribute('aria-busy', 'true');
    expect(await trasformazione(page, '#modal-img')).toContain('scale(1.2)');
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    const primo = await img.getAttribute('src');
    await page.locator('#modal-img-viewport [data-iv="elaborazione"]').selectOption('soglia');
    await expect(page.locator('#modal-img-viewport [data-iv="riga-soglia"]')).toBeVisible();
    await expect(img).not.toHaveAttribute('src', primo!);

    await page.locator('#modal-img-viewport [data-iv="elaborazione"]').selectOption('');
    await expect(img).toHaveAttribute('src', originale!);
    expect(await trasformazione(page, '#modal-img')).toContain('scale(1.2)');

    await page.locator('#modal-img-viewport [data-iv="elaborazione"]').selectOption('r');
    await expect(img).toHaveAttribute('src', /^blob:/);
    await page.locator('#modal-img-viewport [data-iv="reset"]').click();
    await expect(img).toHaveAttribute('src', originale!);
    await expect(page.locator('#modal-img-viewport [data-iv="elaborazione"]')).toHaveValue('');
  });

  test('lo stato non sopravvive alla chiusura del modal', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    await createItemWithAttachment(page, 'MS-IV-RESET', FIXTURE_PNG);
    await apriImmagineNelModal(page, 'MS-IV-RESET');

    await page.locator('#modal-img-viewport [data-iv="zoom-in"]').click();
    await page.locator('#modal-img-viewport [data-iv="rot-cw"]').click();
    expect(await trasformazione(page, '#modal-img')).toContain('rotate(90deg)');

    await page.evaluate(() => (window as any).chiudiModal());
    await expect(page.locator('#image-modal')).toBeHidden();

    await apriImmagineNelModal(page, 'MS-IV-RESET');
    const t = await trasformazione(page, '#modal-img');
    expect(t).toContain('scale(1)');
    expect(t).toContain('rotate(0deg)');
  });

  test('la tastiera zooma e ruota quando il viewport ha il fuoco', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    await createItemWithAttachment(page, 'MS-IV-TASTI', FIXTURE_PNG);
    await apriImmagineNelModal(page, 'MS-IV-TASTI');

    await page.locator('#modal-img-viewport').focus();
    await page.keyboard.press('+');
    expect(await trasformazione(page, '#modal-img')).toContain('scale(1.2)');

    await page.keyboard.press('r');
    expect(await trasformazione(page, '#modal-img')).toContain('rotate(90deg)');

    await page.keyboard.press('0');
    const t = await trasformazione(page, '#modal-img');
    expect(t).toContain('rotate(90deg)');
    expect(t).not.toContain('scale(1.2)');
  });

  test('il PDF resta sull\'iframe nativo, senza viewport immagine', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    await createItemWithAttachment(page, 'MS-IV-PDF', FIXTURE_PDF);
    const nome = await nomeAllegato(page, 'MS-IV-PDF');

    await page.evaluate((n: string) => {
      (window as any).apriModal('local-asset://' + encodeURIComponent(n), 'pdf');
    }, nome);

    await expect(page.locator('#image-modal')).toBeVisible();
    await expect(page.locator('#modal-pdf')).toBeVisible();
    await expect(page.locator('#modal-img-viewport')).toBeHidden();
  });

  test('il pannello della trascrizione usa lo STESSO visualizzatore', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    const id = await createItemWithAttachment(page, 'MS-IV-TRASC', FIXTURE_PNG);

    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-img-viewport')).toBeVisible();
    await expect(page.locator('#trasc-img-viewport .iv-barra')).toBeVisible();

    await page.locator('#trasc-img-viewport [data-iv="rot-cw"]').click();
    expect(await trasformazione(page, '#trasc-img-preview')).toContain('rotate(90deg)');

    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#trasc-carte-totale')).toHaveText('/ 2');
    await page.locator('#btn-next-allegato').click();
    await expect(page.locator('#trasc-pdf-bar')).toBeVisible();
    await expect(page.locator('#trasc-img-preview')).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('#trasc-img-viewport .iv-barra')).toBeVisible();
    await expect.poll(() => trasformazione(page, '#trasc-img-preview')).toContain('rotate(0deg)');

    await page.locator('#btn-prev-allegato').click();
    await expect(page.locator('#trasc-img-viewport')).toBeVisible();
    expect(await trasformazione(page, '#trasc-img-preview')).toContain('rotate(0deg)');
  });

  test('la tastiera del visualizzatore non ruba i tasti all\'editor di trascrizione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    const id = await createItemWithAttachment(page, 'MS-IV-EDITOR', FIXTURE_PNG);

    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-img-viewport')).toBeVisible();

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('r0+1-');
    await expect(page.locator('#trascrizione-editor')).toContainText('r0+1-');
    expect(await trasformazione(page, '#trasc-img-preview')).toContain('scale(1)');
  });

  test('una pagina PDF si trascina col sinistro, anche poco o per nulla ingrandita', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    const id = await createItemWithAttachment(page, 'MS-IV-PAN', path.join(__dirname, 'fixtures', 'multipage.pdf'));
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-img-preview')).toHaveAttribute('src', /^blob:/);

    const traslazione = async () => {
      const t = await trasformazione(page, '#trasc-img-preview');
      const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(t);
      return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: NaN, y: NaN };
    };
    const trascina = async (dx: number, dy: number) => {
      const box = (await page.locator('#trasc-img-viewport').boundingBox())!;
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
      await page.mouse.up();
    };

    await trascina(120, 80);
    expect(await traslazione()).toEqual({ x: 120, y: 80 });

    await page.locator('#trasc-img-viewport [data-iv="fit"]').click();
    await page.locator('#trasc-img-viewport [data-iv="zoom-in"]').click();
    await trascina(-150, 0);
    expect((await traslazione()).x).toBeLessThanOrEqual(-149);

    await trascina(-5000, -5000);
    const img = (await page.locator('#trasc-img-preview').boundingBox())!;
    const vp = (await page.locator('#trasc-img-viewport').boundingBox())!;
    expect(img.x + img.width - vp.x).toBeGreaterThan(Math.min(img.width, vp.width) * 0.24);
    expect(img.y + img.height - vp.y).toBeGreaterThan(Math.min(img.height, vp.height) * 0.24);
  });
});

