// Permessi e navigazione per TUTTI i webContents (L2 e N9 in PIANO-SICUREZZA-OTTIMIZZAZIONE.md).
//
// Senza handler Electron concede ogni permesso (microfono, fotocamera, notifiche, posizione…)
// a qualsiasi pagina, iframe compresi. Qui si concede solo ciò che l'app usa, e solo alla
// finestra principale: scrivere negli appunti (copia di citazioni e codici d'invito) e lo
// schermo intero. Gli host PDF e stampa non ricevono niente.
//
// Le guardie di navigazione della finestra principale restano in main.ts (createWindow):
// qui si coprono gli altri webContents, che non devono navigare né aprire finestre da soli.
// Gli host caricano le loro pagine con loadURL dal main, che non passa da `will-navigate`.
//
// La decisione sui permessi è pura: test/guardieWebContents.test.js.

const PERMESSI_FINESTRA_PRINCIPALE = new Set(['clipboard-sanitized-write', 'fullscreen']);
// Concessi anche a un iframe della finestra: lo schermo intero lo chiede il visualizzatore PDF,
// che sta nell'iframe `local-asset`. Gli appunti no: li scrive solo l'app, dal frame principale.
const PERMESSI_ANCHE_DA_IFRAME = new Set(['fullscreen']);

/**
 * true se `permesso` va concesso. `daFinestraPrincipale`: la richiesta viene dalla finestra
 * dell'app; `daFramePrincipale`: dal suo documento e non da un iframe (che condivide lo stesso
 * webContents, quindi il primo controllo da solo non li distingue).
 */
function permessoConcesso(permesso: unknown, daFinestraPrincipale: boolean, daFramePrincipale = true): boolean {
  if (daFinestraPrincipale !== true || typeof permesso !== 'string' || !PERMESSI_FINESTRA_PRINCIPALE.has(permesso)) return false;
  return daFramePrincipale === true || PERMESSI_ANCHE_DA_IFRAME.has(permesso);
}

function installaGuardieWebContents(app: any, sessione: any, finestraPrincipale: () => any) {
  const principale = (wc: any) => {
    const f = finestraPrincipale();
    return !!(wc && f && !f.isDestroyed() && f.webContents === wc);
  };

  // `isMainFrame` assente (versioni o percorsi che non lo passano) conta come iframe: nel dubbio
  // valgono solo i permessi ammessi anche agli iframe.
  sessione.setPermissionRequestHandler((wc: any, permesso: string, callback: (ok: boolean) => void, dettagli: any) => {
    const ok = permessoConcesso(permesso, principale(wc), dettagli?.isMainFrame === true);
    if (!ok) console.warn(`[SECURITY] Permesso negato: ${permesso}`);
    callback(ok);
  });
  sessione.setPermissionCheckHandler((wc: any, permesso: string, _origine: string, dettagli: any) =>
    permessoConcesso(permesso, principale(wc), dettagli?.isMainFrame === true));

  app.on('web-contents-created', (_evento: any, contents: any) => {
    // La finestra principale imposta il suo handler in createWindow (apre http/https nel
    // browser): quello sostituisce questo, che resta per tutti gli altri.
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (evento: any, url: string) => {
      if (principale(contents)) return;
      console.warn(`[SECURITY] Navigazione bloccata in un webContents secondario: ${url}`);
      evento.preventDefault();
    });
    contents.on('will-attach-webview', (evento: any) => evento.preventDefault());
  });
}

module.exports = { permessoConcesso, installaGuardieWebContents };
export {};
