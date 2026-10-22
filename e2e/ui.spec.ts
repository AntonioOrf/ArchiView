import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

test.use({ seedWorkspace: 'UI' });

test.describe('UI: impostazioni, lingua, tema', () => {
  test('apre e chiude la modale impostazioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await expect(page.locator('#settings-modal')).toBeVisible();

    await page.evaluate(() => (window as any).chiudiImpostazioni());
    await expect(page.locator('#settings-modal')).toBeHidden();
  });

  test('il cambio lingua aggiorna il DOM', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    const struttura = page.locator('[data-i18n="sidebar_section_folders"]').first();
    await expect(struttura).toHaveText('Cartelle');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await page.locator('#settings-language').selectOption('en');

    await expect(struttura).toHaveText('Folders', { timeout: 8_000 });
  });

  test('il cambio tema applica la classe dark', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    await page.evaluate(() => (window as any).apriImpostazioni('tab-appearance'));
    await page.locator('#settings-theme .tema-scheda:has(input[value="dark"])').click();

    await expect(page.locator('html')).toHaveClass(/dark-theme/, { timeout: 8_000 });
  });

  test('nei temi scuri le voci delle tendine hanno sfondo pieno e testo leggibile', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');
    await page.evaluate(() => (window as any).apriImpostazioni('tab-appearance'));
    for (const tema of ['dark', 'blue-dark']) {
      await page.locator(`#settings-theme .tema-scheda:has(input[value="${tema}"])`).click();
      await expect(page.locator('html')).toHaveClass(new RegExp(`(^| )${tema}-theme( |$)`));
      const illeggibili = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        const rgba = (c: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = '#000';
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          const trasparente = /rgba\(.*,\s*0\)$|transparent/.test(c);
          return { r: d[0], g: d[1], b: d[2], pieno: !trasparente && d[3] === 255 };
        };
        const lum = ({ r, g, b }: any) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const select = Array.from(document.querySelectorAll('select'));
        return select.map(s => {
          const o = s.options[0];
          if (!o) return null;
          const st = getComputedStyle(o);
          const fondo = rgba(st.backgroundColor);
          const testo = rgba(st.color);
          const [a, b] = [lum(fondo), lum(testo)].sort((x, y) => y - x);
          const contrasto = (a + 0.05) / (b + 0.05);
          return fondo.pieno && contrasto >= 4.5 ? null : `${s.id || s.className}: ${st.color} su ${st.backgroundColor}`;
        }).filter(Boolean);
      });
      expect(illeggibili, tema).toEqual([]);
    }
  });

  test('il tema scelto persiste dopo il riavvio', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    await page.evaluate(() => (window as any).apriImpostazioni('tab-appearance'));
    await page.locator('#settings-theme .tema-scheda:has(input[value="dark"])').click();
    await expect(page.locator('html')).toHaveClass(/dark-theme/, { timeout: 8_000 });

    const { launchApp, closeApp } = await import('./fixtures');
    await closeApp(electronApp);
    const { app: app2, page: page2 } = await launchApp(userDataDir);

    await expect(page2.locator('#btn-tab-add')).toBeVisible({ timeout: 15_000 });
    await expect(page2.locator('html')).toHaveClass(/dark-theme/, { timeout: 8_000 });
    await closeApp(app2);
  });

  test('username personalizzato viene salvato nelle impostazioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'UI');

    await page.evaluate(() => (window as any).apriImpostazioni());
    await page.locator('#settings-username').fill('Archivista Test');
    await page.locator('#settings-username').blur();
    await page.evaluate(() => (window as any).chiudiImpostazioni());

    const settings = await page.evaluate(() => (window as any).apiSettings.get());
    expect(settings.username).toBe('Archivista Test');
  });
});
