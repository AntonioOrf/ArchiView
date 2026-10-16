import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ipcMain } from 'electron';
import { state, getAllSettings } from '../workspaceManager';
import { readVaultConfig, assicuraArchivioId } from '../vaultConfig';
import { leggiPerfConfig } from '../perfConfig';
import { IndiceWorker } from '../crossArchive/client';
import { safeAttachmentPathOrNull, safeAttachmentPath } from './pathSafety';
import { hashFile } from '../chunkingLogic';

import type { IndiceArchivi } from '../crossArchive/indiceMemoria';

type ArchivioConsultabile = { id: string; percorso: string; nome: string; tipo: string; escluso: boolean };

let indice: IndiceArchivi | null = null;

const MIME_IMMAGINI: { [ext: string]: string } = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif'
};
const MAX_IMMAGINE = 25 * 1024 * 1024;
const idPerPercorso = new Map<string, string>();
const ricercheInCorso = new Map<string, AbortController>();

function ottieniIndice(): IndiceArchivi {
  if (!indice) {
    const lowPerf = !!leggiPerfConfig().lowPerf;
    indice = new IndiceWorker({
      indice: { maxArchivi: lowPerf ? 4 : 16, limiteTesto: lowPerf ? 64 * 1024 : 256 * 1024 }
    }) as IndiceArchivi;
  }
  return indice;
}

function chiavePercorso(p: string): string {
  const r = path.resolve(p);
  return process.platform === 'win32' ? r.toLowerCase() : r;
}

function idDaPercorso(p: string): string {
  return 'percorso:' + crypto.createHash('sha1').update(chiavePercorso(p)).digest('hex').slice(0, 16);
}

function archiviRecenti(): ArchivioConsultabile[] {
  const settings = getAllSettings();
  const recenti = Array.isArray(settings.recentWorkspaces) ? settings.recentWorkspaces : [];
  const esclusi = new Set((Array.isArray(settings.crossArchiveEsclusi) ? settings.crossArchiveEsclusi : []).map(String));
  const attivo = state.workspacePath ? chiavePercorso(state.workspacePath) : null;
  const visti = new Set<string>();
  const percorsiVisti = new Set<string>();
  if (state.workspacePath && attivo) {
    const idAttivo = idPerPercorso.get(attivo) || assicuraArchivioId(state.workspacePath, settings);
    if (idAttivo) { idPerPercorso.set(attivo, idAttivo); visti.add(idAttivo); }
  }

  const out: ArchivioConsultabile[] = [];
  for (const p of recenti) {
    if (typeof p !== 'string' || !p) continue;
    const chiave = chiavePercorso(p);
    if (chiave === attivo || percorsiVisti.has(chiave)) continue;
    percorsiVisti.add(chiave);

    let id: string = idPerPercorso.get(chiave) || '';
    if (!id) {
      const generato = assicuraArchivioId(p, settings);
      if (generato) { id = generato; idPerPercorso.set(chiave, id); }
      else id = idDaPercorso(p);
    }
    if (visti.has(id)) id = idDaPercorso(p);
    visti.add(id);

    let tipo = 'local';
    try { tipo = readVaultConfig(p, settings).vaultType || 'local'; } catch (e) {}
    out.push({ id, percorso: p, nome: path.basename(p), tipo, escluso: esclusi.has(id) });
  }
  return out;
}

function pubblico(a: ArchivioConsultabile) {
  return { id: a.id, nome: a.nome, tipo: a.tipo };
}

