import * as path from 'path';
import { ipcMain, nativeImage } from 'electron';
import { state, getAllSettings } from '../workspaceManager';
import { authenticateDrive, loadSavedTokens } from './drive/auth';
import { riceviLotti, MAX_BYTE_MANIFEST } from '../scanner/arrivoLotti';
import { creaSorgenteDrive, pubblicaConfig, manifestSuDrive } from '../scanner/driveArrivo';
const ScannerLotto = require('../../shared/scannerLotto');
import * as arrivo from '../scanner/arrivoLocale';
import { avviaServerWifi, indirizziLan, urlAbbinamento } from '../scanner/wifiArrivo';
const QRCode = require('qrcode');

const LATO_MINIATURA = 240;

let inCorso: Promise<any> | null = null;

let wifi: { server: any; sender: any } | null = null;
const finestreConAscolto = new WeakSet<object>();

async function fermaWifi(): Promise<void> {
  const w = wifi;
  wifi = null;
  if (!w) return;
  try {
    await w.server.ferma();
  } catch (e: any) {
    console.warn('[scanner] arresto del server Wi-Fi:', e && e.message);
  }
}

function nomeArchivio(): string {
  if (!state.workspacePath) throw new Error('nessun_archivio_aperto');
  return ScannerLotto.nomeArchivio(path.basename(state.workspacePath)).slice(0, 200);
}

function cartelleScanner(): { arrivo: string; temp: string; assegnati: string } {
  if (!state.workspacePath) throw new Error('nessun_archivio_aperto');
  const base = path.join(state.workspacePath, '.archiview', 'scanner');
  return { arrivo: path.join(base, 'arrivo'), temp: path.join(base, 'tmp'), assegnati: path.join(base, 'assegnati') };
}

function gestisci(canale: string, fn: (...args: any[]) => Promise<any>) {
  ipcMain.handle(canale, async (_event: any, ...args: any[]) => {
    try {
      return { success: true, ...(await fn(...args)) };
    } catch (error: any) {
      console.error(`[scanner] ${canale} fallito:`, error && error.message);
      return { success: false, error: (error && (error.code === 'EEXIST' ? 'file_esistente' : error.message)) || String(error) };
    }
  });
}

