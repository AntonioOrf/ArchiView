import { File, Paths } from 'expo-file-system';
import { NetworkStateType, type NetworkState } from 'expo-network';
import { creaDatabase, elencaArchivi, inviaLotto, lottiSuDrive, scaricaConfig, type Avanzamento } from './drive';
import { arrivati, daControllare, NESSUN_INVIO, recenti, registra, type Invii } from './invii';
import { ScannerLotto, type ConfigScanner } from './contratto';
import { elencaLotti, fileDellaPagina, manifest, segnaInviato, type Bozza } from './lotti';
import { DOPO_INVIO_PREDEFINITO, type DopoInvio } from './pagine';
import { leggiJson, scriviJson } from './fileJson';
import type { Lingua } from './lingua';
import { unisciArchivi } from './scelta';

export type Impostazioni = { dopoInvio: DopoInvio; archivio?: { nome: string; nuovo: boolean }; aperte?: Record<string, string[]>; account?: string; documenti?: boolean; copiaDocumenti?: boolean; viste?: Record<string, string[]>; lingua?: Lingua; cartelleNuove?: Record<string, string[]> };

const IMPOSTAZIONI_PREDEFINITE: Impostazioni = { dopoInvio: DOPO_INVIO_PREDEFINITO };

function fileImpostazioni(): File {
  return new File(Paths.document, 'impostazioni.json');
}

