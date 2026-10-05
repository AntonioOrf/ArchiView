// Ricerca tra archivi — il lato main del worker. Implementa lo stesso contratto
// `IndiceArchivi` dell'indice che ospita: chi lo usa non sa che c'è un thread in mezzo.
//
// Tre garanzie:
// 1. **Annullamento**: un `AbortSignal` scattato nel main rifiuta subito la promessa e manda
//    `annulla` al worker, che smette di scansionare al prossimo passo.
// 2. **Riavvio**: se il worker muore, le richieste pendenti falliscono con un errore e la
//    successiva ne avvia uno nuovo. L'indice si ricostruisce alla prima `sincronizza`.
// 3. **Ripiego**: se il worker non riesce nemmeno a partire (modulo non trovato dentro
//    l'asar, ambiente senza worker_threads) l'indice gira nel main. Più lento sotto carico,
//    ma la funzione non sparisce. Lo stesso dopo troppi crash ravvicinati.

const path = require('path');
const { Worker } = require('worker_threads');
const { IndiceMemoria } = require('./indiceMemoria');

import type { IndiceArchivi, ArchivioRif, StatoArchivio, Query, PaginaRisultati } from './indiceMemoria';

type OpzioniClient = {
  /** Percorso dello script del worker; predefinito: `worker.js` accanto a questo file. */
  script?: string;
  /** Passate all'indice (nel worker o nel ripiego). */
  indice?: { maxArchivi?: number; limiteTesto?: number };
  /** Dopo quanto tempo senza richieste il worker viene chiuso per liberare memoria. 0 = mai. */
  inattivitaMs?: number;
  /** Crash tollerati nella finestra prima di passare al ripiego definitivo. */
  maxCrash?: number;
  log?: (msg: string, e?: any) => void;
};

type Pendente = { resolve: (v: any) => void; reject: (e: any) => void; op: string; args: any[]; segnale?: AbortSignal };

const FINESTRA_CRASH_MS = 60_000;

function erroreAnnullato() {
  const e: any = new Error('Ricerca annullata');
  e.name = 'AbortError';
  return e;
}

class IndiceWorker implements IndiceArchivi {
  private opz: OpzioniClient;
  private worker: any = null;
  private pronto = false;
  private pendenti = new Map<number, Pendente>();
  private prossimoId = 1;
  private crash: number[] = [];
  private ripiego: IndiceArchivi | null = null;
  private timerInattivita: any = null;
  private log: (msg: string, e?: any) => void;

  constructor(opzioni?: OpzioniClient) {
    this.opz = opzioni || {};
    this.log = this.opz.log || ((m, e) => console.warn('[ricerca-archivi] ' + m, e || ''));
  }

  /** true se l'indice sta girando nel main invece che nel worker. */
  get inRipiego(): boolean {
    return !!this.ripiego;
  }

  sincronizza(archivi: ArchivioRif[]): Promise<StatoArchivio[]> {
    return this.chiama('sincronizza', [archivi]);
  }

  cerca(q: Query, segnale?: AbortSignal): Promise<PaginaRisultati> {
    return this.chiama('cerca', [q], segnale);
  }

  scheda(archivioId: string, schedaId: string): Promise<{ scheda: any; tipo: any; contesto: any } | null> {
    return this.chiama('scheda', [archivioId, schedaId]);
  }

  invalida(archivioId?: string): Promise<void> {
    return this.chiama('invalida', archivioId === undefined ? [] : [archivioId]);
  }

  async chiudi(): Promise<void> {
    clearTimeout(this.timerInattivita);
    const w = this.worker;
    this.worker = null;
    this.pronto = false;
    this.rifiutaTutti(new Error('Indice chiuso'));
    if (w) await w.terminate();
  }

  private passaAlRipiego(motivo: string, e?: any) {
    if (this.ripiego) return;
    this.log('worker non disponibile, la ricerca gira nel processo principale: ' + motivo, e);
    this.ripiego = new IndiceMemoria(this.opz.indice || {});
  }

