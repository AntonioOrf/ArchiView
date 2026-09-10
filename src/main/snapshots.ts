// Fase 4.2 — Snapshot locali automatici.
//
// Chi lavora solo in locale non aveva NESSUNA cronologia: il pannello sapeva dire soltanto
// "collegati a Google Drive per vedere lo storico", e l'unica rete era lo stack undo in RAM,
// che muore con la finestra. Qui il database viene fotografato periodicamente in
// `<workspace>/.archiview/snapshots/`, compresso, e ruotato secondo la regola pura di
// `shared/model.ts` (`rotazioneSnapshot`).
//
// ⚠️ TRE DECISIONI CHE NON SI CAMBIANO A CUOR LEGGERO
//
// 1. **Lo snapshot è il payload già serializzato**, non `JSON.stringify` di un oggetto
//    ricostruito qui. `salva-dati` riceve dal renderer la stringa esatta che finisce su
//    disco: fotografarla costa una gzip e nient'altro, mentre ri-serializzare significherebbe
//    fotografare qualcosa che non è mai stato il contenuto del file.
// 2. **La gzip è asincrona** (`zlib.gzip`, non `gzipSync`): gira nel threadpool di libuv.
//    La versione sincrona blocca il processo main — cioè la finestra — per tutta la
//    compressione, ed è esattamente ciò che la modalità Prestazioni ridotte cerca di evitare.
// 3. **Uno snapshot fallito non fa fallire il salvataggio.** È una rete di sicurezza
//    accessoria: se il disco è pieno o la cartella non è scrivibile, l'utente deve comunque
//    poter salvare il proprio lavoro. Gli errori si registrano in console e basta.
//
// Il nome del file È il metadato: `20260910-143000-auto.json.gz`. Un file indice andrebbe
// tenuto d'accordo con la cartella e, alla prima divergenza (una cancellazione a mano, una
// sincronizzazione di cartella), mostrerebbe voci che non esistono più.

const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const zlib = require('zlib');
const { promisify } = require('util');
const { state, getAllSettings } = require('./workspaceManager');
const Model = require('../shared/model');

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

/** Intervallo minimo fra due snapshot automatici. Sotto, il salvataggio non ne crea. */
const INTERVALLO_AUTO_MS = 30 * 60 * 1000;

const MOTIVI = ['auto', 'manuale', 'prima-ripristino', 'prima-import'];
const RE_NOME = /^(\d{8})-(\d{6})(?:-([a-z-]+))?\.json\.gz$/;

/** Ultimo snapshot automatico creato in questa sessione, per non rifarlo a ogni salvataggio. */
let ultimoAuto = 0;

function cartellaSnapshot(): string | null {
  if (!state.workspacePath) return null;
  return path.join(state.workspacePath, '.archiview', 'snapshots');
}

function assicuraCartella(): string | null {
  const dir = cartellaSnapshot();
  if (!dir) return null;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function due(n: number): string { return (n < 10 ? '0' : '') + n; }

function nomeSnapshot(ts: number, motivo: string): string {
  const d = new Date(ts);
  const giorno = '' + d.getFullYear() + due(d.getMonth() + 1) + due(d.getDate());
  const ora = '' + due(d.getHours()) + due(d.getMinutes()) + due(d.getSeconds());
  const m = MOTIVI.indexOf(motivo) !== -1 ? motivo : 'auto';
  return `${giorno}-${ora}-${m}.json.gz`;
}

/**
 * Il momento e il motivo, letti dal nome. `null` per un file che non è uno snapshot: la
 * cartella è dell'utente e può contenere qualunque cosa ci abbia messo dentro.
 */
function metaDaNome(nome: string): { nome: string; creatoIl: number; motivo: string } | null {
  const m = RE_NOME.exec(nome || '');
  if (!m) return null;
  const [, giorno, ora, motivo] = m;
  const ts = new Date(
    Number(giorno.slice(0, 4)), Number(giorno.slice(4, 6)) - 1, Number(giorno.slice(6, 8)),
    Number(ora.slice(0, 2)), Number(ora.slice(2, 4)), Number(ora.slice(4, 6))
  ).getTime();
  if (!isFinite(ts)) return null;
  return { nome, creatoIl: ts, motivo: motivo || 'auto' };
}

/** Il percorso di uno snapshot, con il nome validato: arriva dal renderer. */
function percorsoSicuro(nome: string): string {
  const dir = cartellaSnapshot();
  if (!dir) throw new Error('Workspace non impostato');
  if (!metaDaNome(path.basename(nome || ''))) throw new Error('Nome snapshot non valido');
  const { safeAttachmentPath } = require('./ipc/pathSafety');
  return safeAttachmentPath(dir, nome);
}

/** Le impostazioni di conservazione, con i valori di `shared/model.ts` come predefiniti. */
function opzioniRotazione(): { recenti: number; giorni: number; attivi: boolean } {
  const s = getAllSettings() || {};
  const num = (v: any, dflt: number) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : dflt);
  return {
    attivi: s.snapshotAutomatici !== false,
    recenti: num(s.snapshotRecenti, Model.SNAPSHOT_RECENTI),
    giorni: num(s.snapshotGiorni, Model.SNAPSHOT_GIORNI)
  };
}

async function elencaSnapshot(): Promise<any[]> {
  const dir = cartellaSnapshot();
  if (!dir || !fs.existsSync(dir)) return [];
  const nomi = await fsp.readdir(dir);
  const voci: any[] = [];
  for (const nome of nomi) {
    const meta = metaDaNome(nome);
    if (!meta) continue;
    try {
      const st = await fsp.stat(path.join(dir, nome));
      voci.push({ ...meta, sizeBytes: st.size });
    } catch { /* sparito fra readdir e stat: semplicemente non esiste */ }
  }
  return voci.sort((a, b) => b.creatoIl - a.creatoIl);
}

