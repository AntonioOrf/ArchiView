import { test, expect } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, getAppData } from './helpers';
import * as path from 'path';
import * as fs from 'fs';
import type { ElectronApplication, Page } from '@playwright/test';

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'sample.pdf');
const FIXTURE_PDF3 = path.join(__dirname, 'fixtures', 'multipage.pdf');

async function finestraLarga(electronApp: ElectronApplication, page: Page) {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const b = BrowserWindow.getAllWindows()[0]; b.unmaximize(); b.setSize(1280, 800);
  });
  await expect.poll(() => page.evaluate(() => innerWidth)).toBeGreaterThan(1100);
}

test.describe('Vista Trascrizione', () => {
  test.use({ seedWorkspace: 'Trasc' });

  test('apertura con allegato immagine mostra editor e anteprima', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-IMG', FIXTURE_PNG);

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await expect(page.locator('#trasc-img-preview')).toBeVisible();
    const src = await page.locator('#trasc-img-preview').getAttribute('src');
    expect(src).toBeTruthy();

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Nota di trascrizione');
    await expect(page.locator('#trascrizione-editor')).toContainText('Nota di trascrizione');
  });

  test('F10 — incollare da Word o dal web tiene solo la formattazione base, niente stili né immagini', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-INCOLLA', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await page.locator('#trascrizione-editor').click();
    await electronApp.evaluate(({ clipboard, ClipboardItem }: any) => clipboard.write([new ClipboardItem({
      'text/html': '<p style="color:red;font-family:Calibri" class="MsoNormal">Item <b>die</b> <span style="mso-x:1">predicto</span><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="></p><ul><li>uno</li></ul>',
      'text/plain': 'Item die predicto uno'
    })]));
    await page.keyboard.press('Control+V');
    const html = await page.locator('#trascrizione-editor').evaluate((el) => el.innerHTML);
    expect(html).toContain('<b>die</b>');
    expect(html).toContain('predicto');
    expect(html).toContain('<li>uno</li>');
    expect(html).not.toMatch(/style=|class=|<img|<span|data:/);
  });

  test('F10 — gli elenchi di Word diventano elenchi, senza pallini né spazi finti', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-ELENCHI', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await page.locator('#trascrizione-editor').click();
    const voce = (cls: string, segno: string, testo: string) =>
      `<p class=${cls} style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>${segno}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]><span style='font-family:"Calibri",sans-serif;color:red'>${testo}<o:p></o:p></span></p>\n\n`;
    await page.locator('#trascrizione-editor').evaluate((el, frammento) => {
      const dati = new DataTransfer();
      dati.setData('text/html', frammento);
      dati.setData('text/plain', 'primo secondo uno due');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dati, bubbles: true, cancelable: true }));
    }, '<!--StartFragment-->\n\n<h1>Prima<o:p></o:p></h1>\n\n' + voce('MsoListParagraphCxSpFirst', '·', 'primo') + voce('MsoListParagraphCxSpLast', '·', 'secondo')
      + '<p class=MsoNormal>Dopo</p>\n\n' + voce('MsoListParagraphCxSpFirst', '1.', 'uno') + voce('MsoListParagraphCxSpLast', '2.', 'due'));
    const html = await page.locator('#trascrizione-editor').evaluate((el) => el.innerHTML.replace(/\s+/g, ' '));
    expect(html).toMatch(/<ul>\s*<li>primo<\/li>\s*<li>secondo<\/li>\s*<\/ul>/);
    expect(html).toMatch(/<ol>\s*<li>uno<\/li>\s*<li>due<\/li>\s*<\/ol>/);
    expect(html).not.toMatch(/·|&nbsp;|<p>\s*<\/p>/);
    expect(await page.evaluate(() => (window as any).pulisciHtmlIncollato('<b>a</b> <i>b</i>'))).toBe('<b>a</b> <i>b</i>');
  });

  test('senza allegati l\'editor prende tutta la larghezza e invita ad aggiungere carte', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-TRASC-VUOTA');
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-TRASC-VUOTA');
    const id = (await getAppData(page)).manoscritti.find((m: any) => m.segnatura === 'MS-TRASC-VUOTA').id;

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await expect(page.locator('#trascrizione-allegato-panel')).toBeHidden();
    const [editor, vista] = await Promise.all([
      page.locator('#trascrizione-editor-panel').boundingBox(),
      page.locator('#view-trascrizione').boundingBox(),
    ]);
    expect(editor!.width).toBeGreaterThan(Math.min(vista!.width * 0.9, 900));
    await expect(page.locator('#trascrizione-resizer')).toBeHidden();
    await expect(page.locator('#trasc-vista')).toBeHidden();
    await expect(page.locator('#btn-confronta-carte')).toBeHidden();
    await expect(page.locator('#trasc-senza-fonte')).toBeVisible();
    await expect(page.locator('#btn-carica-allegato-trasc')).toBeVisible();
    await expect(page.locator('#btn-iiif-trasc')).toBeVisible();
  });

  test('senza allegati dopo una scheda con immagine non resta la maniglia a sinistra', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const conImg = await createItemWithAttachment(page, 'MS-TRASC-PRIMA', FIXTURE_PNG);
    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-TRASC-DOPO');
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-TRASC-DOPO');
    const senza = (await getAppData(page)).manoscritti.find((m: any) => m.segnatura === 'MS-TRASC-DOPO').id;

    await page.evaluate((r) => (window as any).apriTrascrizione(r), conImg);
    await page.locator('#trasc-vista button[data-vista="fonte"]').click();
    await page.locator('#btn-back-to-list-trasc').click();
    await page.evaluate((r) => (window as any).apriTrascrizione(r), senza);
    await expect(page.locator('#trascrizione-resizer')).toBeHidden();
    await expect(page.locator('#trascrizione-editor-panel')).toBeVisible();
    await expect(page.locator('#trasc-mostra-testo')).toBeHidden();
  });

  test('il selettore vista passa tra fonte, affiancate e testo', async ({ page, electronApp, userDataDir }) => {
    await finestraLarga(electronApp, page);
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-VISTA', FIXTURE_PNG);
    await page.evaluate((r) => (window as any).apriTrascrizione(r), id);
    const bottone = (v: string) => page.locator(`#trasc-vista button[data-vista="${v}"]`);
    const fonte = page.locator('#trascrizione-allegato-panel');
    const testo = page.locator('#trascrizione-editor-panel');

    await expect(page.locator('#trasc-senza-fonte')).toBeHidden();
    await expect(bottone('affiancate')).toHaveAttribute('aria-pressed', 'true');
    await expect(fonte).toBeVisible();
    await expect(testo).toBeVisible();
    await expect(page.locator('#trascrizione-resizer')).toBeVisible();

    await bottone('testo').click();
    await expect(bottone('testo')).toHaveAttribute('aria-pressed', 'true');
    await expect(fonte).toBeHidden();
    await expect(page.locator('#trascrizione-resizer')).toBeHidden();
    const [ed, cont] = await Promise.all([testo.boundingBox(), page.locator('#trascrizione-container').boundingBox()]);
    expect(ed!.width).toBeGreaterThan(cont!.width * 0.9);

    await bottone('fonte').click();
    await expect(fonte).toBeVisible();
    await expect(testo).toBeHidden();
    await page.locator('#trasc-mostra-testo').click();
    await expect(bottone('affiancate')).toHaveAttribute('aria-pressed', 'true');
    await expect(testo).toBeVisible();
  });

  test('P1 — caratteri speciali: col mouse e da tastiera entrano al cursore', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-MUFI', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    const editor = page.locator('#trascrizione-editor');
    const pannello = page.locator('#trasc-caratteri');
    await editor.click();
    await page.keyboard.type('ab');
    await page.keyboard.press('ArrowLeft');

    await page.locator('#btn-caratteri-speciali').click();
    await expect(page.locator('#btn-caratteri-speciali')).toHaveAttribute('aria-expanded', 'true');
    await pannello.getByRole('button', { name: /per$/ }).click();
    await expect(editor).toBeFocused();
    await page.keyboard.type('x');
    await expect(editor).toHaveText('aꝑxb');
    expect(await page.evaluate(() => (window as any).trascrizioneNonSalvata)).toBe(true);
    await expect(pannello.getByRole('group', { name: /recenti|recent/i }).getByRole('button')).toHaveCount(1);

    await page.keyboard.press('Alt+k');
    await expect(pannello.locator('.car-speciale').first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const scelto = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.c);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(pannello.locator(`[data-c="${scelto}"]:focus`)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(editor).toBeFocused();
    await expect(editor).toHaveText(`aꝑx${scelto}${scelto}b`);
  });

  test('fonte a sinistra, testo a destra con numeri di riga, segni Leiden e barra di stato', async ({ page, electronApp, userDataDir }) => {
    await finestraLarga(electronApp, page);
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-LEIDEN', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    const [fonte, testo] = await Promise.all([
      page.locator('#trascrizione-allegato-panel').boundingBox(),
      page.locator('#trascrizione-editor-panel').boundingBox(),
    ]);
    expect(fonte!.x + fonte!.width).toBeLessThanOrEqual(testo!.x);

    const editor = page.locator('#trascrizione-editor');
    const stato = page.locator('#trasc-stato-testo');
    await editor.click();
    await page.keyboard.type('alfa beta');
    await page.keyboard.press('Enter');
    await page.keyboard.type('gamma');
    await expect(stato).toHaveText(/^(riga 2 di 2 · 3 parole|line 2 of 2 · 3 words)$/);
    const numeri = await editor.locator('p').evaluateAll(ps => ps.map(p => getComputedStyle(p, '::before').content));
    expect(numeri).toEqual(['counter(riga)', 'counter(riga)']);

    await page.keyboard.press('Shift+Home');
    await page.getByRole('button', { name: /^\[(lacuna|gap)\]$/ }).click();
    await expect(editor).toBeFocused();
    await page.getByRole('button', { name: /^sic \(!\)$/ }).click();
    await page.keyboard.type(' d');
    await page.getByRole('button', { name: /^\((espansione|expansion)\)$/ }).click();
    await page.keyboard.type('omi');
    await page.keyboard.press('End');
    await page.getByRole('button', { name: /^\[(lacuna|gap)\]$/ }).click();
    await expect(editor.locator('p').nth(1)).toHaveText('[gamma] (!) d(omi)[...]');
    await expect(editor.locator('p').nth(0)).toHaveText('alfa beta');
    expect(await page.evaluate(() => (window as any).trascrizioneNonSalvata)).toBe(true);
  });

  test('O4 — aperta, la vista tiene il fuoco: l app coperta non si raggiunge col Tab', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-FOCUS', FIXTURE_PNG);
    await page.evaluate(() => document.getElementById('tutorial-banner')!.classList.remove('hidden-tab'));
    await page.evaluate((i) => (window as any).apriTrascrizione(i), id);
    const vista = page.locator('#view-trascrizione');
    await expect(vista).toBeVisible();

    const editor = page.locator('#trascrizione-editor');
    await expect(editor).toBeFocused();
    await expect(editor).toHaveAttribute('role', 'textbox');
    await expect(editor).toHaveAccessibleName(/trascrizione|transcription/i);

    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const fuori = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement;
        return document.getElementById('view-trascrizione')!.contains(a) || a === document.body ? null : a.outerHTML.slice(0, 80);
      });
      expect(fuori, `Tab #${i + 1} è uscito dalla vista`).toBeNull();
    }

    await page.evaluate(() => (window as any).chiudiTrascrizione());
    await expect(vista).toBeHidden();
    expect(await page.evaluate(() => (document.querySelector('body > header') as any).inert)).toBe(false);
    expect(await page.evaluate(() => (document.querySelector('main')!.parentElement as any).inert)).toBe(false);
  });

  test('apertura con allegato PDF mostra la pagina disegnata da pdf.js', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-PDF', FIXTURE_PDF);

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-pdf-bar')).toBeVisible();
    await expect(page.locator('#trasc-img-preview')).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('#trasc-pdf-totale')).toHaveText('/ 1');
  });

  test('barra delle carte: numero, nome sopra l immagine e navigazione tra due allegati', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-MULTI', FIXTURE_PNG);

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PDF);
    const barra = page.locator('#trasc-carte-bar');
    await expect(barra).toBeVisible();
    await expect(page.locator('#trasc-carte-totale')).toHaveText('/ 2');
    await expect(page.locator('#trasc-carta-numero')).toHaveValue('1');
    await expect(page.locator('#trasc-carta-nome')).toContainText('sample.png');

    await page.locator('#trasc-carta-numero').fill('2');
    await page.locator('#trasc-carta-numero').press('Enter');
    await expect(page.locator('#trasc-pdf-bar')).toBeVisible();
    await expect(page.locator('#trasc-carta-nome')).toContainText('sample.pdf');
    await expect(page.locator('#btn-carta-succ')).toBeDisabled();

    await page.locator('#btn-carta-prec').click();
    await expect(page.locator('#trasc-pdf-bar')).toBeHidden();
    await expect(page.locator('#trasc-carta-numero')).toHaveValue('1');

    await page.locator('#btn-rinomina-carta').click();
    await page.locator('#rename-input').fill('c. 1r');
    await page.locator('#rename-input').press('Enter');
    await expect(page.locator('#trasc-carta-nome')).toHaveText('c. 1r');
    expect((await getAppData(page)).manoscritti.find((x: any) => x.id === id).allegati[0].originalName).toBe('c. 1r');

    await expect(page.locator('#btn-next-allegato')).toBeVisible();
    await page.locator('#btn-next-allegato').click();
    await expect(page.locator('#trasc-pdf-bar')).toBeVisible();

    await page.locator('#btn-prev-allegato').click();
    await expect(page.locator('#trasc-pdf-bar')).toBeHidden();
    await expect(page.locator('#trasc-img-preview')).toBeVisible();
  });

  test('a finestra non massimizzata la barra resta su una riga e l editor ha spazio', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-STRETTA', FIXTURE_PNG);
    const finestra = (w: number) => electronApp.evaluate(({ BrowserWindow }, w) => {
      const b = BrowserWindow.getAllWindows()[0]; b.unmaximize(); b.setSize(w, 760);
    }, w);

    await finestra(1100);
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1100);
    await page.evaluate((r) => (window as any).apriTrascrizione(r), id);
    const barra = page.locator('#trascrizione-toolbar');
    await expect.poll(async () => (await barra.boundingBox())!.height).toBeLessThan(60);
    for (const sel of ['#btn-ocr-trasc', '#btn-iiif-trasc']) {
      await expect(page.locator(sel)).toHaveAccessibleName(/\S/);
    }

    await finestra(900);
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(900);
    const quota = () => page.evaluate(() => {
      const e = document.getElementById('trascrizione-editor-panel')!.getBoundingClientRect();
      const c = document.getElementById('trascrizione-container')!.getBoundingClientRect();
      return Math.min(e.width / c.width / 0.95, e.height / c.height / 0.4);
    });
    await expect.poll(quota).toBeGreaterThan(1);
    await expect(page.locator('#trascrizione-resizer')).toBeHidden();
  });

  test('la freccia dell allegato raggiunta col Tab è visibile anche senza mouse', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-TAB', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#trasc-carte-totale')).toHaveText('/ 2');
    await page.mouse.move(0, 0);

    let raggiunta = false;
    for (let i = 0; i < 60 && !raggiunta; i++) {
      await page.keyboard.press('Tab');
      raggiunta = await page.evaluate(() => document.activeElement?.id === 'btn-next-allegato');
    }
    expect(raggiunta).toBe(true);
    await expect(page.locator('#btn-next-allegato')).toHaveCSS('opacity', '1');
  });

  test('Alt+ArrowRight cambia allegato da tastiera', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-KEY', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PDF);
    await expect(page.locator('#trasc-carte-totale')).toHaveText('/ 2');

    await page.locator('#view-trascrizione').click();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.locator('#trasc-pdf-bar')).toBeVisible();

    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.locator('#trasc-pdf-bar')).toBeHidden();
    await expect(page.locator('#trasc-img-preview')).toBeVisible();
  });

  test('Ctrl+S salva la trascrizione', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-SAVE', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Testo da salvare');
    await page.keyboard.press('Control+s');

    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 8_000 });
    const appData = await getAppData(page);
    const rec = appData.manoscritti.find((m: any) => m.id === id);
    expect(rec.trascrizione).toContain('Testo da salvare');
  });

  test('Alt+F attiva/disattiva il fullscreen dell\'editor', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-FULL', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    const isHidden = () => page.locator('#trascrizione-editor-panel').isHidden();

    const dispatchAltF = () => page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', altKey: true, bubbles: true }));
    });

    await dispatchAltF();
    await expect.poll(isHidden).toBe(true);

    await dispatchAltF();
    await expect.poll(isHidden).toBe(false);
  });

  test('uscire con modifiche non salvate mostra il modal di conferma', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-TRASC-DIRTY', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Non salvato');

    await page.locator('#btn-back-to-list-trasc').click();
    await expect(page.locator('#unsaved-modal')).toBeVisible();

    await page.evaluate(() => (window as any).confermaUscitaTrascrizione());
    await expect(page.locator('#view-list')).toBeVisible();
  });

  async function creaConDueAllegati(page: any, segnatura: string): Promise<string> {
    await page.locator('#btn-tab-add').click();
    await expect(page.locator('#manoscritto-form')).toBeVisible();
    await page.locator('#form-segnatura').fill(segnatura);
    await page.locator('#form-allegato').setInputFiles([FIXTURE_PNG, FIXTURE_PDF]);
    await page.locator('#btn-submit-form').click();
    const idDi = () => page.evaluate((seg: string) => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.segnatura === seg)?.id ?? null;
    }, segnatura);
    await expect.poll(idDi, { timeout: 10_000 }).not.toBeNull();
    return idDi();
  }

  async function vaiAllaCarta(page: any, segnatura: string, indice: number) {
    await page.evaluate((args: any) => {
      // @ts-ignore
      const m = appData.manoscritti.find((x: any) => x.segnatura === args.seg);
      return (window as any).cambiaAllegatoTrascrizione(m.allegati[args.i].nome, m.allegati[args.i].tipo, args.i);
    }, { seg: segnatura, i: indice });
  }

  async function scriviNellEditor(page: any, testo: string) {
    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type(testo);
  }

  test('F5 — «Esci senza salvare» scarta anche il testo delle carte lasciate, pure dopo un altro salvataggio', async ({ page, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-SCARTA');
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();

    await scriviNellEditor(page, 'Bozza da buttare');
    await vaiAllaCarta(page, 'MS-SCARTA', 1);
    await page.locator('#btn-back-to-list-trasc').click();
    await expect(page.locator('#unsaved-modal')).toBeVisible();
    await page.locator('#unsaved-modal button', { hasText: /Esci senza salvare|Exit without saving/ }).click();
    await expect(page.locator('#view-list')).toBeVisible();

    await page.evaluate(async () => {
      const w = window as any;
      // @ts-ignore
      appData.manoscritti.push({ id: 'altra', segnatura: 'Altra', cartella: '', lastModified: 1 });
      await w.Store.commit();
      await w.flushSalvataggio();
    });
    const db = JSON.parse(fs.readFileSync(path.join(ws, 'database_manoscritti.json'), 'utf8'));
    const m = db.manoscritti.find((x: any) => x.id === id);
    expect(JSON.stringify(m)).not.toContain('Bozza da buttare');
  });

  test('cambiando carta l\'editor segue l\'allegato mostrato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-CARTE-1');
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();

    await scriviNellEditor(page, 'Testo della prima carta');

    await vaiAllaCarta(page, 'MS-CARTE-1', 1);
    await expect(page.locator('#trascrizione-editor')).not.toContainText('Testo della prima carta');

    await scriviNellEditor(page, 'Testo della seconda carta');

    await vaiAllaCarta(page, 'MS-CARTE-1', 0);
    await expect(page.locator('#trascrizione-editor')).toContainText('Testo della prima carta');
    await expect(page.locator('#trascrizione-editor')).not.toContainText('Testo della seconda carta');
  });

  test('P2 — stato della carta: si salva, la card mostra l avanzamento e il filtro trova la scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    await creaConDueAllegati(page, 'MS-STATO-ALTRA');
    const id = await creaConDueAllegati(page, 'MS-STATO');
    await expect(page.locator('main progress')).toHaveCount(0);

    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    const stato = page.locator('#trasc-carta-stato');
    await expect(stato).toHaveValue('');
    await stato.selectOption('trascritta');
    await vaiAllaCarta(page, 'MS-STATO', 1);
    await expect(stato).toHaveValue('');
    await stato.selectOption('daTrascrivere');
    await stato.selectOption('');
    await vaiAllaCarta(page, 'MS-STATO', 0);
    await expect(stato).toHaveValue('trascritta');

    const allegati = (await getAppData(page)).manoscritti.find((m: any) => m.segnatura === 'MS-STATO').allegati;
    expect(allegati[0].stato).toBe('trascritta');
    expect('stato' in allegati[1]).toBe(false);

    await page.evaluate(() => (window as any).chiudiTrascrizione());
    await expect(page.locator('main progress')).toHaveCount(1);
    await expect(page.locator('main progress')).toHaveAccessibleName(/1 di 2|1 of 2/);

    await page.locator('#btn-filtri').click();
    await page.locator('#filtro-stato-carte').selectOption('trascritta');
    await expect(page.locator('#view-list')).toContainText('MS-STATO');
    await expect(page.locator('#view-list')).not.toContainText('MS-STATO-ALTRA');
  });

  test('#42 — con una sola carta lo stato si imposta e il badge diventa Trascritta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-UNA-CARTA', FIXTURE_PNG);

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    const stato = page.locator('#trasc-carta-stato');
    await expect(stato).toBeVisible();
    await expect(page.locator('#btn-carta-prec')).toBeHidden();
    await expect(page.locator('#trasc-carta-numero')).toBeHidden();
    await stato.selectOption('trascritta');

    await page.evaluate(() => (window as any).chiudiTrascrizione());
    await page.locator('#btn-vista-tabella').click();
    await expect(page.locator('#manoscritti-table tbody .stato-trascr')).toHaveText(/Trascritta|Transcribed/);
  });

  test('P3 — "vita" trova "uita" nella carta 2 e il clic porta lì con la parola selezionata', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-PALEO');
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await scriviNellEditor(page, 'Incipit prologus');
    await vaiAllaCarta(page, 'MS-PALEO', 1);
    await scriviNellEditor(page, 'de ſancta uita beati');
    await page.evaluate(() => (window as any).salvaTrascrizione());
    await page.evaluate(() => (window as any).chiudiTrascrizione());

    await page.locator('header button[data-tab="search"]').click();
    await page.locator('#search-input').fill('Vita');
    const risultato = page.locator('#search-suggestions > div', { hasText: 'MS-PALEO' });
    await expect(risultato).toContainText(/c\. 2|sheet 2/);
    await expect(risultato.locator('span.bg-amber-200')).toHaveText('uita');

    await risultato.click();
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await expect(page.locator('#trasc-carta-numero')).toHaveValue('2');
    await expect(page.locator('#trascrizione-editor')).toBeFocused();
    await expect.poll(() => page.evaluate(() => String(window.getSelection()))).toBe('uita');
  });

  test('P6 — regione disegnata col mouse, mossa da tastiera, salvata e trovata dalla ricerca', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-REGIONI', path.join(__dirname, 'fixtures', 'carta.png'));
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    const viewport = page.locator('#trasc-img-viewport');
    const img = page.locator('#trasc-img-preview');
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(400);
    const regioni = () => page.evaluate(() => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.segnatura === 'MS-REGIONI').allegati[0].annotazioni;
    });

    await viewport.hover();
    await viewport.locator('[data-iv="regioni"]').click();
    await expect(viewport.locator('[data-iv="pannello-regioni"]')).toBeVisible();
    await viewport.locator('[data-iv="disegna"]').click();
    await expect(viewport.locator('[data-iv="disegna"]')).toHaveAttribute('aria-pressed', 'true');

    const b = (await img.boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5, { steps: 6 });
    await page.mouse.up();
    await expect(viewport.locator('.iv-regione')).toHaveCount(1);

    const nota = viewport.locator('.iv-regioni-voce input');
    await expect(nota).toBeFocused();
    await page.keyboard.type('Iniziale miniata');
    await viewport.locator('.iv-regione').focus();
    await expect.poll(async () => (await regioni())?.[0]?.testo).toBe('Iniziale miniata');
    const prima = (await regioni())[0].xywh;
    expect(prima[0]).toBeCloseTo(0.2, 1);
    expect(prima[2]).toBeCloseTo(0.4, 1);
    expect(prima[3]).toBeCloseTo(0.3, 1);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => (await regioni())[0].xywh[0]).toBeCloseTo(prima[0] + 0.01, 5);
    await expect.poll(async () => (await regioni())[0].xywh[3]).toBeCloseTo(prima[3] + 0.01, 5);
    expect(await page.evaluate(() => (document.getElementById('trasc-img-viewport') as any)._imageViewer.stato.tx)).toBe(0);

    await page.evaluate(() => (window as any).chiudiTrascrizione());
    await page.locator('header button[data-tab="search"]').click();
    await page.locator('#search-input').fill('miniata');
    const risultato = page.locator('#search-suggestions > div', { hasText: 'MS-REGIONI' });
    await expect(risultato).toContainText(/Regione, c\. 1|Region, f\. 1/);
    await risultato.click();
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await expect(viewport.locator('.iv-regione.iv-regione-scelta')).toBeFocused();

    await page.keyboard.press('Delete');
    await expect(viewport.locator('.iv-regione')).toHaveCount(0);
    await expect.poll(async () => (await regioni()) === undefined).toBe(true);
  });

  test('P5 — confronto: la carta aperta a sinistra, a destra una carta di un altra scheda, zoom sincronizzabile', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    await createItemWithAttachment(page, 'MS-CMP-B', FIXTURE_PNG);
    const id = await createItemWithAttachment(page, 'MS-CMP-A', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await page.locator('#btn-confronta-carte').click();
    const modal = page.locator('#confronto-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#confronto-etichetta-sx')).toContainText('MS-CMP-A');
    await expect(page.locator('#confronto-img-sx')).toHaveAttribute('src', /^local-asset:/);
    await expect(page.locator('#confronto-cerca-dx')).toBeFocused();

    await page.keyboard.type('cmp-b');
    await expect(page.locator('#confronto-risultati-dx button')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('#confronto-etichetta-dx')).toContainText('MS-CMP-B');
    await expect(page.locator('#confronto-viewport-dx .iv-barra')).toBeVisible();

    const scala = (lato: string) => page.locator(`#confronto-img-${lato}`).evaluate((el: HTMLElement) => el.style.transform);
    await page.locator('#confronto-sincronizza').check();
    await page.locator('#confronto-viewport-sx [data-iv="zoom-in"]').click();
    expect(await scala('dx')).toContain('scale(1.2)');
    await page.locator('#confronto-sincronizza').uncheck();
    await page.locator('#confronto-viewport-sx [data-iv="zoom-in"]').click();
    expect(await scala('sx')).toContain('scale(1.44)');
    expect(await scala('dx')).toContain('scale(1.2)');

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(page.locator('#view-trascrizione')).toBeVisible();
  });

  test('P5 — confronto: si sceglie la scheda e poi la carta; clic fuori chiude l elenco', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const secondaPng = test.info().outputPath('seconda.png');
    fs.mkdirSync(path.dirname(secondaPng), { recursive: true });
    fs.writeFileSync(secondaPng, Buffer.concat([fs.readFileSync(FIXTURE_PNG), Buffer.from('bis')]));
    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-CMP-DUE');
    await page.locator('#form-allegato').setInputFiles([FIXTURE_PNG, secondaPng]);
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toContainText('MS-CMP-DUE', { timeout: 10_000 });
    await page.evaluate(() => (window as any).apriConfrontoCarte());
    const risultati = page.locator('#confronto-risultati-dx');

    await page.locator('#confronto-cerca-dx').click();
    const scheda = risultati.locator('button', { hasText: 'MS-CMP-DUE' });
    await expect(scheda).toContainText(/2 carte|2 sheets/);
    await scheda.click();
    await expect(risultati.locator('button', { hasText: /^c\. \d/ })).toHaveCount(2);
    await risultati.locator('button', { hasText: /^c\. 2/ }).click();
    await expect(page.locator('#confronto-etichetta-dx')).toContainText('MS-CMP-DUE');
    await expect(risultati).toBeHidden();

    await page.locator('#confronto-cerca-sx').fill('zzzz-nulla');
    await expect(page.locator('#confronto-risultati-sx')).toBeVisible();
    await page.locator('#confronto-modal .modal-title').click();
    await expect(page.locator('#confronto-risultati-sx')).toBeHidden();
  });

  test('il salvataggio conserva il testo di TUTTE le carte, non solo di quella a schermo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-CARTE-2');
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);

    await scriviNellEditor(page, 'Carta uno');
    await vaiAllaCarta(page, 'MS-CARTE-2', 1);
    await scriviNellEditor(page, 'Carta due');
    await page.evaluate(() => (window as any).salvaTrascrizione());

    const dati = await getAppData(page);
    const rec = dati.manoscritti.find((m: any) => m.id === id);
    expect(rec.allegati[0].trascrizione).toContain('Carta uno');
    expect(rec.allegati[1].trascrizione).toContain('Carta due');
    expect(rec.trascrizione).toContain('Carta uno');
    expect(rec.trascrizione).toContain('Carta due');
  });

  test('la ricerca trova la scheda per il testo di qualunque carta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-CARTE-3');
    await createItemWithAttachment(page, 'ESCA-CARTE', FIXTURE_PNG);

    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await vaiAllaCarta(page, 'MS-CARTE-3', 1);
    await scriviNellEditor(page, 'Bartholomeus notarius');
    await page.evaluate(() => (window as any).salvaTrascrizione());

    const trovati = await page.evaluate(() => {
      const tokens = (window as any).tokenizzaRicerca('bartholomeus');
      // @ts-ignore
      return appData.manoscritti
        .filter((m: any) => (window as any).objectMatchesTokens(m, tokens))
        .map((m: any) => m.segnatura);
    });
    expect(trovati).toEqual(['MS-CARTE-3']);
  });

  test('una trascrizione dell\'archivio vecchio migra sulla prima carta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await creaConDueAllegati(page, 'MS-CARTE-4');

    await page.evaluate(async (recId: string) => {
      // @ts-ignore
      const m = appData.manoscritti.find((x: any) => x.id === recId);
      m.trascrizione = '<p>Lettura fatta prima dell aggiornamento</p>';
      for (const a of m.allegati) delete a.trascrizione;
      await (window as any).Store.commit();
    }, id);

    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trascrizione-editor')).toContainText('Lettura fatta prima');

    await page.evaluate(() => (window as any).salvaTrascrizione());
    const dati = await getAppData(page);
    const rec = dati.manoscritti.find((m: any) => m.id === id);
    expect(rec.allegati[0].trascrizione).toContain('Lettura fatta prima');
  });

  test('l\'etichetta dice quale carta si sta trascrivendo, e solo con più carte', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const due = await creaConDueAllegati(page, 'MS-CARTE-5');
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), due);
    await expect(page.locator('#trascrizione-carta')).toBeVisible();
    await expect(page.locator('#trascrizione-carta')).toContainText('1');

    await vaiAllaCarta(page, 'MS-CARTE-5', 1);
    await expect(page.locator('#trascrizione-carta')).toContainText('2');

    await page.evaluate(() => (window as any).chiudiTrascrizione());
    const una = await createItemWithAttachment(page, 'MS-CARTE-6', FIXTURE_PNG);
    await page.evaluate((recId: string) => (window as any).apriTrascrizione(recId), una);
    await expect(page.locator('#trascrizione-carta')).toBeHidden();
  });
});

