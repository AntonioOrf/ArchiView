import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
import { t } from '../lingua';
import { spazio, useColori } from '../theme';
import { Pulsante } from './Pulsante';
import { Testo } from './Testo';

type Props = { titolo: string; sotto?: string; onIndietro?: () => void; chiudi?: boolean; azioni?: ReactNode };

export function Intestazione({ titolo, sotto, onIndietro, chiudi, azioni }: Props) {
  const c = useColori();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spazio.xs,
      paddingHorizontal: spazio.sm, paddingVertical: spazio.sm,
      backgroundColor: c.bgPanel, borderBottomWidth: 1, borderColor: c.divisore
    }}>
      {onIndietro ? <Pulsante variante="ghost" icona={chiudi ? X : ArrowLeft} etichetta={chiudi ? t('Chiudi') : t('Indietro')} onPress={onIndietro} /> : <View style={{ width: spazio.sm }} />}
      <View style={{ flex: 1 }}>
        <Testo variante="titolo" accessibilityRole="header" numberOfLines={2}>{titolo}</Testo>
        {!!sotto && <Testo variante="aiuto">{sotto}</Testo>}
      </View>
      {azioni}
    </View>
  );
}
