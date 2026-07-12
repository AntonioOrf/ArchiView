import { test, expect } from './fixtures';
import { createLocalWorkspace, injectConflict } from './helpers';
import * as path from 'path';

test.describe('Conflitti di merge (dati iniettati)', () => {
  test('rilevaConflitti individua un conflitto 3-way sul campo modificato da entrambi', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');

    const conflitti = await page.evaluate(() => {
      const w = window as any;
      const base = { id: '1', segnatura: 'Base', cartella: 'Generale' };
      const baseHash = w.getRecordHash(base);
      const local = { ...base, segnatura: 'Locale' };
      const external = { ...base, segnatura: 'Esterno' };
      return w.rilevaConflitti([local], [external], 0, { '1': baseHash });
    });

    expect(conflitti).toHaveLength(1);
    expect(conflitti[0].campiConflitto).toContain('segnatura');
  });

  test('rilevaConflitti non segnala nulla se le versioni sono identiche', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');

    const conflitti = await page.evaluate(() => {
      const w = window as any;
      const record = { id: '1', segnatura: 'Uguale', cartella: 'Generale' };
      const baseHash = w.getRecordHash(record);
      return w.rilevaConflitti([record], [record], 0, { '1': baseHash });
    });

    expect(conflitti).toHaveLength(0);
  });

  test('apriMergeConflictModal mostra la lista e il dettaglio del conflitto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    // Il campo in conflitto di default è proprio "segnatura": la card in lista
    // mostra il valore locale (quello con cui la risoluzione parte precompilata).
    await expect(page.locator('#conflict-list')).toContainText('Valore Locale');
    await expect(page.locator('#conflict-detail')).toContainText('Valore Locale');
    await expect(page.locator('#conflict-detail')).toContainText('Valore Cloud');
    await expect(page.locator('#btn-resolve-all')).toBeDisabled();
  });

  test('risolvere un singolo campo abilita via via il conteggio, e Applica risoluzione chiude il modal', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    await page.locator('button[data-resolve-scelta="local"]').first().click();
    await expect(page.locator('#btn-resolve-all')).toBeEnabled();

    await page.locator('#btn-resolve-all').click();
    await expect(page.locator('#merge-conflict-modal')).toBeHidden();

    const resolved = await page.evaluate(() => (window as any).__e2eResolved);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].segnatura).toBe('Valore Locale');
  });

  test('scegliere la versione cloud produce la risoluzione con il valore esterno', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    await page.locator('button[data-resolve-scelta="external"]').first().click();
    await page.locator('#btn-resolve-all').click();

    const resolved = await page.evaluate(() => (window as any).__e2eResolved);
    expect(resolved[0].segnatura).toBe('Valore Cloud');
  });

  test('annullare la sincronizzazione chiude il modal e segnala l\'annullamento alla callback', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Merge');
    await injectConflict(page);

    await page.evaluate(() => (window as any).annullaSincronizzazioneConflitto());
    await expect(page.locator('#merge-conflict-modal')).toBeHidden();

    const resolved = await page.evaluate(() => (window as any).__e2eResolved);
    expect(resolved).toBeNull();
  });
});
