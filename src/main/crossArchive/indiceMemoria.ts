import * as path from 'path';
const fsp = require('fs').promises;
const Model = require('../../shared/model');
import { NORMALIZZAZIONE_VERSIONE, analizzaQuery, posizioneOriginale, normalizza } from './testo';
import { INDICE_FORMATO, PESO, contestoArchivio, costruisciVoce } from './voce';

const FILE_DATABASE = 'database_manoscritti.json';

type ArchivioRif = { id: string; percorso: string };

type StatoArchivio = {
  id: string;
  raggiungibile: boolean;
  schede: number;
  aggiornatoIl: number | null;
  errore?: 'assente' | 'illeggibile' | 'formato';
  futuro?: true;
  ricostruite: number;
};

type Query = {
  testo: string;
  soloAnagrafica?: boolean;
  chiaveAnagrafica?: string;
  archivi?: string[];
  cursore?: string | null;
  limite?: number;
};

type Estratto = { prima: string; match: string; dopo: string };

type Risultato = {
  archivioId: string;
  schedaId: string;
  segnatura: string;
  tipoId: string;
  tipoNome: string;
  campo: string;
  campoLabel?: string;
  estratto: Estratto;
  punteggio: number;
  anagrafica: { tipo: string; nome: string }[];
};

type PaginaRisultati = {
  risultati: Risultato[];
  cursore: string | null;
  totale: number;
  totaleTroncato: boolean;
  cursoreScaduto?: true;
};

type ContestoScheda = {
  vocabolari: { [id: string]: any };
  authority: { [chiave: string]: any };
  segnatureRelazioni: { [id: string]: string };
};

interface IndiceArchivi {
  sincronizza(archivi: ArchivioRif[]): Promise<StatoArchivio[]>;
  cerca(q: Query, segnale?: AbortSignal): Promise<PaginaRisultati>;
  scheda(archivioId: string, schedaId: string): Promise<{ scheda: any; tipo: any; contesto: ContestoScheda } | null>;
  invalida(archivioId?: string): Promise<void>;
  chiudi?(): Promise<void>;
}

const LIMITE_PREDEFINITO = 50;
const LIMITE_MASSIMO = 200;
const MAX_RISULTATI = 2000;
const PASSO_CESSIONE = 2000;
const CONTESTO_ESTRATTO = 70;

type Archivio = {
  id: string;
  percorso: string;
  mtimeMs: number;
  size: number;
  firma: string;
  voci: any[];
  perId: Map<string, any>;
  futuro: boolean;
  ultimoUso: number;
  formato: number;
  normalizzazione: number;
};

type Corrispondenza = { archivioId: string; voce: any; campo: any; termine: string; punteggio: number };

type FsLike = {
  stat(p: string): Promise<{ mtimeMs: number; size: number; isDirectory(): boolean }>;
  readFile(p: string, enc: 'utf8'): Promise<string>;
};

type OpzioniIndice = {
  fs?: FsLike;
  maxArchivi?: number;
  limiteTesto?: number;
};

function erroreAnnullato() {
  const e: any = new Error('Ricerca annullata');
  e.name = 'AbortError';
  return e;
}

const COLLATOR = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });
function confrontaSegnature(a: string, b: string): number {
  return COLLATOR.compare(a, b);
}

function cedi(): Promise<void> {
  return new Promise(r => setImmediate(r));
}

function chiaveQuery(q: Query, archivi: string[]): string {
  return JSON.stringify([q.testo, !!q.soloAnagrafica, q.chiaveAnagrafica || '', archivi]);
}

function codificaCursore(c: object): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function decodificaCursore(s: any): any {
  if (typeof s !== 'string' || !s || s.length > 512) return null;
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); } catch (e) { return null; }
}

function estratto(orig: string, norm: string, termine: string): Estratto {
  const pos = termine ? norm.indexOf(termine) : -1;
  if (pos < 0) {
    const testa = orig.slice(0, CONTESTO_ESTRATTO * 2);
    return { prima: '', match: '', dopo: testa + (orig.length > testa.length ? '…' : '') };
  }
  const da = posizioneOriginale(orig, pos);
  const a = posizioneOriginale(orig, pos + termine.length);
  const inizio = Math.max(0, da - CONTESTO_ESTRATTO);
  const fine = Math.min(orig.length, a + CONTESTO_ESTRATTO);
  return {
    prima: (inizio > 0 ? '…' : '') + orig.slice(inizio, da).replace(/\s+/g, ' ').trimStart(),
    match: orig.slice(da, a),
    dopo: orig.slice(a, fine).replace(/\s+/g, ' ').trimEnd() + (fine < orig.length ? '…' : '')
  };
}

