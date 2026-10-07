// ArchiView Scanner — ricezione dei lotti (docs/scanner/CONTRATTO.md).
//
// Codice PURO rispetto al canale: non sa se i lotti arrivano da Google Drive o dal server
// Wi-Fi. Riceve una `SorgenteLotti` (adattatore Drive: `driveArrivo.ts`; Wi-Fi: Fase 2) e
// scrive su disco. Così le due strade condividono la parte che conta — validazione,
// controllo dei byte e degli hash, scrittura atomica — e il test gira in Node puro con una
// sorgente finta.
//
// Invarianti:
// - Un lotto senza `lotto.json` è ancora in caricamento: non si tocca.
// - Il lotto si scarica in una cartella temporanea SULLO STESSO VOLUME e diventa visibile in
//   `arrivo/<id>/` con un solo `rename`, dopo che ogni pagina ha byte e sha256 attesi e il
//   manifest normalizzato è scritto. In `arrivo/` non c'è mai un lotto a metà.
// - La copia remota si rimuove SOLO DOPO il rename. Se la rimozione fallisce il lotto resta
//   ricevuto: al giro dopo risulta già presente, non si riscarica e si riprova a rimuoverlo.
// - Un lotto che fallisce non blocca gli altri.

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { hashFile } = require('../chunkingLogic');
const ScannerLotto = require('../../shared/scannerLotto');

/** Oltre questa dimensione `lotto.json` non è un manifest (2000 pagine stanno sotto i 500 KB). */
const MAX_BYTE_MANIFEST = 2 * 1024 * 1024;
/** Download in parallelo per lotto: oltre, Drive comincia a rispondere 429. */
const PAGINE_IN_PARALLELO = 3;

type PaginaLotto = { file: string; sha256: string; byte: number };

export interface VoceSorgente {
  /** Nome della cartella remota, che per contratto è l'id del lotto. */
  id: string;
  /** true = c'è `lotto.json`, cioè il telefono ha finito di caricare. */
  completo: boolean;
}

export interface SorgenteLotti {
  elenca(): Promise<VoceSorgente[]>;
  /** Testo di `lotto.json`. Può rifiutare oltre `maxByte`. */
  leggiManifest(id: string, maxByte: number): Promise<string>;
  /** Scrive la pagina in `destinazione` (sovrascrivendo). */
  scaricaPagina(id: string, pagina: PaginaLotto, destinazione: string): Promise<void>;
  /** Toglie il lotto dal canale (Drive: cestino). Chiamata solo a lotto salvato. */
  rimuovi(id: string): Promise<void>;
}

export interface OpzioniArrivo {
  sorgente: SorgenteLotti;
  /** `<workspace>/.archiview/scanner/arrivo` */
  cartellaArrivo: string;
  /** Cartella di lavoro sullo stesso volume di `cartellaArrivo` (il rename deve essere atomico). */
  cartellaTemp: string;
  /** Avanzamento facoltativo, per la UI. */
  avanzamento?: (e: { id: string; fatte: number; totali: number }) => void;
}

export interface EsitoArrivo {
  ricevuti: string[];
  /** Già in `arrivo/`: non riscaricati, solo rimossi dal canale. */
  giaPresenti: string[];
  inCaricamento: string[];
  falliti: { id: string; codice: string; dettaglio?: any }[];
  /** Lotti salvati in locale ma rimasti sul canale (riprova al giro dopo). */
  nonRimossi: string[];
}

class ErroreLotto extends Error {
  codice: string;
  dettaglio: any;
  constructor(codice: string, dettaglio?: any) {
    super(codice);
    this.codice = codice;
    this.dettaglio = dettaglio;
  }
}

async function esiste(p: string): Promise<boolean> {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function verificaFile(percorso: string, atteso: PaginaLotto): Promise<void> {
  const st = await fsp.stat(percorso);
  if (st.size !== atteso.byte) throw new ErroreLotto('byte_diversi', { file: atteso.file, attesi: atteso.byte, trovati: st.size });
  const sha = await hashFile(percorso);
  if (sha !== atteso.sha256) throw new ErroreLotto('sha256_diverso', { file: atteso.file });
}

/** Esegue `fn` su ogni elemento con al più `limite` operazioni in corso; al primo errore smette. */
async function inParallelo<T>(elementi: T[], limite: number, fn: (x: T) => Promise<void>): Promise<void> {
  let prossimo = 0;
  let errore: any = null;
  const lavoratore = async () => {
    while (!errore && prossimo < elementi.length) {
      const x = elementi[prossimo++];
      try { await fn(x); } catch (e) { errore = errore || e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, elementi.length) }, lavoratore));
  if (errore) throw errore;
}

