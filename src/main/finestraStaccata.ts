// PIANO-SCHEDA-AFFIANCATA, Fasi 4–5 — la scheda (o il documento) in una finestra a parte.
//
// La finestra staccata carica la stessa app con `?finestra=<tipo>`, ma l'archivio non lo tocca:
// parte dalla fotografia che le passa la finestra principale e ogni salvataggio torna lì
// (staccata → main → principale → risposta). Un solo scrittore del database, sempre.
//
// Fase 5: trascinando la finestra staccata sopra la colonna della principale, questa mostra
// «Rilascia per riagganciare»; rilasciandola lì la finestra si chiude e il contenuto torna al
// suo posto. La zona la dichiara il renderer (in px CSS), qui si porta in coordinate schermo.
import { BrowserWindow, ipcMain, screen, nativeTheme } from 'electron';

const TIPI = new Set(['scheda', 'documento']);
const ATTESA_MAX_MS = 30000;

let finestra: any = null;
let tipoAperto: string | null = null;
let datiIniziali: any = null;
// La chiusura è già passata dal renderer staccato (salvataggio fatto): non chiedere di nuovo.
let chiusuraConfermata = false;
// Chiusa dalla principale (altra vista, app che esce): niente riaggancio da notificare.
let senzaRiaggancio = false;
let ultimaPosizione: any = null;
const inAttesa = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: any }>();
let prossimoId = 1;
// Fase 5 — stato del trascinamento in corso.
let zona: any = null;
let zonaChiesta = false;
let zonaAttiva = false;

/** Posizione salvata ancora su uno schermo collegato, o `null`. `schermi` solo per i test. */
function posizioneValida(p: any, schermi?: any[]) {
  if (!p || ![p.x, p.y, p.width, p.height].every((n) => Number.isFinite(n))) return null;
  const visibile = (schermi || screen.getAllDisplays()).some((d: any) => {
    const a = d.workArea;
    return p.x < a.x + a.width - 40 && p.x + p.width > a.x + 40 && p.y >= a.y - 10 && p.y < a.y + a.height - 40;
  });
  return visibile ? { x: Math.round(p.x), y: Math.round(p.y), width: Math.round(p.width), height: Math.round(p.height) } : null;
}

/**
 * Il cursore (coordinate schermo, DIP) è sulla zona di riaggancio? `zona` arriva dal renderer in
 * px CSS relativi al contenuto della finestra; `fattore` è lo zoom dell'interfaccia.
 */
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

  /** Domanda alla principale (o alla staccata) con risposta su `finestra-risposta`. */
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
      // Prima mossa del trascinamento: la zona si chiede una volta sola, non a ogni pixel.
      zonaChiesta = true;
      try { zona = await chiedi(p, 'finestra-richiesta', 'zona', tipoAperto); } catch { zona = null; }
    }
    const dentro = cursoreSullaZona(zona, p.getContentBounds(), p.webContents.getZoomFactor(), screen.getCursorScreenPoint());
    if (finale) {
      zonaChiesta = false;
      zona = null;
      if (zonaAttiva) allaPrincipale('finestra-zona', false);
      zonaAttiva = false;
      // Si riaggancia passando dalla staccata, che prima salva ciò che ha in sospeso.
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
    // Una finestra staccata alla volta: l'altra torna al suo posto.
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
      // La X della finestra: prima la staccata salva, poi chiede lei di chiudere.
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

  // Dalla staccata alla principale: salva, rileggi la scheda.
  ipcMain.handle('finestra-richiesta', (e: any, metodo: string, args: any) => {
    if (!daStaccata(e) || (metodo !== 'salva' && metodo !== 'record')) return Promise.reject(new Error('richiesta non ammessa'));
    return chiedi(vivaPrincipale(), 'finestra-richiesta', metodo, args);
  });

  // Risposte, da entrambe le finestre: ciascuna risponde solo alle domande rivolte a lei.
  ipcMain.on('finestra-risposta', (e: any, id: number, esito: any) => {
    if (!daPrincipale(e) && !daStaccata(e)) return;
    const r = inAttesa.get(id);
    if (!r) return;
    inAttesa.delete(id);
    clearTimeout(r.timer);
    if (esito && esito.errore) r.reject(new Error(String(esito.errore)));
    else r.resolve(esito ? esito.valore : undefined);
  });

  // Dalla principale alla staccata.
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
      // Ciò che la staccata ha in sospeso arriva su disco prima di proseguire.
      try { await chiedi(f, 'finestra-svuota'); } catch (err) { console.warn('[Finestra staccata] Salvataggio prima della chiusura non confermato:', err); }
      if (tipoMsg !== 'svuota') chiudi(tipoMsg === 'riaggancia');
      return true;
    }
    return false;
  });

  // Dalla staccata: «Riaggancia», o la X dopo il salvataggio.
  ipcMain.handle('finestra-riaggancia', (e: any) => {
    if (!daStaccata(e)) return false;
    chiudi(true);
    return true;
  });
}

/** La principale si chiude: la staccata se ne va con lei, senza chiedere (ha già salvato). */
function distruggiFinestraStaccata() {
  for (const r of inAttesa.values()) { clearTimeout(r.timer); r.reject(new Error('finestra chiusa')); }
  inAttesa.clear();
  if (finestra && !finestra.isDestroyed()) {
    senzaRiaggancio = true;
    finestra.destroy();
  }
}

export { setupFinestraStaccata, distruggiFinestraStaccata, posizioneValida, cursoreSullaZona };
