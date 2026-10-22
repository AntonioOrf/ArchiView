import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
import { t } from '../lingua';
import { spazio, useColori } from '../theme';
import { Pulsante } from './Pulsante';
import { Testo } from './Testo';

type Props = { titolo: string; sotto?: string; onIndietro?: () => void; chiudi?: boolean; azioni?: ReactNode; mono?: boolean };

export function Intestazione({ titolo, sotto, onIndietro, chiudi, azioni, mono }: Props) {
  const c = useColori();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spazio.xs,
      paddingHorizontal: spazio.sm, paddingVertical: spazio.sm,
      backgroundColor: c.bgPanel, borderBottomWidth: 1, borderColor: c.divisore
    }}>
      {onIndietro ? <Pulsante variante="ghost" icona={chiudi ? X : ArrowLeft} etichetta={chiudi ? t('Chiudi') : t('Indietro')} onPress={onIndietro} /> : <View style={{ width: spazio.sm }} />}
      <View style={{ flex: 1 }}>
        <Testo variante={mono ? 'mono' : 'titolo'} accessibilityRole="header" numberOfLines={2} style={mono ? { fontSize: 18, fontWeight: '500' } : undefined}>{titolo}</Testo>
        {!!sotto && <Testo variante="aiuto">{sotto}</Testo>}
      </View>
      {azioni}
    </View>
  );
}
