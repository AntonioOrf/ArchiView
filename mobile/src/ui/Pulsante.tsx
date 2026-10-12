// Il `.btn` del desktop: primario, secondario, ghost, pericolo (pieno) e pericolo-ghost.
// Premuto = lo stato :hover del desktop. Angoli morbidi, niente ombra, area di tocco ≥ 48 dp.

import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { raggio, spazio, tipo, TOCCO, useColori, type Colori } from '../theme';

type Variante = 'primario' | 'secondario' | 'ghost' | 'pericolo' | 'pericoloGhost';
type Icona = ComponentType<{ size?: number; color?: string }>;

function aspetto(c: Colori, v: Variante, premuto: boolean) {
  switch (v) {
    case 'primario': return { fondo: premuto ? c.primaryHover : c.primary, testo: c.onPrimary, bordo: 'transparent' };
    case 'secondario': return { fondo: premuto ? c.bgHover : c.bgPanel, testo: c.textMain, bordo: c.border };
    case 'pericolo': return { fondo: premuto ? c.dangerHover : c.danger, testo: c.onDanger, bordo: 'transparent' };
    case 'pericoloGhost': return { fondo: premuto ? c.dangerLight : 'transparent', testo: c.dangerText, bordo: 'transparent' };
    default: return { fondo: premuto ? c.bgHover : 'transparent', testo: premuto ? c.textMain : c.textMuted, bordo: 'transparent' };
  }
}

type Props = {
  titolo?: string;
  /** Per i pulsanti con sola icona è obbligatoria (lettore di schermo). */
  etichetta?: string;
  icona?: Icona;
  variante?: Variante;
  disabilitato?: boolean;
  caricamento?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Pulsante({ titolo, etichetta, icona: Icona, variante = 'secondario', disabilitato, caricamento, onPress, style }: Props) {
  const c = useColori();
  const spento = !!(disabilitato || caricamento);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etichetta || titolo}
      accessibilityState={{ disabled: spento, busy: !!caricamento }}
      disabled={spento}
      onPress={onPress}
      hitSlop={titolo ? undefined : 4}
      style={({ pressed }) => {
        const a = aspetto(c, variante, pressed);
        return [{
          minHeight: TOCCO,
          minWidth: TOCCO,
          paddingHorizontal: titolo ? spazio.md : spazio.sm,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spazio.sm,
          backgroundColor: a.fondo, borderWidth: 1, borderColor: a.bordo, borderRadius: raggio.md,
          opacity: disabilitato ? 0.5 : 1
        }, style];
      }}
    >
      {({ pressed }) => {
        const a = aspetto(c, variante, pressed);
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm, flexShrink: 1 }}>
            {caricamento ? <ActivityIndicator color={a.testo} /> : Icona ? <Icona size={20} color={a.testo} /> : null}
            {/* 11c: col testo di sistema ingrandito l'etichetta va a capo invece di uscire dal pulsante. */}
            {!!titolo && <Text style={[tipo.controllo, { color: a.testo, flexShrink: 1, textAlign: 'center' }]}>{titolo}</Text>}
          </View>
        );
      }}
    </Pressable>
  );
}