function contestoScheda(db: any, m: any): ContestoScheda {
  const ana = Model.authority(db);
  const authority: { [k: string]: any } = {};
  const prova = (nome: any) => {
    for (const tipo of Model.TIPI_AUTHORITY) {
      const k = Model.chiaveAuthority(tipo, nome);
      if (k && ana[k]) authority[k] = ana[k];
    }
  };
  for (const k of Object.keys(m)) {
    const v = m[k];
    if (typeof v === 'string' && v.length < 500) prova(v);
    else if (Array.isArray(v)) for (const e of v) if (e && typeof e === 'object') prova(e.v !== undefined ? e.v : e.nome);
  }
  const segnatureRelazioni: { [id: string]: string } = {};
  for (const r of Model.relazioni(m)) {
    const altra = (db.manoscritti || []).find((x: any) => x && String(x.id) === r.id);
    if (altra && altra.segnatura) segnatureRelazioni[r.id] = String(altra.segnatura);
  }
  return { vocabolari: db.vocabolari && typeof db.vocabolari === 'object' ? db.vocabolari : {}, authority, segnatureRelazioni };
}

class IndiceMemoria implements IndiceArchivi {
  private fs: FsLike;
  private maxArchivi: number;
  private limiteTesto: number;
  private archivi = new Map<string, Archivio>();
  private percorsi = new Map<string, string>();
  private attivi: string[] = [];
  private inCorso = new Map<string, Promise<StatoArchivio>>();
  private generazione = 0;
  private ultimaRicerca: { chiave: string; generazione: number; risultati: Corrispondenza[]; troncato: boolean } | null = null;

  constructor(opzioni?: OpzioniIndice) {
    const o = opzioni || {};
    this.fs = o.fs || { stat: (p) => fsp.stat(p), readFile: (p, enc) => fsp.readFile(p, enc) };
    this.maxArchivi = Math.max(1, o.maxArchivi || 16);
    this.limiteTesto = o.limiteTesto === undefined ? 256 * 1024 : Math.max(0, o.limiteTesto);
  }

  async sincronizza(rif: ArchivioRif[]): Promise<StatoArchivio[]> {
    const elenco = (Array.isArray(rif) ? rif : []).filter(a => a && a.id && a.percorso);
    this.attivi = elenco.map(a => a.id);
    for (const a of elenco) this.percorsi.set(a.id, a.percorso);
    const stati = await Promise.all(elenco.map(a => this.sincronizzaUno(a)));
    this.sfoltisci();
    return stati;
  }

  private sincronizzaUno(a: ArchivioRif): Promise<StatoArchivio> {
    const gia = this.inCorso.get(a.id);
    if (gia) return gia;
    const p = this.caricaArchivio(a).finally(() => this.inCorso.delete(a.id));
    this.inCorso.set(a.id, p);
    return p;
  }

  private async caricaArchivio(a: ArchivioRif): Promise<StatoArchivio> {
    const vuoto = (errore?: StatoArchivio['errore']): StatoArchivio => {
      const s: StatoArchivio = { id: a.id, raggiungibile: !errore, schede: 0, aggiornatoIl: null, ricostruite: 0 };
      if (errore) s.errore = errore;
      return s;
    };

    try {
      const dir = await this.fs.stat(a.percorso);
      if (!dir.isDirectory()) return this.scarta(a.id, vuoto('assente'));
    } catch (e) {
      return this.scarta(a.id, vuoto(e && e.code === 'ENOENT' ? 'assente' : 'illeggibile'));
    }

    const file = path.join(a.percorso, FILE_DATABASE);
    let st;
    try {
      st = await this.fs.stat(file);
    } catch (e) {
      if (e && e.code === 'ENOENT') return this.scarta(a.id, vuoto());
      return this.scarta(a.id, vuoto('illeggibile'));
    }

    const prima = this.archivi.get(a.id);
    if (prima && prima.percorso === a.percorso && prima.mtimeMs === st.mtimeMs && prima.size === st.size &&
        prima.formato === INDICE_FORMATO && prima.normalizzazione === NORMALIZZAZIONE_VERSIONE) {
      prima.ultimoUso = Date.now();
      return this.stato(prima, 0);
    }

    let grezzo;
    try {
      grezzo = await this.fs.readFile(file, 'utf8');
    } catch (e) {
      return this.scarta(a.id, vuoto('illeggibile'));
    }
    let db;
    try {
      const esito = Model.migraDatabase(JSON.parse(grezzo));
      db = esito.db;
      db.__futuro = esito.futuro;
    } catch (e) {
      return this.scarta(a.id, vuoto('formato'));
    }
    grezzo = null;

    const ctx = contestoArchivio(db);
    const riusabili = prima && prima.firma === ctx.firma && prima.formato === INDICE_FORMATO &&
      prima.normalizzazione === NORMALIZZAZIONE_VERSIONE ? prima.perId : null;
    const voci: any[] = [];
    const perId = new Map<string, any>();
    let ricostruite = 0;
    for (const m of Array.isArray(db.manoscritti) ? db.manoscritti : []) {
      if (!m || m.id === undefined || m.id === null) continue;
      const id = String(m.id);
      if (perId.has(id)) continue;
      const vecchia = riusabili ? riusabili.get(id) : null;
      let voce;
      if (vecchia && vecchia.lastModified !== null && vecchia.lastModified === m.lastModified) {
        voce = vecchia;
      } else {
        voce = costruisciVoce(m, ctx, this.limiteTesto);
        ricostruite++;
      }
      if (!voce) continue;
      voci.push(voce);
      perId.set(id, voce);
    }

    const arch: Archivio = {
      id: a.id, percorso: a.percorso, mtimeMs: st.mtimeMs, size: st.size, firma: ctx.firma,
      voci, perId, futuro: !!db.__futuro, ultimoUso: Date.now(),
      formato: INDICE_FORMATO, normalizzazione: NORMALIZZAZIONE_VERSIONE
    };
    this.archivi.set(a.id, arch);
    this.generazione++;
    return this.stato(arch, ricostruite);
  }