test.describe('Trascrizione per pagina nei PDF', () => {
  test.use({ seedWorkspace: 'Pagine' });

  const editor = (page) => page.locator('#trascrizione-editor');
  const paginaAperta = (page) => page.locator('#trasc-pdf-pagina');

  test('P5 — confronto coi PDF: a sinistra la pagina che si trascrive, a destra si sfoglia senza toccarla', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Pagine');
    const id = await createItemWithAttachment(page, 'MS-CMP-PDF', FIXTURE_PDF3);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.locator('#btn-pdf-pagina-succ').click();
    await expect(paginaAperta(page)).toHaveValue('2');

    await page.locator('#btn-confronta-carte').click();
    await expect(page.locator('#confronto-pagina-sx')).toHaveValue('2');
    await expect(page.locator('#confronto-totale-sx')).toHaveText('/ 3');
    await expect(page.locator('#confronto-img-sx')).toHaveAttribute('src', /^blob:/);

    await page.locator('#confronto-cerca-dx').fill('cmp-pdf');
    await page.locator('#confronto-risultati-dx button', { hasText: 'MS-CMP-PDF' }).click();
    await expect(page.locator('#confronto-pagina-dx')).toHaveValue('1');
    await page.locator('#confronto-succ-dx').click();
    await page.locator('#confronto-succ-dx').click();
    await expect(page.locator('#confronto-pagina-dx')).toHaveValue('3');
    await expect(page.locator('#confronto-succ-dx')).toBeDisabled();
    await expect(page.locator('#confronto-img-dx')).toHaveAttribute('alt', /3 di 3|3 of 3/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#confronto-modal')).toBeHidden();
    expect(await page.evaluate(() => (window as any).PdfViewer.numeroPagine())).toBe(3);
    await expect(paginaAperta(page)).toHaveValue('2');
  });

  test('il testo segue la pagina, e sopravvive al salvataggio e alla riapertura', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Pagine');
    const id = await createItemWithAttachment(page, 'MS-PDF-PAG', FIXTURE_PDF3);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await expect(page.locator('#trasc-pdf-totale')).toHaveText('/ 3');
    await expect(page.locator('#trascrizione-carta')).toContainText('p. 1 di 3');

    await editor(page).click();
    await page.keyboard.type('Testo prima pagina');
    await page.locator('#btn-pdf-pagina-succ').click();
    await expect(paginaAperta(page)).toHaveValue('2');
    await expect(page.locator('#trascrizione-carta')).toContainText('p. 2 di 3');
    await expect(editor(page)).not.toContainText('Testo prima pagina');
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Testo seconda pagina');

    await page.locator('#btn-pdf-pagina-prec').click();
    await expect(editor(page)).toContainText('Testo prima pagina');
    await expect(editor(page)).not.toContainText('Testo seconda pagina');

    await page.keyboard.press('Control+s');
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 8_000 });
    const rec = (await getAppData(page)).manoscritti.find((m: any) => m.id === id);
    expect(rec.allegati[0].pagine[0]).toContain('Testo prima pagina');
    expect(rec.allegati[0].pagine[1]).toContain('Testo seconda pagina');
    expect(rec.allegati[0].pagine).toHaveLength(2);
    expect(rec.trascrizione).toContain('[p. 2]');

    await page.evaluate(() => (window as any).chiudiTrascrizione());
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(editor(page)).toContainText('Testo prima pagina');
    await paginaAperta(page).fill('2');
    await paginaAperta(page).press('Enter');
    await expect(editor(page)).toContainText('Testo seconda pagina');
  });

  test('le frecce sono continue: pagine del PDF, poi la carta vicina', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Pagine');
    const id = await createItemWithAttachment(page, 'MS-PDF-NAV', FIXTURE_PDF3);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.locator('#trasc-file-input').setInputFiles(FIXTURE_PNG);
    await expect(page.locator('#trasc-carte-totale')).toHaveText('/ 2');
    await expect(paginaAperta(page)).toHaveValue('1');

    await page.locator('#btn-next-allegato').click();
    await expect(paginaAperta(page)).toHaveValue('2');
    await page.locator('#btn-next-allegato').click();
    await expect(paginaAperta(page)).toHaveValue('3');
    await page.locator('#btn-next-allegato').click();
    await expect(page.locator('#trasc-pdf-bar')).toBeHidden();
    await expect(page.locator('#btn-next-allegato')).toBeHidden();

    await page.locator('#btn-prev-allegato').click();
    await expect(page.locator('#trasc-pdf-bar')).toBeVisible();
    await expect(paginaAperta(page)).toHaveValue('3');
    await expect(page.locator('#trascrizione-carta')).toContainText('Carta 1 di 2');
    await expect(page.locator('#trascrizione-carta')).toContainText('p. 3 di 3');

    await page.locator('#trasc-img-viewport').focus();
    await page.keyboard.press('PageDown');
    await expect(page.locator('#trasc-pdf-bar')).toBeHidden();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(paginaAperta(page)).toHaveValue('3');
  });

  test('la ricerca trova nel PDF e nelle trascrizioni, e porta alla pagina', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Pagine');
    const id = await createItemWithAttachment(page, 'MS-PDF-CERCA', FIXTURE_PDF3);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-pdf-totale')).toHaveText('/ 3');

    const cerca = page.locator('#trasc-pdf-cerca');
    const risultati = page.locator('#trasc-pdf-risultati');

    await cerca.fill('beta');
    await expect(risultati).toBeVisible();
    await expect(risultati.locator('button')).toHaveCount(1);
    await expect(risultati).toContainText('p. 2');
    await risultati.locator('button').first().click();
    await expect(paginaAperta(page)).toHaveValue('2');
    await expect(risultati).toBeHidden();

    await page.locator('#btn-pdf-pagina-succ').click();
    await expect(paginaAperta(page)).toHaveValue('3');
    await editor(page).click();
    await page.keyboard.type('Bartholomeus notarius');
    await cerca.fill('');
    await cerca.fill('notarius');
    await expect(risultati).toContainText('p. 3');
    await expect(risultati).toContainText('Trascrizione');
    await page.locator('#btn-pdf-pagina-prec').click();
    await expect(paginaAperta(page)).toHaveValue('2');
    await cerca.press('Enter');
    await expect(paginaAperta(page)).toHaveValue('3');
    await expect(editor(page)).toContainText('Bartholomeus notarius');

    await cerca.fill('inesistente');
    await expect(page.locator('#trasc-pdf-stato')).toHaveText(/Nessun risultato|No results/);
  });
});

