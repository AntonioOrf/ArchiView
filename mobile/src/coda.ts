import { File, Paths } from 'expo-file-system';
import { NetworkStateType, type NetworkState } from 'expo-network';
import { elencaArchivi, inviaLotto, scaricaConfig, type Avanzamento } from './drive';
import { ScannerLotto, type ConfigScanner } from './contratto';
import { elencaLotti, fileDellaPagina, manifest, segnaInviato, type Bozza } from './lotti';
import { DOPO_INVIO_PREDEFINITO, type DopoInvio } from './pagine';
import { leggiJson, scriviJson } from './fileJson';
import type { Lingua } from './lingua';

export type Impostazioni = { soloWifi: boolean; dopoInvio: DopoInvio; archivio?: { nome: string; nuovo: boolean }; aperte?: Record<string, string[]>; account?: string; documenti?: boolean; copiaDocumenti?: boolean; viste?: Record<string, string[]>; lingua?: Lingua };

const IMPOSTAZIONI_PREDEFINITE: Impostazioni = { soloWifi: true, dopoInvio: DOPO_INVIO_PREDEFINITO };

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

function fileElenco(): File {
  return new File(Paths.document, 'schede.json');
}

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

export async function aggiornaElenco(archivio: string, conDatabase = true): Promise<ConfigScanner | null> {
  const config = await scaricaConfig(archivio, conDatabase);
  const locale = elencoLocale(archivio);
  if (!config || (locale && Date.parse(locale.aggiornatoIl) > Date.parse(config.aggiornatoIl))) return locale;
  fileElenco().write(JSON.stringify(config));
  return config;
}

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

export async function svuotaCoda(dispositivo: string, evento: (e: EventoCoda) => void, invia: typeof inviaLotto = inviaLotto, filtro: (b: Bozza) => boolean = () => true): Promise<boolean> {
  if (inCorso) return false;
  inCorso = true;
  try {
    const tentati = new Set<string>();
    for (;;) {
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
        if (/network|rete|fetch|wifi_401/i.test(String(e?.message))) break;
      }
    }
    return true;
  } finally {
    inCorso = false;
  }
}
