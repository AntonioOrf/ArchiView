// Fase 4.1 — Il cestino.
//
// L'eliminazione era hard delete: il record spariva dal database e l'unica rete era lo
// stack undo in RAM, monouso e vivo solo finché la finestra restava aperta. Ora la scheda
// eliminata viene copiata qui prima di sparire, e da qui si può rimettere al suo posto.
//
// ⚠️ IL CESTINO NON STA NEL DATABASE E NON SI SINCRONIZZA.
//
// È la decisione che spiega tutto il resto del file. Il database è il file che viene
// caricato sul cloud, e mettere il cestino dentro di esso avrebbe tre conseguenze, tutte
// sbagliate:
//
// 1. **Il "definitivamente" non sarebbe definitivo.** Svuotare il cestino su una macchina
//    e sincronizzare da un'altra farebbe tornare tutto: l'unione dei tombstone risolve la
//    cancellazione di un RECORD, non quella di una voce di cestino, che avrebbe bisogno di
//    tombstone propri — cioè di un secondo meccanismo di cancellazione sopra il primo.
// 2. **Le schede eliminate viaggerebbero.** Un archivio condiviso trasporterebbe per
//    trenta giorni una copia di tutto ciò che chiunque ha buttato via, a ogni pull di ogni
//    collega.
// 3. **Il cestino di un collega non è il mio.** Chi elimina sa perché lo ha fatto; a chi
//    riceve la modifica quella scheda risulterebbe da recuperare senza sapere da chi né
//    perché sia lì.
//
// L'eliminazione invece continua a sincronizzarsi ESATTAMENTE come prima, attraverso
// `deletedIds`: il cestino non tocca il merge e non cambia una riga di `state.ts`. È una
// copia locale in più, non un secondo modello del dato.
//
// Formato di `<workspace>/.archiview/cestino.json`:
//   [{ deletedAt: number, record: AVScheda, cartella: string, da: string }]
// `cartella` è ridondante (sta nel record) ma è ciò che si mostra nella lista: leggerla dal
// record vorrebbe dire riesumare l'intero oggetto per stampare una riga.

const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { state, getAllSettings } = require('./workspaceManager');
const Model = require('../shared/model');

/** Tetto di sicurezza: un'operazione in massa su un archivio grosso non deve gonfiare il file. */
const MAX_VOCI = 2000;

function percorsoCestino(): string | null {
  if (!state.workspacePath) return null;
  return path.join(state.workspacePath, '.archiview', 'cestino.json');
}

function giorniConservazione(): number {
  const s = getAllSettings() || {};
  const v = s.cestinoGiorni;
  return typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : Model.CESTINO_GIORNI;
}

async function leggiGrezzo(): Promise<any[]> {
  const file = percorsoCestino();
  if (!file || !fs.existsSync(file)) return [];
  try {
    const dati = JSON.parse(await fsp.readFile(file, 'utf8'));
    return Array.isArray(dati) ? dati : [];
  } catch (e: any) {
    // Un cestino illeggibile non deve impedire di lavorare: si riparte da vuoto. Il file
    // NON si cancella, così resta recuperabile a mano se conteneva qualcosa di prezioso.
    console.error('[Cestino] File illeggibile, ignorato:', e && e.message);
    return [];
  }
}

async function scrivi(voci: any[]): Promise<void> {
  const file = percorsoCestino();
  if (!file) throw new Error('Workspace non impostato');
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(voci));
  await fsp.rename(tmp, file);
}

/**
 * Le voci ancora valide. La scadenza si applica in LETTURA e non con un lavoro periodico:
 * un'app che non viene aperta per un mese non deve conservare per sempre ciò che era già
 * scaduto, e non serve un timer che giri a vuoto per ricordarselo.
 */
async function elencaCestino(): Promise<any[]> {
  const voci = Model.cestinoValido(await leggiGrezzo(), { giorni: giorniConservazione() });
  return voci.slice(0, MAX_VOCI);
}

/** Riscrive il file solo se la potatura ha davvero tolto qualcosa. */
async function potaCestino(): Promise<number> {
  const grezzo = await leggiGrezzo();
  const validi = Model.cestinoValido(grezzo, { giorni: giorniConservazione() }).slice(0, MAX_VOCI);
  if (validi.length !== grezzo.length) await scrivi(validi);
  return grezzo.length - validi.length;
}

/** Aggiunge le schede eliminate. Le voci più vecchie cedono il posto quando si sfora. */
async function aggiungiAlCestino(records: any[], da?: string): Promise<number> {
  const lista = Array.isArray(records) ? records.filter(r => r && r.id) : [];
  if (lista.length === 0) return 0;
  if (giorniConservazione() === 0) return 0;   // conservazione disattivata: si elimina e basta

  const ora = Date.now();
  const nuove = lista.map(r => ({
    deletedAt: ora,
    record: r,
    cartella: typeof r.cartella === 'string' ? r.cartella : '',
    da: da || ''
  }));

  const esistenti = Model.cestinoValido(await leggiGrezzo(), { giorni: giorniConservazione() });
  // Una scheda eliminata due volte (eliminata, ripristinata, rieliminata) ha una voce sola,
  // la più recente: due righe identiche nella lista non aiutano nessuno a scegliere.
  const idNuovi = new Set(nuove.map(v => String(v.record.id)));
  const fuse = nuove.concat(esistenti.filter(v => !idNuovi.has(String(v.record && v.record.id))));
  await scrivi(fuse.slice(0, MAX_VOCI));
  return nuove.length;
}

/** Estrae le voci indicate e le toglie dal file. Ritorna i RECORD, pronti a rientrare. */
async function prendiDalCestino(ids: string[]): Promise<any[]> {
  const cercati = new Set((ids || []).map(String));
  const voci = Model.cestinoValido(await leggiGrezzo(), { giorni: giorniConservazione() });
  const presi = voci.filter(v => cercati.has(String(v.record.id)));
  if (presi.length) await scrivi(voci.filter(v => !cercati.has(String(v.record.id))));
  return presi.map(v => v.record);
}

/** Eliminazione definitiva di alcune voci. */
async function eliminaDalCestino(ids: string[]): Promise<number> {
  const cercati = new Set((ids || []).map(String));
  const voci = Model.cestinoValido(await leggiGrezzo(), { giorni: giorniConservazione() });
  const restanti = voci.filter(v => !cercati.has(String(v.record.id)));
  await scrivi(restanti);
  return voci.length - restanti.length;
}

async function svuotaCestino(): Promise<number> {
  const voci = await leggiGrezzo();
  await scrivi([]);
  return voci.length;
}

module.exports = {
  MAX_VOCI,
  percorsoCestino,
  elencaCestino,
  potaCestino,
  aggiungiAlCestino,
  prendiDalCestino,
  eliminaDalCestino,
  svuotaCestino
};
export {};
