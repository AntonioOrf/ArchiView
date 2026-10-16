type AvclToken = { testo: string; chiave: string };
type AvclSegmento = { tipo: 'uguale' | 'variante'; daA: number; aA: number; daB: number; aB: number };
type AvclLezione = { sigla: string; testo: string; da: number; a: number };
type AvclVoce = { da: number; a: number; lemma: string; lezioni: AvclLezione[] };

/** ponytail: tetto fisso; con testi lunghissimi e molto divergenti serve Myers a spazio lineare.
 */
const AVCL_MAX_DIFFERENZE = 3000;

const AVCL_BORDO = /^[^\p{L}\p{M}\p{N}&⁊]+|[^\p{L}\p{M}\p{N}&⁊]+$/gu;

function avclTokenizza(testo: any, chiave?: (s: string) => string): AvclToken[] {
  const out: AvclToken[] = [];
  for (const t of String(testo || '').split(/\s+/)) {
    const nudo = t.replace(AVCL_BORDO, '');
    if (!nudo) continue;
    out.push({ testo: t, chiave: chiave ? chiave(nudo) : nudo.toLowerCase() });
  }
  return out;
}

function avclAllinea(a: string[], b: string[]): Array<[number, number]> | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const traccia: Int32Array[] = [];
  let fine = -1;
  for (let d = 0; d <= max && fine === -1; d++) {
    if (d > AVCL_MAX_DIFFERENZE) return null;
    traccia.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) { fine = d; break; }
    }
  }
  const coppie: Array<[number, number]> = [];
  let x = n;
  let y = m;
  for (let d = fine; d > 0; d--) {
    const prec = traccia[d];
    const leggi = (k: number) => prec[k + d + 1];
    const k = x - y;
    const kPrec = (k === -d || (k !== d && leggi(k - 1) < leggi(k + 1))) ? k + 1 : k - 1;
    const xPrec = leggi(kPrec);
    const yPrec = xPrec - kPrec;
    while (x > xPrec && y > yPrec) { x--; y--; coppie.push([x, y]); }
    x = xPrec;
    y = yPrec;
  }
  while (x > 0 && y > 0) { x--; y--; coppie.push([x, y]); }
  return coppie.reverse();
}

function avclConfronta(a: AvclToken[], b: AvclToken[]): AvclSegmento[] | null {
  const coppie = avclAllinea(a.map(t => t.chiave), b.map(t => t.chiave));
  if (!coppie) return null;
  const out: AvclSegmento[] = [];
  let i = 0;
  let j = 0;
  const aggiungi = (tipo: 'uguale' | 'variante', aA: number, aB: number) => {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.tipo === tipo) { ultimo.aA = aA; ultimo.aB = aB; }
    else out.push({ tipo, daA: i, aA, daB: j, aB });
    i = aA;
    j = aB;
  };
  for (const [x, y] of coppie) {
    if (x > i || y > j) aggiungi('variante', x, y);
    aggiungi('uguale', x + 1, y + 1);
  }
  if (i < a.length || j < b.length) aggiungi('variante', a.length, b.length);
  return out;
}

function avclApparato(base: any, testimoni: { sigla: string; testo: any }[], chiave?: (s: string) => string) {
  const tb = avclTokenizza(base, chiave);
  const perLuogo = new Map<string, AvclVoce>();
  const parole: { [sigla: string]: AvclToken[] } = {};
  const troppoDiversi: string[] = [];
  for (const w of testimoni || []) {
    const tw = avclTokenizza(w.testo, chiave);
    parole[w.sigla] = tw;
    const segmenti = avclConfronta(tb, tw);
    if (!segmenti) { troppoDiversi.push(w.sigla); continue; }
    for (const s of segmenti) {
      if (s.tipo !== 'variante') continue;
      const luogo = s.daA + ':' + s.aA;
      let voce = perLuogo.get(luogo);
      if (!voce) {
        voce = { da: s.daA, a: s.aA, lemma: tb.slice(s.daA, s.aA).map(t => t.testo).join(' '), lezioni: [] };
        perLuogo.set(luogo, voce);
      }
      voce.lezioni.push({ sigla: w.sigla, testo: tw.slice(s.daB, s.aB).map(t => t.testo).join(' '), da: s.daB, a: s.aB });
    }
  }
  const voci = Array.from(perLuogo.values()).sort((p, q) => p.da - q.da || p.a - q.a);
  return { base: tb, parole, voci, troppoDiversi };
}

const ArchiViewCollazione = {
  MAX_DIFFERENZE: AVCL_MAX_DIFFERENZE,
  tokenizza: avclTokenizza,
  confronta: avclConfronta,
  apparato: avclApparato
};

const avModuloCjsCollazione = typeof module !== 'undefined' ? module : null;
if (avModuloCjsCollazione && avModuloCjsCollazione.exports) avModuloCjsCollazione.exports = ArchiViewCollazione;
if (typeof window !== 'undefined') (window as any).Collazione = ArchiViewCollazione;
