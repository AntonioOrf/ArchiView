import { useColorScheme, type TextStyle } from 'react-native';
import { colori, type Colori } from './colori';

export type { Colori };

export function useColori(): Colori {
  return useColorScheme() === 'dark' ? colori.scuro : colori.chiaro;
}

export const spazio = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const raggio = { sm: 8, md: 12, lg: 16, tondo: 9999 } as const;

export const TOCCO = 48;

const SERIF = 'serif';

export const tipo = {
  titolo: { fontFamily: SERIF, fontSize: 22, fontWeight: '600' },
  sezione: { fontFamily: SERIF, fontSize: 17, fontWeight: '600' },
  voce: { fontFamily: SERIF, fontSize: 16 },
  corpo: { fontSize: 15 },
  controllo: { fontSize: 15, fontWeight: '600' },
  aiuto: { fontSize: 13 }
} as const satisfies Record<string, TextStyle>;
