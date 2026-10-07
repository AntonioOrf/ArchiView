import * as path from 'path';
import { pathToFileURL } from 'url';
import { test, expect } from './fixtures';

test.describe('Security Regression Tests', () => {

  test('CSP senza unsafe-inline: nessun handler inline nel DOM e nessuna violazione', async ({ page, electronApp, userDataDir }) => {
    test.setTimeout(120_000);
    // La policy stessa: se qualcuno rimette 'unsafe-inline' fra gli script, qui si vede.
    const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content') || '');
    const scriptSrc = (/script-src([^;]*)/.exec(csp) || [])[1] || '';
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');

    // Chromium segnala un on*="" bloccato solo quando l'evento scatta: il controllo forte è
    // che nel DOM non ne resti nessuno, schermata per schermata.
    const inline = (dove: string) => page.evaluate((dove) => {
      const out: string[] = [];
      document.querySelectorAll('*').forEach(el => {
        for (const a of Array.from(el.attributes)) {
          if (/^on[a-z]+$/.test(a.name)) out.push(`${dove} · <${el.tagName.toLowerCase()} ${a.name}="${a.value.slice(0, 60)}">`);
        }
      });
      return out;
    }, dove);

    const { createLocalWorkspace, seedItems, openSidebarPanel, openView } = await import('./helpers');
    const { preparaSchermateSecondarie, modaliAperti } = await import('./a11ySchermate');
    const path = await import('path');
    const trovati: string[] = [...await inline('benvenuto')];
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Csp');
    // Dopo la creazione: aprire il workspace ricarica la finestra.
    await page.evaluate(() => {
      (window as any).__violazioniCsp = [];
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as any).__violazioniCsp.push(`${e.violatedDirective} · ${e.blockedURI} · ${e.sample}`));
    });
    const secondarie = await preparaSchermateSecondarie(page, electronApp, userDataDir);
    await seedItems(page, 3, { tagPrefix: 't' });
    await page.evaluate(() => (window as any).renderMain());

    trovati.push(...await inline('griglia'));
    await page.evaluate(() => (window as any).cambiaVistaLista('tabella'));
    trovati.push(...await inline('tabella'));
    await page.evaluate(() => (window as any).cambiaVistaLista('griglia'));
    for (const p of ['search', 'tags', 'history', 'folders'] as const) {
      await openSidebarPanel(page, p);
      trovati.push(...await inline('sidebar-' + p));
    }
    await openView(page, 'add');
    trovati.push(...await inline('form'));
    await openView(page, 'list');
    for (const f of ['apriImpostazioni', 'apriCloudModal', 'apriGestioneTag', 'apriNewTypeModal', 'apriCestino']) {
      await page.evaluate((f) => (window as any)[f](), f);
      await expect.poll(() => modaliAperti(page)).toBe(1);
      trovati.push(...await inline(f));
      await page.keyboard.press('Escape');
      await expect.poll(() => modaliAperti(page)).toBe(0);
    }
    for (const s of secondarie) {
      await s.apri();
      trovati.push(...await inline(s.nome));
      await s.chiudi();
    }
    // @ts-ignore -- `appData` è una `let` globale (script classico), non window.appData.
    const id = await page.evaluate(() => appData.manoscritti[0].id);
    await page.evaluate((id) => (window as any).apriTrascrizione(id), id);
    await expect(page.locator('#trascrizione-editor')).toBeVisible();
    trovati.push(...await inline('trascrizione'));

    expect([...new Set(trovati)], 'attributi on* rimasti nel DOM').toEqual([]);
    expect(await page.evaluate(() => (window as any).__violazioniCsp), 'violazioni CSP').toEqual([]);
  });

  test('cloneWorkspaceHub IPC deve bloccare i tentativi di directory traversal', async ({ page, userDataDir }) => {
    // Usiamo il preload apiBrowser per simulare una chiamata malevola dal renderer
    // Tentiamo di fargli scrivere fuori dalla directory consentita (userDataDir)
    const result = await page.evaluate(async (basePath) => {
      const api = (window as any).apiBrowser;
      if (!api || !api.cloneWorkspaceHub) {
        return 'API non disponibile';
      }
      try {
        // Tentativo di path traversal: nome cartella con '../' per evadere dal basePath
        const res = await api.cloneWorkspaceHub(basePath, '../../cartella-malevola', {}, {});
        return res; // Ci aspettiamo che ritorni false grazie alla mitigazione introdotta
      } catch (e: any) {
        return e.message;
      }
    }, userDataDir);

    // Deve ritornare false (azione bloccata dal controllo newPath.startsWith)
    expect(result).toBe(false);
  });

  test('DOMPurify deve neutralizzare i payload HTML/JS malevoli (XSS)', async ({ page }) => {
    let xssFired = false;
    page.on('console', msg => { 
      if (msg.text() === 'XSS-PAYLOAD-TRIGGERED') xssFired = true; 
    });

    // Testiamo la VERA barriera protettiva dell'app: il sistema di sanitizzazione.
    // Simuliamo che un dato compromesso (proveniente dal DB o dall'Hub) arrivi alla vista.
    const resultHtml = await page.evaluate(() => {
        const payload = '<img src="x" onerror="console.log(\'XSS-PAYLOAD-TRIGGERED\')"> <b onclick="alert(1)">Test</b>';
        // Se utils.ts / DOMPurify è configurato correttamente, gli attributi 'onerror' e 'onclick' verranno rimossi.
        if (typeof (window as any).sanitizeHTML === 'function') {
            return (window as any).sanitizeHTML(payload);
        }
        return 'sanitizeHTML_non_trovata';
    });

    // Verifichiamo che DOMPurify abbia strappato via l'attributo malevolo
    expect(resultHtml).not.toContain('onerror');
    expect(resultHtml).not.toContain('XSS-PAYLOAD-TRIGGERED');
    expect(resultHtml).not.toContain('onclick');
    expect(xssFired).toBe(false);
  });

  // S8 (REVIEW-SECURITY.md): le chiavi dell'Hub restano nel main.
  test('config Hub: nessuna chiave nel renderer, hubUrl e segreti non riscrivibili da lì', async ({ page, userDataDir }) => {
    const { createLocalWorkspace } = await import('./helpers');
    const path = await import('path');
    const fs = await import('fs');
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'HubChiavi');
    const wsPath = typeof ws === 'string' && fs.existsSync(ws) ? ws : await page.evaluate(() => (window as any).apiBrowser.getWorkspacePath());
    const cfgFile = path.join(wsPath, '.archiview-hub.json');
    // Config legacy con i segreti in chiaro: la prima lettura li sposta nel token store.
    fs.writeFileSync(cfgFile, JSON.stringify({ hubUrl: 'https://hub.example', repoId: 'r1', repoKey: 'CHIAVE-SEGRETA', encKey: 'ENC-SEGRETA', version: 2 }));

    const api = (fn: string, ...args: any[]) => page.evaluate(([f, a]) => (window as any).apiBrowser[f as string](...(a as any[])), [fn, args] as const);
    const letta = await api('loadHubConfig');
    expect(JSON.stringify(letta)).not.toMatch(/SEGRETA/);
    expect(letta).toMatchObject({ hubUrl: 'https://hub.example', repoId: 'r1', hasRepoKey: true, hasEncKey: true, version: 2 });
    expect(fs.readFileSync(cfgFile, 'utf8')).not.toMatch(/SEGRETA/);

    // Il renderer aggiorna lo stato della sync, non la destinazione né le chiavi.
    expect(await api('saveHubConfig', { hubUrl: 'https://evil.example', repoId: 'altro', repoKey: 'X', encKey: 'Y', version: 5, attachmentsMode: 'off' })).toBe(true);
    expect(await api('loadHubConfig')).toMatchObject({ hubUrl: 'https://hub.example', repoId: 'r1', version: 5, attachmentsMode: 'off', hasRepoKey: true });

    // Il clone dal renderer non accetta più una config Hub (il join passa da hub-join nel main).
    expect(await api('cloneWorkspaceHub', userDataDir, 'Clone', { hubUrl: 'https://evil.example', repoId: 'r', repoKey: 'k' }, {})).toBe(false);
    expect(fs.existsSync(path.join(userDataDir, 'Clone'))).toBe(false);

    // Invito con Hub in chiaro verso un host remoto: rifiutato prima di qualsiasi richiesta.
    const invito = Buffer.from('HUB1|http://evil.example|r1|k|e|||x').toString('base64url');
    expect(await api('hubJoin', invito, userDataDir)).toMatchObject({ ok: false, status: 0 });
  });

  // S7 (REVIEW-SECURITY.md): il database arriva all'Hub cifrato e torna in chiaro solo nel client.
  test('Hub: database cifrato sul server, decifrato al pull, downgrade in chiaro rifiutato', async ({ page, userDataDir }) => {
    const { createLocalWorkspace } = await import('./helpers');
    const path = await import('path');
    const fs = await import('fs');
    const http = await import('http');
    const crypto = await import('crypto');
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'HubCifrato');
    const wsPath = typeof ws === 'string' && fs.existsSync(ws) ? ws : await page.evaluate(() => (window as any).apiBrowser.getWorkspacePath());

    // Finto Hub: conserva ciò che riceve, come il Worker vero (versioni append-only).
    const versioni: any[] = [{ manoscritti: [] }];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const send = (code: number, obj: any) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
        if (req.headers.authorization !== 'Bearer CHIAVE-R1') return send(401, { error: 'no' });
        const url = new URL(req.url!, 'http://x');
        const cur = versioni.length - 1;
        if (url.pathname === '/api/repos/r1/push' && req.method === 'POST') {
          const b = JSON.parse(body);
          if (b.parentVersion !== cur) return send(409, { error: 'conflitto' });
          versioni.push(b.database);
          return send(200, { version: cur + 1 });
        }
        if (url.pathname === '/api/repos/r1/pull') return send(200, { version: cur, database: versioni[cur] });
        const m = /^\/api\/repos\/r1\/versions\/(\d+)$/.exec(url.pathname);
        if (m) return send(200, { version: Number(m[1]), database: versioni[Number(m[1])] });
        send(404, {});
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    try {
      const hubUrl = `http://127.0.0.1:${(server.address() as any).port}`;
      fs.writeFileSync(path.join(wsPath, '.archiview-hub.json'), JSON.stringify({
        hubUrl, repoId: 'r1', repoKey: 'CHIAVE-R1', encKey: crypto.randomBytes(32).toString('base64url'), version: 0
      }));
      const api = (fn: string, ...args: any[]) => page.evaluate(([f, a]) => (window as any).apiBrowser[f as string](...(a as any[])), [fn, args] as const);

      const db = { nomeArchivio: 'Fondo', manoscritti: [{ id: 'm1', trascrizione: 'testo-riservato-123' }] };
      const push = await api('hubPush', 0, db);
      expect(push).toMatchObject({ ok: true, data: { version: 1 } });
      expect(JSON.stringify(versioni[1])).not.toContain('testo-riservato-123');
      expect(versioni[1]).toHaveProperty('archiviewCifrato', 1);

      const pull = await api('hubPull');
      expect(pull.ok).toBe(true);
      expect(pull.data).toMatchObject({ version: 1, database: db });

      // Lo snapshot pre-cifratura (v0, in chiaro) resta consultabile nella cronologia.
      expect(await api('hubVersion', 0)).toMatchObject({ ok: true, data: { database: { manoscritti: [] } } });

      // Il server (o un client vecchio) rimette in chiaro la versione corrente: rifiutata.
      versioni.push({ manoscritti: [{ id: 'm1', trascrizione: 'contenuto iniettato' }] });
      const downgrade = await api('hubPull');
      expect(downgrade.ok).toBe(false);
      expect(JSON.stringify(downgrade)).not.toContain('iniettato');

      // Rollback: il server ripresenta la busta della v1 come se fosse la v3. AAD diversa → rifiutata.
      versioni.push(versioni[1]);
      expect((await api('hubPull')).ok).toBe(false);
    } finally {
      server.close();
    }
  });

  // S6 (REVIEW-SECURITY.md): realtime Hub su canale privato. SDK locale sotto CSP, firma
  // chiesta dal main con la repoKey, notifica = solo controllo, il proprio push non è una novità.
  test('realtime Hub: SDK locale, iscrizione autorizzata dal main, evento → solo controllo', async ({ page, userDataDir }) => {
    const { createLocalWorkspace } = await import('./helpers');
    const path = await import('path');
    const fs = await import('fs');
    const http = await import('http');
    const ws = await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'HubRealtime');
    const wsPath = typeof ws === 'string' && fs.existsSync(ws) ? ws : await page.evaluate(() => (window as any).apiBrowser.getWorkspacePath());

    const richieste: any[] = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        richieste.push({ url: req.url, auth: req.headers.authorization, body });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ auth: 'chiave-pusher:firma-di-prova' }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    try {
      const hubUrl = `http://127.0.0.1:${(server.address() as any).port}`;
      fs.writeFileSync(path.join(wsPath, '.archiview-hub.json'), JSON.stringify({
        hubUrl, repoId: 'repo_rt', repoKey: 'CHIAVE-RT', version: 3, pusherKey: 'chiave-pusher', pusherCluster: 'eu'
      }));
      const violazioni: string[] = [];
      await page.exposeFunction('segnalaCsp', (v: string) => { violazioni.push(v); });
      await page.evaluate(() => document.addEventListener('securitypolicyviolation',
        (e) => (window as any).segnalaCsp(`${e.violatedDirective} ${e.blockedURI}`)));

      // Avvio come all'apertura del vault: config pubblica, poi autofetch + realtime.
      await page.evaluate(async () => {
        const w = window as any;
        w.hubConfig = await w.apiBrowser.loadHubConfig();
        await w.avviaRealtimeHub();
      });
      expect(await page.evaluate(() => typeof (window as any).Pusher === 'function')).toBe(true);
      const src = await page.evaluate(() => Array.from(document.scripts).map((s) => s.src).filter((s) => /pusher/i.test(s)));
      expect(src.length).toBeGreaterThan(0);
      for (const s of src) expect(s).not.toMatch(/^https?:/);
      // L5: il renderer non fa più fetch (le chiamate cloud sono nel main): solo il WebSocket Pusher.
      const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content') || '');
      expect((/connect-src([^;]*)/.exec(csp) || [])[1].trim()).toBe("'self' wss://*.pusher.com");
      expect(csp).not.toContain('js.pusher.com');

      // Il main valida prima di chiamare il Worker: né canali altrui né socket id strani partono.
      const auth = (socketId: string, channel: string) => page.evaluate(([s, c]) => (window as any).apiBrowser.hubRealtimeAuth(s, c), [socketId, channel]);
      expect(await auth('1.2', 'private-repo-altro')).toMatchObject({ ok: false, status: 0 });
      expect(await auth('1.2:x', 'private-repo-repo_rt')).toMatchObject({ ok: false, status: 0 });
      expect(richieste.length).toBe(0);

      // Percorso completo dell'SDK: channelAuthorizer → customHandler → IPC → main → Worker.
      const firma = await page.evaluate(() => new Promise((resolve) => {
        (window as any).pusherInstance.config.channelAuthorizer(
          { socketId: '123.456', channelName: 'private-repo-repo_rt' }, (err: any, data: any) => resolve({ err: err && String(err), data }));
      }));
      expect(firma).toEqual({ err: null, data: { auth: 'chiave-pusher:firma-di-prova' } });
      expect(richieste).toHaveLength(1);
      expect(richieste[0].url).toBe('/api/repos/repo_rt/realtime-auth');
      expect(richieste[0].auth).toBe('Bearer CHIAVE-RT');
      expect(JSON.parse(richieste[0].body)).toEqual({ socketId: '123.456', channel: 'private-repo-repo_rt' });
      expect(await page.evaluate(() => JSON.stringify((window as any).hubConfig))).not.toContain('CHIAVE-RT');

      // Evento: versione già nota → niente; più recente → solo il controllo (nessun merge).
      const chiamate = await page.evaluate(async () => {
        const w = window as any;
        let n = 0;
        w.controllaModificheHub = async () => { n++; };
        const ch = w.pusherInstance.channel('private-repo-repo_rt');
        ch.emit('hub-updated', { version: 3 });
        await new Promise((r) => setTimeout(r, 50));
        const dopoVecchia = n;
        ch.emit('hub-updated', { version: 4 });
        await new Promise((r) => setTimeout(r, 50));
        return [dopoVecchia, n];
      });
      expect(chiamate).toEqual([0, 1]);

      // Il proprio push: l'evento arriva prima della risposta, ma non diventa una novità.
      const proprio = await page.evaluate(async () => {
        const w = window as any;
        let n = 0;
        w.controllaModificheHub = async () => { n++; };
        let risolvi: any;
        w.hubPushInCorso = new Promise((r) => { risolvi = r; });
        w.pusherInstance.channel('private-repo-repo_rt').emit('hub-updated', { version: 5 });
        await new Promise((r) => setTimeout(r, 50));
        w.hubConfig.version = 5; risolvi(); w.hubPushInCorso = null;
        await new Promise((r) => setTimeout(r, 50));
        return n;
      });
      expect(proprio).toBe(0);

      await page.evaluate(() => (window as any).pusherInstance && (window as any).pusherInstance.disconnect());
      expect(violazioni.filter((v) => !/^img-src/.test(v))).toEqual([]);
    } finally {
      server.close();
    }
  });

  // S4 (REVIEW-SECURITY.md): l'id della scheda arriva dal vault e finiva nel percorso di copia.
  test('salva-allegato: id ostile resta nella cartella allegati, file interni non allegabili', async ({ page, userDataDir }) => {
    const { createLocalWorkspace } = await import('./helpers');
    const path = await import('path');
    const fs = await import('fs');
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Allegati');
    const png = path.join(__dirname, 'fixtures', 'sample.png');

    for (const id of ['..\\..\\..\\Desktop\\x', '../../fuori', 'C:\\Windows\\Temp\\x', 'a/b']) {
      const r = await page.evaluate(([p, i]) => (window as any).apiBrowser.salvaAllegato(p, i), [png, id]);
      expect(r, `id ${id}`).toBeTruthy();
      expect(r.fileName).not.toMatch(/[\\/]|\.\./);
      const dir = await page.evaluate(() => (window as any).apiBrowser.getAllegatoPath('x'));
      expect(fs.existsSync(path.join(path.dirname(dir), r.fileName))).toBe(true);
    }

    // Un file dei dati dell'app (userData, fuori dal workspace aperto) non si copia fra gli allegati.
    const interno = path.join(userDataDir, 'segreto-di-prova.json');
    fs.writeFileSync(interno, '{"token":"x"}');
    expect(await page.evaluate((p) => (window as any).apiBrowser.salvaAllegato(p, 'id1'), interno)).toBeNull();
    // Percorso relativo: rifiutato
    expect(await page.evaluate(() => (window as any).apiBrowser.salvaAllegato('sample.png', 'id1'))).toBeNull();
  });

  // Visualizzatore PDF: il renderer legge byte dal main. Solo PDF della cartella allegati,
  // solo intervalli sensati, mai un file intero in una richiesta.
  test('pdf-allegato-*: niente traversal, niente non-PDF, intervalli limitati', async ({ page, userDataDir }) => {
    const { createLocalWorkspace } = await import('./helpers');
    const path = await import('path');
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'PdfIpc');
    const pdf = path.join(__dirname, 'fixtures', 'multipage.pdf');
    const png = path.join(__dirname, 'fixtures', 'sample.png');
    const rPdf = await page.evaluate(([p]) => (window as any).apiBrowser.salvaAllegato(p, 'id1'), [pdf]);
    const rPng = await page.evaluate(([p]) => (window as any).apiBrowser.salvaAllegato(p, 'id2'), [png]);

    const api = (metodo: string, ...args: any[]) =>
      page.evaluate(([m, a]) => (window as any).apiBrowser[m](...a), [metodo, args] as [string, any[]]);

    const info = await api('pdfAllegatoInfo', rPdf.fileName);
    expect(info.ok).toBe(true);
    expect(info.dimensione).toBeGreaterThan(1000);
    const intervallo = await api('pdfAllegatoIntervallo', rPdf.fileName, 0, 5);
    expect(intervallo.ok).toBe(true);
    expect(Buffer.from(intervallo.dati).toString('latin1')).toBe('%PDF-');

    // Un'immagine è un allegato, ma questa API non la legge.
    expect((await api('pdfAllegatoInfo', rPng.fileName)).ok).toBe(false);
    // Il percorso si riduce al nome: fuori dalla cartella allegati non si esce.
    expect((await api('pdfAllegatoInfo', '..\\..\\' + rPdf.fileName)).ok).toBe(true);
    expect((await api('pdfAllegatoInfo', 'C:\\Windows\\win.ini')).ok).toBe(false);
    for (const [a, b] of [[-1, 10], [10, 5], [0, 64 * 1024 * 1024], [0.5, 10], ['0', 10]]) {
      expect((await api('pdfAllegatoIntervallo', rPdf.fileName, a, b)).ok, `intervallo ${a}-${b}`).toBe(false);
    }
  });

  // S2 (REVIEW-SECURITY.md): un data-on-* in un HTML condiviso non deve diventare un comando.
  test('una trascrizione con data-on-* non chiama funzioni (sanitize, registro, editor)', async ({ page, userDataDir }) => {
    const { createLocalWorkspace, seedItems } = await import('./helpers');
    const path = await import('path');
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Azioni');
    const [id] = await seedItems(page, 1);

    // Spie al posto di una funzione distruttiva (fuori registro) e di una del registro.
    await page.evaluate(() => {
      const w = window as any;
      w.__chiamate = [];
      w.svuotaCestino = () => w.__chiamate.push('svuotaCestino');
      w.apriCestino = () => w.__chiamate.push('apriCestino');
    });

    // 1. Sanitize: il payload salvato nella scheda arriva nell'editor senza attributi d'azione.
    await page.evaluate(async (recId) => {
      // @ts-ignore -- `appData` è una `let` globale (script classico)
      const m = appData.manoscritti.find((x: any) => x.id === recId);
      m.trascrizione = '<p id="ostile" data-on-mousedown="svuotaCestino" data-on-click="apriCestino" data-args-click="[1]" '
        + 'style="position:fixed;inset:0;z-index:99999;opacity:0">x</p><p>Incipit</p>';
      await (window as any).Store.commit();
      (window as any).apriTrascrizione(recId);
    }, id);
    await expect(page.locator('#view-trascrizione')).toBeVisible();
    await expect(page.locator('#trascrizione-editor')).toContainText('Incipit');
    const residui = await page.locator('#trascrizione-editor [data-on-mousedown], #trascrizione-editor [data-on-click], #trascrizione-editor [data-args-click]').count();
    expect(residui).toBe(0);
    await page.mouse.click(300, 300);

    // 2. Editor: anche se un attributo arrivasse nel contenuto per un'altra strada, dentro un
    //    contenteditable non è un comando, nemmeno con un nome del registro.
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.id = 'iniettato-editor';
      p.textContent = 'y';
      p.setAttribute('data-on-click', 'apriCestino');
      document.getElementById('trascrizione-editor')!.appendChild(p);
    });
    await page.locator('#iniettato-editor').dispatchEvent('click');

    // 3. Registro: fuori dall'editor un nome non registrato non si esegue, né diretto né
    //    passando da seEsiste / inSequenza / cliccaElemento.
    await page.evaluate(() => {
      const box = document.createElement('div');
      box.id = 'iniettato-fuori';
      box.innerHTML = [
        '<button id="b1" data-on-click="svuotaCestino">1</button>',
        '<button id="b2" data-on-click="seEsiste" data-args-click="[&quot;svuotaCestino&quot;]">2</button>',
        '<button id="b3" data-on-click="inSequenza" data-args-click="[&quot;svuotaCestino&quot;]">3</button>',
        '<button id="b4" data-on-click="fermaEChiama" data-args-click="[&quot;fetch&quot;,&quot;https://example.invalid&quot;]">4</button>',
        '<button id="b5" data-on-click="cliccaElemento" data-args-click="[&quot;b1&quot;]">5</button>',
      ].join('');
      document.body.appendChild(box);
    });
    for (const b of ['b1', 'b2', 'b3', 'b4', 'b5']) await page.locator('#' + b).dispatchEvent('click');

    expect(await page.evaluate(() => (window as any).__chiamate)).toEqual([]);

    // Controprova: il registro non ha spento le azioni legittime.
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.id = 'legittimo';
      b.textContent = 'ok';
      b.setAttribute('data-on-click', 'apriCestino');
      document.getElementById('iniettato-fuori')!.appendChild(b);
    });
    await page.locator('#legittimo').dispatchEvent('click');
    expect(await page.evaluate(() => (window as any).__chiamate)).toEqual(['apriCestino']);
  });

  // N1 (PIANO-SICUREZZA-OTTIMIZZAZIONE.md): un `file://host/…` in un HTML condiviso fa tentare
  // a Windows una connessione SMB verso host, con l'hash NTLM dell'utente. La CSP non lo ferma
  // (`img-src 'self'` su una pagina file:// copre ogni file:), quindi due difese indipendenti.
  test('file:// verso un host remoto: tolto dal sanitizer e bloccato dal main', async ({ page }) => {
    const pulito = await page.evaluate(() => (window as any).sanitizeHTML(
      '<p><img src="file://192.0.2.1/s/x.png"><img src="FILE:////192.0.2.1/s/y.png">'
      + '<a href="file://192.0.2.1/s/z">z</a><img src="local-asset://ok.png"></p>'));
    expect(pulito).not.toContain('192.0.2.1');
    expect(pulito).toContain('local-asset://ok.png');

    // Rete indipendente dal sanitizer: la richiesta muore subito nel main invece di restare
    // appesa al tentativo SMB (192.0.2.1 è TEST-NET, nessuno risponde).
    for (const src of ['file://192.0.2.1/s/x.png', 'file:////192.0.2.1/s/x.png']) {
      const esito = await page.evaluate((src) => new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => resolve('caricata');
        img.onerror = () => resolve('bloccata');
        setTimeout(() => resolve('in attesa'), 3000);
        img.src = src;
      }), src);
      expect(esito, src).toBe('bloccata');
    }
  });

  // O3: la finestra principale gira su app://archiview, quindi `'self'` non comprende più
  // `file:`. Su file:// un'immagine del disco passava la CSP: un HTML condiviso poteva
  // sondare l'esistenza di file locali (onload/onerror) e rimaneva solo la guardia del main.
  test('origine app://: la CSP non lascia caricare file: nemmeno locali', async ({ page }) => {
    expect(await page.evaluate(() => location.origin)).toBe('app://archiview');
    const src = pathToFileURL(path.resolve(__dirname, 'fixtures', 'sample.png')).href;
    const esito = await page.evaluate((src) => new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => resolve('caricata');
      img.onerror = () => resolve('bloccata');
      setTimeout(() => resolve('in attesa'), 3000);
      img.src = src;
    }), src);
    expect(esito).toBe('bloccata');
  });

  // N3: nessuno script remoto nel renderer (il Picker Google gira nel browser esterno).
  test('nessuno script remoto: CSP senza domini Google, join senza api.js', async ({ page }) => {
    const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content') || '');
    expect((/script-src([^;]*)/.exec(csp) || [])[1].trim()).toBe("'self'");
    expect(csp).not.toMatch(/google\.com/);
    await page.evaluate(() => (window as any).mostraJoinForm());
    const remoti = await page.evaluate(() => Array.from(document.scripts).map((s) => s.src).filter((s) => /^https?:/.test(s)));
    expect(remoti).toEqual([]);
  });

  // N2: le chiavi che decidono quali cartelle il main legge, copia o cestina non arrivano
  // dal renderer. Prima un renderer compromesso le scriveva con save-settings e poi mandava
  // nel cestino una cartella qualsiasi passando da delete-vault-local.
  test('save-settings: percorsi e chiavi del vault non scrivibili dal renderer', async ({ page, electronApp, userDataDir }) => {
    const { createLocalWorkspace } = await import('./helpers');
    const { stubDialog } = await import('./fixtures');
    const path = await import('path');
    const fs = await import('fs');
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Impostazioni');
    const vittima = path.join(userDataDir, 'vittima');
    fs.mkdirSync(vittima, { recursive: true });
    fs.writeFileSync(path.join(vittima, 'database_manoscritti.json'), JSON.stringify({ manoscritti: [], cartelle: [] }));

    const prima = await page.evaluate(() => (window as any).apiSettings.get());
    await page.evaluate(async (v) => {
      const s = await (window as any).apiSettings.get();
      await (window as any).apiSettings.save({
        ...s, lang: 'en', recentWorkspaces: [v], customAttachmentsPath: v, workspacePath: v,
        isSharedVault: true, sharedVaultId: 'cartella-altrui', crossArchiveEsclusi: ['a', 7, 'b']
      });
    }, vittima);
    const dopo = await page.evaluate(() => (window as any).apiSettings.get());
    expect(dopo.lang).toBe('en');
    expect(dopo.recentWorkspaces).toEqual(prima.recentWorkspaces);
    expect(dopo.workspacePath).toBe(prima.workspacePath);
    expect(dopo.customAttachmentsPath).toBeUndefined();
    expect(dopo.crossArchiveEsclusi).toEqual(['a', 'b']);
    expect((await page.evaluate(() => (window as any).apiBrowser.getVaultConfig())).sharedVaultId).not.toBe('cartella-altrui');

    expect((await page.evaluate((v) => (window as any).apiBrowser.deleteVaultLocal(v), vittima)).success).toBe(false);
    expect(fs.existsSync(vittima)).toBe(true);
    const archivi = await page.evaluate(() => (window as any).apiBrowser.crossArchiveArchivi());
    expect(archivi.archivi.map((a: any) => a.nome)).not.toContain('vittima');
    const allegati = await page.evaluate(() => (window as any).apiBrowser.getAllegatoPath('x'));
    expect(path.dirname(allegati)).not.toBe(vittima);

    // La cartella allegati personalizzata passa da un dialogo aperto dal main, e si ripristina.
    const scelta = path.join(userDataDir, 'allegati-altrove');
    fs.mkdirSync(scelta);
    await stubDialog(electronApp, { canceled: false, filePaths: [scelta] });
    expect(await page.evaluate(() => (window as any).apiSettings.scegliCartellaAllegati('Titolo'))).toBe(scelta);
    expect(path.dirname(await page.evaluate(() => (window as any).apiBrowser.getAllegatoPath('x')))).toBe(scelta);
    await page.evaluate(() => (window as any).apiSettings.ripristinaCartellaAllegati());
    expect((await page.evaluate(() => (window as any).apiSettings.get())).customAttachmentsPath).toBeUndefined();
    expect(path.basename(path.dirname(await page.evaluate(() => (window as any).apiBrowser.getAllegatoPath('x'))))).toBe('allegati_manoscritti');

    // Una preferenza svuotata si toglie davvero dal file (prima il valore vecchio restava).
    await page.evaluate(async () => {
      const api = (window as any).apiSettings;
      await api.save({ ...(await api.get()), snapshotRecenti: 10 });
      await api.save({ ...(await api.get()), snapshotRecenti: null });
    });
    expect((await page.evaluate(() => (window as any).apiSettings.get())).snapshotRecenti).toBeUndefined();
  });

  // L2: senza handler Electron concedeva ogni permesso a qualsiasi pagina.
  test('permessi: negati tutti tranne appunti e schermo intero della finestra principale', async ({ page, electronApp }) => {
    expect(await page.evaluate(() => Notification.requestPermission())).toBe('denied');
    const media = await page.evaluate(() => navigator.mediaDevices.getUserMedia({ audio: true }).then(() => 'concesso', (e) => e.name));
    expect(media).not.toBe('concesso');
    expect(await page.evaluate(() => navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((s) => s.state))).toBe('denied');

    // Un webContents secondario (come gli host PDF e stampa) non naviga da solo e non apre finestre.
    const esito = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
      try {
        await w.loadURL('data:text/html,<p>host</p>');
        await w.webContents.executeJavaScript('location.href = "https://example.org/"; window.open("https://example.org/")');
        await new Promise((r) => setTimeout(r, 500));
        return { url: w.webContents.getURL(), finestre: BrowserWindow.getAllWindows().length };
      } finally {
        w.destroy();
      }
    });
    expect(esito.url).toMatch(/^data:/);
    expect(esito.finestre).toBe(2);
  });

  // N4: un allegato dichiarato `pdf` che è un .html o un .svg non deve girare come pagina
  // nell'iframe del modal, e local-asset serve solo immagini e PDF con un tipo fisso.
  test('local-asset: solo immagini e PDF, con header; un "PDF" che non lo è non si apre', async ({ page, electronApp, userDataDir }) => {
    const { createLocalWorkspace } = await import('./helpers');
    const path = await import('path');
    const fs = await import('fs');
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'LocalAsset');
    const dir = path.dirname(await page.evaluate(() => (window as any).apiBrowser.getAllegatoPath('x')));
    const pagina = '<html><body><script>parent.postMessage("eseguito", "*")</script></body></html>';
    fs.writeFileSync(path.join(dir, 'ostile.html'), pagina);
    fs.writeFileSync(path.join(dir, 'ostile.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"><script>parent.postMessage("eseguito", "*")</script></svg>');
    fs.copyFileSync(path.join(__dirname, 'fixtures', 'sample.png'), path.join(dir, 'carta 50% #1.png'));
    fs.copyFileSync(path.join(__dirname, 'fixtures', 'sample.pdf'), path.join(dir, 'doc.pdf'));
    fs.writeFileSync(path.join(path.dirname(dir), 'fuori.png'), fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.png')));

    // Risposte del protocollo, lette dal main.
    const chiedi = (url: string) => electronApp.evaluate(async ({ net }, u) => {
      const r = await net.fetch(u);
      return { status: r.status, tipo: r.headers.get('content-type'), nosniff: r.headers.get('x-content-type-options'), csp: r.headers.get('content-security-policy') };
    }, url);
    expect((await chiedi('local-asset://ostile.html')).status).toBe(403);
    expect((await chiedi('local-asset://%2e%2e')).status).toBe(403);
    expect((await chiedi('local-asset://..%5Cfuori.png')).status).not.toBe(200);
    const png = await chiedi('local-asset://' + encodeURIComponent('carta 50% #1.png') + '?t=123');
    expect(png).toMatchObject({ status: 200, tipo: 'image/png', nosniff: 'nosniff' });
    expect(png.csp).toContain("default-src 'none'");
    expect(await chiedi('local-asset://doc.pdf')).toMatchObject({ status: 200, tipo: 'application/pdf', nosniff: 'nosniff' });
    const svg = await chiedi('local-asset://ostile.svg');
    expect(svg.csp).toContain("default-src 'none'");

    // Nell'iframe del modal: nessuno script di un allegato gira, qualunque sia la strada.
    await page.evaluate(() => {
      (window as any).__eseguito = 0;
      window.addEventListener('message', (e) => { if (e.data === 'eseguito') (window as any).__eseguito++; });
    });
    await page.evaluate(() => (window as any).apriPdfInterno('ostile.html'));
    await page.evaluate(() => (window as any).apriModal('local-asset://ostile.html', 'pdf'));
    await page.evaluate(() => (window as any).apriModal('local-asset://ostile.svg', 'pdf'));
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as any).__eseguito)).toBe(0);

    // Il PDF vero si apre ancora.
    await page.keyboard.press('Escape');
    await page.evaluate(() => (window as any).apriPdfInterno('doc.pdf'));
    await expect(page.locator('#modal-pdf')).toBeVisible();
    expect(await page.locator('#modal-pdf').getAttribute('src')).toContain('local-asset://doc.pdf');
    // Con gli header nuovi il visualizzatore nativo di Chromium parte ancora.
    await expect.poll(() => page.frames().some((f) => f.url().startsWith('chrome-extension://'))).toBe(true);
  });

});
