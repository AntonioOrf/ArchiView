// Coda d'invio: i lotti `in_coda` partono uno alla volta, dal più vecchio, quando c'è rete
// (con "solo Wi-Fi", solo su Wi-Fi o Ethernet). Un lotto inviato si elimina dal telefono (o resta
// in sola lettura, impostazione «Dopo l'invio»); uno
// fallito resta in coda con il suo errore e si riprova al prossimo giro. L'invio è
// riprendibile (src/drive.ts), quindi un giro interrotto a metà non duplica nulla.

import { File, Paths } from 'expo-file-system';
import { NetworkStateType, type NetworkState } from 'expo-network';
import { elencaArchivi, inviaLotto, scaricaConfig, type Avanzamento } from './drive';
import { ScannerLotto, type ConfigScanner } from './contratto';
import { elencaLotti, fileDellaPagina, manifest, segnaInviato, type Bozza } from './lotti';
import { DOPO_INVIO_PREDEFINITO, type DopoInvio } from './pagine';
import { leggiJson, scriviJson } from './fileJson';

/**
 * `archivio`: quello scelto (ricordato); `nuovo` = creato qui, il desktop non l'ha ancora pubblicato.
 * `aperte`: cartelle aperte nell'albero, per archivio, in ordine d'apertura (`alternaCartella`).
 * `account`: email dell'ultimo accesso con cui è partita la coda; con un altro account la coda aspetta il permesso.
 * `documenti`: l'app era nella sezione Documenti; alla riapertura riparte da lì.
 */
export type Impostazioni = { soloWifi: boolean; dopoInvio: DopoInvio; archivio?: { nome: string; nuovo: boolean }; aperte?: Record<string, string[]>; account?: string; documenti?: boolean };

const IMPOSTAZIONI_PREDEFINITE: Impostazioni = { soloWifi: true, dopoInvio: DOPO_INVIO_PREDEFINITO };

function fileImpostazioni(): File {
  return new File(Paths.document, 'impostazioni.json');
}

export function leggiImpostazioni(): Impostazioni {
  try {
    const salvate = leggiJson(fileImpostazioni());
    if (!salvate) return IMPOSTAZIONI_PREDEFINITE;
    const i: Impostazioni = { ...IMPOSTAZIONI_PREDEFINITE, ...(salvate as Partial<Impostazioni>) };
    // Scelto quando l'elenco mostrava ancora "<nome>_ArchiView": stesso archivio, nome normalizzato.
    if (i.archivio) i.archivio = { ...i.archivio, nome: ScannerLotto.nomeArchivio(i.archivio.nome) };
    return i;
  } catch (e) {
    console.warn('[coda] impostazioni illeggibili, uso le predefinite', e);
    return IMPOSTAZIONI_PREDEFINITE;
  }
}

export function salvaImpostazioni(i: Impostazioni): void {
  scriviJson(fileImpostazioni(), i);
}

// --- Elenco delle schede (Fase 4): copia locale, per scegliere la destinazione offline ---

function fileElenco(): File {
  return new File(Paths.document, 'schede.json');
}

/** Copia locale dell'elenco delle schede dell'archivio scelto (una sola: quella dell'archivio in uso). */
export function elencoLocale(archivio?: string): ConfigScanner | null {
  try {
    const f = fileElenco();
    if (!archivio || !f.exists) return null;
    const esito = ScannerLotto.validaConfig(JSON.parse(f.textSync()));
    return esito.ok && ScannerLotto.nomeArchivio(esito.config.archivio) === ScannerLotto.nomeArchivio(archivio) ? esito.config : null;
  } catch (e) {
    console.warn('[coda] elenco schede locale illeggibile', e);
    return null;
  }
}

/**
 * Scarica l'elenco dell'archivio e ne salva la copia. Senza elenco su Drive, o se la copia locale è
 * più recente (presa dal database quando c'era il Wi-Fi), resta quella locale.
 */
export async function aggiornaElenco(archivio: string, conDatabase = true): Promise<ConfigScanner | null> {
  const config = await scaricaConfig(archivio, conDatabase);
  const locale = elencoLocale(archivio);
  if (!config || (locale && Date.parse(locale.aggiornatoIl) > Date.parse(config.aggiornatoIl))) return locale;
  fileElenco().write(JSON.stringify(config));
  return config;
}

