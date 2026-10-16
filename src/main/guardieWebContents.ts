const PERMESSI_FINESTRA_PRINCIPALE = new Set(['clipboard-sanitized-write', 'fullscreen']);
const PERMESSI_ANCHE_DA_IFRAME = new Set(['fullscreen']);

function permessoConcesso(permesso: unknown, daFinestraPrincipale: boolean, daFramePrincipale = true): boolean {
  if (daFinestraPrincipale !== true || typeof permesso !== 'string' || !PERMESSI_FINESTRA_PRINCIPALE.has(permesso)) return false;
  return daFramePrincipale === true || PERMESSI_ANCHE_DA_IFRAME.has(permesso);
}

function installaGuardieWebContents(app: any, sessione: any, finestraPrincipale: () => any) {
  const principale = (wc: any) => {
    const f = finestraPrincipale();
    return !!(wc && f && !f.isDestroyed() && f.webContents === wc);
  };

  sessione.setPermissionRequestHandler((wc: any, permesso: string, callback: (ok: boolean) => void, dettagli: any) => {
    const ok = permessoConcesso(permesso, principale(wc), dettagli?.isMainFrame === true);
    if (!ok) console.warn(`[SECURITY] Permesso negato: ${permesso}`);
    callback(ok);
  });
  sessione.setPermissionCheckHandler((wc: any, permesso: string, _origine: string, dettagli: any) =>
    permessoConcesso(permesso, principale(wc), dettagli?.isMainFrame === true));

  app.on('web-contents-created', (_evento: any, contents: any) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (evento: any, url: string) => {
      if (principale(contents)) return;
      console.warn(`[SECURITY] Navigazione bloccata in un webContents secondario: ${url}`);
      evento.preventDefault();
    });
    contents.on('will-attach-webview', (evento: any) => evento.preventDefault());
  });
}

export { permessoConcesso, installaGuardieWebContents };
