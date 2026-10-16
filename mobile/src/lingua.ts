import { EN } from './lingua.en';

export type Lingua = 'it' | 'en';
export type SceltaLingua = 'auto' | Lingua;

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

export const localeDate = () => (attuale === 'en' ? 'en-GB' : 'it-IT');

export function t(it: string, v?: Record<string, string | number>): string {
  const s = attuale === 'en' ? EN[it] ?? it : it;
  return v ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m)) : s;
}