export function leggiImpostazioni(): Impostazioni {
  try {
    const salvate = leggiJson(fileImpostazioni());
    if (!salvate) return IMPOSTAZIONI_PREDEFINITE;
    const i: Impostazioni = { ...IMPOSTAZIONI_PREDEFINITE, ...(salvate as Partial<Impostazioni>) };
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

const fileBenvenuto = () => new File(Paths.document, 'benvenuto.json');

export function benvenutoFatto(): boolean {
  try { return fileBenvenuto().exists; } catch (e) { console.warn('[coda] benvenuto illeggibile', e); return true; }
}

export function segnaBenvenuto(): void {
  scriviJson(fileBenvenuto(), { data: new Date().toISOString() });
}

const fileElenco = (archivio: string) => new File(Paths.document, `schede-${encodeURIComponent(archivio)}.json`);
const fileElencoVecchio = () => new File(Paths.document, 'schede.json');

function leggiElenco(f: File, archivio: string): ConfigScanner | null {
  if (!f.exists) return null;
  const esito = ScannerLotto.validaConfig(JSON.parse(f.textSync()));
  return esito.ok && ScannerLotto.nomeArchivio(esito.config.archivio) === archivio ? esito.config : null;
}

export function elencoLocale(archivio?: string): ConfigScanner | null {
  if (!archivio) return null;
  const nome = ScannerLotto.nomeArchivio(archivio);
  try {
    const f = fileElenco(nome);
    if (f.exists) return leggiElenco(f, nome);
    const vecchio = fileElencoVecchio();
    const migrato = leggiElenco(vecchio, nome);
    if (migrato) {
      scriviJson(f, migrato);
      vecchio.delete();
    }
    return migrato;
  } catch (e) {
    console.warn('[coda] elenco schede locale illeggibile', nome, e);
    return null;
  }
}

export async function aggiornaElenco(archivio: string, conDatabase = true): Promise<ConfigScanner | null> {
  const config = await scaricaConfig(archivio, conDatabase);
  const locale = elencoLocale(archivio);
  if (!config || (locale && Date.parse(locale.aggiornatoIl) > Date.parse(config.aggiornatoIl))) return locale;
  try {
    scriviJson(fileElenco(ScannerLotto.nomeArchivio(archivio)), config);
  } catch (e) {
    console.warn('[coda] copia locale dell’elenco non salvata', archivio, e);
  }
  return config;
}

function fileArchivi(): File {
  return new File(Paths.document, 'archivi.json');
}

const fileCreati = () => new File(Paths.document, 'archivi-creati.json');

function leggiNomi(f: File): string[] {
  try {
    const nomi = leggiJson(f);
    return Array.isArray(nomi) ? nomi.filter(n => typeof n === 'string') : [];
  } catch (e) {
    console.warn('[coda] elenco di archivi illeggibile', f.uri, e);
    return [];
  }
}

export const archiviCreati = () => leggiNomi(fileCreati());

export function segnaArchivioCreato(archivio: string): void {
  const nome = ScannerLotto.nomeArchivio(archivio);
  const creati = archiviCreati();
  if (!creati.includes(nome)) scriviJson(fileCreati(), [...creati, nome]);
}

export function archiviLocali(): string[] {
  return unisciArchivi(leggiNomi(fileArchivi()), archiviCreati()).tutti;
}

export async function aggiornaArchivi(): Promise<{ tutti: string[]; suDrive: string[] }> {
  const suDrive = await elencaArchivi();
  for (const nome of archiviCreati()) {
    if (suDrive.includes(nome)) continue;
    try {
      await creaDatabase(nome);
      suDrive.push(nome);
    } catch (e) {
      console.warn('[coda] database su Drive non creato, riprovo al prossimo collegamento', nome, e);
    }
  }
  const { tutti, creati } = unisciArchivi(suDrive, archiviCreati());
  scriviJson(fileCreati(), creati);
  scriviJson(fileArchivi(), tutti);
  return { tutti, suDrive };
}

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

function segnaPartita(id: string, notaInviata: string | undefined): void {
  try {
    const tutte = schedeNuove();
    const portata = (s: SchedaNuova) => !!notaInviata && s.nota === notaInviata;
    if (tutte.some(s => s.id === id && (!s.partita || portata(s)))) {
      salvaSchedeNuove(tutte.map(s => (s.id !== id ? s : { ...s, partita: true as const, nota: portata(s) ? undefined : s.nota })));
    }
  } catch (e) {
    console.warn('[coda] scheda nuova non segnata come partita', id, e);
  }
}

const fileInvii = () => new File(Paths.document, 'invii.json');

export function leggiInvii(): Invii {
  try {
    const v = leggiJson(fileInvii()) as Invii | null;
    return v && Array.isArray(v.lotti) ? recenti({ lotti: v.lotti, archivi: Array.isArray(v.archivi) ? v.archivi : [] }, new Date()) : NESSUN_INVIO;
  } catch (e) {
    console.warn('[coda] invii illeggibili', e);
    return NESSUN_INVIO;
  }
}

function tracciaInvio(b: Bozza, account: string | undefined, arrivato: boolean): void {
  try {
    const { id, archivio, destinazione, titolo, nota } = b;
    scriviJson(fileInvii(), registra(leggiInvii(), { id, archivio, account, destinazione, titolo, nota, pagine: b.pagine.length }, new Date(), arrivato));
  } catch (e) {
    console.warn('[coda] invio non tracciato', b.id, e);
  }
}

export async function controllaArrivi(account: string): Promise<Invii> {
  const s = leggiInvii();
  if (!daControllare(s, account)) return s;
  const dopo = arrivati(s, await lottiSuDrive(), account, new Date());
  scriviJson(fileInvii(), dopo);
  return dopo;
}

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
let corrente: string | null = null;

export const lottoInInvio = () => corrente;

export async function svuotaCoda(dispositivo: string, evento: (e: EventoCoda) => void, invia: typeof inviaLotto = inviaLotto, filtro: (b: Bozza) => boolean = () => true): Promise<boolean> {
  if (inCorso) return false;
  inCorso = true;
  try {
    const tentati = new Set<string>();
    for (;;) {
      const b = elencaLotti().find(l => l.stato === 'in_coda' && !tentati.has(l.id) && filtro(l));
      if (!b) break;
      tentati.add(b.id);
      corrente = b.id;
      try {
        await invia(manifest(b, dispositivo), nome => fileDellaPagina(b, nome), a => evento({ tipo: 'lotto', id: b.id, avanzamento: a }));
        const imp = leggiImpostazioni();
        segnaInviato(b, imp.dopoInvio);
        tracciaInvio(b, imp.account, invia !== inviaLotto);
        if (b.destinazione.tipo === 'nuova' && b.destinazione.schedaId) segnaPartita(b.destinazione.schedaId, b.nota);
        evento({ tipo: 'inviato', id: b.id });
      } catch (e: any) {
        console.error('[coda] invio fallito', b.id, e);
        evento({ tipo: 'errore', id: b.id, messaggio: e?.message || String(e) });
        if (/network|rete|fetch|wifi_401/i.test(String(e?.message))) break;
      } finally {
        corrente = null;
      }
    }
    return true;
  } finally {
    inCorso = false;
  }
}