function setupCrossArchiveIpc() {
  ipcMain.handle('cross-archive-archivi', () => {
    try {
      return { ok: true, archivi: archiviRecenti().map(a => ({ ...pubblico(a), escluso: a.escluso, raggiungibile: fs.existsSync(a.percorso) })) };
    } catch (e) {
      console.error('[ricerca-archivi] elenco archivi:', e);
      return { ok: false, error: (e && e.message) || String(e) };
    }
  });

  ipcMain.handle('cross-archive-search', async (event: any, richiesta: any) => {
    const r = richiesta && typeof richiesta === 'object' ? richiesta : {};
    const testo = typeof r.testo === 'string' ? r.testo.slice(0, 500) : '';
    const query = {
      testo,
      soloAnagrafica: r.soloAnagrafica === true,
      chiaveAnagrafica: typeof r.chiaveAnagrafica === 'string' && r.chiaveAnagrafica.length <= 300 ? r.chiaveAnagrafica : undefined,
      cursore: typeof r.cursore === 'string' && r.cursore.length <= 512 ? r.cursore : null,
      limite: Number.isFinite(r.limite) ? r.limite : undefined
    };

    const canale = typeof r.canale === 'string' && /^[a-z]{1,20}$/.test(r.canale) ? r.canale : 'ricerca';
    const esclusivo = canale !== 'suggerimento';
    const finestra = (event && event.sender ? event.sender.id : 0) + ':' + canale;
    const precedente = esclusivo ? ricercheInCorso.get(finestra) : null;
    if (precedente) precedente.abort();
    const controllo = new AbortController();
    if (esclusivo) ricercheInCorso.set(finestra, controllo);

    try {
      const archivi = archiviRecenti().filter(a => !a.escluso);
      const idx = ottieniIndice();
      const stati = await idx.sincronizza(archivi.map(a => ({ id: a.id, percorso: a.percorso })));
      if (controllo.signal.aborted) return { ok: false, annullata: true };
      const pagina = await idx.cerca(query, controllo.signal);
      const perId = new Map(stati.map(s => [s.id, s]));
      return {
        ok: true,
        motore: (idx as any).inRipiego ? 'ripiego' : 'worker',
        archivi: archivi.map(a => {
          const s: any = perId.get(a.id) || {};
          const out: any = { ...pubblico(a), raggiungibile: !!s.raggiungibile, schede: s.schede || 0, aggiornatoIl: s.aggiornatoIl || null };
          if (s.errore) out.errore = s.errore;
          if (s.futuro) out.futuro = true;
          return out;
        }),
        ...pagina
      };
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: false, annullata: true };
      console.error('[ricerca-archivi] ricerca:', e);
      return { ok: false, error: (e && e.message) || String(e) };
    } finally {
      if (ricercheInCorso.get(finestra) === controllo) ricercheInCorso.delete(finestra);
    }
  });

  ipcMain.handle('cross-archive-get', async (event: any, archivioId: any, schedaId: any) => {
    if (!idValido(archivioId) || !idValido(schedaId)) return { ok: false, error: 'Parametri non validi' };
    try {
      const archivio = await archivioConsultabile(archivioId);
      if (!archivio) return { ok: false, error: 'Archivio non consultabile' };
      const esito = await ottieniIndice().scheda(archivioId, schedaId);
      if (!esito) return { ok: false, error: 'Scheda non trovata' };
      return {
        ok: true, archivio: pubblico(archivio), scheda: esito.scheda, tipo: esito.tipo, contesto: esito.contesto,
        dimensioniAllegati: await dimensioniAllegati(archivio.percorso, esito.scheda)
      };
    } catch (e) {
      console.error('[ricerca-archivi] lettura scheda:', e);
      return { ok: false, error: (e && e.message) || String(e) };
    }
  });

  ipcMain.handle('cross-archive-copia-allegati', async (event: any, archivioId: any, schedaId: any, posizioni: any, prefisso: any) => {
    if (!idValido(archivioId) || !idValido(schedaId) || !Array.isArray(posizioni) || posizioni.length > 2000 ||
        !posizioni.every((p: any) => Number.isInteger(p) && p >= 0 && p <= 10000)) {
      return { ok: false, error: 'Parametri non validi' };
    }
    if (!state.workspacePath || !state.attachmentsDirPath) return { ok: false, error: 'Nessun archivio aperto' };
    try {
      const archivio = await archivioConsultabile(archivioId);
      if (!archivio) return { ok: false, error: 'Archivio non consultabile' };
      const esito = await ottieniIndice().scheda(archivioId, schedaId);
      if (!esito) return { ok: false, error: 'Scheda non trovata' };
      const allegati = Array.isArray(esito.scheda.allegati) ? esito.scheda.allegati : [];
      const pref = (typeof prefisso === 'string' ? prefisso : '').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64) || ('doc_' + Date.now());
      const dest = state.attachmentsDirPath;
      await fs.promises.mkdir(dest, { recursive: true });

      const copiati: any[] = [];
      const errori: any[] = [];
      let fatti = 0;
      for (const p of posizioni) {
        const a = allegati[p];
        try {
          if (!a || a.remoto || typeof a.nome !== 'string') throw new Error('Allegato non disponibile');
          const da = safeAttachmentPath(cartellaAllegati(archivio.percorso), a.nome);
          const nome = await nomeLibero(dest, pref, a.originalName || a.nome);
          const verso = safeAttachmentPath(dest, nome);
          await fs.promises.copyFile(da, verso, fs.constants.COPYFILE_EXCL);
          copiati.push({ posizione: p, nome, hash: await hashFile(verso) });
        } catch (e) {
          errori.push({ posizione: p, errore: e && e.code === 'ENOENT' ? 'File non presente su questo computer' : ((e && e.message) || String(e)) });
        }
        fatti++;
        if (event && event.sender && !event.sender.isDestroyed()) event.sender.send('cross-archive-copia-progresso', { fatti, totale: posizioni.length });
      }
      return { ok: true, copiati, errori };
    } catch (e) {
      console.error('[ricerca-archivi] copia allegati:', e);
      return { ok: false, error: (e && e.message) || String(e) };
    }
  });

  ipcMain.handle('cross-archive-allegato', async (event: any, archivioId: any, schedaId: any, posizione: any) => {
    if (!idValido(archivioId) || !idValido(schedaId) || !Number.isInteger(posizione) || posizione < 0 || posizione > 10000) {
      return { ok: false, error: 'Parametri non validi' };
    }
    try {
      const archivio = await archivioConsultabile(archivioId);
      if (!archivio) return { ok: false, error: 'Archivio non consultabile' };
      const esito = await ottieniIndice().scheda(archivioId, schedaId);
      const allegato = esito && Array.isArray(esito.scheda.allegati) ? esito.scheda.allegati[posizione] : null;
      if (!allegato || allegato.remoto || typeof allegato.nome !== 'string') return { ok: false, error: 'Allegato non disponibile' };
      const mime = MIME_IMMAGINI[path.extname(allegato.nome).toLowerCase()];
      if (!mime) return { ok: false, error: 'Formato non visualizzabile' };
      const file = safeAttachmentPathOrNull(path.join(archivio.percorso, 'allegati_manoscritti'), allegato.nome);
      if (!file) return { ok: false, error: 'Nome allegato non valido' };
      const st = await fs.promises.stat(file);
      if (!st.isFile() || st.size > MAX_IMMAGINE) return { ok: false, error: 'Allegato troppo grande' };
      return { ok: true, mime, dati: await fs.promises.readFile(file) };
    } catch (e) {
      if (e && e.code === 'ENOENT') return { ok: false, error: 'File non presente su questo computer' };
      console.error('[ricerca-archivi] allegato:', e);
      return { ok: false, error: (e && e.message) || String(e) };
    }
  });
}