  private suRipiego(op: string, args: any[], segnale?: AbortSignal): Promise<any> {
    if (segnale && segnale.aborted) return Promise.reject(erroreAnnullato());
    const r: any = this.ripiego;
    return op === 'cerca' ? r.cerca(args[0], segnale) : r[op](...args);
  }

  private avvia(): boolean {
    if (this.worker) return true;
    const script = this.opz.script || path.join(__dirname, 'worker.js');
    let w;
    try {
      w = new Worker(script, { workerData: this.opz.indice || {} });
    } catch (e) {
      this.passaAlRipiego('avvio fallito', e);
      return false;
    }
    this.worker = w;
    this.pronto = false;
    // Il worker non deve tenere in vita il processo (test, chiusura dell'app).
    if (typeof w.unref === 'function') w.unref();

    w.on('message', (msg: any) => {
      if (msg && msg.pronto) { this.pronto = true; return; }
      const p = msg && this.pendenti.get(msg.reqId);
      if (!p) return;
      this.pendenti.delete(msg.reqId);
      if (msg.ok) p.resolve(msg.valore);
      else {
        const e: any = new Error(msg.errore && msg.errore.message || 'Errore nel worker');
        e.name = msg.errore && msg.errore.name || 'Error';
        p.reject(e);
      }
    });
    const caduto = (motivo: string, e?: any) => {
      if (this.worker !== w) return;
      const eraPronto = this.pronto;
      this.worker = null;
      this.pronto = false;
      if (!eraPronto) {
        // Non è mai partito: riprovare darebbe lo stesso esito. Le richieste in attesa
        // vengono rigirate al ripiego invece di fallire.
        this.passaAlRipiego(motivo, e);
        const attese = [...this.pendenti.values()];
        this.pendenti.clear();
        for (const p of attese) this.suRipiego(p.op, p.args, p.segnale).then(p.resolve, p.reject);
        return;
      }
      const ora = Date.now();
      this.crash = this.crash.filter(t => ora - t < FINESTRA_CRASH_MS).concat(ora);
      this.rifiutaTutti(new Error('Il processo di ricerca si è interrotto: ' + motivo));
      if (this.crash.length > (this.opz.maxCrash || 3)) this.passaAlRipiego('troppi crash', e);
    };
    w.on('error', (e: any) => caduto((e && e.message) || 'errore', e));
    w.on('exit', (code: number) => caduto('uscita con codice ' + code));
    return true;
  }

  private rifiutaTutti(e: any) {
    const attese = [...this.pendenti.values()];
    this.pendenti.clear();
    for (const p of attese) p.reject(e);
  }

  private programmaInattivita() {
    const ms = this.opz.inattivitaMs === undefined ? 10 * 60_000 : this.opz.inattivitaMs;
    if (!ms) return;
    clearTimeout(this.timerInattivita);
    this.timerInattivita = setTimeout(() => {
      if (this.pendenti.size || !this.worker) return;
      const w = this.worker;
      this.worker = null;
      this.pronto = false;
      w.terminate().catch(() => {});
    }, ms);
    if (this.timerInattivita && typeof this.timerInattivita.unref === 'function') this.timerInattivita.unref();
  }

  private chiama(op: string, args: any[], segnale?: AbortSignal): Promise<any> {
    if (this.ripiego || !this.avvia()) return this.suRipiego(op, args, segnale);
    if (segnale && segnale.aborted) return Promise.reject(erroreAnnullato());
    this.programmaInattivita();

    const reqId = this.prossimoId++;
    return new Promise((resolve, reject) => {
      this.pendenti.set(reqId, { resolve, reject, op, args, segnale });
      if (segnale) {
        segnale.addEventListener('abort', () => {
          if (!this.pendenti.delete(reqId)) return;
          if (this.worker) this.worker.postMessage({ op: 'annulla', reqId });
          reject(erroreAnnullato());
        }, { once: true });
      }
      this.worker.postMessage({ reqId, op, args });
    });
  }
}

module.exports = { IndiceWorker };
export {};
