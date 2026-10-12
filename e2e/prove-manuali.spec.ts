import { test, expect, launchApp, closeApp, stubDialog } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, seedItems, openView, openSidebarPanel } from './helpers';
import { scansiona, TEMI } from './contrasto';
import type { Page } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Prove di PIANO-PROVE-MANUALI.md rese automatiche (id M* nel titolo). Quelle che dipendono
// dalla macchina (condivisione amministrativa C$, SMB locale) si saltano dove non ci sono.

const fixture = (f: string) => path.join(__dirname, 'fixtures', f);
const w = (page: Page, f: string, ...args: unknown[]) =>
  page.evaluate(([f, args]) => (window as any)[f as string](...(args as unknown[])), [f, args] as const);

// Connessioni TCP verso <ip>:445. Le apre il redirector SMB del kernel (PID 4), non l'app:
// si conta per indirizzo, quindi serve un IP verso cui nessuno ha già una sessione aperta.
const connessioniSmb = (ip: string) => execSync('netstat -an -p TCP', { encoding: 'utf8' })
  .split('\n').filter(l => l.includes(` ${ip}:445 `) || l.trim().split(/\s+/)[2] === `${ip}:445`);

test.describe('Prove manuali automatizzate', () => {
  test('M2.1 — trascrizione con file:// verso la rete: niente immagini, nessuna connessione SMB', async ({ page, userDataDir }) => {
    test.skip(process.platform !== 'win32', 'SMB di Windows');
    const ip = Object.values(os.networkInterfaces()).flat()
      .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i!.address)
      .find(a => connessioniSmb(a).length === 0);
    test.skip(!ip, 'nessun indirizzo IPv4 libero da sessioni SMB');

    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Smb');
    const [id] = await seedItems(page, 1);
    await page.evaluate(async ([rid, ip]) => {
      // @ts-ignore -- appData è una let globale
      const m = appData.manoscritti.find((x: any) => x.id === rid);
      m.trascrizione = `<p>prova</p><img src="file://${ip}/E$/x.png"><img src="file:////${ip}/E$/y.png">`;
      await (window as any).Store.commit();
    }, [id, ip!] as const);

    await w(page, 'editItem', id);
    await w(page, 'apriTrascrizione', id);
    await expect(page.locator('#trascrizione-editor')).toContainText('prova');
    // Il sanitizer toglie l'attributo, il tag può restare: conta che nessuna immagine punti fuori.
    expect(await page.locator('#trascrizione-editor img').evaluateAll(els => els.filter(e => (e as HTMLImageElement).src).length)).toBe(0);
    await page.waitForTimeout(2000);
    expect(connessioniSmb(ip!), `connessioni verso ${ip}:445`).toEqual([]);

    // Controprova: lo stesso controllo vede una connessione vera.
    fs.existsSync(`\\\\${ip}\\C$`);
    expect(connessioniSmb(ip!).length, 'controprova: netstat vede SMB').toBeGreaterThan(0);
  });

  // L'archivio su NAS si simula con la condivisione amministrativa \\<questo pc>\C$: stessa
  // strada di rete (UNC, file://host/...) senza un NAS. Non `localhost`: in file://localhost/
  // Chromium tratta l'host come locale e il percorso C$\... non esiste.
  test('M4.1/M4.2 — archivio e cartella allegati su un percorso di rete', async ({ page, electronApp, userDataDir }) => {
    const unc = (p: string) => '\\\\' + os.hostname() + '\\' + p[0] + '$' + p.slice(2);
    test.skip(process.platform !== 'win32' || !fs.existsSync(unc(userDataDir)), 'condivisione amministrativa non raggiungibile');
    const base = unc(path.join(userDataDir, 'nas'));
    fs.mkdirSync(base, { recursive: true });

    const ws = await createLocalWorkspace(page, base, 'Nas');
    expect(ws.startsWith('\\\\')).toBe(true);
    await createItemWithAttachment(page, 'NAS-IMG', fixture('sample.png'));
    await createItemWithAttachment(page, 'NAS-PDF', fixture('multipage.pdf'));
    expect(fs.existsSync(path.join(ws, 'allegati_manoscritti'))).toBe(true);

    // L'immagine si vede nel visore della trascrizione (servita da local-asset dalla rete).
    // @ts-ignore -- appData è una let globale
    await w(page, 'apriTrascrizione', await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'NAS-IMG').id));
    await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll<HTMLImageElement>('#view-trascrizione img'))
      .filter(i => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
    await w(page, 'confermaUscitaTrascrizione');
    // @ts-ignore -- appData è una let globale
    const pdf = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'NAS-PDF').allegati[0].nome);
    expect((await page.evaluate((n) => (window as any).apiBrowser.pdfAllegatoInfo(n), pdf)).ok).toBe(true);

    // M4.2: cartella allegati personalizzata, anch'essa in rete; poi ripristino.
    const altrove = unc(path.join(userDataDir, 'nas', 'allegati-altrove'));
    fs.mkdirSync(altrove);
    await stubDialog(electronApp, { canceled: false, filePaths: [altrove] });
    expect(await page.evaluate(() => (window as any).apiSettings.scegliCartellaAllegati('Titolo'))).toBe(altrove);
    await createItemWithAttachment(page, 'NAS-ALTROVE', fixture('sample.png'));
    expect(fs.readdirSync(altrove).length).toBeGreaterThan(0);
    await page.evaluate(() => (window as any).apiSettings.ripristinaCartellaAllegati());
    expect(path.dirname(await page.evaluate(() => (window as any).apiBrowser.getAllegatoPath('x'))))
      .toBe(path.join(ws, 'allegati_manoscritti'));

    // Riapertura: l'archivio in rete torna con le schede.
    await expect.poll(() => fs.readFileSync(path.join(ws, 'database_manoscritti.json'), 'utf8'), { timeout: 10_000 }).toContain('NAS-ALTROVE');
    await closeApp(electronApp);
    const { app, page: p2 } = await launchApp(userDataDir);
    try {
      await p2.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 20_000 });
      // @ts-ignore -- appData è una let globale
      expect(await p2.evaluate(() => appData.manoscritti.map((m: any) => m.segnatura).sort())).toEqual(['NAS-ALTROVE', 'NAS-IMG', 'NAS-PDF']);
    } finally {
      await closeApp(app);
    }
  });

  // M7.2: zoom vero (Ctrl++ = zoomFactor) a 1280×800, non una finestra stretta.
  test('M7.2 — zoom al 200% su 1280×800: nulla tagliato né irraggiungibile', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Zoom');
    await seedItems(page, 3);
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setContentSize(1280, 800);
      win.webContents.setZoomFactor(2);
    });
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBeLessThan(660);
    await openView(page, 'list');

    const tagliati = (sel: string) => page.evaluate((s) => Array.from(document.querySelectorAll(s)).filter(e => {
      const r = e.getBoundingClientRect();
      if (!r.width) return false;
      const c = (e.closest('.card-scheda') || e.parentElement!).getBoundingClientRect();
      return r.left < Math.max(0, c.left) - 1 || r.right > Math.min(innerWidth, c.right) + 1;
    }).map(e => e.id || e.getAttribute('aria-label') || e.textContent!.trim().slice(0, 30)), sel);

    for (const wdt of await page.locator('.card-scheda .card-title').evaluateAll(els => els.map(e => e.getBoundingClientRect().width))) {
      expect(wdt, 'segnatura nella card').toBeGreaterThan(60);
    }
    expect(await tagliati('.card-scheda .card-badge')).toEqual([]);
    expect(await tagliati('#sidebar button[aria-label]')).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);

    // @ts-ignore -- appData è una let globale
    const id = await page.evaluate(() => appData.manoscritti[0].id);
    await w(page, 'apriTrascrizione', id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    expect(await tagliati('#view-trascrizione button')).toEqual([]);
    await w(page, 'confermaUscitaTrascrizione');

    // Un modale alto (Impostazioni): il pulsante di chiusura resta raggiungibile e il corpo scorre.
    await w(page, 'apriImpostazioni');
    const modale = page.locator('#settings-modal .modal-window');
    await expect(modale).toBeVisible();
    const g = await modale.evaluate((m) => { const r = m.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
    expect(g.top).toBeGreaterThanOrEqual(0);
    expect(g.left).toBeGreaterThanOrEqual(0);
    expect(g.bottom).toBeLessThanOrEqual(await page.evaluate(() => innerHeight) + 1);
    expect(g.right).toBeLessThanOrEqual(await page.evaluate(() => innerWidth) + 1);
  });

  // M6.8: pulsanti di pericolo in hover e col fuoco da tastiera, nei 4 temi. Si cercano da
  // soli (classe o colore di pericolo), così un pulsante nuovo entra senza toccare il test.
  test('M6.8 — pulsanti di pericolo leggibili in hover e col fuoco visibile, nei 4 temi', async ({ page, userDataDir }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Pericolo');
    await seedItems(page, 3, { tagPrefix: 'notarile' });
    // Una scheda nel cestino, così compaiono anche i pulsanti per voce.
    // @ts-ignore -- appData è una let globale
    await w(page, 'deleteItem', await page.evaluate(() => appData.manoscritti[0].id));
    await w(page, 'confermaEliminazione');

    const schermate: { nome: string; apri: () => Promise<unknown>; chiudi: () => Promise<unknown> }[] = [
      { nome: 'cestino', apri: () => w(page, 'apriCestino'), chiudi: () => page.keyboard.press('Escape') },
      { nome: 'tag', apri: () => w(page, 'apriGestioneTag'), chiudi: () => page.keyboard.press('Escape') },
      { nome: 'vocabolari', apri: () => w(page, 'apriVocabolari'), chiudi: () => page.keyboard.press('Escape') },
      { nome: 'impostazioni', apri: () => w(page, 'apriImpostazioni'), chiudi: () => w(page, 'chiudiImpostazioni') },
      { nome: 'cloud', apri: () => w(page, 'apriCloudModal'), chiudi: () => page.keyboard.press('Escape') },
      // @ts-ignore -- appData è una let globale
      { nome: 'form', apri: async () => w(page, 'editItem', await page.evaluate(() => appData.manoscritti[0].id)), chiudi: () => openView(page, 'list') },
    ];

    const PERICOLO = '.btn-danger, .btn-danger-ghost, [data-sonda-pericolo]';
    const problemi: string[] = [];
    const trovati = new Set<string>();
    for (const tema of TEMI) {
      await w(page, 'applicaTema', tema);
      for (const s of schermate) {
        await s.apri();
        await page.waitForTimeout(200);
        // Pulsanti col testo nel colore di pericolo anche senza la classe (text-red-* rimappati).
        const n = await page.evaluate(() => {
          const sonda = document.createElement('span');
          sonda.style.color = 'var(--color-danger-text)';
          document.body.appendChild(sonda);
          const rosso = getComputedStyle(sonda).color;
          sonda.remove();
          let n = 0;
          document.querySelectorAll('button').forEach(b => {
            if (!b.getClientRects().length || (b as HTMLButtonElement).disabled) return;
            if (b.matches('.btn-danger, .btn-danger-ghost') || getComputedStyle(b).color === rosso) { b.setAttribute('data-sonda-pericolo', ''); n++; }
          });
          return n;
        });
        for (let i = 0; i < n; i++) {
          const b = page.locator('[data-sonda-pericolo]').nth(i);
          const nome = (await b.evaluate(e => e.getAttribute('aria-label') || e.textContent!.trim().slice(0, 30) || e.id)) || '?';
          trovati.add(`${s.nome}: ${nome}`);
          if (!(await b.isVisible()) || !(await b.evaluate(e => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }))) continue;
          for (const stato of ['riposo', 'hover'] as const) {
            if (stato === 'hover') { await b.hover().catch(() => {}); await page.waitForTimeout(60); }
            await b.evaluate(e => e.setAttribute('data-sonda-hover', ''));
            const v = await page.evaluate(scansiona, { radiceSel: '[data-sonda-hover]', modo: 'testo' as const });
            await b.evaluate(e => e.removeAttribute('data-sonda-hover'));
            problemi.push(...v.map(x => `${tema} · ${s.nome} · «${nome}» ${stato}: ${x.fg} su ${x.bg} = ${x.ratio}:1`));
          }
          await page.mouse.move(0, 0);
          // Fuoco da tastiera: Tab porta in modalità :focus-visible, poi il fuoco sul pulsante.
          await page.keyboard.press('Shift');
          await b.evaluate(e => (e as HTMLElement).focus({ focusVisible: true } as any));
          const anello = await b.evaluate(e => {
            const st = getComputedStyle(e);
            return e.matches(':focus-visible') && ((st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) >= 1) || st.boxShadow !== 'none');
          });
          if (!anello) problemi.push(`${tema} · ${s.nome} · «${nome}» senza anello di fuoco`);
        }
        await page.evaluate((sel) => document.querySelectorAll(sel).forEach(e => e.removeAttribute('data-sonda-pericolo')), PERICOLO);
        await s.chiudi();
        await page.waitForTimeout(100);
      }
    }
    console.log('[M6.8] pulsanti di pericolo provati:\n  ' + [...trovati].join('\n  '));
    expect(trovati.size, 'nessun pulsante di pericolo trovato').toBeGreaterThan(0);
    expect([...new Set(problemi)]).toEqual([]);
  });

  // M7.3 approssimata: contrasto elevato di Windows = forced-colors. I fondi e i box-shadow
  // spariscono: fuoco e selezione devono reggersi su outline, bordi o testo.
  test('M7.3 — contrasto elevato: fuoco e scheda selezionata ancora visibili', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Contrasto');
    await seedItems(page, 3);
    await page.emulateMedia({ forcedColors: 'active' });
    await openView(page, 'list');
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    // Fuoco: i primi 25 Tab, ogni elemento a fuoco ha un outline (il box-shadow qui non si vede).
    const senzaAnello: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement;
        if (!e || e === document.body) return null;
        const st = getComputedStyle(e);
        const ok = st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) >= 1;
        return ok ? null : (e.id || e.getAttribute('aria-label') || e.tagName + ' ' + (e.textContent || '').trim().slice(0, 25));
      });
      if (r) senzaAnello.push(r);
    }
    expect.soft([...new Set(senzaAnello)], 'elementi senza outline di fuoco in forced-colors').toEqual([]);

    // Selezione: la stessa card, fotografata prima e dopo, deve cambiare a schermo anche quando
    // il forced-colors cancella fondi e ring (box-shadow).
    await page.keyboard.press('Escape');
    await page.mouse.move(0, 0);
    // @ts-ignore -- appData è una let globale
    const id = await page.evaluate(() => appData.manoscritti[1].id);
    const card = page.locator(`#card-${id}`);
    const prima = await card.screenshot({ animations: 'disabled' });
    await page.evaluate((rid) => { (window as any).selectedRecords = [rid]; (window as any).renderMain(); }, id);
    await page.mouse.move(0, 0);
    const dopo = await page.locator(`#card-${id}`).screenshot({ animations: 'disabled' });
    expect.soft(Buffer.compare(prima, dopo), 'la card selezionata è identica a quella non selezionata').not.toBe(0);
  });
});
