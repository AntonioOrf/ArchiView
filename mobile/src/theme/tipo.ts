import type { TextStyle } from 'react-native';

const SANS = 'IBMPlexSans';
const SERIF = 'SourceSerif4';
const MONO = 'IBMPlexMono';

export const tipo = {
  titolo: { fontFamily: SERIF, fontSize: 22, fontWeight: '600' },
  sezione: { fontFamily: SANS, fontSize: 15, fontWeight: '600' },
  voce: { fontFamily: SERIF, fontSize: 16 },
  corpo: { fontFamily: SANS, fontSize: 15 },
  controllo: { fontFamily: SANS, fontSize: 15, fontWeight: '500' },
  aiuto: { fontFamily: SANS, fontSize: 13 },
  mono: { fontFamily: MONO, fontSize: 15 }
} as const satisfies Record<string, TextStyle>;
