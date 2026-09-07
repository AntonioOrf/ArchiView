import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, getAppData } from './helpers';
import * as path from 'path';

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'sample.pdf');

/** Nome su disco del primo allegato di una scheda (serve per costruire l'URL local-asset). */
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
  // La barra compare solo se il visualizzatore si è attivato davvero.
  await expect(page.locator('#modal-img-viewport .iv-barra')).toBeVisible();
}

const trasformazione = (page: any, sel: string) =>
  page.locator(sel).evaluate((el: HTMLElement) => el.style.transform);

test.describe('Visualizzatore immagini (Fase 1.2)', () => {
  test('il modal immagine monta il visualizzatore con la sua barra', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    await createItemWithAttachment(page, 'MS-IV-001', FIXTURE_PNG);
    await apriImmagineNelModal(page, 'MS-IV-001');

    // Stato iniziale: nessuna trasformazione, 100% dei pixel disponibili.
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
    // 1.2 / 1.2 torna esattamente a 1 solo in virgola mobile "fortunata": basta che
    // l'immagine sia tornata sotto la soglia di trascinamento.
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

    await page.locator('#modal-img-viewport [data-iv="contrasto"]').fill('180');
    await page.locator('#modal-img-viewport [data-iv="inverti"]').check();
    const filtro = await page.locator('#modal-img').evaluate((el: HTMLElement) => el.style.filter);
    expect(filtro).toContain('contrast(180%)');
    expect(filtro).toContain('invert(1)');

    // Il ripristino chiude il pannello e riporta i filtri a neutro: una carta lasciata in
    // negativo che riapre in negativo è il difetto classico di questi visualizzatori.
    await page.locator('#modal-img-viewport [data-iv="reset"]').click();
    await expect(pannello).toBeHidden();
    const dopo = await page.locator('#modal-img').evaluate((el: HTMLElement) => el.style.filter);
    expect(dopo).toContain('contrast(100%)');
    expect(dopo).toContain('invert(0)');
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
    expect(t).toContain('rotate(90deg)'); // "adatta" non raddrizza la carta
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

    // Passando a un allegato PDF il viewport immagine sparisce (e con esso la barra):
    // la scheda-esca di questo test è proprio il secondo allegato, di tipo diverso.
    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#trascrizione-thumbnails .allegato-btn')).toHaveCount(2);
    await page.locator('#btn-next-allegato').click();
    await expect(page.locator('#trasc-pdf-preview')).toBeVisible();
    await expect(page.locator('#trasc-img-viewport')).toBeHidden();

    // Tornando all'immagine, la rotazione precedente NON deve essere sopravvissuta.
    await page.locator('#btn-prev-allegato').click();
    await expect(page.locator('#trasc-img-viewport')).toBeVisible();
    expect(await trasformazione(page, '#trasc-img-preview')).toContain('rotate(0deg)');
  });

  test('la tastiera del visualizzatore non ruba i tasti all\'editor di trascrizione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Viewer');
    const id = await createItemWithAttachment(page, 'MS-IV-EDITOR', FIXTURE_PNG);

    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-img-viewport')).toBeVisible();

    // "r0+1-" contiene tutte le scorciatoie del visualizzatore: nell'editor devono restare
    // testo. È il motivo per cui l'handler è sul viewport e non sul document.
    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('r0+1-');
    await expect(page.locator('#trascrizione-editor')).toContainText('r0+1-');
    expect(await trasformazione(page, '#trasc-img-preview')).toContain('scale(1)');
  });
});

