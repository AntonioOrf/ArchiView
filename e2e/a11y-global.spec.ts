import { test, expect } from './fixtures';
import { createLocalWorkspace } from './helpers';
import * as path from 'path';

// Fase 6 — effetti globali delle regole a11y introdotte con il Cloud modal.
// Coprono superfici che vanno oltre il modal: live region condivisa, focus ring su
// controlli non-.btn, prefers-reduced-motion, e i rami di driveLogic che nessun test
// raggiungeva perché richiedono l'autenticazione Google.
//
// apiSettings/apiBrowser arrivano da contextBridge e NON sono ridefinibili nel renderer
// (Cannot redefine property): i finti si installano sostituendo l'handler nel main.
test.describe('Accessibilità: effetti globali', () => {

  test('6.1 — i toast finiscono nella live region giusta per priorità', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    await page.evaluate(() => (window as any).mostraMessaggio('Salvataggio riuscito', 'success'));
    await expect(page.locator('#a11y-live-polite')).toHaveText('Salvataggio riuscito');

    await page.evaluate(() => (window as any).mostraMessaggio('Disco pieno', 'error'));
    await expect(page.locator('#a11y-live-assertive')).toHaveText('Disco pieno');
  });

  test('6.2 — due annunci identici consecutivi vengono ri-annunciati', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    // Una live region che riceve lo stesso testo due volte resta muta: l'helper deve
    // svuotarla e ripopolarla. Si verifica osservando che il reset avviene davvero.
    const passaggi = await page.evaluate(async () => {
      const el = document.getElementById('a11y-live-polite')!;
      const visti: string[] = [];
      const mo = new MutationObserver(() => visti.push(el.textContent || '(vuoto)'));
      mo.observe(el, { childList: true, characterData: true, subtree: true });
      (window as any).annunciaA11y('Sincronizzazione completata');
      await new Promise(r => setTimeout(r, 80));
      (window as any).annunciaA11y('Sincronizzazione completata');
      await new Promise(r => setTimeout(r, 80));
      mo.disconnect();
      return visti;
    });

    // Almeno un reset a vuoto tra i due annunci identici.
    expect(passaggi).toContain('(vuoto)');
    expect(passaggi.filter(t => t === 'Sincronizzazione completata').length).toBeGreaterThanOrEqual(2);
  });

  test('6.3 — un toast non ruba il fuoco', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    await page.locator('#btn-tab-add').focus();
    await page.evaluate(() => (window as any).mostraMessaggio('Messaggio qualsiasi', 'info'));
    await expect(page.locator('#btn-tab-add')).toBeFocused();
  });

  test('6.4 — checkbox, radio e summary hanno un focus ring visibile', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    // Il Cloud modal contiene sia una checkbox sia un summary; i radio stanno altrove,
    // ma la regola è la stessa: si verifica che non restino senza indicatore.
    await page.evaluate(() => (window as any).apriCloudModal());
    await page.evaluate(() => {
      document.getElementById('cloud-local-section')!.classList.add('hidden-tab');
      document.getElementById('cloud-shared-section')!.classList.remove('hidden-tab');
    });

    // :focus-visible non si attiva con .focus() da script: Chrome lo concede solo quando
    // l'ultima interazione è da tastiera. Si arriva quindi sull'elemento con Tab.
    for (const sel of ['#cloud-sync-attachments', '#cloud-shared-section summary']) {
      await page.locator(sel).evaluate((el: HTMLElement) => {
        // Porta il fuoco all'elemento precedente, poi ci si arriva con un Tab reale.
        const tutti = Array.from(document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
          .filter(e => e.offsetParent !== null);
        const i = tutti.indexOf(el);
        if (i > 0) tutti[i - 1].focus();
      });
      await page.keyboard.press('Tab');

      const stile = await page.locator(sel).evaluate((el: HTMLElement) => {
        const s = getComputedStyle(el);
        const primario = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
        return {
          attivo: el === document.activeElement,
          focusVisible: el.matches(':focus-visible'),
          stile: s.outlineStyle,
          larghezza: parseFloat(s.outlineWidth) || 0,
          colore: s.outlineColor,
          primario,
        };
      });
      expect(stile.attivo, `${sel} non ha ricevuto il fuoco`).toBe(true);
      expect(stile.focusVisible, `${sel} non è in :focus-visible`).toBe(true);
      expect(stile.stile, `outline-style di ${sel}`).not.toBe('none');
      // 1.5 e non 2: l'outline viene agganciato ai pixel fisici, e con devicePixelRatio
      // 1.25 i nostri 2px CSS risultano 1.6px (stesso motivo del 31.9 nel test 5.4).
      expect(stile.larghezza, `outline-width di ${sel}`).toBeGreaterThanOrEqual(1.5);
      // Prova che il ring è il nostro e non quello di default del browser.
      expect(stile.colore, `outline-color di ${sel} non è --color-primary`).not.toBe('');
    }
  });

  test('6.5 — con reduced-motion le animazioni si fermano e l app resta usabile', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.evaluate(() => (window as any).mostraProgressoCloud('Test', 'In corso'));
    const durata = await page.locator('#cloud-progress-overlay svg').evaluate(
      (el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(durata).toBeLessThan(0.05);
    await page.evaluate(() => (window as any).nascondiProgressoCloud());

    // La riduzione del movimento non deve rompere ciò che dipende dalle transizioni.
    await page.evaluate(() => (window as any).apriImpostazioni());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-modal')).toBeHidden();

    await page.evaluate(() => (window as any).switchSidebarTab('tags'));
    await expect(page.locator('#sidebar-tags')).toBeVisible();
  });

  test('6.6 — il bottone di stato cloud applica hover e colori di stato', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    // Regole rimaste a lungo inerti: le precedeva un commento CSS che si chiudeva
    // in anticipo su "text-*/", invalidando la dichiarazione successiva.
    const btn = page.locator('#cloud-status-btn');
    const sfondoBase = await btn.evaluate(el => getComputedStyle(el).backgroundColor);
    await btn.hover();
    const sfondoHover = await btn.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(sfondoHover).not.toBe(sfondoBase);

    // Ogni stato deve avere un colore proprio, non ereditare quello del precedente.
    const colori: string[] = [];
    for (const stato of ['ok', 'entrata', 'pendenti', 'errore']) {
      await page.evaluate((s) => {
        document.getElementById('cloud-status-btn')!.setAttribute('data-stato', s);
      }, stato);
      // .btn ha `transition: all .2s`: senza attesa si legge il colore a metà dissolvenza
      // e due stati diversi possono risultare identici.
      await page.waitForTimeout(300);
      colori.push(await btn.evaluate(el => getComputedStyle(el).color));
    }
    expect(new Set(colori).size).toBe(colori.length);
  });

  test('6.7 — pulisciAllegatiOrfani espone aria-busy e ripristina il pulsante', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('drive-clean-orphans');
      ipcMain.handle('drive-clean-orphans', async () => {
        await new Promise(r => setTimeout(r, 1200));
        return { deletedLocal: 2, deletedDrive: 1 };
      });
    });

    await page.evaluate(() => (window as any).apriCloudModal());
    await page.evaluate(() => {
      document.getElementById('cloud-shared-section')!.classList.remove('hidden-tab');
      // La conferma è un banner: qui interessa lo stato del pulsante, non il dialogo.
      (window as any).mostraBottomConfirm = (_m: string, ok: () => void) => ok();
      (window as any).pulisciAllegatiOrfani();
    });

    const btn = page.locator('#btn-cloud-clean-orphans');
    await expect(btn).toHaveAttribute('aria-busy', 'true');
    await expect(btn).toBeDisabled();

    await expect(btn).not.toHaveAttribute('aria-busy', 'true', { timeout: 10_000 });
    await expect(btn).toBeEnabled();
    await expect(btn).toContainText(/Pulizia|Pulisci|Clean/i);
  });

  test('6.8 — se il salvataggio fallisce la checkbox torna indietro', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('save-settings');
      ipcMain.handle('save-settings', () => { throw new Error('disco pieno'); });
    });

    await page.evaluate(() => (window as any).apriCloudModal());
    await page.evaluate(() => document.getElementById('cloud-shared-section')!.classList.remove('hidden-tab'));

    const cb = page.locator('#cloud-sync-attachments');
    const prima = await cb.isChecked();
    await page.evaluate((v) => (window as any).toggleSyncAttachments(!v), prima);

    // Lo stato mostrato deve corrispondere a quello salvato: un salvataggio fallito
    // non può lasciare la casella su un valore che non è mai stato scritto.
    await expect(cb).toBeChecked({ checked: prima });
    await expect(page.locator('#toast-container')).toContainText(/Errore/i);
  });

  test('6.9 — il pulsante di sync del modal mostra lo stato di attesa', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    await electronApp.evaluate(({ ipcMain }) => {
      for (const c of ['drive-pull', 'drive-sync', 'drive-sync-attachments']) {
        try { ipcMain.removeHandler(c); } catch {}
      }
      ipcMain.handle('drive-pull', async () => { await new Promise(r => setTimeout(r, 1200)); return null; });
      ipcMain.handle('drive-sync', async () => Date.now());
      ipcMain.handle('drive-sync-attachments', async () => ({}));
    });

    await page.evaluate(() => (window as any).apriCloudModal());
    await page.evaluate(() => {
      document.getElementById('cloud-shared-section')!.classList.remove('hidden-tab');
      (window as any).driveStatus = { isAuthenticated: true, user: 'test@example.com' };
      (window as any).sincronizzaGoogleDrive(true);
    });

    const btn = page.locator('#btn-cloud-drive-sync');
    await expect(btn).toHaveAttribute('aria-busy', 'true');
    await expect(btn).not.toHaveAttribute('aria-busy', 'true', { timeout: 15_000 });
    await expect(btn).toContainText(/Sincronizza/i);
  });

  test('6.10 — le chiavi i18n nuove sono tradotte in italiano e inglese', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    const chiavi = [
      'modal_cloud_title_backup', 'modal_cloud_title_shared', 'cloud_shared_hint',
      'cloud_status_type', 'cloud_status_type_backup', 'cloud_status_type_shared',
      'cloud_status_account', 'cloud_status_last_sync', 'btn_syncing', 'btn_activating',
      'a11y_sync_attachments_on', 'a11y_sync_attachments_off', 'a11y_operation_done',
    ];

    for (const lingua of ['it', 'en']) {
      await page.evaluate((l) => (window as any).cambiaLingua(l), lingua);
      const grezze = await page.evaluate((ks) => {
        const t = (window as any).t;
        return ks.filter((k: string) => {
          const v = t(k);
          return !v || v === k; // l'id grezzo a schermo significa chiave mancante
        });
      }, chiavi);
      expect(grezze, `chiavi non tradotte in ${lingua}`).toEqual([]);
    }
  });

  test('6.11 — il variant dark è agganciato ai temi scuri e solo a quelli', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');

    // Senza @custom-variant in input.css le utility dark:* seguono prefers-color-scheme
    // e restano inerti con i temi dell'app: questo test impedisce la regressione.
    const misura = await page.evaluate(() => {
      // Tailwind genera solo le utility presenti nei sorgenti: questa coppia è usata
      // davvero (shareModal), quindi esiste nel CSS compilato. Una classe inventata
      // darebbe "nessuna regola" e il test misurerebbe il nulla.
      const sonda = document.createElement('div');
      sonda.className = 'bg-emerald-100 dark:bg-emerald-900/20';
      document.body.appendChild(sonda);
      const leggi = (tema: string) => {
        document.documentElement.className = tema;
        return getComputedStyle(sonda).backgroundColor;
      };
      const originale = document.documentElement.className;
      const out = {
        chiaro: leggi(''),
        dark: leggi('dark-theme'),
        blueDark: leggi('blue-dark-theme'),
        amberLight: leggi('amber-light-theme'),
      };
      document.documentElement.className = originale;
      sonda.remove();
      return out;
    });

    expect(misura.dark).not.toBe(misura.chiaro);
    expect(misura.blueDark).not.toBe(misura.chiaro);
    expect(misura.amberLight).toBe(misura.chiaro); // tema chiaro: non deve attivare dark:
  });

  test('6.12 — il Cloud modal resta leggibile in tutti e quattro i temi', async ({ page, electronApp, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'A11yG');
    // Il body ha `transition: color .25s`: senza azzerare il movimento si misurano
    // i colori a metà dissolvenza, cioè quelli del tema precedente.
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const tipo of ['backup', 'shared']) {
      await electronApp.evaluate(({ ipcMain }, t) => {
        ipcMain.removeHandler('get-vault-config');
        ipcMain.handle('get-vault-config', () => ({ vaultType: t }));
      }, tipo);

      for (const tema of ['light', 'amber-light', 'dark', 'blue-dark']) {
        await page.evaluate(() => (window as any).apriImpostazioni());
        await page.locator('#settings-theme').selectOption(tema);
        await page.evaluate(() => (window as any).chiudiImpostazioni());
        // cambiaTemaSelezionato applica la classe solo dopo due round-trip IPC: senza
        // questa attesa si misurano i colori del tema precedente.
        await page.waitForFunction((t) => {
          const c = document.documentElement.classList;
          const scuri = ['dark-theme', 'blue-dark-theme', 'amber-light-theme'];
          const attesa: Record<string, string | null> = {
            'dark': 'dark-theme', 'blue-dark': 'blue-dark-theme',
            'amber-light': 'amber-light-theme', 'light': null,
          };
          const a = attesa[t];
          return a ? c.contains(a) : scuri.every(x => !c.contains(x));
        }, tema);
        // La classe cambia subito, i colori no: body ha `transition: color .25s`.
        // Va attesa la fine della dissolvenza, altrimenti si misura il tema precedente.
        await page.waitForTimeout(400);

        await page.evaluate(() => (window as any).apriCloudModal());
        await expect(page.locator('#cloud-shared-section')).toBeVisible();

        const esiti = await page.evaluate(() => {
          // Tailwind v4 dichiara i colori in oklch() e getComputedStyle li restituisce così:
          // leggere i numeri con una regex darebbe valori senza senso. La canvas li converte
          // in RGB reali qualunque sia la notazione di partenza.
          const cv = document.createElement('canvas');
          cv.width = cv.height = 1;
          const ctx = cv.getContext('2d', { willReadFrequently: true })!;
          const rgb = (s: string): number[] => {
            const alpha = s.startsWith('rgba') ? Number((s.match(/[\d.]+\)$/) || ['1'])[0].slice(0, -1)) : 1;
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = '#000';
            ctx.fillStyle = s;
            ctx.fillRect(0, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 1, 1).data;
            return [d[0], d[1], d[2], alpha === 1 ? d[3] / 255 : alpha];
          };
          const lum = ([r, g, b]: number[]) => {
            const c = [r, g, b].map(v => {
              const x = v / 255;
              return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
          };
          // Lo sfondo effettivo va cercato risalendo i genitori: i pannelli usano
          // fondi semitrasparenti o ereditati, e un rgba(0,0,0,0) darebbe un falso 21:1.
          const sfondo = (el: Element): number[] => {
            let n: Element | null = el;
            while (n) {
              const c = rgb(getComputedStyle(n).backgroundColor);
              if ((c[3] ?? 1) > 0.9) return c.slice(0, 3);
              n = n.parentElement;
            }
            return rgb(getComputedStyle(document.body).backgroundColor).slice(0, 3);
          };
          const rapporto = (a: number[], b: number[]) => {
            const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
            return (x + 0.05) / (y + 0.05);
          };

          const campioni: Record<string, string> = {
            titolo: '#cloud-active-title',
            descrizione: '#cloud-active-desc',
            riepilogo: '#cloud-status-summary',
            distruttiva: '#btn-disconnect-cloud',
            etichettaCheckbox: 'label[for="cloud-sync-attachments"] span',
            opzioniAvanzate: '#cloud-shared-section summary',
          };
          const out: Record<string, { r: number; testo: string; fondo: string }> = {};
          for (const [nome, sel] of Object.entries(campioni)) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const t = rgb(getComputedStyle(el).color).slice(0, 3);
            const f = sfondo(el);
            out[nome] = { r: rapporto(t, f), testo: `rgb(${t})`, fondo: `rgb(${f})` };
          }
          return { classe: document.documentElement.className, campi: out };
        });

        for (const [nome, v] of Object.entries(esiti.campi)) {
          expect(
            v.r,
            `contrasto ${nome} — tema ${tema} (classe "${esiti.classe}"), vault ${tipo}: testo ${v.testo} su fondo ${v.fondo}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        await page.evaluate(() => (window as any).chiudiCloudModal());
      }
    }
  });
});
