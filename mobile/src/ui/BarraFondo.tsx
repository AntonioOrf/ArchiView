import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { raggio, spazio, useColori } from '../theme';
import { Testo } from './Testo';

type Icona = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type Voce = { etichetta: string; icona: Icona; onPress: () => void; disabilitata?: boolean; conta?: number; descrizione?: string };

const ALTEZZA = 72;
export const CERCHIO = 64;
export const ALTEZZA_BARRA = ALTEZZA;
const STACCO = 8;

export function BarraFondo({ sinistra, centro, destra }: { sinistra: Voce; centro: Voce; destra: Voce }) {
  const c = useColori();
  const margini = useSafeAreaInsets();
  const meta = (v: Voce, lato: 'sinistra' | 'destra') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={v.descrizione || v.etichetta}
      onPress={v.onPress}
      style={({ pressed }) => ({
        flex: 1, alignItems: 'center', justifyContent: 'center', gap: spazio.xs,
        [lato === 'sinistra' ? 'paddingRight' : 'paddingLeft']: CERCHIO / 2,
        backgroundColor: pressed ? c.bgHover : 'transparent'
      })}
    >
      <View>
        <v.icona size={22} color={c.textMuted} />
        {!!v.conta && (
          <View style={{ position: 'absolute', top: -6, left: 14, minWidth: 18, minHeight: 18, paddingHorizontal: 4, borderRadius: raggio.tondo, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary }}>
            <Testo variante="aiuto" maxFontSizeMultiplier={1.5} style={{ fontSize: 11, lineHeight: 14, fontWeight: '700', color: c.onPrimary }}>{v.conta > 99 ? '99+' : String(v.conta)}</Testo>
          </View>
        )}
      </View>
      <Testo variante="aiuto" numberOfLines={1} maxFontSizeMultiplier={1.5}>{v.etichetta}</Testo>
    </Pressable>
  );
  const linea = { position: 'absolute' as const, top: 0, height: 1, width: '50%' as const, backgroundColor: c.divisore };
  return (
    <View style={{ height: ALTEZZA + margini.bottom, paddingBottom: margini.bottom, backgroundColor: c.bgPanel }}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {meta(sinistra, 'sinistra')}
        {meta(destra, 'destra')}
      </View>
      <View pointerEvents="none" style={[linea, { left: 0, transform: [{ translateX: -(CERCHIO / 2 + STACCO) }] }]} />
      <View pointerEvents="none" style={[linea, { right: 0, transform: [{ translateX: CERCHIO / 2 + STACCO }] }]} />
      <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: CERCHIO / 2 + STACCO, bottom: margini.bottom + 10, width: 1, backgroundColor: c.divisore }} />
      <View style={{ position: 'absolute', top: -CERCHIO / 2, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={centro.etichetta}
          accessibilityState={{ disabled: !!centro.disabilitata }}
          disabled={centro.disabilitata}
          onPress={centro.onPress}
          style={({ pressed }) => ({
            width: CERCHIO, height: CERCHIO, borderRadius: raggio.tondo,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: pressed ? c.primaryHover : c.primary,
            opacity: centro.disabilitata ? 0.5 : 1
          })}
        >
          <centro.icona size={32} color={c.onPrimary} strokeWidth={2.25} />
        </Pressable>
      </View>
    </View>
  );
}

export const SPORGENZA_BARRA = CERCHIO / 2 + STACCO;
