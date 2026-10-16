import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { hashFile } from '../chunkingLogic';
const ScannerLotto = require('../../shared/scannerLotto');

const MAX_BYTE_MANIFEST = 2 * 1024 * 1024;
const PAGINE_IN_PARALLELO = 3;

type PaginaLotto = { file: string; sha256: string; byte: number };

export interface VoceSorgente {
  id: string;
  completo: boolean;
}

export interface SorgenteLotti {
  elenca(): Promise<VoceSorgente[]>;
  leggiManifest(id: string, maxByte: number): Promise<string>;
  scaricaPagina(id: string, pagina: PaginaLotto, destinazione: string): Promise<void>;
  rimuovi(id: string): Promise<void>;
}

export interface OpzioniArrivo {
  sorgente: SorgenteLotti;
  cartellaArrivo: string;
  cartellaTemp: string;
  cartellaAssegnati?: string;
  archivio?: string;
  avanzamento?: (e: { id: string; fatte: number; totali: number }) => void;
}

export interface EsitoArrivo {
  ricevuti: string[];
  giaPresenti: string[];
  inCaricamento: string[];
  altroArchivio: string[];
  falliti: { id: string; codice: string; dettaglio?: any }[];
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
  if (lotto.id !== id) throw new ErroreLotto('id_diverso', { cartella: id, manifest: lotto.id });
  if (o.archivio !== undefined && lotto.archivio !== undefined && ScannerLotto.nomeArchivio(lotto.archivio) !== ScannerLotto.nomeArchivio(o.archivio)) {
    throw new ErroreLotto('altro_archivio', lotto.archivio);
  }

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
    if (await esiste(finale)) await fsp.rm(finale, { recursive: true, force: true });
    await fsp.rename(temp, finale);
  } catch (e) {
    await fsp.rm(temp, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

async function riceviLotti(o: OpzioniArrivo): Promise<EsitoArrivo> {
  const esito: EsitoArrivo = { ricevuti: [], giaPresenti: [], inCaricamento: [], altroArchivio: [], falliti: [], nonRimossi: [] };
  await fsp.mkdir(o.cartellaArrivo, { recursive: true });
  await fsp.rm(o.cartellaTemp, { recursive: true, force: true });
  await fsp.mkdir(o.cartellaTemp, { recursive: true });

  const voci = await o.sorgente.elenca();
  const visti = new Set<string>();
  for (const v of voci) {
    const id = v && v.id;
    if (!ScannerLotto.idValido(id)) {
      esito.falliti.push({ id: String(id), codice: 'id_non_valido' });
      continue;
    }
    if (visti.has(id)) { esito.falliti.push({ id, codice: 'id_duplicato' }); continue; }
    visti.add(id);
    if (!v.completo) { esito.inCaricamento.push(id); continue; }

    if (await esiste(path.join(o.cartellaArrivo, id, ScannerLotto.NOME_MANIFEST)) ||
        (o.cartellaAssegnati && await esiste(path.join(o.cartellaAssegnati, id)))) {
      esito.giaPresenti.push(id);
    } else {
      try {
        await scaricaLotto(id, o);
        esito.ricevuti.push(id);
      } catch (e: any) {
        if (e instanceof ErroreLotto && e.codice === 'altro_archivio') esito.altroArchivio.push(id);
        else if (e instanceof ErroreLotto) esito.falliti.push({ id, codice: e.codice, dettaglio: e.dettaglio });
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

export { riceviLotti, MAX_BYTE_MANIFEST };
