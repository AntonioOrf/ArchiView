import { BrowserWindow, ipcMain, screen, nativeTheme } from 'electron';

const TIPI = new Set(['scheda', 'documento']);
const ATTESA_MAX_MS = 30000;

let finestra: any = null;
let tipoAperto: string | null = null;
let datiIniziali: any = null;
let chiusuraConfermata = false;
let senzaRiaggancio = false;
let ultimaPosizione: any = null;
const inAttesa = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: any }>();
let prossimoId = 1;
let zona: any = null;
let zonaChiesta = false;
let zonaAttiva = false;

function posizioneValida(p: any, schermi?: any[]) {
  if (!p || ![p.x, p.y, p.width, p.height].every((n) => Number.isFinite(n))) return null;
  const visibile = (schermi || screen.getAllDisplays()).some((d: any) => {
    const a = d.workArea;
    return p.x < a.x + a.width - 40 && p.x + p.width > a.x + 40 && p.y >= a.y - 10 && p.y < a.y + a.height - 40;
  });
  return visibile ? { x: Math.round(p.x), y: Math.round(p.y), width: Math.round(p.width), height: Math.round(p.height) } : null;
}

function cursoreSullaZona(zona: any, contenuto: any, fattore: number, cursore: any): boolean {
  if (!zona || ![zona.x, zona.y, zona.width, zona.height].every((n) => Number.isFinite(n)) || zona.width <= 0 || zona.height <= 0) return false;
  const f = Number.isFinite(fattore) && fattore > 0 ? fattore : 1;
  const x = contenuto.x + zona.x * f;
  const y = contenuto.y + zona.y * f;
  return cursore.x >= x && cursore.x <= x + zona.width * f && cursore.y >= y && cursore.y <= y + zona.height * f;
}