test.describe('Trascrizione: tab Scheda', () => {
  test.use({ seedWorkspace: 'Trasc' });

  const record = (page, id) => getAppData(page).then((d: any) => d.manoscritti.find((m: any) => m.id === id));

  test('la scheda si compila guardando il documento e si salva da sola, senza perdere il testo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-AFF-1', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Incipit liber');

    const tabScheda = page.getByRole('tab', { name: /^Scheda|^Record/ });
    await tabScheda.click();
    await expect(tabScheda).toHaveAttribute('aria-selected', 'true');
    const segnatura = page.locator('#trasc-pannello-scheda #form-segnatura');
    await expect(segnatura).toHaveValue('MS-AFF-1');
    await expect(page.locator('#trasc-img-preview')).toBeVisible();

    await segnatura.fill('MS-AFF-1bis');
    await segnatura.press('Enter');
    await expect(page.locator('#trasc-scheda-stato')).toHaveText(/Salvata alle|Saved at/);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    const salvato = await record(page, id);
    expect(salvato.segnatura).toBe('MS-AFF-1bis');
    expect(salvato.allegati[0].trascrizione).toContain('Incipit liber');
    expect(salvato.trascrizione).toContain('Incipit liber');

    await page.getByRole('tab', { name: /^Testo|^Text/ }).click();
    await expect(page.locator('#trascrizione-editor')).toContainText('Incipit liber');
    await expect(page.locator('#view-add #manoscritto-form')).toHaveCount(1);
  });

  test('Ctrl+Maiusc+S alterna i tab, il tab si ricorda e uscendo la modifica in sospeso si salva', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-AFF-2', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    await page.locator('#trascrizione-editor').click();
    await page.keyboard.press('Control+Shift+S');
    const segnatura = page.locator('#trasc-pannello-scheda #form-segnatura');
    await expect(segnatura).toBeVisible();

    await segnatura.fill('MS-AFF-2bis');
    await page.locator('#btn-back-to-list-trasc').click();
    await expect(page.locator('#view-list')).toBeVisible();
    await expect.poll(async () => (await record(page, id)).segnatura).toBe('MS-AFF-2bis');
    await expect(page.locator('#view-add #manoscritto-form')).toHaveCount(1);

    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.getByRole('tab', { name: /^Scheda|^Record/ })).toHaveAttribute('aria-selected', 'true');
    await expect(segnatura).toHaveValue('MS-AFF-2bis');
    await page.keyboard.press('Control+Shift+S');
    await expect(page.locator('#trascrizione-editor')).toBeVisible();
    await expect(segnatura).toHaveCount(0);
  });

  test('il separatore si trascina, si aggancia, si regola da tastiera e ricorda la proporzione per tab', async ({ page, electronApp, userDataDir }) => {
    await electronApp.evaluate(({ BrowserWindow }) => {
      const b = BrowserWindow.getAllWindows()[0]; b.unmaximize(); b.setContentSize(1200, 760);
    });
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-AFF-3', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);

    const sep = page.locator('#trascrizione-resizer');
    await expect(sep).toBeVisible();
    const contenitore = (await page.locator('#trascrizione-container').boundingBox())!;
    const quota = async () => {
      const ed = (await page.locator('#trascrizione-editor-panel').boundingBox())!;
      return 100 - (ed.width / contenitore.width) * 100;
    };
    const trascina = async (pct: number) => {
      const s = (await sep.boundingBox())!;
      await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
      await page.mouse.down();
      await page.mouse.move(contenitore.x + (contenitore.width * pct) / 100, s.y + s.height / 2, { steps: 8 });
      await page.mouse.up();
    };

    await trascina(10);
    expect(await quota()).toBeCloseTo(25, 0);
    await trascina(34.5);
    expect(await quota()).toBeCloseTo(100 / 3, 0);
    await sep.focus();
    await page.keyboard.press('ArrowRight');
    await expect(sep).toHaveAttribute('aria-valuenow', '35');
    await sep.dblclick();
    await expect(sep).toHaveAttribute('aria-valuenow', '50');
    await expect.poll(quota).toBeCloseTo(50, 0);
    await trascina(40);

    await page.getByRole('tab', { name: /^Scheda|^Record/ }).click();
    await expect.poll(quota).toBeCloseTo(50, 0);
    await trascina(65);
    await page.getByRole('tab', { name: /^Testo|^Text/ }).click();
    await expect.poll(quota).toBeCloseTo(40, 0);
    await page.getByRole('tab', { name: /^Scheda|^Record/ }).click();
    await expect.poll(quota).toBeCloseTo(200 / 3, 0);
  });
});