/** Applica la regola di conservazione e cancella il resto. Ritorna i nomi eliminati. */
async function ruotaSnapshot(): Promise<string[]> {
  const dir = cartellaSnapshot();
  if (!dir) return [];
  const voci = await elencaSnapshot();
  const { recenti, giorni } = opzioniRotazione();
  const { eliminare } = Model.rotazioneSnapshot(voci, { recenti, giorni });
  const fatti: string[] = [];
  for (const nome of eliminare) {
    try {
      await fsp.unlink(path.join(dir, nome));
      fatti.push(nome);
    } catch (e: any) {
      console.error('[Snapshot] Eliminazione fallita per', nome, e && e.message);
    }
  }
  return fatti;
}

/**
 * Scrive uno snapshot. `payload` è la stringa JSON del database; se manca, si rilegge il
 * file su disco (è il caso dello snapshot su richiesta, che non passa da un salvataggio).
 */
async function creaSnapshot(payload?: string | null, motivo: string = 'manuale'): Promise<any> {
  const dir = assicuraCartella();
  if (!dir) throw new Error('Workspace non impostato');

  let json = typeof payload === 'string' ? payload : null;
  if (!json) {
    if (!state.dataFilePath || !fs.existsSync(state.dataFilePath)) throw new Error('Nessun database da fotografare');
    json = await fsp.readFile(state.dataFilePath, 'utf8');
  }

  const ts = Date.now();
  let nome = nomeSnapshot(ts, motivo);
  // Due snapshot nello stesso secondo (un ripristino subito dopo un salvataggio): il
  // secondo slitta in avanti finché il nome è libero, invece di sovrascrivere il primo.
  let scarto = 0;
  while (fs.existsSync(path.join(dir, nome)) && scarto < 60) {
    scarto++;
    nome = nomeSnapshot(ts + scarto * 1000, motivo);
  }

  const compresso = await gzipAsync(Buffer.from(json, 'utf8'));
  // Scrittura atomica come per il database: un crash a metà lascerebbe uno snapshot
  // troncato, cioè una rete di sicurezza che si scopre rotta proprio quando serve.
  const tmp = path.join(dir, nome + '.tmp');
  await fsp.writeFile(tmp, compresso);
  await fsp.rename(tmp, path.join(dir, nome));

  if (motivo === 'auto') ultimoAuto = ts;
  await ruotaSnapshot();
  return { nome, creatoIl: ts, motivo, sizeBytes: compresso.length };
}

/**
 * Lo snapshot automatico agganciato al salvataggio: crea solo se è passato l'intervallo
 * minimo dall'ultimo. Non lancia MAI (vedi la decisione 3 in testa al file).
 */
async function forseCreaSnapshotAutomatico(payload: string): Promise<void> {
  try {
    const { attivi } = opzioniRotazione();
    if (!attivi) return;
    if (!cartellaSnapshot()) return;
    if (ultimoAuto === 0) {
      // Prima scrittura della sessione: l'intervallo si conta dall'ULTIMO snapshot su
      // disco, non dall'avvio, o riaprire l'app dieci volte di fila ne creerebbe dieci.
      const voci = await elencaSnapshot();
      ultimoAuto = voci.length ? voci[0].creatoIl : 0;
    }
    if (Date.now() - ultimoAuto < INTERVALLO_AUTO_MS) return;
    await creaSnapshot(payload, 'auto');
  } catch (e: any) {
    console.error('[Snapshot] Creazione automatica fallita:', e && e.message);
  }
}

async function caricaSnapshot(nome: string): Promise<any> {
  const file = percorsoSicuro(nome);
  const compresso = await fsp.readFile(file);
  const json = (await gunzipAsync(compresso)).toString('utf8');
  return JSON.parse(json);
}

async function eliminaSnapshot(nome: string): Promise<void> {
  await fsp.unlink(percorsoSicuro(nome));
}

/**
 * Fase 4.3 — la storia di UNA scheda, ricavata dagli snapshot.
 *
 * Il lavoro sta qui e non nel renderer perché significa decomprimere e parsare N database
 * interi: farlo nella finestra bloccherebbe l'interfaccia per tutto il tempo, e per giunta
 * farebbe attraversare l'IPC a N copie dell'archivio per tenerne una scheda ciascuna.
 *
 * Ritorna solo i momenti in cui la scheda è CAMBIATA (impronta diversa dalla precedente),
 * dal più recente: una cronologia con venti voci identiche non è una cronologia.
 */
async function storiaRecord(id: string): Promise<any[]> {
  const voci = await elencaSnapshot();
  const tappe: any[] = [];
  let precedente: string | null = null;
  // Dal più VECCHIO al più recente: il confronto "è cambiato?" ha senso solo in avanti.
  for (const v of voci.slice().reverse()) {
    let db: any = null;
    try { db = await caricaSnapshot(v.nome); } catch { continue; }
    const rec = (db && Array.isArray(db.manoscritti))
      ? db.manoscritti.find((m: any) => String(m.id) === String(id))
      : null;
    const impronta = rec ? JSON.stringify(rec) : '';
    if (impronta === precedente) continue;
    precedente = impronta;
    tappe.push({ nome: v.nome, creatoIl: v.creatoIl, motivo: v.motivo, record: rec || null });
  }
  return tappe.reverse();
}

module.exports = {
  INTERVALLO_AUTO_MS,
  cartellaSnapshot,
  nomeSnapshot,
  metaDaNome,
  elencaSnapshot,
  creaSnapshot,
  forseCreaSnapshotAutomatico,
  ruotaSnapshot,
  caricaSnapshot,
  eliminaSnapshot,
  storiaRecord
};
export {};
