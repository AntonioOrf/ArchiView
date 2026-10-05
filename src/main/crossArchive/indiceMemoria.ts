// Ricerca tra archivi — primo backend del contratto `IndiceArchivi`: tutto in memoria,
// scansione lineare sui testi normalizzati.
//
// È la scelta giusta per pochi archivi piccoli e la sbagliata per cento archivi grandi: per
// questo nessuno fuori da `crossArchive/` conosce questa classe. Il giorno in cui la prova di
// carico (`test/crossArchiveBench.test.js`) sfora le soglie, si scrive un altro backend con
// gli stessi quattro metodi e cambia una riga in `client.ts`.
//
// Nessuna dipendenza da electron: gira identico nel worker, nel main (ripiego) e nei test.
//
// ⚠️ SOLA LETTURA. Il database degli altri archivi viene letto e migrato IN MEMORIA, mai
// riscritto: un archivio di una versione più nuova resta com'è, un archivio vecchio verrà
// migrato da chi lo apre davvero.

const path = require('path');
const fsp = require('fs').promises;
const Model = require('../../shared/model');
const { NORMALIZZAZIONE_VERSIONE, analizzaQuery, posizioneOriginale, normalizza } = require('./testo');
const { INDICE_FORMATO, PESO, contestoArchivio, costruisciVoce } = require('./voce');

const FILE_DATABASE = 'database_manoscritti.json';

// --- Contratto -----------------------------------------------------------------

type ArchivioRif = { id: string; percorso: string };

type StatoArchivio = {
  id: string;
  raggiungibile: boolean;
  schede: number;
  /** mtime del database letto: dice quanto è recente la copia locale di un archivio condiviso. */
  aggiornatoIl: number | null;
  /** 'assente' = cartella sparita; 'illeggibile' = I/O fallito; 'formato' = JSON non valido. */
  errore?: 'assente' | 'illeggibile' | 'formato';
  /** Il file viene da una versione più nuova dell'app: indicizzato com'è, senza migrazioni. */
  futuro?: true;
  /** Voci ricalcolate all'ultima sincronizzazione (0 = archivio invariato). Diagnostica e test. */
  ricostruite: number;
};

type Query = {
  testo: string;
  soloAnagrafica?: boolean;
  /**
   * Corrispondenza ESATTA su una voce d'anagrafica (`persona:luca d'abete`): è la domanda del
   * suggerimento nel form, "questa persona compare altrove?". Con questa `testo` non serve, e
   * "Luca di Piero d'Abete" NON è "Luca d'Abete".
   */
  chiaveAnagrafica?: string;
  /** Sottoinsieme degli archivi sincronizzati; assente = tutti. */
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
  /** Id del campo che ha dato l'estratto (`#trascrizione`, `#ocr`, `#tags` per i derivati). */
  campo: string;
  campoLabel?: string;
  estratto: Estratto;
  punteggio: number;
  /** Nomi d'anagrafica della scheda, nella grafia scelta: servono al suggerimento nel form. */
  anagrafica: { tipo: string; nome: string }[];
};

type PaginaRisultati = {
  risultati: Risultato[];
  cursore: string | null;
  totale: number;
  /** I risultati sono più di `MAX_RISULTATI`: conviene restringere la ricerca. */
  totaleTroncato: boolean;
  /** Il cursore apparteneva a un indice ormai cambiato: ripartire dalla prima pagina. */
  cursoreScaduto?: true;
};

/** Ciò che serve a copiare una scheda altrove, oltre alla scheda e al suo tipo. */
type ContestoScheda = {
  vocabolari: { [id: string]: any };
  /** Solo le voci d'anagrafica dei nomi citati dalla scheda. */
  authority: { [chiave: string]: any };
  /** Segnature delle schede a cui rimanda, per i rimandi esterni della copia. */
  segnatureRelazioni: { [id: string]: string };
};

/**
 * Il contratto. `crossArchiveIpc.ts` conosce SOLO questo: memoria, worker, indice
 * invertito o indice su disco sono dettagli di chi lo implementa.
 */
interface IndiceArchivi {
  sincronizza(archivi: ArchivioRif[]): Promise<StatoArchivio[]>;
  cerca(q: Query, segnale?: AbortSignal): Promise<PaginaRisultati>;
  scheda(archivioId: string, schedaId: string): Promise<{ scheda: any; tipo: any; contesto: ContestoScheda } | null>;
  invalida(archivioId?: string): Promise<void>;
  chiudi?(): Promise<void>;
}

// --- Implementazione -------------------------------------------------------------

const LIMITE_PREDEFINITO = 50;
const LIMITE_MASSIMO = 200;
const MAX_RISULTATI = 2000;
/** Ogni quante voci la scansione cede il turno, così un `annulla` può arrivare. */
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