test.describe('Modulo della scheda: documento accanto', () => {
  test.use({ seedWorkspace: 'Trasc' });

  test('Documento mostra la carta accanto al modulo, la trascrizione in sola lettura, e si ricorda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-DOC-1', FIXTURE_PNG);

    await page.locator('#btn-tab-add').click();
    await expect(page.locator('#btn-documento-scheda')).toBeHidden();
    await page.locator('#btn-cancel-edit, #btn-back-to-list').first().click();

    await page.evaluate((recId) => (window as any).editItem(recId), id);
    const pulsante = page.getByRole('button', { name: /^Documento|^Document/ });
    await pulsante.click();
    await expect(pulsante).toHaveAttribute('aria-pressed', 'true');
    const pannello = page.locator('#doc-scheda');
    await expect(pannello).toBeVisible();
    await expect(page.locator('#doc-scheda-img')).toHaveAttribute('src', /local-asset:/);
    const [modulo, doc] = await Promise.all([page.locator('#manoscritto-form').boundingBox(), pannello.boundingBox()]);
    expect(modulo!.x + modulo!.width).toBeLessThanOrEqual(doc!.x + 1);

    await page.getByRole('button', { name: /^Trascrizione$|^Transcription$/ }).click();
    await expect(page.locator('#doc-scheda-testo')).toContainText(/non è ancora trascritta|not been transcribed/);
    await expect(page.locator('#doc-scheda-viewport')).toBeHidden();

    await page.locator('#form-segnatura').fill('MS-DOC-1bis');
    await page.keyboard.press('Control+Shift+S');
    await expect(pannello).toBeHidden();
    await page.keyboard.press('Control+Shift+S');
    await expect(pannello).toBeVisible();
    await page.locator('#btn-submit-form').click();
    await expect(page.locator('#view-list')).toBeVisible();
    await expect(pannello).toBeHidden();

    await page.evaluate((recId) => (window as any).editItem(recId), id);
    await expect(pannello).toBeVisible();
    await expect(page.locator('#doc-scheda-testo')).toBeVisible();
    await page.locator('#doc-scheda-chiudi').click();
    await expect(pannello).toBeHidden();
    await expect(pulsante).toBeFocused();
  });
});