  private stato(a: Archivio, ricostruite: number): StatoArchivio {
    const s: StatoArchivio = { id: a.id, raggiungibile: true, schede: a.voci.length, aggiornatoIl: a.mtimeMs, ricostruite };
    if (a.futuro) s.futuro = true;
    return s;
  }

  private scarta(id: string, s: StatoArchivio): StatoArchivio {
    if (this.archivi.delete(id)) this.generazione++;
    return s;
  }

  private sfoltisci() {
    if (this.archivi.size <= this.maxArchivi) return;
    const attivi = new Set(this.attivi);
    const candidati = [...this.archivi.values()].filter(a => !attivi.has(a.id)).sort((x, y) => x.ultimoUso - y.ultimoUso);
    for (const a of candidati) {
      if (this.archivi.size <= this.maxArchivi) break;
      this.archivi.delete(a.id);
    }
  }

  async cerca(q: Query, segnale?: AbortSignal): Promise<PaginaRisultati> {
    const testo = String((q && q.testo) || '').slice(0, 500);
    const limite = Math.min(LIMITE_MASSIMO, Math.max(1, Math.floor(Number(q && q.limite) || LIMITE_PREDEFINITO)));
    const richiesti = q && Array.isArray(q.archivi) ? q.archivi.map(String) : null;
    const ordine = this.attivi.filter(id => this.archivi.has(id) && (!richiesti || richiesti.indexOf(id) !== -1));
    const { token, frasi } = analizzaQuery(testo);
    const chiaveAna = q && typeof q.chiaveAnagrafica === 'string' ? q.chiaveAnagrafica.slice(0, 300) : '';
    const termini = chiaveAna ? [] : frasi.concat(token);
    if (!termini.length && !chiaveAna) return { risultati: [], cursore: null, totale: 0, totaleTroncato: false };

    const chiave = chiaveQuery({ testo, soloAnagrafica: q.soloAnagrafica, chiaveAnagrafica: chiaveAna }, ordine);
    let offset = 0;
    if (q.cursore) {
      const c = decodificaCursore(q.cursore);
      if (!c || c.k !== chiave || c.g !== this.generazione || typeof c.o !== 'number') {
        return { risultati: [], cursore: null, totale: 0, totaleTroncato: false, cursoreScaduto: true };
      }
      offset = Math.max(0, Math.floor(c.o));
    }

    let tutti: Corrispondenza[];
    let troncato: boolean;
    const cache = this.ultimaRicerca;
    if (cache && cache.chiave === chiave && cache.generazione === this.generazione) {
      tutti = cache.risultati;
      troncato = cache.troncato;
    } else {
      const esito = await this.scansiona(ordine, termini, !!q.soloAnagrafica, segnale, chiaveAna);
      tutti = esito.risultati;
      troncato = esito.troncato;
      this.ultimaRicerca = { chiave, generazione: this.generazione, risultati: tutti, troncato };
    }

    const pagina = tutti.slice(offset, offset + limite).map(c => this.risultato(c));
    const prossimo = offset + limite < tutti.length
      ? codificaCursore({ k: chiave, g: this.generazione, o: offset + limite })
      : null;
    return { risultati: pagina, cursore: prossimo, totale: tutti.length, totaleTroncato: troncato };
  }

  private risultato(c: Corrispondenza): Risultato {
    const v = c.voce;
    const r: Risultato = {
      archivioId: c.archivioId,
      schedaId: v.id,
      segnatura: v.segnatura,
      tipoId: v.tipoId,
      tipoNome: v.tipoNome,
      campo: c.campo ? c.campo.id : 'anagrafica',
      estratto: c.campo ? estratto(c.campo.orig, c.campo.norm, c.termine) : { prima: '', match: v.anagrafica[0].nome, dopo: '' },
      punteggio: c.punteggio,
      anagrafica: v.anagrafica.map((a: any) => ({ tipo: a.tipo, nome: a.nome }))
    };
    if (c.campo && c.campo.label) r.campoLabel = c.campo.label;
    return r;
  }

