const NORMALIZZAZIONE_VERSIONE = 2;

const RE_DIACRITICI = /[̀-ͯ]/g;
const RE_APOSTROFI = /[‘’ʼʹ′]/g;
const RE_VARIANTI = /[vjſꝛꝺæœ]/g;
const VARIANTI: Record<string, string> = { v: 'u', j: 'i', 'ſ': 's', 'ꝛ': 'r', 'ꝺ': 'd', 'æ': 'ae', 'œ': 'oe' };

function normalizza(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(RE_DIACRITICI, '')
    .replace(RE_APOSTROFI, "'")
    .replace(RE_VARIANTI, c => VARIANTI[c]);
}

function posizioneOriginale(originale: string, indiceNorm: number): number {
  let n = 0;
  let i = 0;
  for (const ch of originale) {
    if (n >= indiceNorm) return i;
    n += normalizza(ch).length;
    i += ch.length;
  }
  return originale.length;
}

function testoIndicizzabile(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    let out = '';
    for (const el of v) {
      if (el === null || el === undefined) continue;
      if (typeof el === 'string' || typeof el === 'number') out += el + ' ';
      else if (typeof el === 'object') out += (el.k || '') + ' ' + (el.v || '') + ' ';
    }
    return out;
  }
  return '';
}

function testoPulito(v: any): string {
  return testoIndicizzabile(v).replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

type QueryAnalizzata = { token: string[]; frasi: string[] };

function analizzaQuery(q: any): QueryAnalizzata {
  const norm = normalizza(q);
  const esito: QueryAnalizzata = { token: [], frasi: [] };
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(norm)) !== null) {
    if (m[1] !== undefined) {
      const f = m[1].replace(/\s+/g, ' ').trim();
      if (f) esito.frasi.push(f);
    } else if (m[2]) {
      esito.token.push(m[2]);
    }
  }
  return esito;
}

export { NORMALIZZAZIONE_VERSIONE, normalizza, posizioneOriginale, testoIndicizzabile, testoPulito, analizzaQuery };