async function archivioConsultabile(archivioId: string) {
  const archivi = archiviRecenti().filter(a => !a.escluso);
  const archivio = archivi.find(a => a.id === archivioId);
  if (!archivio) return null;
  await ottieniIndice().sincronizza(archivi.map(a => ({ id: a.id, percorso: a.percorso })));
  return archivio;
}

function cartellaAllegati(percorso: string): string {
  return path.join(percorso, 'allegati_manoscritti');
}

async function dimensioniAllegati(percorso: string, scheda: any): Promise<(number | null)[]> {
  const allegati = Array.isArray(scheda && scheda.allegati) ? scheda.allegati : [];
  return Promise.all(allegati.map(async (a: any) => {
    if (!a || a.remoto || typeof a.nome !== 'string') return null;
    const file = safeAttachmentPathOrNull(cartellaAllegati(percorso), a.nome);
    if (!file) return null;
    try { return (await fs.promises.stat(file)).size; } catch (e) { return null; }
  }));
}

async function nomeLibero(dir: string, prefisso: string, originale: string): Promise<string> {
  const ext = path.extname(originale).toLowerCase().replace(/[^a-z0-9.]/g, '').substring(0, 16);
  const base = path.basename(originale, path.extname(originale)).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) || 'allegato';
  for (let n = 1; n < 1000; n++) {
    const nome = `${prefisso}_${base}${n > 1 ? '_' + n : ''}${ext}`;
    try { await fs.promises.access(path.join(dir, nome)); } catch (e) { return nome; }
  }
  throw new Error('Nessun nome libero per ' + originale);
}

function idValido(v: any): boolean {
  return typeof v === 'string' && v.length > 0 && v.length <= 128;
}

export { setupCrossArchiveIpc, archiviRecenti };
