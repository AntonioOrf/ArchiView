import type { Destinazione } from './contratto';

export type SchedaScelta =
  | { tipo: 'smistare' }
  | { tipo: 'esistente'; id: string; segnatura: string }
  | { tipo: 'nuova'; id: string; segnatura: string; nota?: string; cartella?: string };

const TIPO_PREDEFINITO = 'imbreviature';

export function nomeArchivioValido(nome: string): boolean {
  const n = nome.trim();
  return !!n && n.length <= 200 && n !== '.' && n !== '..' && !/[. ]$/.test(n) &&
    !/[<>:"/\\|?*\u0000-\u001f]/.test(n) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i.test(n);
}

export function destinazioneDi(s: SchedaScelta): Destinazione {
  if (s.tipo === 'smistare') return { tipo: 'nessuna' };
  if (s.tipo === 'esistente') return { tipo: 'esistente', schedaId: s.id };
  return {
    tipo: 'nuova', tipoDocumento: TIPO_PREDEFINITO, schedaId: s.id,
    ...(s.cartella ? { cartella: s.cartella } : {}),
    campi: s.segnatura.trim() ? { segnatura: s.segnatura.trim() } : {}
  };
}

const CAMPI_TITOLO = ['dichiarante', 'Notaio', 'autore', 'attori_dinamici', 'titolo'];

function rigaDi(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number') return String(v).replace(/<[^>]*>/g, '').trim();
  if (!Array.isArray(v)) return '';
  for (const el of v) {
    const s = el && typeof el === 'object' ? rigaDi(el.v || el.nome || el.k || el.ruolo) : rigaDi(el);
    if (s) return s;
  }
  return '';
}

function titoloDi(m: any): string {
  for (const k of CAMPI_TITOLO) {
    const s = rigaDi(m && m[k]);
    if (s) return s.slice(0, 500);
  }
  return '';
}

export const SUFFISSO_VAULT = '_ArchiView';

export function configDaDatabase(archivio: string, db: any, aggiornatoIl: string, daVedere: (tags: unknown) => boolean = () => false) {
  const manoscritti: any[] = db && Array.isArray(db.manoscritti) ? db.manoscritti : [];
  const testo = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, 500) : '');
  const schede = manoscritti
    .map(m => ({ id: testo(m && m.id), segnatura: testo(m && m.segnatura), cartella: testo(m && m.cartella), titolo: titoloDi(m), ...(daVedere(m && m.tags) ? { daVedere: true as const } : {}) }))
    .filter(s => s.id && s.id.length <= 200)
    .slice(0, 50000);
  const cartelle = (db && Array.isArray(db.cartelle) ? db.cartelle : []).map(testo).filter(Boolean).slice(0, 10000);
  return { formato: 'archiview-scanner/config', versione: 1, archivio, aggiornatoIl, schede, cartelle };
}

export type SchedaAlbero = { id: string; segnatura: string; titolo: string; cartella: string; nuova: boolean; daVedere?: boolean };

export type Riga =
  | { tipo: 'cartella'; percorso: string; nome: string; livello: number; aperta: boolean; conta: number }
  | { tipo: 'scheda'; scheda: SchedaAlbero; livello: number };

export const chiaveRicerca = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const confronta = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export function righeAlbero(schede: SchedaAlbero[], cartelle: string[], aperte: ReadonlySet<string>, cerca = '', soloDaVedere = false): Riga[] {
  const q = chiaveRicerca(cerca);
  const filtrato = !!q || soloDaVedere;
  const visibili = schede.filter(s => (!soloDaVedere || s.daVedere) && (!q || [s.segnatura, s.titolo, s.cartella].some(t => chiaveRicerca(t).includes(q))));
  const sotto = new Map<string, Set<string>>();
  const conta = new Map<string, number>();
  const dentro = new Map<string, SchedaAlbero[]>();
  const aggiungi = (percorso: string, n: number) => {
    const parti = percorso.split('/');
    for (let i = 0; i < parti.length; i++) {
      const p = parti.slice(0, i + 1).join('/');
      const padre = parti.slice(0, i).join('/');
      if (!sotto.has(padre)) sotto.set(padre, new Set());
      sotto.get(padre)!.add(p);
      conta.set(p, (conta.get(p) || 0) + n);
    }
  };
  if (!filtrato) for (const c of cartelle) if (c) aggiungi(c, 0);
  for (const s of visibili) {
    if (s.cartella) aggiungi(s.cartella, 1);
    const l = dentro.get(s.cartella);
    if (l) l.push(s); else dentro.set(s.cartella, [s]);
  }
  const out: Riga[] = [];
  const nome = (p: string) => p.slice(p.lastIndexOf('/') + 1);
  const visita = (padre: string, livello: number) => {
    for (const p of [...(sotto.get(padre) || [])].sort((a, b) => confronta(nome(a), nome(b)))) {
      const aperta = filtrato || aperte.has(p);
      out.push({ tipo: 'cartella', percorso: p, nome: nome(p), livello, aperta, conta: conta.get(p) || 0 });
      if (aperta) visita(p, livello + 1);
    }
    for (const s of (dentro.get(padre) || []).sort((a, b) => confronta(a.segnatura || a.id, b.segnatura || b.id))) out.push({ tipo: 'scheda', scheda: s, livello });
  };
  visita('', 0);
  return out;
}

export const percorsoLeggibile = (p: string) => p.split('/').join(' › ');

export function tutteLeCartelle(percorsi: string[]): string[] {
  const out = new Set<string>();
  for (const p of percorsi) {
    if (!p) continue;
    const parti = p.split('/');
    for (let i = 1; i <= parti.length; i++) out.add(parti.slice(0, i).join('/'));
  }
  return [...out];
}

export function alternaCartella(aperte: string[], percorso: string): string[] {
  return aperte.includes(percorso) ? aperte.filter(p => p !== percorso && !p.startsWith(percorso + '/')) : [...aperte, percorso];
}

export function perArchivio(nome: string, norma: (n: string) => string) {
  const atteso = norma(nome);
  return (b: { archivio?: string }) => !b.archivio || norma(b.archivio) === atteso;
}

export function chiaveDestinazione(d: Destinazione): string {
  return d.tipo === 'nessuna' ? '' : d.schedaId || '';
}