function setupFinestraStaccata(opzioni: { principale: () => any; urlIndex: string; preload: string; icona: string }) {
  const { principale, urlIndex, preload, icona } = opzioni;
  const vivaPrincipale = () => {
    const p = principale();
    return p && !p.isDestroyed() ? p : null;
  };
  const viva = () => (finestra && !finestra.isDestroyed() ? finestra : null);
  const daPrincipale = (e: any) => !!vivaPrincipale() && e.sender === vivaPrincipale().webContents;
  const daStaccata = (e: any) => !!viva() && e.sender === viva().webContents;
  const allaPrincipale = (canale: string, ...args: any[]) => { const p = vivaPrincipale(); if (p) p.webContents.send(canale, ...args); };

  function chiedi(destinatario: any, canale: string, ...args: any[]): Promise<any> {
    if (!destinatario) return Promise.reject(new Error('finestra non disponibile'));
    const id = prossimoId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { inAttesa.delete(id); reject(new Error('nessuna risposta')); }, ATTESA_MAX_MS);
      inAttesa.set(id, { resolve, reject, timer });
      destinatario.webContents.send(canale, id, ...args);
    });
  }

  function chiudi(riaggancia: boolean) {
    const f = viva();
    if (!f) return;
    senzaRiaggancio = !riaggancia;
    chiusuraConfermata = true;
    f.close();
  }

  async function controllaZona(finale: boolean) {
    const p = vivaPrincipale();
    if (!p || p.isMinimized() || !viva()) return;
    if (!zonaChiesta) {
      zonaChiesta = true;
      try { zona = await chiedi(p, 'finestra-richiesta', 'zona', tipoAperto); } catch { zona = null; }
    }
    const dentro = cursoreSullaZona(zona, p.getContentBounds(), p.webContents.getZoomFactor(), screen.getCursorScreenPoint());
    if (finale) {
      zonaChiesta = false;
      zona = null;
      if (zonaAttiva) allaPrincipale('finestra-zona', false);
      zonaAttiva = false;
      if (dentro && viva()) viva().webContents.send('finestra-chiudi-richiesta');
      return;
    }
    if (dentro !== zonaAttiva) {
      zonaAttiva = dentro;
      allaPrincipale('finestra-zona', dentro);
    }
  }

  ipcMain.handle('finestra-stacca', (e: any, tipo: string, dati: any, posizione: any) => {
    if (!daPrincipale(e) || !TIPI.has(tipo)) return false;
    datiIniziali = { tipo, dati };
    const aperta = viva();
    if (aperta && tipoAperto === tipo) {
      aperta.webContents.send('finestra-carica', dati);
      aperta.show();
      aperta.focus();
      return true;
    }
    if (aperta) aperta.destroy();
    tipoAperto = tipo;
    chiusuraConfermata = false;
    senzaRiaggancio = false;
    const b = posizioneValida(posizione);
    const f = new BrowserWindow({
      width: b ? b.width : 720,
      height: b ? b.height : 860,
      ...(b ? { x: b.x, y: b.y } : {}),
      minWidth: 420,
      minHeight: 360,
      title: 'ArchiView',
      icon: icona,
      show: false,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#282828' : '#fafaf9',
      webPreferences: { preload, contextIsolation: true, nodeIntegration: false }
    });
    finestra = f;
    f.setMenuBarVisibility(false);
    if (process.env.ARCHIVIEW_E2E_USER_DATA && process.env.ARCHIVIEW_E2E_BACKGROUND) {
      f.setSkipTaskbar(true);
      f.setPosition(-32000, -32000);
      f.once('ready-to-show', () => f.showInactive());
    } else {
      f.once('ready-to-show', () => f.show());
    }
    f.loadURL(`${urlIndex}?finestra=${tipo}`);
    f.on('close', (ev: any) => {
      ultimaPosizione = f.getBounds();
      if (chiusuraConfermata) return;
      ev.preventDefault();
      f.webContents.send('finestra-chiudi-richiesta');
    });
    f.on('closed', () => {
      if (finestra !== f) return;
      const tipoChiuso = tipoAperto;
      finestra = null;
      tipoAperto = null;
      allaPrincipale('finestra-posizione', tipoChiuso, ultimaPosizione);
      if (!senzaRiaggancio) allaPrincipale('finestra-chiusa', tipoChiuso);
    });
    f.on('move', () => { controllaZona(false); });
    f.on('moved', () => { controllaZona(true); });
    return true;
  });

  ipcMain.handle('finestra-dati', (e: any) => (daStaccata(e) ? datiIniziali : null));

  ipcMain.handle('finestra-richiesta', (e: any, metodo: string, args: any) => {
    if (!daStaccata(e) || !['salva', 'record', 'archivio'].includes(metodo)) return Promise.reject(new Error('richiesta non ammessa'));
    return chiedi(vivaPrincipale(), 'finestra-richiesta', metodo, args);
  });

  ipcMain.on('finestra-risposta', (e: any, id: number, esito: any) => {
    if (!daPrincipale(e) && !daStaccata(e)) return;
    const r = inAttesa.get(id);
    if (!r) return;
    inAttesa.delete(id);
    clearTimeout(r.timer);
    if (esito && esito.errore) r.reject(new Error(String(esito.errore)));
    else r.resolve(esito ? esito.valore : undefined);
  });

  ipcMain.handle('finestra-messaggio', async (e: any, tipoMsg: string, dati: any) => {
    if (!daPrincipale(e)) return false;
    const f = viva();
    if (!f) return false;
    if (tipoMsg === 'carica') {
      datiIniziali = { tipo: tipoAperto, dati };
      f.webContents.send('finestra-carica', dati);
      return true;
    }
    if (tipoMsg === 'mostra') {
      f.show();
      f.focus();
      return true;
    }
    if (tipoMsg === 'svuota' || tipoMsg === 'chiudi' || tipoMsg === 'riaggancia') {
      try { await chiedi(f, 'finestra-svuota'); } catch (err) { console.warn('[Finestra staccata] Salvataggio prima della chiusura non confermato:', err); }
      if (tipoMsg !== 'svuota') chiudi(tipoMsg === 'riaggancia');
      return true;
    }
    return false;
  });

  ipcMain.handle('finestra-riaggancia', (e: any) => {
    if (!daStaccata(e)) return false;
    chiudi(true);
    return true;
  });
}

function distruggiFinestraStaccata() {
  for (const r of inAttesa.values()) { clearTimeout(r.timer); r.reject(new Error('finestra chiusa')); }
  inAttesa.clear();
  if (finestra && !finestra.isDestroyed()) {
    senzaRiaggancio = true;
    finestra.destroy();
  }
}

export { setupFinestraStaccata, distruggiFinestraStaccata, posizioneValida, cursoreSullaZona };
