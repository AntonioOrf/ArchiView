import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import { scansiona, TEMI, TEMI_SCURI } from './contrasto';
import type { Page } from '@playwright/test';
import * as path from 'path';

test.use({ seedWorkspace: 'Rari' });

type Schermata = { nome: string; radice: string; apri: () => Promise<void>; chiudi: () => Promise<void> };

const w = (page: Page, f: string, ...args: unknown[]) =>
  page.evaluate(([f, args]) => (window as any)[f as string](...(args as unknown[])), [f, args] as const);

function schermate(page: Page): Schermata[] {
  const rimuovi = (id: string) => page.evaluate((i) => document.getElementById(i)?.remove(), id);
  const statoCloud = (stato: string): Schermata => ({
    nome: `cloud-${stato}`, radice: '#cloud-status-btn',
    apri: async () => {
      await page.evaluate((s) => {
        const btn = document.getElementById('cloud-status-btn')!;
        btn.dataset.stato = s;
        document.getElementById('cloud-status-label')!.textContent = 'Stato ' + s;
      }, stato);
    },
    chiudi: async () => { await w(page, 'aggiornaCloudStatus'); },
  });

  const condivisioneHub = (ruolo: 'owner' | 'member'): Schermata => ({
    nome: `condivisione-hub-${ruolo}`, radice: '#share-modal',
    apri: async () => {
      await page.evaluate(async (r) => {
        const w = window as any;
        w.__finto = { hubConfig: w.hubConfig, getHubRole: w.getHubRole, listaMembriHub: w.listaMembriHub, driveStatus: w.driveStatus };
        w.hubConfig = { name: 'Vault ABC', attachmentsMode: r === 'owner' ? 'off' : 'drive-links', lastLoadedAt: Date.now() };
        w.getHubRole = async () => r;
        w.listaMembriHub = async () => [
          { memberId: 'm1', label: 'Collega attiva', role: 'member' },
          { memberId: 'm2', label: 'Collega revocato', role: 'member', revoked: true },
        ];
        w.driveStatus = { ...(w.driveStatus || {}), isAuthenticated: r === 'member', user: 'prova@esempio.it' };
        await w.apriShareModal();
      }, ruolo);
      await expect(page.locator(ruolo === 'owner' ? '#share-state-owner' : '#share-state-member')).toBeVisible();
    },
    chiudi: async () => {
      await page.evaluate(() => {
        const w = window as any;
        w.chiudiShareModal();
        Object.assign(w, w.__finto);
      });
    },
  });

  return [
    {
      nome: 'conflitti-merge', radice: '#merge-conflict-modal',
      apri: async () => {
        await page.evaluate(() => {
          const w = window as any;
          const crea = (id: string, segnatura: string) => {
            const base = { id, segnatura, titolo: 'Base', cartella: '', tipoDocumento: 'manoscritto' };
            const hash = w.getRecordHash(base);
            const local = { ...base, segnatura: segnatura + ' L', titolo: 'Titolo locale' };
            const external = { ...base, segnatura: segnatura + ' C', titolo: 'Titolo cloud' };
            return w.rilevaConflitti([local], [external], 0, { [id]: hash });
          };
          w.apriMergeConflictModal([...crea('c-1', 'BAV 1'), ...crea('c-2', 'BAV 2')], () => {});
        });
        await expect(page.locator('#merge-conflict-modal')).toBeVisible();
        await page.locator('button[data-resolve-scelta="local"]').first().click();
      },
      chiudi: async () => { await w(page, 'annullaSincronizzazioneConflitto'); },
    },
    {
      nome: 'eliminazioni', radice: '#deletion-conflict-modal',
      apri: async () => {
        await w(page, 'apriDeletionConflictModal', [
          { id: 'del-1-aaaaaaaa', segnatura: 'Doc 1' },
          { id: 'del-2-bbbbbbbb', segnatura: 'Doc 2' },
          { id: 'del-3-cccccccc', segnatura: 'Doc 3' },
        ], null);
        await page.locator('button[data-deletion-id="del-1-aaaaaaaa"][data-deletion-action="keep"]').click();
        await page.locator('button[data-deletion-id="del-2-bbbbbbbb"][data-deletion-action="delete"]').click();
      },
      chiudi: async () => { await w(page, 'annullaSincronizzazioneDeletions'); },
    },
    {
      nome: 'accesso-negato', radice: '#accesso-negato-overlay',
      apri: async () => {
        await w(page, 'mostraErroreAccessoNegato', 'ospite@esempio.it');
        await expect(page.locator('#accesso-negato-overlay')).toBeVisible();
      },
      chiudi: () => rimuovi('accesso-negato-overlay'),
    },
    {
      nome: 'storico-diff', radice: '#history-diff-modal',
      apri: async () => {
        await w(page, 'apriDiffRevisioneModal', [
          { id: '1', revM: { id: '1', segnatura: 'BAV 1', titolo: 'Prima' }, curM: { id: '1', segnatura: 'BAV 1', titolo: 'Dopo' } },
          { id: '2', revM: { id: '2', segnatura: 'BAV 2' }, curM: { id: '2', segnatura: 'BAV 2b' } },
        ], '07/10/2026 10:00');
        await expect(page.locator('#history-diff-modal')).toBeVisible();
      },
      chiudi: () => rimuovi('history-diff-modal'),
    },
    {
      nome: 'storico-ripristino', radice: '#history-restore-confirm',
      apri: async () => {
        await page.evaluate(() => (window as any).apriConfermaRipristino('07/10/2026 10:00', async () => false));
        await expect(page.locator('#history-restore-confirm')).toBeVisible();
      },
      chiudi: () => rimuovi('history-restore-confirm'),
    },
    {
      nome: 'storico-elenco', radice: '#storico-prova',
      apri: async () => {
        await page.evaluate(async () => {
          const w = window as any;
          const prova = document.createElement('div');
          prova.id = 'storico-prova';
          prova.className = 'panel-solid';
          prova.style.cssText = 'position:fixed;top:0;left:0;width:320px;z-index:500';
          const lista = document.getElementById('history-list')!;
          w.__storicoGenitore = lista.parentElement;
          prova.appendChild(lista);
          document.body.appendChild(prova);
          w.__elencaVersioniHub = w.elencaVersioniHub;
          w.hubConfig = { prova: true };
          const ora = Date.now();
          w.elencaVersioniHub = async () => ({ currentVersion: 3, versions: [
            { version: 3, authorMemberId: null, createdAt: ora - 60_000, sizeBytes: 2048 },
            { version: 2, authorMemberId: 7, authorLabel: 'Collega', createdAt: ora - 3_600_000, sizeBytes: 2000 },
          ] });
          await w.renderHistoryList();
        });
        await expect(page.locator('#storico-prova .storico-riga.is-attuale')).toBeVisible();
      },
      chiudi: async () => {
        await page.evaluate(() => {
          const w = window as any;
          w.hubConfig = null;
          w.elencaVersioniHub = w.__elencaVersioniHub;
          w.__storicoGenitore.appendChild(document.getElementById('history-list')!);
          document.getElementById('storico-prova')!.remove();
        });
      },
    },
    condivisioneHub('owner'),
    condivisioneHub('member'),
    ...['ok', 'entrata', 'pendenti', 'errore', 'disconnesso', 'occupato'].map(statoCloud),
  ];
}

