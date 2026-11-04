import type { Destinazione } from './contratto';

export type Invio = {
  id: string;
  archivio?: string;
  account?: string;
  destinazione: Destinazione;
  titolo?: string;
  nota?: string;
  pagine: number;
  partitoIl: string;
  arrivatoIl?: string;
};

export type Invii = { lotti: Invio[]; archivi: string[] };

export const NESSUN_INVIO: Invii = { lotti: [], archivi: [] };

const GIORNO = 86_400_000;

export function registra(s: Invii, l: Omit<Invio, 'partitoIl' | 'arrivatoIl'>, ora: Date, arrivato: boolean): Invii {
  const iso = ora.toISOString();
  const voce: Invio = { ...l, partitoIl: iso, ...(arrivato ? { arrivatoIl: iso } : {}) };
  const archivi = arrivato && l.archivio && !s.archivi.includes(l.archivio) ? [...s.archivi, l.archivio] : s.archivi;
  return { lotti: [...s.lotti.filter(x => x.id !== l.id), voce], archivi };
}

export function arrivati(s: Invii, suDrive: Set<string>, account: string, ora: Date): Invii {
  const iso = ora.toISOString();
  const lotti = s.lotti.map(l => (l.arrivatoIl || l.account !== account || suDrive.has(l.id) ? l : { ...l, arrivatoIl: iso }));
  const archivi = new Set(s.archivi);
  for (const l of lotti) if (l.arrivatoIl && l.archivio) archivi.add(l.archivio);
  return recenti({ lotti, archivi: [...archivi] }, ora);
}

export function recenti(s: Invii, ora: Date): Invii {
  return { ...s, lotti: s.lotti.filter(l => !l.arrivatoIl || ora.getTime() - Date.parse(l.arrivatoIl) < GIORNO) };
}

export const daControllare = (s: Invii, account: string) => s.lotti.some(l => !l.arrivatoIl && l.account === account);

export type Giro = { totali: number; base: number; corrente: number; pagine: Record<string, number>; inviati: number; inviate: number; errore?: string };
export type PassoGiro =
  | { tipo: 'lotto'; id: string; avanzamento: { fatte: number; totali: number } }
  | { tipo: 'inviato'; id: string }
  | { tipo: 'errore'; id: string; messaggio: string };

export function inizioGiro(lotti: { id: string; pagine: number }[]): Giro {
  return { totali: lotti.reduce((n, l) => n + l.pagine, 0), base: 0, corrente: 0, pagine: Object.fromEntries(lotti.map(l => [l.id, l.pagine])), inviati: 0, inviate: 0 };
}

export function passoGiro(g: Giro, e: PassoGiro): Giro {
  if (e.tipo === 'lotto') return { ...g, corrente: e.avanzamento.fatte };
  const pagine = g.pagine[e.id] ?? 0;
  if (e.tipo === 'inviato') return { ...g, base: g.base + pagine, corrente: 0, inviati: g.inviati + 1, inviate: g.inviate + pagine };
  return { ...g, base: g.base + pagine, corrente: 0, errore: g.errore ?? e.messaggio };
}

export const fatteGiro = (g: Giro) => Math.min(g.totali, g.base + g.corrente);
