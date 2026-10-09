import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'Cascata' });

// Audit front-end, Fase 3 (P2-4, P2-5): style.css è fuori da @layer e vince sulle utility
// Tailwind scritte accanto nel markup. Si misura il rendering, non il sorgente.
test.describe('Cascata style.css / utility', () => {

  test('P2-5 — nessuna transizione globale fuori dal cambio tema; transition-transform intatto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Cascata');

    const esito = await page.evaluate(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      const durata = getComputedStyle(div).transitionDuration;
      div.remove();
      // Fuori da ogni regola dedicata: <i> e <span> come quelli dei template.
      const i = document.createElement('i');
      i.className = 'transition-transform';
      document.body.appendChild(i);
      const proprieta = getComputedStyle(i).transitionProperty;
      i.remove();
      return { durata, proprieta };
    });
    expect(esito.durata).toBe('0s');
    expect(esito.proprieta).toContain('transform');
  });

  test('P2-4 — i pulsanti ghost di pericolo mostrano il colore di pericolo nei 4 temi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Cascata');
    await page.evaluate(() => (window as any).apriCestino());
    await expect(page.locator('#cestino-modal')).toBeVisible();

    for (const tema of ['', 'amber-light-theme', 'dark-theme', 'blue-dark-theme']) {
      const esito = await page.evaluate((t) => {
        const r = document.documentElement;
        r.classList.remove('dark-theme', 'amber-light-theme', 'blue-dark-theme');
        if (t) r.classList.add(t);
        document.getAnimations().forEach(a => a.finish()); // .btn ha la sua transition: color 0.2s
        const sonda = document.createElement('span');
        sonda.style.color = 'var(--color-danger-text)';
        document.body.appendChild(sonda);
        const atteso = getComputedStyle(sonda).color;
        sonda.remove();
        const btn = document.querySelector('[data-on-click="svuotaCestinoDaPannello"]')!;
        return { atteso, reale: getComputedStyle(btn).color };
      }, tema);
      expect(esito.reale, tema || 'light').toBe(esito.atteso);
    }
  });
});
