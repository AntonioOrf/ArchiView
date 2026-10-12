// Tema dell'app (PIANO-SCANNER Fase 11): una sola fonte, ricavata dal desktop (DESIGN.md).
// Colori: `colori.ts`, GENERATO da style.css (chiaro = Clear Blue, scuro = Dark nero e arancione), scelto
// dal tema del sistema. Forma: angoli morbidi (`raggio`), niente ombre. Testo: serif per titoli e contenuti,
// sans di sistema per i controlli, mai sotto 12 (DESIGN.md: ≥ 11 px).

import { useColorScheme, type TextStyle } from 'react-native';
import { colori, type Colori } from './colori';

export type { Colori };

/** I colori del tema del sistema. Solo dentro i componenti (è un hook). */
export function useColori(): Colori {
  return useColorScheme() === 'dark' ? colori.scuro : colori.chiaro;
}

/** Scala da 4 punti. */
export const spazio = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/**
 * Angoli: sul telefono la forma è più morbida del desktop (richiesta 11/10; il desktop resta a
 * raggio 0, DESIGN.md). `md` controlli e riquadri, `lg` gruppi e pannelli, `tondo` il «+».
 */
export const raggio = { sm: 8, md: 12, lg: 16, tondo: 9999 } as const;

/** Area di tocco minima (Android: 48 dp). */
export const TOCCO = 48;

/** Serif di Android (Noto Serif): al posto di Georgia del desktop, senza font inclusi. */
const SERIF = 'serif';

/** Stili di testo, senza colore (lo mette `Testo` dal tema). */
export const tipo = {
  titolo: { fontFamily: SERIF, fontSize: 22, fontWeight: '600' },
  sezione: { fontFamily: SERIF, fontSize: 17, fontWeight: '600' },
  voce: { fontFamily: SERIF, fontSize: 16 },
  corpo: { fontSize: 15 },
  controllo: { fontSize: 15, fontWeight: '600' },
  aiuto: { fontSize: 13 }
} as const satisfies Record<string, TextStyle>;
