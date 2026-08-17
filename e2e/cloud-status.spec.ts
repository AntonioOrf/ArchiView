import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

// Fase 3 — il controllo cloud unico. Gli stati si pilotano da window.statoCloud senza
// bisogno di un account reale: qui si verifica la mappatura stato → etichetta → azioni.
async function impostaStato(page: any, patch: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  await page.evaluate(({ patch, extra }) => {
    Object.assign((window as any).statoCloud, patch);
    Object.assign(window as any, extra);
    (window as any).aggiornaCloudStatus();
  }, { patch, extra });
}

test.describe('Controllo cloud unico', () => {
  test.beforeEach(async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'CloudState');
  });

  test('vault cloud allineato: "Sincronizzato" e popover con le tre azioni + i due dettagli', async ({ page }) => {
    await impostaStato(page, { vaultCloud: true, autenticato: true, inEntrata: false, pendenti: false, errore: null });

    await expect(page.locator('#cloud-status-btn')).toHaveAttribute('data-stato', 'ok');
    await expect(page.locator('#cloud-status-label')).toHaveText('Sincronizzato');

    await page.locator('#cloud-status-btn').click();
    const voci = page.locator('#custom-context-menu [role="menuitem"]');
    await expect(voci).toHaveCount(5);
    for (const testo of ['Controlla aggiornamenti', 'Ricevi modifiche', 'Invia modifiche', 'Vedi modifiche', 'Storico versioni']) {
      await expect(page.locator('#custom-context-menu')).toContainText(testo);
    }
  });

  test('aggiornamenti in entrata: il numero finisce nell\'etichetta', async ({ page }) => {
    await impostaStato(
      page,
      { vaultCloud: true, autenticato: true, inEntrata: true },
      { incomingChanges: [{ id: 'a' }, { id: 'b' }], incomingStructuralChanges: [{ label: 'x' }] },
    );

    await expect(page.locator('#cloud-status-btn')).toHaveAttribute('data-stato', 'entrata');
    await expect(page.locator('#cloud-status-label')).toHaveText('3 in entrata');
  });

  test('modifiche locali: lo stato dice quante ne restano da inviare', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).ultimoCaricamento = 1000;
      // @ts-ignore -- appData è una let globale
      appData.manoscritti.push({ id: 'p1', cartella: '', segnatura: 'P1', lastModified: 5000, allegati: [] });
      (window as any).statoCloud.vaultCloud = true;
      (window as any).statoCloud.autenticato = true;
      (window as any).impostaModifichePendenti(true);
    });

    await expect(page.locator('#cloud-status-btn')).toHaveAttribute('data-stato', 'pendenti');
    await expect(page.locator('#cloud-status-label')).toHaveText('1 da inviare');
  });

  test('errore di sync: stato rosso e messaggio dentro il popover', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).statoCloud.vaultCloud = true;
      (window as any).statoCloud.autenticato = true;
      (window as any).impostaErroreCloud('quota superata');
    });

    await expect(page.locator('#cloud-status-btn')).toHaveAttribute('data-stato', 'errore');
    await page.locator('#cloud-status-btn').click();
    await expect(page.locator('#custom-context-menu')).toContainText('quota superata');

    // Un fetch riuscito deve riportarlo a "Sincronizzato": l'errore non è appiccicoso.
    await page.keyboard.press('Escape');
    await page.evaluate(() => (window as any).azzeraErroreCloud());
    await expect(page.locator('#cloud-status-btn')).toHaveAttribute('data-stato', 'ok');
  });

  test('durante la sincronizzazione le tre azioni sono disabilitate', async ({ page }) => {
    await impostaStato(page, { vaultCloud: true, autenticato: true });
    await page.evaluate(() => (window as any).toggleSyncProgress(true));

    await expect(page.locator('#cloud-status-btn')).toHaveAttribute('data-stato', 'occupato');
    await page.locator('#cloud-status-btn').click();
    const menu = page.locator('#custom-context-menu');
    for (const testo of ['Controlla aggiornamenti', 'Ricevi modifiche', 'Invia modifiche']) {
      await expect(menu.locator('[role="menuitem"]', { hasText: testo })).toBeDisabled();
    }
    // Vedi modifiche / Storico restano usabili: sono sola lettura.
    await expect(menu.locator('[role="menuitem"]', { hasText: 'Storico versioni' })).toBeEnabled();
  });

  test('l’azione del momento è sempre visibile e cambia con lo stato', async ({ page }) => {
    const azione = page.locator('#cloud-primary-action');
    const etichetta = page.locator('#cloud-primary-action-label');

    // Allineato: l'unica cosa sensata da fare è ricontrollare.
    await impostaStato(page, { vaultCloud: true, autenticato: true, inEntrata: false, pendenti: false, errore: null });
    await expect(azione).toBeVisible();
    await expect(etichetta).toHaveText('Controlla');

    await impostaStato(page, { inEntrata: true }, { incomingChanges: [{ id: 'a' }] });
    await expect(etichetta).toHaveText('Ricevi');

    await impostaStato(page, { inEntrata: false, pendenti: true });
    await expect(etichetta).toHaveText('Invia');

    await impostaStato(page, { errore: 'rete assente' });
    await expect(etichetta).toHaveText('Riprova');

    // Durante la sync non c'è nulla da premere: il pulsante sparisce invece di mentire.
    await impostaStato(page, { errore: null, occupato: true });
    await expect(azione).toBeHidden();
  });

  test('il bottone di stato dichiara di essere apribile', async ({ page }) => {
    await impostaStato(page, { vaultCloud: true, autenticato: true });
    const btn = page.locator('#cloud-status-btn');
    // chevron: senza, il controllo si legge come una semplice etichetta di stato
    await expect(btn.locator('svg')).toHaveCount(2);
    await expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    await expect(btn).toHaveAttribute('title', /clicca per le azioni/);
  });

  test('3.3 — a finestra stretta il controllo e il popover restano raggiungibili', async ({ page }) => {
    await impostaStato(page, { vaultCloud: true, autenticato: true, pendenti: true });
    await page.setViewportSize({ width: 700, height: 720 });

    await expect(page.locator('#cloud-status-btn')).toBeVisible();
    await page.locator('#cloud-status-btn').click();
    await expect(page.locator('#custom-context-menu')).toBeVisible();
    await expect(page.locator('#custom-context-menu')).toContainText('Invia modifiche');
  });
});
