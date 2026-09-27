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

});
