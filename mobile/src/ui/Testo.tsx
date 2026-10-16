import { Text, type TextProps } from 'react-native';
import { tipo, useColori, type Colori } from '../theme';

type Tono = 'main' | 'muted' | 'danger' | 'success' | 'accento';

const coloreDi = (c: Colori, t: Tono) =>
  t === 'muted' ? c.textMuted : t === 'danger' ? c.dangerText : t === 'success' ? c.success : t === 'accento' ? c.primaryHover : c.textMain;

export function Testo({ variante = 'corpo', tono, style, ...props }: TextProps & { variante?: keyof typeof tipo; tono?: Tono }) {
  const c = useColori();
  const t = tono || (variante === 'aiuto' ? 'muted' : 'main');
  return <Text style={[tipo[variante], { color: coloreDi(c, t) }, style]} {...props} />;
}