function setupScannerIpc() {
  ipcMain.handle('scanner-ricevi-drive', async (event: any) => {
    if (inCorso) return { success: false, error: 'ricezione_in_corso' };
    inCorso = (async () => {
      try {
        const c = cartelleScanner();
        await authenticateDrive();
        const sorgente = await creaSorgenteDrive();
        const esito = await riceviLotti({
          sorgente,
          cartellaArrivo: c.arrivo,
          cartellaTemp: c.temp,
          cartellaAssegnati: c.assegnati,
          archivio: nomeArchivio(),
          avanzamento: (e: any) => {
            if (!event.sender.isDestroyed()) event.sender.send('scanner-progress', e);
          }
        });
        if (esito.falliti.length) console.warn('[scanner] lotti non ricevuti:', JSON.stringify(esito.falliti));
        return { success: true, ...esito };
      } catch (error: any) {
        console.error('[scanner] ricezione da Drive fallita:', error && error.message);
        return { success: false, error: (error && error.message) || String(error) };
      }
    })();
    try { return await inCorso; } finally { inCorso = null; }
  });

  gestisci('scanner-elenca', async () => ({ lotti: await arrivo.elencaArrivo(cartelleScanner()) }));

  gestisci('scanner-miniatura', async (id: unknown, file: unknown) => {
    const p = arrivo.percorsoPagina(cartelleScanner(), id, file);
    if (typeof nativeImage.createThumbnailFromPath !== 'function') return { dataUrl: null };
    const img = await nativeImage.createThumbnailFromPath(p, { width: LATO_MINIATURA, height: LATO_MINIATURA });
    return { dataUrl: img.isEmpty() ? null : img.toDataURL() };
  });

  gestisci('scanner-assegna', async (id: unknown, schedaId: unknown, opzioni: any) => {
    if (!state.attachmentsDirPath) throw new Error('cartella_allegati_assente');
    const c = cartelleScanner();
    const allegati = opzioni && opzioni.pdf === true
      ? [await arrivo.unisciInPdf(c, id, schedaId, state.attachmentsDirPath)]
      : await arrivo.copiaInAllegati(c, id, schedaId, state.attachmentsDirPath);
    return { allegati };
  });

  gestisci('scanner-pubblica-schede', async (schede: unknown, cartelle: unknown) => {
    const archivio = nomeArchivio();
    const esito = ScannerLotto.validaConfig({
      formato: ScannerLotto.FORMATO_CONFIG,
      versione: ScannerLotto.VERSIONE,
      archivio,
      aggiornatoIl: new Date().toISOString(),
      schede: Array.isArray(schede) ? schede.map((s: any) => (s && typeof s === 'object' && ScannerLotto.daVedere(s.tags) ? { ...s, daVedere: true } : s)) : schede,
      cartelle
    });
    if (!esito.ok) throw new Error('elenco_non_valido');
    await authenticateDrive();
    await pubblicaConfig(archivio + '.json', JSON.stringify(esito.config));
    return { schede: esito.config.schede.length };
  });

  gestisci('scanner-controlla-drive', async () => {
    const archivio = nomeArchivio();
    if (!loadSavedTokens()) return { collegato: false, qui: [], altri: [] };
    const recenti: string[] = (getAllSettings().recentWorkspaces || []).map(String);
    const percorsoDi = (nome: string) => recenti.find((p) => ScannerLotto.nomeArchivio(path.basename(p)) === nome) || null;
    const qui: { id: string; pagine: number; destinazione: unknown }[] = [];
    const altri = new Map<string, { nome: string; pagine: number; nuovo: boolean; percorso: string | null }>();
    for (const testo of await manifestSuDrive(MAX_BYTE_MANIFEST)) {
      let esito: any;
      try { esito = ScannerLotto.valida(JSON.parse(testo)); } catch { continue; }
      if (!esito.ok || esito.lotto.archivio === undefined) continue;
      const l = esito.lotto;
      const suo = ScannerLotto.nomeArchivio(l.archivio);
      if (suo === archivio) { qui.push({ id: l.id, pagine: l.pagine.length, destinazione: l.destinazione }); continue; }
      const a = altri.get(suo) || { nome: suo, pagine: 0, nuovo: false, percorso: percorsoDi(suo) };
      a.pagine += l.pagine.length;
      a.nuovo = a.nuovo || (!!l.archivioNuovo && !a.percorso);
      altri.set(suo, a);
    }
    return { collegato: true, qui, altri: [...altri.values()].sort((a, b) => a.nome.localeCompare(b.nome)) };
  });

  ipcMain.handle('scanner-wifi-avvia', async (event: any) => {
    try {
      await fermaWifi();
      const c = cartelleScanner();
      const base = path.dirname(c.arrivo);
      const server = await avviaServerWifi({
        cartellaArrivo: c.arrivo,
        cartellaTemp: path.join(base, 'tmp-wifi'),
        cartellaAssegnati: c.assegnati,
        cartellaStaging: path.join(base, 'staging-wifi'),
        archivio: nomeArchivio(),
        onLotto: (id: string) => { if (!event.sender.isDestroyed()) event.sender.send('scanner-wifi-lotto', id); }
      });
      wifi = { server, sender: event.sender };
      if (!finestreConAscolto.has(event.sender)) {
        finestreConAscolto.add(event.sender);
        event.sender.once('destroyed', () => { fermaWifi(); });
        event.sender.on('did-start-loading', () => { fermaWifi(); });
      }
      const indirizzi = indirizziLan();
      if (!indirizzi.length) { await fermaWifi(); throw new Error('nessuna_rete_locale'); }
      const url = urlAbbinamento(indirizzi[0], server.porta, server.token);
      const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 280 });
      return { success: true, qr, indirizzi, porta: server.porta };
    } catch (error: any) {
      console.error('[scanner] Wi-Fi non avviato:', error && error.message);
      return { success: false, error: (error && error.message) || String(error) };
    }
  });

  gestisci('scanner-wifi-ferma', async () => { await fermaWifi(); return {}; });

  gestisci('scanner-togli', async (id: unknown) => {
    await arrivo.togliDaArrivo(cartelleScanner(), id);
    return {};
  });
}

export { setupScannerIpc, fermaWifi };
