export type Parola = { t: string; x0: number; y0: number; x1: number; y1: number };

type Cornice = { left: number; top: number; right: number; bottom: number };
export type RisultatoOcr = { blocks: { lines: { text: string; elements: { text: string; frame: Cornice }[] }[] }[] };

export function daRisultato(r: RisultatoOcr): { testo: string; parole: Parola[] } {
  const parole: Parola[] = [];
  const blocchi = r.blocks.map(b => b.lines.map(l => {
    for (const e of l.elements) parole.push({ t: e.text, x0: e.frame.left, y0: e.frame.top, x1: e.frame.right, y1: e.frame.bottom });
    return l.text;
  }).join('\n'));
  return { testo: blocchi.filter(Boolean).join('\n\n'), parole };
}

export function soloCaratteri(t: string, ammessi: ReadonlySet<number>): string {
  return Array.from(t, ch => (ammessi.has(ch.codePointAt(0)!) ? ch : '?')).join('');
}

export const testoDiPiuPagine = (testi: (string | undefined)[]) => testi.map(t => t?.trim()).filter(Boolean).join('\n\n');

export function parolaVicina(parole: Parola[], x: number, y: number): number {
  let migliore = -1, d = Infinity;
  for (const [i, p] of parole.entries()) {
    const dx = Math.max(p.x0 - x, 0, x - p.x1), dy = Math.max(p.y0 - y, 0, y - p.y1);
    const di = dx * dx + dy * dy;
    if (di < d) { d = di; migliore = i; }
  }
  return migliore;
}

export function testoSelezionato(parole: Parola[], a: number, b: number): string {
  const sel = parole.slice(Math.min(a, b), Math.max(a, b) + 1);
  return sel.map((p, i) => (i === 0 ? '' : p.x0 < sel[i - 1].x0 ? '\n' : ' ') + p.t).join('');
}

export function stratoTesto(parole: Parola[], foto: { w: number; h: number }, pagina: { w: number; h: number }, larghezza1: (t: string) => number): { t: string; x: number; y: number; size: number }[] {
  const sx = pagina.w / foto.w, sy = pagina.h / foto.h;
  const out: { t: string; x: number; y: number; size: number }[] = [];
  for (const p of parole) {
    const l1 = p.t.trim() ? larghezza1(p.t) : 0;
    if (l1 <= 0 || p.x1 <= p.x0 || p.y1 <= p.y0) continue;
    const altezza = (p.y1 - p.y0) * sy;
    const size = Math.min((p.x1 - p.x0) * sx / l1, altezza * 2);
    out.push({ t: p.t, x: p.x0 * sx, y: pagina.h - p.y1 * sy + altezza * 0.2, size });
  }
  return out;
}