  private async scansiona(ordine: string[], termini: string[], soloAnagrafica: boolean, segnale?: AbortSignal, chiaveAna?: string) {
    const risultati: Corrispondenza[] = [];
    const posizione = new Map(ordine.map((id, i) => [id, i]));
    let contatore = 0;
    let troncato = false;

    for (const archivioId of ordine) {
      const arch = this.archivi.get(archivioId);
      if (!arch) continue;
      arch.ultimoUso = Date.now();
      for (const voce of arch.voci) {
        if (++contatore % PASSO_CESSIONE === 0) {
          await cedi();
          if (segnale && segnale.aborted) throw erroreAnnullato();
        }
        const r = chiaveAna ? this.provaChiave(voce, chiaveAna)
          : soloAnagrafica ? this.provaAnagrafica(voce, termini) : this.provaCampi(voce, termini);
        if (!r) continue;
        if (risultati.length >= MAX_RISULTATI) { troncato = true; continue; }
        risultati.push({ archivioId, voce, campo: r.campo, termine: r.termine, punteggio: r.punteggio });
      }
    }
    if (segnale && segnale.aborted) throw erroreAnnullato();

    risultati.sort((a, b) =>
      b.punteggio - a.punteggio ||
      (posizione.get(a.archivioId) ?? 0) - (posizione.get(b.archivioId) ?? 0) ||
      confrontaSegnature(a.voce.segnatura, b.voce.segnatura) ||
      (a.voce.id < b.voce.id ? -1 : a.voce.id > b.voce.id ? 1 : 0));
    return { risultati, troncato };
  }

  private provaCampi(voce: any, termini: string[]) {
    let punteggio = 0;
    let primo: { campo: any; termine: string } | null = null;
    let comune: Set<any> | null = null;
    for (const t of termini) {
      let migliore: any = null;
      const contenenti = new Set<any>();
      for (const c of voce.campi) {
        if (c.norm.indexOf(t) === -1) continue;
        contenenti.add(c);
        if (!migliore || c.peso > migliore.peso) migliore = c;
      }
      if (!migliore) return null;
      punteggio += migliore.peso;
      if (!primo) primo = { campo: migliore, termine: t };
      comune = comune ? new Set([...comune].filter(c => contenenti.has(c))) : contenenti;
    }
    if (termini.length > 1 && comune && comune.size) punteggio += PESO.campo;
    if (!primo) return null;
    return { campo: primo.campo, termine: primo.termine, punteggio };
  }

  private provaChiave(voce: any, chiave: string) {
    const n = voce.anagrafica.find((a: any) => a.chiave === chiave);
    if (!n) return null;
    const termine = normalizza(chiave.slice(chiave.indexOf(':') + 1));
    const campo = voce.campi.find((c: any) => c.peso === PESO.anagrafica && c.norm.indexOf(termine) !== -1) || null;
    return { campo, termine, punteggio: PESO.anagrafica };
  }

  private provaAnagrafica(voce: any, termini: string[]) {
    if (!voce.anagrafica.length) return null;
    for (const t of termini) {
      if (!voce.anagrafica.some((a: any) => a.norm.indexOf(t) !== -1)) return null;
    }
    const campo = voce.campi.find((c: any) => c.peso === PESO.anagrafica && c.norm.indexOf(termini[0]) !== -1) || null;
    return { campo, termine: termini[0], punteggio: PESO.anagrafica * termini.length };
  }

  async scheda(archivioId: string, schedaId: string) {
    const percorso = this.percorsi.get(String(archivioId));
    if (!percorso) return null;
    try {
      const db = Model.migraDatabase(JSON.parse(await this.fs.readFile(path.join(percorso, FILE_DATABASE), 'utf8'))).db;
      const m = (db.manoscritti || []).find((x: any) => x && String(x.id) === String(schedaId));
      if (!m) return null;
      const tipo = (db.tipiDocumento || []).find((t: any) => t && t.id === m.tipoDocumento) || null;
      return { scheda: m, tipo, contesto: contestoScheda(db, m) };
    } catch (e) {
      return null;
    }
  }

  async invalida(archivioId?: string) {
    if (archivioId) this.archivi.delete(String(archivioId));
    else this.archivi.clear();
    this.generazione++;
    this.ultimaRicerca = null;
  }
}

export { IndiceMemoria, LIMITE_MASSIMO, MAX_RISULTATI };
export type { IndiceArchivi, ArchivioRif, StatoArchivio, Query, PaginaRisultati, Risultato, ContestoScheda };