test.describe('Finestra staccata', () => {
  test.use({ seedWorkspace: 'Trasc' });

  const pronta = async (finestra) => {
    await finestra.waitForLoadState('domcontentloaded');
    await finestra.waitForFunction(() => (window as any).__appPronta === true);
  };

  test('la scheda staccata salva passando dalla principale, senza perdere il testo trascritto lì, e si riaggancia', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-STAC-1', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.getByRole('tab', { name: /^Scheda|^Record/ }).click();

    const [staccata] = await Promise.all([
      electronApp.waitForEvent('window'),
      page.getByRole('button', { name: /Stacca in una finestra|Open in a separate window/ }).click(),
    ]);
    await pronta(staccata);
    const segnaturaFuori = staccata.locator('#trasc-pannello-scheda #form-segnatura');
    await expect(segnaturaFuori).toHaveValue('MS-STAC-1');
    await expect(page.locator('#trasc-scheda-staccata')).toBeVisible();
    await expect(page.locator('#trasc-pannello-scheda #form-segnatura')).toHaveCount(0);

    await page.getByRole('tab', { name: /^Testo|^Text/ }).click();
    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Explicit liber');
    await segnaturaFuori.fill('MS-STAC-1bis');
    await expect(staccata.locator('#trasc-scheda-stato')).toHaveText(/Salvata alle|Saved at/);
    await expect.poll(async () => (await getAppData(page)).manoscritti.find((m: any) => m.id === id).segnatura).toBe('MS-STAC-1bis');
    const salvato = (await getAppData(page)).manoscritti.find((m: any) => m.id === id);
    expect(salvato.allegati[0].trascrizione).toContain('Explicit liber');

    await page.getByRole('tab', { name: /^Scheda|^Record/ }).click();
    await Promise.all([
      staccata.waitForEvent('close'),
      staccata.getByRole('button', { name: /^Riaggancia$|^Dock back$/ }).click(),
    ]);
    await expect(page.locator('#trasc-scheda-staccata')).toBeHidden();
    await expect(page.locator('#trasc-pannello-scheda #form-segnatura')).toHaveValue('MS-STAC-1bis');
  });

  test('F4 — dalla staccata «+ valore», tag nuovo e «promuovi al modello» arrivano all\'archivio vero', async ({ page, electronApp, userDataDir }) => {
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-STAC-F4', FIXTURE_PNG);
    await page.evaluate(() => (window as any).salvaVocabolarioArchivio({ id: 'materia', nome: 'Materia', valori: ['pergamena'] }));
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.getByRole('tab', { name: /^Scheda|^Record/ }).click();
    const [staccata] = await Promise.all([
      electronApp.waitForEvent('window'),
      page.getByRole('button', { name: /Stacca in una finestra|Open in a separate window/ }).click(),
    ]);
    await pronta(staccata);

    await staccata.evaluate(() => (window as any).aggiungiValoreVocabolario('materia', 'carta bambagina'));
    await staccata.evaluate(() => (window as any).registraTagUsati(['notarile']));
    await staccata.evaluate(() => (window as any).apriCampoProprioModal());
    await staccata.locator('#campo-proprio-nome').fill('Filigrana');
    await staccata.evaluate(() => (window as any).confermaCampoProprio());
    await staccata.evaluate(() => (window as any).promuoviCampoProprio('Filigrana'));

    const archivio = () => page.evaluate((recId) => {
      // @ts-ignore
      const d = appData;
      const m = d.manoscritti.find((x: any) => x.id === recId);
      return {
        valori: d.vocabolari.materia.valori,
        tag: Object.keys(d.tagsAnagrafica || {}),
        campi: d.tipiDocumento.find((t: any) => t.id === m.tipoDocumento).campi
      };
    }, id);
    await expect.poll(async () => (await archivio()).valori).toContain('carta bambagina');
    const a = await archivio();
    expect(a.tag).toContain('notarile');
    expect(a.campi).toContain('Filigrana');
    await page.evaluate(() => (window as any).flushSalvataggio());
    const disco = JSON.parse(require('fs').readFileSync(path.join(ws, 'database_manoscritti.json'), 'utf8'));
    expect(disco.vocabolari.materia.valori).toContain('carta bambagina');
  });

  test('la zona «Rilascia per riagganciare» copre la colonna; la X salva e riaggancia', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-STAC-3', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await page.getByRole('tab', { name: /^Scheda|^Record/ }).click();
    const [staccata] = await Promise.all([
      electronApp.waitForEvent('window'),
      page.getByRole('button', { name: /Stacca in una finestra|Open in a separate window/ }).click(),
    ]);
    await pronta(staccata);

    await electronApp.evaluate(({ BrowserWindow }) => {
      const principale = BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes('finestra='))!;
      principale.webContents.send('finestra-richiesta', 99999, 'zona', 'scheda');
      setTimeout(() => principale.webContents.send('finestra-zona', true), 200);
    });
    const velo = page.locator('#zona-riaggancio');
    await expect(velo).toBeVisible();
    await expect(velo).toHaveText(/Rilascia per riagganciare|Release to dock/);
    const [v, colonna] = await Promise.all([velo.boundingBox(), page.locator('#trascrizione-editor-panel').boundingBox()]);
    expect(Math.abs(v!.x - colonna!.x)).toBeLessThan(2);
    expect(Math.abs(v!.width - colonna!.width)).toBeLessThan(2);

    await staccata.locator('#trasc-pannello-scheda #form-segnatura').fill('MS-STAC-3bis');
    await Promise.all([
      staccata.waitForEvent('close'),
      electronApp.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('finestra='))!.close();
      }),
    ]);
    await expect(velo).toBeHidden();
    await expect(page.locator('#trasc-pannello-scheda #form-segnatura')).toHaveValue('MS-STAC-3bis');
    expect((await getAppData(page)).manoscritti.find((m: any) => m.id === id).segnatura).toBe('MS-STAC-3bis');
  });

  test('il documento si stacca dal modulo e si riaggancia nel pannello', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-STAC-2', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).editItem(recId), id);
    await page.getByRole('button', { name: /^Documento|^Document/ }).click();

    const [staccata] = await Promise.all([
      electronApp.waitForEvent('window'),
      page.locator('#doc-scheda').getByRole('button', { name: /Stacca in una finestra|Open in a separate window/ }).click(),
    ]);
    await pronta(staccata);
    await expect(staccata.locator('#doc-scheda')).toBeVisible();
    await expect(staccata.locator('#doc-scheda-img')).toHaveAttribute('src', /local-asset:/);
    await expect(page.locator('#doc-scheda')).toBeHidden();
    await expect(page.locator('#view-add')).not.toHaveClass(/con-documento/);

    await Promise.all([
      staccata.waitForEvent('close'),
      staccata.getByRole('button', { name: /^Riaggancia$|^Dock back$/ }).click(),
    ]);
    await expect(page.locator('#doc-scheda')).toBeVisible();
  });
});