test.describe('Modali rari: contrasto, temi e lingua', () => {
  test('testo ≥ minimo WCAG e nessun fondo del tema chiaro nei temi scuri', async ({ page, userDataDir }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Rari');

    const righe: string[] = [];
    for (const tema of TEMI) {
      await page.evaluate(async (t) => {
        (window as any).applicaTema(t);
        await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
      }, tema);
      for (const s of schermate(page)) {
        await s.apri();
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
        const testo = await page.evaluate(scansiona, { radiceSel: s.radice, modo: 'testo' as const });
        righe.push(...testo.map(v => `${tema} · ${s.nome} · ${v.elemento} «${v.testo}» ${v.fg} su ${v.bg} = ${v.ratio}:1 (min ${v.minimo})`));
        if (TEMI_SCURI.includes(tema)) {
          const chiari = await page.evaluate(scansiona, { radiceSel: s.radice, modo: 'sfondi' as const });
          righe.push(...chiari.map(v => `${tema} · ${s.nome} · ${v.elemento} «${v.testo}» su fondo chiaro ${v.bg}`));
        }
        await s.chiudi();
      }
    }
    expect([...new Set(righe)]).toEqual([]);
  });

  test('accesso negato e conferma di ripristino stanno sulla scala z-index; Esc chiude solo la seconda', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Rari');

    await w(page, 'mostraErroreAccessoNegato', 'ospite@esempio.it');
    const z = await page.evaluate(() => ({
      overlay: getComputedStyle(document.getElementById('accesso-negato-overlay')!).zIndex,
      scala: getComputedStyle(document.documentElement).getPropertyValue('--z-modal-critical').trim(),
    }));
    expect(z.overlay).toBe(z.scala);
    await page.evaluate(() => document.getElementById('accesso-negato-overlay')!.remove());

    await page.evaluate(() => (window as any).apriConfermaRipristino('07/10/2026 10:00', async () => false));
    const conferma = page.locator('#history-restore-confirm');
    await expect(conferma).toBeVisible();
    await expect(conferma.locator('.modal-window')).toHaveAttribute('role', 'dialog');
    const zc = await page.evaluate(() => ({
      overlay: getComputedStyle(document.getElementById('history-restore-confirm')!).zIndex,
      scala: getComputedStyle(document.documentElement).getPropertyValue('--z-modal-alert').trim(),
    }));
    expect(zc.overlay).toBe(zc.scala);
    await expect.poll(() => page.evaluate(() =>
      document.getElementById('history-restore-confirm')?.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(conferma).toHaveCount(0);
  });

  test('il diff dello storico conserva il fuoco passando alla scheda successiva', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Rari');
    await w(page, 'apriDiffRevisioneModal', [
      { id: '1', revM: { id: '1', segnatura: 'A' }, curM: { id: '1', segnatura: 'A2' } },
      { id: '2', revM: { id: '2', segnatura: 'B' }, curM: { id: '2', segnatura: 'B2' } },
    ], 'v3');
    const modale = page.locator('#history-diff-modal');
    await expect(modale.locator('.modal-window')).toHaveAttribute('role', 'dialog');
    await modale.locator('#hist-next-btn').focus();
    await page.keyboard.press('Enter');
    await expect(modale).toContainText('B2');
    await expect.poll(() => page.evaluate(() =>
      document.getElementById('history-diff-modal')?.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(modale).toHaveCount(0);
  });

  test('il menu di una versione nello storico è il menu comune: tastiera, Esc e voci giuste', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Rari');
    const elenco = schermate(page).find(s => s.nome === 'storico-elenco')!;
    await elenco.apri();
    await page.locator('#storico-prova .storico-riga.is-attuale').click();
    const menu = page.locator('#custom-context-menu[role="menu"]');
    await expect(menu).toBeVisible();
    await expect(menu.locator('[role="menuitem"]')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    await page.locator('#storico-prova .storico-riga:not(.is-attuale)').click();
    await expect(menu.locator('[role="menuitem"]')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await elenco.chiudi();
  });

  test('in inglese i modali rari non mostrano testo italiano cablato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Rari');
    await page.evaluate(() => (window as any).cambiaLingua('en'));

    const italiano = /\b(Accesso|Negato|Cambia|Scegli|Altro|Archivio|account .* non è|Eliminati|Server da|Mantieni|Mantenuto|Elimina|Da eliminare|Conferma|Annulla|Ricezione|verificare|verificate|Storico|Campo|Chiudi|Prec\.|Succ\.|scheda|schede|differenze|Visualizzando|Ripristina|revisione|sovrascriverà|Vuoto|Senza Titolo|corrente)\b/;
    const testi: Record<string, string> = {};
    for (const s of schermate(page).filter(s => !s.nome.startsWith('cloud-'))) {
      await s.apri();
      testi[s.nome] = await page.locator(s.radice).evaluate((el) => {
        const html = el as HTMLElement;
        const attr = Array.from(el.querySelectorAll('[aria-label], [title]'))
          .map(e => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' ');
        return html.innerText + ' ' + attr;
      });
      await s.chiudi();
    }
    const trovati = Object.entries(testi)
      .map(([nome, t]) => [nome, t.match(new RegExp(italiano.source, 'g'))] as const)
      .filter(([, m]) => m)
      .map(([nome, m]) => `${nome}: ${[...new Set(m)].join(', ')}`);
    expect(trovati).toEqual([]);
  });
});
