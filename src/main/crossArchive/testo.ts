// Ricerca tra archivi — normalizzazione del testo e query.
//
// ⚠️ STESSE REGOLE di `normalizzaTesto`/`tokenizzaRicerca` del renderer (logic/utils.ts):
// "d'Abete" deve trovare "D’abete" nella griglia E negli altri archivi, o il ricercatore
// vede due motori che dicono cose diverse sulla stessa parola. Il renderer non è
// importabile dal main, quindi la coerenza la garantisce `test/crossArchiveIndex.test.js`,
// che confronta le due implementazioni sugli stessi input.
//
// La normalizzazione è PER CARATTERE: la lunghezza normalizzata di ogni carattere è
// ricalcolabile, e questo permette di riportare una posizione trovata nel testo normalizzato
// sul testo originale (`posizioneOriginale`) senza tenere in memoria una tabella di offset
// grande quattro volte il testo.

/**
 * Versione delle regole qui sotto. Va incrementata a OGNI cambiamento di `normalizza`:
 * un indice costruito con regole vecchie (in memoria oggi, su disco domani) va ricostruito,
 * altrimenti una parola risulta introvabile senza che nulla fallisca.
 */
const NORMALIZZAZIONE_VERSIONE = 1;

const RE_DIACRITICI = /[̀-ͯ]/g;
const RE_APOSTROFI = /[‘’ʼʹ′]/g;

function normalizza(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(RE_DIACRITICI, '')
    .replace(RE_APOSTROFI, "'");
}

/**
 * Porta un indice del testo normalizzato sul testo originale. Si percorre l'originale
 * carattere per carattere sommando la lunghezza normalizzata di ciascuno: costa O(n) sul
 * solo campo che ha dato il risultato, una volta per risultato mostrato.
 */
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

/** Riduce a testo il valore di un campo. Copia di `testoIndicizzabile` (logic/utils.ts). */
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

/** Toglie i tag dai campi ricchi, come fa l'indice della griglia. */
function testoPulito(v: any): string {
  return testoIndicizzabile(v).replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

type QueryAnalizzata = { token: string[]; frasi: string[] };

/**
 * Token liberi (AND, anche su campi diversi, come la griglia) e frasi fra virgolette (che
 * devono comparire intere). I vincoli `campo:valore` della griglia non sono ancora supportati
 * qui: un token con i due punti viene cercato così com'è.
 */
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

module.exports = { NORMALIZZAZIONE_VERSIONE, normalizza, posizioneOriginale, testoIndicizzabile, testoPulito, analizzaQuery };
export {};
