import { test, expect, launchApp, closeApp, stubDialog } from './fixtures';
import { createLocalWorkspace, createItemWithAttachment, seedItems, openView, openSidebarPanel } from './helpers';
import { scansiona, TEMI } from './contrasto';
import type { Page } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const fixture = (f: string) => path.join(__dirname, 'fixtures', f);
const w = (page: Page, f: string, ...args: unknown[]) =>
  page.evaluate(([f, args]) => (window as any)[f as string](...(args as unknown[])), [f, args] as const);

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
      // @ts-ignore
      const m = appData.manoscritti.find((x: any) => x.id === rid);
      m.trascrizione = `<p>prova</p><img src="file://${ip}/E$/x.png"><img src="file:////${ip}/E$/y.png">`;
      await (window as any).Store.commit();
    }, [id, ip!] as const);

    await w(page, 'editItem', id);
    await w(page, 'apriTrascrizione', id);
    await expect(page.locator('#trascrizione-editor')).toContainText('prova');
    expect(await page.locator('#trascrizione-editor img').evaluateAll(els => els.filter(e => (e as HTMLImageElement).src).length)).toBe(0);
    await page.waitForTimeout(2000);
    expect(connessioniSmb(ip!), `connessioni verso ${ip}:445`).toEqual([]);

    fs.existsSync(`\\\\${ip}\\C$`);
    expect(connessioniSmb(ip!).length, 'controprova: netstat vede SMB').toBeGreaterThan(0);
  });

  test('M4.1/M4.2 — archivio e cartella allegati su un percorso di rete', async ({ page, electronApp, userDataDir }) => {
    const unc = (p: string) => '\\\\' + os.hostname() + '\\' + p[0] + '$' + p.slice(2);
    test.skip(!!process.env.CI, 'sul runner la condivisione D$ in loopback blocca il main process');
    test.skip(process.platform !== 'win32' || !fs.existsSync(unc(userDataDir)), 'condivisione amministrativa non raggiungibile');
    const base = unc(path.join(userDataDir, 'nas'));
    fs.mkdirSync(base, { recursive: true });

    const ws = await createLocalWorkspace(page, base, 'Nas');
    expect(ws.startsWith('\\\\')).toBe(true);
    await createItemWithAttachment(page, 'NAS-IMG', fixture('sample.png'));
    await createItemWithAttachment(page, 'NAS-PDF', fixture('multipage.pdf'));
    expect(fs.existsSync(path.join(ws, 'allegati_manoscritti'))).toBe(true);

    // @ts-ignore
    await w(page, 'apriTrascrizione', await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'NAS-IMG').id));
    await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll<HTMLImageElement>('#view-trascrizione img'))
      .filter(i => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
    await w(page, 'confermaUscitaTrascrizione');
    // @ts-ignore
    const pdf = await page.evaluate(() => appData.manoscritti.find((m: any) => m.segnatura === 'NAS-PDF').allegati[0].nome);
    expect((await page.evaluate((n) => (window as any).apiBrowser.pdfAllegatoInfo(n), pdf)).ok).toBe(true);

    const altrove = unc(path.join(userDataDir, 'nas', 'allegati-altrove'));
    fs.mkdirSync(altrove);
    await stubDialog(electronApp, { canceled: false, filePaths: [altrove] });
    expect(await page.evaluate(() => (window as any).apiSettings.scegliCartellaAllegati('Titolo'))).toBe(altrove);
    await createItemWithAttachment(page, 'NAS-ALTROVE', fixture('sample.png'));
    expect(fs.readdirSync(altrove).length).toBeGreaterThan(0);
    await page.evaluate(() => (window as any).apiSettings.ripristinaCartellaAllegati());
    expect(path.dirname(await page.evaluate(() => (window as any).apiBrowser.getAllegatoPath('x'))))
      .toBe(path.join(ws, 'allegati_manoscritti'));

    await expect.poll(() => fs.readFileSync(path.join(ws, 'database_manoscritti.json'), 'utf8'), { timeout: 10_000 }).toContain('NAS-ALTROVE');
    await closeApp(electronApp);
    const { app, page: p2 } = await launchApp(userDataDir);
    try {
      await p2.waitForFunction(() => (window as any).__appPronta === true, null, { timeout: 20_000 });
      // @ts-ignore
      expect(await p2.evaluate(() => appData.manoscritti.map((m: any) => m.segnatura).sort())).toEqual(['NAS-ALTROVE', 'NAS-IMG', 'NAS-PDF']);
    } finally {
      await closeApp(app);
    }
  });

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

    // @ts-ignore
    const id = await page.evaluate(() => appData.manoscritti[0].id);
    await w(page, 'apriTrascrizione', id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    expect(await tagliati('#view-trascrizione button')).toEqual([]);
    await w(page, 'confermaUscitaTrascrizione');

    await w(page, 'apriImpostazioni');
    const modale = page.locator('#settings-modal .modal-window');
    await expect(modale).toBeVisible();
    const g = await modale.evaluate((m) => { const r = m.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
    expect(g.top).toBeGreaterThanOrEqual(0);
    expect(g.left).toBeGreaterThanOrEqual(0);
    expect(g.bottom).toBeLessThanOrEqual(await page.evaluate(() => innerHeight) + 1);
    expect(g.right).toBeLessThanOrEqual(await page.evaluate(() => innerWidth) + 1);
  });

  test('M6.8 — pulsanti di pericolo leggibili in hover e col fuoco visibile, nei 4 temi', async ({ page, userDataDir }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Pericolo');
    await seedItems(page, 3, { tagPrefix: 'notarile' });
    // @ts-ignore
    await w(page, 'deleteItem', await page.evaluate(() => appData.manoscritti[0].id));
    await w(page, 'confermaEliminazione');

    const schermate: { nome: string; apri: () => Promise<unknown>; chiudi: () => Promise<unknown> }[] = [
      { nome: 'cestino', apri: () => w(page, 'apriCestino'), chiudi: () => page.keyboard.press('Escape') },
      { nome: 'tag', apri: () => w(page, 'apriGestioneTag'), chiudi: () => page.keyboard.press('Escape') },
      { nome: 'vocabolari', apri: () => w(page, 'apriVocabolari'), chiudi: () => page.keyboard.press('Escape') },
      { nome: 'impostazioni', apri: () => w(page, 'apriImpostazioni'), chiudi: () => w(page, 'chiudiImpostazioni') },
      { nome: 'cloud', apri: () => w(page, 'apriCloudModal'), chiudi: () => page.keyboard.press('Escape') },
      // @ts-ignore
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

  test('M7.3 — contrasto elevato: fuoco e scheda selezionata ancora visibili', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Contrasto');
    await seedItems(page, 3);
    await page.emulateMedia({ forcedColors: 'active' });
    await openView(page, 'list');
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

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

    await page.keyboard.press('Escape');
    await page.mouse.move(0, 0);
    // @ts-ignore
    const id = await page.evaluate(() => appData.manoscritti[1].id);
    const card = page.locator(`#card-${id}`);
    const prima = await card.screenshot({ animations: 'disabled' });
    await page.evaluate((rid) => { (window as any).selectedRecords = [rid]; (window as any).renderMain(); }, id);
    await page.mouse.move(0, 0);
    const dopo = await page.locator(`#card-${id}`).screenshot({ animations: 'disabled' });
    expect.soft(Buffer.compare(prima, dopo), 'la card selezionata è identica a quella non selezionata').not.toBe(0);
  });

  test('M16.2 — X sulla welcome al primo avvio: l\'app si chiude', async ({ electronApp, page }) => {
    await expect(page.locator('#welcome-modal')).toBeVisible();
    await page.waitForFunction(() => (window as any).__appPronta === true);
    const uscita = new Promise<number | null>(r => electronApp.process().once('exit', c => r(c)));
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    expect(await Promise.race([uscita, new Promise(r => setTimeout(() => r('ancora aperta'), 10_000))])).toBe(0);
  });

  test('M16.4 — login lasciato a metà: messaggio dopo 5 minuti, porta 3456 libera, secondo login riparte', async ({ page, electronApp }) => {
    test.skip(!process.env.ARCHIVIEW_E2E_LUNGHE, '5 minuti di attesa: ARCHIVIEW_E2E_LUNGHE=1');
    test.setTimeout(8 * 60_000);
    const portaLibera = () => new Promise<boolean>(r => {
      const s = require('net').createServer().once('error', () => r(false)).listen(3456, '127.0.0.1', () => s.close(() => r(true)));
    });
    await electronApp.evaluate(({ shell }) => {
      (globalThis as any).aperture = [];
      shell.openExternal = async (u: string) => { (globalThis as any).aperture.push(u); };
    });
    await expect(page.locator('#welcome-modal')).toBeVisible();
    await page.waitForFunction(() => (window as any).__appPronta === true);
    const inizio = Date.now();
    await page.evaluate(() => { (window as any).mostraCloudExplorer(); });
    await expect.poll(() => electronApp.evaluate(() => (globalThis as any).aperture.length)).toBe(1);
    expect(await electronApp.evaluate(() => (globalThis as any).aperture[0])).toContain('accounts.google.com');
    expect(await portaLibera()).toBe(false);
    await expect(page.locator('#toast-container').getByText('entro 5 minuti')).toBeVisible({ timeout: 6 * 60_000 });
    expect(Date.now() - inizio).toBeGreaterThan(5 * 60_000 - 5_000);
    expect(await portaLibera()).toBe(true);
    await page.evaluate(() => { (window as any).mostraCloudExplorer(); });
    await expect.poll(() => electronApp.evaluate(() => (globalThis as any).aperture.length)).toBe(2);
    expect(await portaLibera()).toBe(false);
  });

  test('M16.8 — lingua OCR scaricata davvero da tessdata e usata per riconoscere una pagina', async ({ page, userDataDir }) => {
    test.setTimeout(6 * 60_000);
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'OcrVera');
    const png = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-m168-')), 'pagina.png');
    const dati = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1600; c.height = 400;
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#000'; g.font = '64px Georgia, serif';
      g.fillText('Archivio dei manoscritti', 60, 150);
      g.fillText('della biblioteca di Firenze', 60, 280);
      return c.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync(png, Buffer.from(dati, 'base64'));
    const esito = await page.evaluate(() => (window as any).apiOcr.installaLingua('ita'));
    expect(esito.ok, JSON.stringify(esito)).toBe(true);
    const traineddata = path.join(userDataDir, 'ocr-langs', 'ita.traineddata');
    expect(fs.statSync(traineddata).size).toBeGreaterThan(1_000_000);
    const lingue = await page.evaluate(() => (window as any).apiOcr.lingue());
    expect(lingue.lingue.find((l: any) => l.codice === 'ita').installata).toBe(true);

    const id = await createItemWithAttachment(page, 'OCR-VERA', png);
    await page.evaluate((rid) => (window as any).apriOcrModal(rid, 0), id);
    await expect(page.locator('#ocr-confirm')).toBeEnabled();
    await page.locator('#ocr-dest-indice').setChecked(true);
    await page.locator('#ocr-confirm').click();
    await expect(page.locator('#ocr-result')).toBeVisible({ timeout: 120_000 });
    const testo = await page.evaluate((rid) => {
      // @ts-ignore
      return appData.manoscritti.find((m: any) => m.id === rid).allegati[0].ocr?.testo || '';
    }, id);
    console.log('[M16.8] testo riconosciuto:', JSON.stringify(testo));
    expect(testo).toMatch(/manoscritti/i);
    expect(testo).toMatch(/Firenze/i);
  });

  test('M16.9 — incolla da Word vero: restano paragrafi, grassetto, corsivo, elenchi; spariscono stili e immagine', async ({ page, electronApp, userDataDir }) => {
    test.skip(process.platform !== 'win32' || !process.env.ARCHIVIEW_E2E_LUNGHE, 'Word via COM e appunti di sistema condivisi: ARCHIVIEW_E2E_LUNGHE=1, da sola');
    test.setTimeout(3 * 60_000);
    const segnale = path.join(userDataDir, 'word');
    fs.mkdirSync(segnale);
    const ps1 = path.join(segnale, 'copia.ps1');
    fs.writeFileSync(ps1, [
      '$ErrorActionPreference = "Stop"',
      '$w = New-Object -ComObject Word.Application',
      '$w.Visible = $false',
      '$w.DisplayAlerts = 0',
      'try {',
      '  $d = $w.Documents.Add()',
      '  $s = $w.Selection',
      '  $s.Style = $d.Styles.Item(-2)',
      '  $s.TypeText("Titolo del fondo")',
      '  $s.TypeParagraph()',
      '  $s.Style = $d.Styles.Item(-1)',
      '  $s.Font.Name = "Calibri"; $s.Font.Color = 255',
      '  $s.TypeText("Item ")',
      '  $s.Font.Bold = 1; $s.TypeText("die"); $s.Font.Bold = 0',
      '  $s.TypeText(" ")',
      '  $s.Font.Italic = 1; $s.TypeText("predicto"); $s.Font.Italic = 0',
      '  $s.TypeText(" anno domini ")',
      `  $null = $s.InlineShapes.AddPicture("${fixture('sample.png')}")`,
      '  $s.TypeParagraph()',
      '  $s.Range.ListFormat.ApplyBulletDefault()',
      '  $s.TypeText("primo")',
      '  $s.TypeParagraph()',
      '  $s.TypeText("secondo")',
      '  $d.Content.Copy()',
      'Add-Type -AssemblyName System.Windows.Forms',
      `[System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::Html) | Set-Content -Encoding utf8 "${path.join(segnale, 'appunti.html')}"`,
      `  New-Item -ItemType File "${path.join(segnale, 'copiato')}" | Out-Null`,
      `  $t = 0; while (-not (Test-Path "${path.join(segnale, 'fatto')}") -and $t -lt 120) { Start-Sleep -Milliseconds 500; $t++ }`,
      '  $d.Close([ref]0)',
      '} finally { $w.Quit([ref]0) }',
    ].join('\r\n'));
    const word = require('child_process').spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], { stdio: 'inherit' });
    try {
      await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Word');
      const id = await createItemWithAttachment(page, 'MS-WORD', fixture('sample.png'));
      await page.evaluate((rid) => (window as any).apriTrascrizione(rid), id);
      await expect(page.locator('#view-trascrizione')).toBeVisible();
      await expect.poll(() => fs.existsSync(path.join(segnale, 'copiato')), { timeout: 90_000 }).toBe(true);
      const sorgente = fs.readFileSync(path.join(segnale, 'appunti.html'), 'utf8');
      expect(sorgente, 'negli appunti c\'è l\'HTML di Word').toMatch(/urn:schemas-microsoft-com:office|mso-/);
      await page.locator('#trascrizione-editor').click();
      await page.keyboard.press('Control+V');
      await expect(page.locator('#trascrizione-editor')).toContainText('secondo');
      const html = await page.locator('#trascrizione-editor').evaluate((el) => el.innerHTML);
      console.log('[M16.9] HTML incollato:', html);
      expect(html).toContain('Titolo del fondo');
      expect(html).toMatch(/<(b|strong)>die<\/(b|strong)>/);
      expect(html).toMatch(/<(i|em)>predicto<\/(i|em)>/);
      expect(html).toMatch(/<li>[^<]*primo/);
      expect(html).toMatch(/<li>[^<]*secondo/);
      expect(html).not.toMatch(/style=|class=|<img|<span|<o:p|mso-|data:/);
    } finally {
      fs.writeFileSync(path.join(segnale, 'fatto'), '');
      if (word.exitCode === null) await new Promise(r => word.once('exit', r));
    }
  });
});
