// Riga di un elenco (archivi, schede): icona, titolo serif, riga d'aiuto, contenuto a destra e ›.
// Elenco piatto con divisori, non una pila di card (DESIGN.md: superfici piatte).

import type { ComponentType, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { Testo } from './Testo';

type Props = {
  titolo: string;
  sotto?: string;
  icona?: ComponentType<{ size?: number; color?: string }>;
  destra?: ReactNode;
  onPress?: () => void;
  /** Fondo d'accento: la voce fissa più importante («Da smistare»). */
  evidenziata?: boolean;
  /** Ultima del gruppo: niente divisore sotto (il gruppo ha già il suo bordo). */
  ultima?: boolean;
};

/** Gruppo arrotondato che contiene le voci (design "morbido" 11/10). */
export function Gruppo({ children }: { children: ReactNode }) {
  const c = useColori();
  return <View style={{ marginHorizontal: spazio.md, borderWidth: 1, borderColor: c.divisore, borderRadius: raggio.lg, overflow: 'hidden', backgroundColor: c.bgPanel }}>{children}</View>;
}

export function Voce({ titolo, sotto, icona: Icona, destra, onPress, evidenziata, ultima }: Props) {
  const c = useColori();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sotto ? `${titolo}, ${sotto}` : titolo}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: TOCCO + spazio.md,
        flexDirection: 'row', alignItems: 'center', gap: spazio.md,
        paddingHorizontal: spazio.md, paddingVertical: spazio.sm,
        backgroundColor: pressed ? c.bgHover : evidenziata ? c.primaryLight : c.bgPanel,
        borderBottomWidth: ultima ? 0 : 1, borderColor: c.divisore
      })}
    >
      {Icona && <Icona size={22} color={evidenziata ? c.primaryHover : c.textMuted} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Testo variante="voce">{titolo}</Testo>
        {!!sotto && <Testo variante="aiuto">{sotto}</Testo>}
      </View>
      {destra}
      {onPress && <ChevronRight size={20} color={c.textMuted} />}
    </Pressable>
  );
}