// --- Archivi pubblicati dal desktop (copia locale, per scegliere anche offline) ---

function fileArchivi(): File {
  return new File(Paths.document, 'archivi.json');
}

export function archiviLocali(): string[] {
  try {
    const f = fileArchivi();
    const nomi = f.exists ? JSON.parse(f.textSync()) : [];
    return Array.isArray(nomi) ? nomi.filter(n => typeof n === 'string') : [];
  } catch (e) {
    console.warn('[coda] elenco archivi locale illeggibile', e);
    return [];
  }
}

export async function aggiornaArchivi(): Promise<string[]> {
  const nomi = await elencaArchivi();
  fileArchivi().write(JSON.stringify(nomi));
  return nomi;
}

// --- Schede nate sul telefono: restano in vista nell'archivio anche dopo l'invio ---

/** `partita`: il computer ha già ricevuto pagine, quindi ha creato la scheda: la cartella non si cambia più da qui. */
export type SchedaNuova = { archivio: string; id: string; segnatura: string; nota?: string; cartella?: string; partita?: true };

function fileSchedeNuove(): File {
  return new File(Paths.document, 'schede-nuove.json');
}

export function schedeNuove(): SchedaNuova[] {
  try {
    const v = leggiJson(fileSchedeNuove());
    return Array.isArray(v) ? v : [];
  } catch (e) {
    console.warn('[coda] schede nuove illeggibili', e);
    return [];
  }
}

export function salvaSchedeNuove(s: SchedaNuova[]): void {
  scriviJson(fileSchedeNuove(), s);
}

function segnaPartita(id: string): void {
  try {
    const tutte = schedeNuove();
    if (tutte.some(s => s.id === id && !s.partita)) salvaSchedeNuove(tutte.map(s => (s.id === id ? { ...s, partita: true as const } : s)));
  } catch (e) {
    console.warn('[coda] scheda nuova non segnata come partita', id, e);
  }
}

/** La rete permette l'invio? `isInternetReachable` può restare indefinito: conta `isConnected`. */
export function reteAdatta(rete: NetworkState, soloWifi: boolean): boolean {
  if (!rete.isConnected || rete.isInternetReachable === false) return false;
  if (!soloWifi) return true;
  return rete.type === NetworkStateType.WIFI || rete.type === NetworkStateType.ETHERNET;
}

export type EventoCoda =
  | { tipo: 'lotto'; id: string; avanzamento: Avanzamento }
  | { tipo: 'inviato'; id: string }
  | { tipo: 'errore'; id: string; messaggio: string };

let inCorso = false;

/**
 * Un giro della coda. Se un giro è già in corso non ne parte un secondo (i trigger sono tanti:
 * rete che cambia, app in primo piano, lotto appena chiuso). `false` = giro saltato.
 * `filtro`: solo i lotti che passano (Wi-Fi: quelli dell'archivio abbinato).
 */
export async function svuotaCoda(dispositivo: string, evento: (e: EventoCoda) => void, invia: typeof inviaLotto = inviaLotto, filtro: (b: Bozza) => boolean = () => true): Promise<boolean> {
  if (inCorso) return false;
  inCorso = true;
  try {
    const tentati = new Set<string>();
    for (;;) {
      // Si rilegge il disco a ogni lotto: uno riaperto nel frattempo non deve partire.
      const b = elencaLotti().find(l => l.stato === 'in_coda' && !tentati.has(l.id) && filtro(l));
      if (!b) break;
      tentati.add(b.id);
      try {
        await invia(manifest(b, dispositivo), nome => fileDellaPagina(b, nome), a => evento({ tipo: 'lotto', id: b.id, avanzamento: a }));
        segnaInviato(b, leggiImpostazioni().dopoInvio);
        if (b.destinazione.tipo === 'nuova' && b.destinazione.schedaId) segnaPartita(b.destinazione.schedaId);
        evento({ tipo: 'inviato', id: b.id });
      } catch (e: any) {
        console.error('[coda] invio fallito', b.id, e);
        evento({ tipo: 'errore', id: b.id, messaggio: e?.message || String(e) });
        // Senza rete (o abbinamento scaduto) fallirebbero anche i successivi: si chiude il giro.
        if (/network|rete|fetch|wifi_401/i.test(String(e?.message))) break;
      }
    }
    return true;
  } finally {
    inCorso = false;
  }
}