test.describe('Scheda affiancata: prove M14', () => {
  test.use({ seedWorkspace: 'Trasc' });

  const pronta = async (finestra) => {
    await finestra.waitForLoadState('domcontentloaded');
    await finestra.waitForFunction(() => (window as any).__appPronta === true);
  };
  const tabScheda = (page) => page.getByRole('tab', { name: /^Scheda|^Record/ });
  const tabTesto = (page) => page.getByRole('tab', { name: /^Testo|^Text/ });
  const suDisco = (page, id) => page.evaluate(async (recId) => {
    await (window as any).flushSalvataggio();
    const db = await (window as any).leggiDatiArchivio();
    return db.manoscritti.find((m: any) => m.id === recId);
  }, id);
  const preparaChiusura = (electronApp) => electronApp.evaluate(({ ipcMain }) => {
    ipcMain.removeAllListeners('confirm-close');
    (globalThis as any).chiusureConfermate = 0;
    ipcMain.on('confirm-close', () => { (globalThis as any).chiusureConfermate++; });
  });
  const chiediChiusura = (electronApp) => electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes('finestra='))!.webContents.send('request-close');
  });
  const chiusureConfermate = (electronApp) => electronApp.evaluate(() => (globalThis as any).chiusureConfermate);

  test('M14.1 — PDF multipagina: il testo di p. 2 resta, anche su disco, dopo il salvataggio della scheda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-M141', FIXTURE_PDF3);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-pdf-pagina')).toHaveValue('1');
    await page.locator('#btn-pdf-pagina-succ').click();
    await expect(page.locator('#trasc-pdf-pagina')).toHaveValue('2');
    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Secunda pagina');

    await tabScheda(page).click();
    await page.locator('#trasc-pannello-scheda #form-segnatura').fill('MS-M141bis');
    await expect(page.locator('#trasc-scheda-stato')).toHaveText(/Salvata alle|Saved at/);
    const salvato = await suDisco(page, id);
    expect(salvato.segnatura).toBe('MS-M141bis');
    expect(salvato.allegati[0].pagine[1]).toContain('Secunda pagina');
    expect(salvato.allegati[0].pagine[0] || '').not.toContain('Secunda pagina');
    expect(salvato.trascrizione).toContain('Secunda pagina');

    await tabTesto(page).click();
    await expect(page.locator('#trasc-pdf-pagina')).toHaveValue('2');
    await expect(page.locator('#trascrizione-editor')).toContainText('Secunda pagina');
  });

  test('M14.2 — togliere e rinominare un allegato dal modulo non perde il testo dell altra carta', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    await page.locator('#btn-tab-add').click();
    await page.locator('#form-segnatura').fill('MS-M142');
    await page.locator('#form-allegato').setInputFiles([FIXTURE_PNG, FIXTURE_PDF]);
    await page.locator('#btn-submit-form').click();
    const idDi = () => page.evaluate(() => (window as any).appData.manoscritti.find((m: any) => m.segnatura === 'MS-M142')?.id ?? null);
    await expect.poll(idDi).not.toBeNull();
    const id = await idDi();
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await expect(page.locator('#trasc-carte-bar')).toBeVisible();
    await page.locator('#trascrizione-editor').click();
    await page.keyboard.type('Prima carta, non salvata');

    await tabScheda(page).click();
    const righe = page.locator('#trasc-pannello-scheda #form-allegati-list .allegato-row');
    await expect(righe).toHaveCount(2);
    await righe.nth(0).getByRole('button', { name: /^Rinomina$|^Rename$/ }).click();
    await page.locator('#rename-input').fill('Carta prima');
    await page.locator('#rename-input').press('Enter');
    await righe.nth(1).getByRole('button', { name: /^Rimuovi$|^Remove$/ }).click();
    await expect(righe).toHaveCount(1);
    await expect(page.locator('#trasc-scheda-stato')).toHaveText(/Salvata alle|Saved at/);

    const salvato = await suDisco(page, id);
    expect(salvato.allegati).toHaveLength(1);
    expect(salvato.allegati[0].originalName).toBe('Carta prima');
    expect(salvato.allegati[0].trascrizione).toContain('Prima carta, non salvata');
    await expect(page.locator('#trasc-carta-numero')).toBeHidden();
    await tabTesto(page).click();
    await expect(page.locator('#trascrizione-editor')).toContainText('Prima carta, non salvata');
  });

  test('M14.3 — chiudere l app con un campo obbligatorio vuoto nel tab chiede, e «Annulla» lascia tutto com era', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-M143', FIXTURE_PNG);
    await page.evaluate(async (recId) => {
      const w = window as any;
      const tipo: any = { id: 'obblig', nome: 'Con obbligo', campi: [] };
      w.Model.impostaCampi(tipo, [{ id: 'Notaio', tipo: 'text', obbligatorio: true }]);
      w.appData.tipiDocumento.push(tipo);
      const m = w.appData.manoscritti.find((x: any) => x.id === recId);
      m.tipoDocumento = 'obblig';
      m.Notaio = 'Rossi';
      await w.Store.commit();
    }, id);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await tabScheda(page).click();
    const idNotaio = await page.evaluate(() => (window as any).idControlloCampo('Notaio'));
    const notaio = page.locator('#trasc-pannello-scheda #' + idNotaio);
    await expect(notaio).toHaveValue('Rossi');
    await notaio.fill('');
    await expect(page.locator('#trasc-scheda-stato')).toHaveText(/obbligatorio|required/i);

    await preparaChiusura(electronApp);
    await chiediChiusura(electronApp);
    const banner = page.locator('#bottom-confirm-banner');
    await expect(banner).toBeVisible();
    await banner.locator('.btn-ghost').click();
    await expect(banner).toBeHidden();
    expect(await chiusureConfermate(electronApp)).toBe(0);
    await expect(notaio).toHaveValue('');
    expect((await suDisco(page, id)).Notaio).toBe('Rossi');
  });

  test('M14.5 — chiudere l app con la scheda staccata salva ciò che è in sospeso; la staccata resta ricordata', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const id = await createItemWithAttachment(page, 'MS-M145', FIXTURE_PNG);
    await page.evaluate((recId) => (window as any).apriTrascrizione(recId), id);
    await tabScheda(page).click();
    const [staccata] = await Promise.all([
      electronApp.waitForEvent('window'),
      page.getByRole('button', { name: /Stacca in una finestra|Open in a separate window/ }).click(),
    ]);
    await pronta(staccata);

    await staccata.locator('#trasc-pannello-scheda #form-segnatura').fill('MS-M145bis');
    await preparaChiusura(electronApp);
    await chiediChiusura(electronApp);
    await expect.poll(() => chiusureConfermate(electronApp)).toBe(1);
    expect((await suDisco(page, id)).segnatura).toBe('MS-M145bis');
    expect(await page.evaluate(() => (window as any).prefLocale('finestraStaccata:scheda'))).toBe('1');

    await Promise.all([staccata.waitForEvent('close'), page.evaluate(() => (window as any).switchTab('list'))]);
    const [di_nuovo] = await Promise.all([
      electronApp.waitForEvent('window'),
      page.evaluate((recId) => (window as any).apriTrascrizione(recId), id),
    ]);
    await pronta(di_nuovo);
    await expect(di_nuovo.locator('#trasc-pannello-scheda #form-segnatura')).toHaveValue('MS-M145bis');
    await expect(page.locator('#trasc-scheda-staccata')).toBeVisible();
  });

  test('M14.7 — il documento staccato segue la scheda aperta, e si riaggancia nel pannello', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Trasc');
    const idA = await createItemWithAttachment(page, 'MS-M147-A', FIXTURE_PNG);
    const idB = await createItemWithAttachment(page, 'MS-M147-B', FIXTURE_PDF3);
    await page.evaluate((recId) => (window as any).editItem(recId), idA);
    await page.getByRole('button', { name: /^Documento|^Document/ }).click();
    const [prima] = await Promise.all([
      electronApp.waitForEvent('window'),
      page.locator('#doc-scheda').getByRole('button', { name: /Stacca in una finestra|Open in a separate window/ }).click(),
    ]);
    await pronta(prima);
    await expect(prima).toHaveTitle(/MS-M147-A/);

    await Promise.all([prima.waitForEvent('close'), page.locator('#btn-cancel-edit').click()]);
    const [seconda] = await Promise.all([
      electronApp.waitForEvent('window'),
      page.evaluate((recId) => (window as any).editItem(recId), idB),
    ]);
    await pronta(seconda);
    await expect(seconda).toHaveTitle(/MS-M147-B/);
    await expect(seconda.locator('#doc-scheda-pagine')).toBeVisible();
    await expect(page.locator('#doc-scheda')).toBeHidden();

    await Promise.all([
      seconda.waitForEvent('close'),
      seconda.getByRole('button', { name: /^Riaggancia$|^Dock back$/ }).click(),
    ]);
    await expect(page.locator('#doc-scheda')).toBeVisible();
    await expect(page.locator('#doc-scheda-pagine')).toBeVisible();
  });
});
