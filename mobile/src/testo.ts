// Fase 15e — OCR dei Documenti, parte pura (provata con `node --test`): dal risultato di ML Kit
// al testo da copiare e alle parole con la loro posizione, poi lo strato di testo invisibile del
// PDF ricercabile. Solo Documenti: l'OCR di ML Kit non conosce il latino medievale.

/** Una parola riconosciuta, coi bordi in pixel della foto letta. */
export type Parola = { t: string; x0: number; y0: number; x1: number; y1: number };

type Cornice = { left: number; top: number; right: number; bottom: number };
/** Il sottoinsieme del risultato di `recognizeText` che serve qui. */
export type RisultatoOcr = { blocks: { lines: { text: string; elements: { text: string; frame: Cornice }[] }[] }[] };

/** Testo (righe a capo, blocchi separati da una riga vuota) e parole con la posizione. */
export function daRisultato(r: RisultatoOcr): { testo: string; parole: Parola[] } {
  const parole: Parola[] = [];
  const blocchi = r.blocks.map(b => b.lines.map(l => {
    for (const e of l.elements) parole.push({ t: e.text, x0: e.frame.left, y0: e.frame.top, x1: e.frame.right, y1: e.frame.bottom });
    return l.text;
  }).join('\n'));
  return { testo: blocchi.filter(Boolean).join('\n\n'), parole };
}

/** Tiene i caratteri che il font del PDF sa scrivere (Helvetica: WinAnsi), gli altri diventano «?». */
export function soloCaratteri(t: string, ammessi: ReadonlySet<number>): string {
  return Array.from(t, ch => (ammessi.has(ch.codePointAt(0)!) ? ch : '?')).join('');
}

/** Testo di più pagine, in ordine, separate da una riga vuota; le pagine senza testo si saltano. */
export const testoDiPiuPagine = (testi: (string | undefined)[]) => testi.map(t => t?.trim()).filter(Boolean).join('\n\n');

/** Indice della parola più vicina al punto (in pixel della foto; 0 se ci cade dentro), -1 se non ce ne sono. */
export function parolaVicina(parole: Parola[], x: number, y: number): number {
  let migliore = -1, d = Infinity;
  for (const [i, p] of parole.entries()) {
    const dx = Math.max(p.x0 - x, 0, x - p.x1), dy = Math.max(p.y0 - y, 0, y - p.y1);
    const di = dx * dx + dy * dy;
    if (di < d) { d = di; migliore = i; }
  }
  return migliore;
}

/** Le parole da `a` a `b` (in qualunque ordine), a capo quando la successiva torna indietro: riga nuova. */
export function testoSelezionato(parole: Parola[], a: number, b: number): string {
  const sel = parole.slice(Math.min(a, b), Math.max(a, b) + 1);
  return sel.map((p, i) => (i === 0 ? '' : p.x0 < sel[i - 1].x0 ? '\n' : ' ') + p.t).join('');
}

/**
 * Dove scrivere ogni parola sulla pagina PDF (origine in basso a sinistra), con la dimensione che
 * la fa larga quanto la parola nella foto: selezione e ricerca cadono sul punto giusto.
 * `larghezza1(t)`: larghezza del testo a corpo 1 nel font usato. Le parole vuote si saltano.
 */
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