async function scaricaLotto(id: string, o: OpzioniArrivo): Promise<void> {
  let testo: string;
  try {
    testo = await o.sorgente.leggiManifest(id, MAX_BYTE_MANIFEST);
  } catch (e: any) {
    throw new ErroreLotto('manifest_non_leggibile', e && e.message);
  }
  if (typeof testo !== 'string' || testo.length > MAX_BYTE_MANIFEST) throw new ErroreLotto('manifest_troppo_grande');
  let json: any;
  try { json = JSON.parse(testo); } catch { throw new ErroreLotto('manifest_non_json'); }
  const esito = ScannerLotto.valida(json);
  if (!esito.ok) throw new ErroreLotto('manifest_non_valido', esito.errori);
  const lotto = esito.lotto;
  // Il nome della cartella decide dove finisce il lotto: deve essere lo stesso id del manifest.
  if (lotto.id !== id) throw new ErroreLotto('id_diverso', { cartella: id, manifest: lotto.id });

  const temp = path.join(o.cartellaTemp, id + '-' + crypto.randomBytes(4).toString('hex'));
  await fsp.mkdir(temp, { recursive: true });
  try {
    let fatte = 0;
    await inParallelo(lotto.pagine, PAGINE_IN_PARALLELO, async (pg: PaginaLotto) => {
      const dest = path.join(temp, pg.file);
      try {
        await o.sorgente.scaricaPagina(id, pg, dest);
      } catch (e: any) {
        if (e instanceof ErroreLotto) throw e;
        throw new ErroreLotto('pagina_non_scaricata', { file: pg.file, errore: e && e.message });
      }
      await verificaFile(dest, pg);
      fatte++;
      if (o.avanzamento) o.avanzamento({ id, fatte, totali: lotto.pagine.length });
    });
    await fsp.writeFile(path.join(temp, ScannerLotto.NOME_MANIFEST), JSON.stringify(lotto, null, 2), 'utf8');

    const finale = path.join(o.cartellaArrivo, id);
    // Una cartella senza manifest non è un lotto ricevuto (es. creata a mano): si sostituisce.
    if (await esiste(finale)) await fsp.rm(finale, { recursive: true, force: true });
    await fsp.rename(temp, finale);
  } catch (e) {
    await fsp.rm(temp, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

async function riceviLotti(o: OpzioniArrivo): Promise<EsitoArrivo> {
  const esito: EsitoArrivo = { ricevuti: [], giaPresenti: [], inCaricamento: [], falliti: [], nonRimossi: [] };
  await fsp.mkdir(o.cartellaArrivo, { recursive: true });
  // Le ricezioni sono serializzate dal chiamante: quel che resta in temp è di un giro interrotto.
  await fsp.rm(o.cartellaTemp, { recursive: true, force: true });
  await fsp.mkdir(o.cartellaTemp, { recursive: true });

  const voci = await o.sorgente.elenca();
  const visti = new Set<string>();
  for (const v of voci) {
    const id = v && v.id;
    if (!ScannerLotto.idValido(id)) {
      // Una cartella estranea nel canale: non è nostra, non si tocca.
      esito.falliti.push({ id: String(id), codice: 'id_non_valido' });
      continue;
    }
    if (visti.has(id)) { esito.falliti.push({ id, codice: 'id_duplicato' }); continue; }
    visti.add(id);
    if (!v.completo) { esito.inCaricamento.push(id); continue; }

    if (await esiste(path.join(o.cartellaArrivo, id, ScannerLotto.NOME_MANIFEST))) {
      esito.giaPresenti.push(id);
    } else {
      try {
        await scaricaLotto(id, o);
        esito.ricevuti.push(id);
      } catch (e: any) {
        if (e instanceof ErroreLotto) esito.falliti.push({ id, codice: e.codice, dettaglio: e.dettaglio });
        else esito.falliti.push({ id, codice: 'errore_locale', dettaglio: e && e.message });
        continue;
      }
    }
    try {
      await o.sorgente.rimuovi(id);
    } catch (e: any) {
      console.warn('[scanner] lotto salvato ma non rimosso dal canale:', id, e && e.message);
      esito.nonRimossi.push(id);
    }
  }
  return esito;
}

module.exports = { riceviLotti, MAX_BYTE_MANIFEST };
