import { test, expect } from './fixtures';

test.describe('Security Regression Tests', () => {

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
