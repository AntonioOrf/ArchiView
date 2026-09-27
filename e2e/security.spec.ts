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

});
