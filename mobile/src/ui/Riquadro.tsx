import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { raggio, spazio, useColori, type Colori } from '../theme';

type Tono = 'info' | 'successo' | 'pericolo' | 'avviso' | 'neutro';

const toni = (c: Colori, t: Tono) => ({
  info: { fondo: c.infoLight, bordo: c.infoBorder },
  successo: { fondo: c.successLight, bordo: c.successBorder },
  pericolo: { fondo: c.dangerLight, bordo: c.dangerBorder },
  avviso: { fondo: c.warningLight, bordo: c.warningBorder },
  neutro: { fondo: c.bgPanel, bordo: c.border }
}[t]);

export function Riquadro({ tono = 'neutro', children, style }: { tono?: Tono; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const a = toni(useColori(), tono);
  return <View style={[{ padding: spazio.md, gap: spazio.sm, backgroundColor: a.fondo, borderWidth: 1, borderColor: a.bordo, borderRadius: raggio.md }, style]}>{children}</View>;
}
