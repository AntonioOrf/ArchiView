// Numerazione automatica delle carte: dall'etichetta della pagina precedente alla successiva.
// `12r` → `12v` → `13r`; `5` → `6`; prefisso e zeri iniziali restano (`c. 009v` → `c. 010r`).
// Se l'etichetta non finisce con un numero (più r/v facoltativo) non si indovina: `undefined`.

export function prossimaEtichetta(precedente: string | undefined): string | undefined {
  const m = /^(.*?)(\d+)([rRvV]?)$/.exec((precedente || '').trim());
  if (!m) return undefined;
  const [, prefisso, cifre, lato] = m;
  const avanti = (n: number) => String(n).padStart(cifre.length, '0');
  if (lato === 'r') return prefisso + cifre + 'v';
  if (lato === 'R') return prefisso + cifre + 'V';
  if (lato === 'v') return prefisso + avanti(Number(cifre) + 1) + 'r';
  if (lato === 'V') return prefisso + avanti(Number(cifre) + 1) + 'R';
  return prefisso + avanti(Number(cifre) + 1);
}
