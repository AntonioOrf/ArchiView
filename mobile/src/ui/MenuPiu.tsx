import type { ComponentType } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { t } from '../lingua';
import { raggio, spazio, useColori } from '../theme';
import { ALTEZZA_BARRA, CERCHIO } from './BarraFondo';
import { Testo } from './Testo';

const PALLINO = 52;

type Voce = { titolo: string; sotto: string; icona: ComponentType<{ size?: number; color?: string }>; onPress: () => void };

export function MenuPiu({ visibile, voci, onChiudi }: { visibile: boolean; voci: Voce[]; onChiudi: () => void }) {
  const c = useColori();
  const margini = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fondoCerchio = ALTEZZA_BARRA + margini.bottom - CERCHIO / 2;
  return (
    <Modal visible={visibile} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onChiudi}>
      <Pressable accessibilityLabel={t('Chiudi')} onPress={onChiudi} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20, 19, 18, 0.55)' }} />
      <View accessibilityViewIsModal style={{ position: 'absolute', left: 0, right: width / 2 - PALLINO / 2, bottom: fondoCerchio + CERCHIO + spazio.lg, alignItems: 'flex-end', gap: spazio.md }}>
        {voci.map(v => (
          <Pressable
            key={v.titolo}
            accessibilityRole="menuitem"
            accessibilityLabel={`${v.titolo}, ${v.sotto}`}
            onPress={() => { onChiudi(); v.onPress(); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md, maxWidth: '100%', paddingLeft: spazio.md }}
          >
            {({ pressed }) => (
              <>
                <View style={{ flexShrink: 1, paddingHorizontal: 14, paddingVertical: spazio.sm, borderRadius: raggio.md, backgroundColor: pressed ? c.bgHover : c.bgPanel }}>
                  <Testo variante="controllo">{v.titolo}</Testo>
                  <Testo variante="aiuto">{v.sotto}</Testo>
                </View>
                <View style={{ width: PALLINO, height: PALLINO, borderRadius: raggio.tondo, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.bgHover : c.bgPanel, borderWidth: 1, borderColor: c.divisore }}>
                  <v.icona size={24} color={c.primaryHover} />
                </View>
              </>
            )}
          </Pressable>
        ))}
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: fondoCerchio, alignItems: 'center' }} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Chiudi')}
          onPress={onChiudi}
          style={({ pressed }) => ({ width: CERCHIO, height: CERCHIO, borderRadius: raggio.tondo, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.primaryHover : c.primary })}
        >
          <X size={30} color={c.onPrimary} strokeWidth={2.25} />
        </Pressable>
      </View>
    </Modal>
  );
}