/**
 * Una corrispondenza prima di diventare `Risultato`. L'estratto costa (rimappatura sul testo
 * originale, copie di stringhe) e serve solo per la pagina mostrata: con 2.000 corrispondenze e
 * pagine da 50, calcolarlo per tutte significherebbe fare quaranta volte il lavoro necessario.
 */
type Corrispondenza = { archivioId: string; voce: any; campo: any; termine: string; punteggio: number };

type FsLike = {
  stat(p: string): Promise<{ mtimeMs: number; size: number; isDirectory(): boolean }>;
  readFile(p: string, enc: 'utf8'): Promise<string>;
};

type OpzioniIndice = {
  fs?: FsLike;
  /** Archivi tenuti in memoria oltre a quelli richiesti dall'ultima sincronizzazione. */
  maxArchivi?: number;
  /** Caratteri di trascrizione/OCR indicizzati per scheda. 0 = nessun limite. */
  limiteTesto?: number;
};

function erroreAnnullato() {
  const e: any = new Error('Ricerca annullata');
  e.name = 'AbortError';
  return e;
}

// Un solo Collator: `localeCompare` con opzioni ne ricrea uno a ogni confronto, e su 2.000
// corrispondenze da ordinare è la voce di costo più alta della ricerca.
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

/**
 * Vocabolari, voci d'anagrafica dei nomi citati e segnature dei rimandi. L'anagrafica si
 * filtra per chiave: tutti i valori testuali della scheda, provati come persona e come luogo,
 * senza dover sapere qui quali campi sono dichiarati tali (lo decide la copia).
 */
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
  /** Cresce a ogni cambiamento dei dati: invalida cursori e risultati in cache. */
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
    // Due ricerche ravvicinate non devono leggere due volte lo stesso file.
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
      // Cartella presente ma senza database: un archivio appena creato, non un errore.
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
      // `migraDatabase` lavora sull'oggetto appena letto: il file non viene toccato.
      const esito = Model.migraDatabase(JSON.parse(grezzo));
      db = esito.db;
      db.__futuro = esito.futuro;
    } catch (e) {
      return this.scarta(a.id, vuoto('formato'));
    }
    grezzo = null;

    const ctx = contestoArchivio(db);
    // Incrementale per scheda: si riusa la voce di una scheda con lo stesso `lastModified`,
    // purché nulla di ciò che la voce eredita dall'archivio (tipi, anagrafica) sia cambiato.
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

  /** LRU: oltre il tetto escono gli archivi non richiesti usati meno di recente. */
  private sfoltisci() {
    if (this.archivi.size <= this.maxArchivi) return;
    const attivi = new Set(this.attivi);
    const candidati = [...this.archivi.values()].filter(a => !attivi.has(a.id)).sort((x, y) => x.ultimoUso - y.ultimoUso);
    while (this.archivi.size > this.maxArchivi && candidati.length) {
      this.archivi.delete(candidati.shift().id);
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
      posizione.get(a.archivioId) - posizione.get(b.archivioId) ||
      confrontaSegnature(a.voce.segnatura, b.voce.segnatura) ||
      (a.voce.id < b.voce.id ? -1 : a.voce.id > b.voce.id ? 1 : 0));
    return { risultati, troncato };
  }

  /** Ogni termine deve stare in almeno un campo (AND, anche su campi diversi, come la griglia). */
  private provaCampi(voce: any, termini: string[]) {
    let punteggio = 0;
    let primo = null;
    let comune: Set<any> | null = null;
    for (const t of termini) {
      let migliore = null;
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
    // Tutti i termini nello stesso campo ("luca abete" dentro un solo nome) vale più degli
    // stessi termini sparsi fra note e trascrizione.
    if (termini.length > 1 && comune && comune.size) punteggio += PESO.campo;
    return { campo: primo.campo, termine: primo.termine, punteggio };
  }

  /** La voce cita esattamente quella persona/quel luogo (stessa chiave d'anagrafica). */
  private provaChiave(voce: any, chiave: string) {
    const n = voce.anagrafica.find((a: any) => a.chiave === chiave);
    if (!n) return null;
    // L'estratto dal campo che contiene il nome: la chiave è normalizzata come `normalizza`
    // più il collasso degli spazi, quindi si cerca la parte dopo il tipo.
    const termine = normalizza(chiave.slice(chiave.indexOf(':') + 1));
    const campo = voce.campi.find((c: any) => c.peso === PESO.anagrafica && c.norm.indexOf(termine) !== -1) || null;
    return { campo, termine, punteggio: PESO.anagrafica };
  }

  /** Solo i nomi di persone e luoghi (filtro "solo anagrafica" della ricerca). */
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
    // Rilettura dal disco: l'indice non tiene le schede intere (sarebbe il doppio della
    // memoria per servire un'anteprima ogni tanto).
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

module.exports = { IndiceMemoria, LIMITE_MASSIMO, MAX_RISULTATI };
export type { IndiceArchivi, ArchivioRif, StatoArchivio, Query, PaginaRisultati, Risultato, ContestoScheda };
