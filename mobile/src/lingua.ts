// Lingua dell'interfaccia (PIANO-INGLESE-MOBILE). L'italiano è scritto nel codice e fa da chiave
// del dizionario inglese: `t('Le {n} pagine', { n })`. Niente libreria né modulo nativo.
// Guardia: test/dizionario.test.mjs (ogni `t('…')` ha la voce inglese, nessuna voce inutile).

import { EN } from './lingua.en';

export type Lingua = 'it' | 'en';
/** Quella salvata in impostazioni.json; assente = 'auto' (lingua del telefono). */
export type SceltaLingua = 'auto' | Lingua;

/** Italiano se il telefono è in italiano, altrimenti inglese (Intl di Hermes dà il locale di Android). */
export function linguaTelefono(): Lingua {
  try {
    return /^it\b/i.test(Intl.DateTimeFormat().resolvedOptions().locale) ? 'it' : 'en';
  } catch {
    return 'it';
  }
}

let attuale: Lingua = linguaTelefono();

export const lingua = (): Lingua => attuale;

export function impostaLingua(scelta: SceltaLingua | undefined): void {
  attuale = !scelta || scelta === 'auto' ? linguaTelefono() : scelta;
}

/** Locale per `toLocaleString` e simili. */
export const localeDate = () => (attuale === 'en' ? 'en-GB' : 'it-IT');

/** Testo nella lingua attuale; `{nome}` diventa `v.nome`. */
export function t(it: string, v?: Record<string, string | number>): string {
  const s = attuale === 'en' ? EN[it] ?? it : it;
  return v ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m)) : s;
}
