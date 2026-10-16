import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, X } from 'lucide-react-native';
import { t } from '../lingua';
import { raggio, spazio, tipo, useColori } from '../theme';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';

type Props = {
  visibile: boolean;
  titolo: string;
  testo: string | null;
  pagine: number;
  occupato: boolean;
  onCorreggi: (testo: string) => void;
  onCopia: (testo: string) => void;
  onCopiaTutte: () => void;
  onChiudi: () => void;
};

export function TestoPagina(p: Props) {
  const c = useColori();
  const margini = useSafeAreaInsets();
  const [valore, setValore] = useState(p.testo ?? '');
  const campo = useRef<TextInput>(null);
  useEffect(() => { setValore(p.testo ?? ''); }, [p.testo]);
  useEffect(() => { if (p.testo !== null) setTimeout(() => campo.current?.setSelection(0, 0), 0); }, [p.testo]);
  const salva = () => { if (p.testo !== null && valore !== p.testo) p.onCorreggi(valore); };
  const chiudi = () => { salva(); p.onChiudi(); };

  return (
    <Modal visible={p.visibile} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={chiudi}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel={t('Chiudi')} onPress={chiudi} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.55)' }} />
        <View accessibilityViewIsModal style={{ height: '70%', backgroundColor: c.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spazio.md, paddingTop: spazio.sm, paddingBottom: spazio.lg + margini.bottom, gap: spazio.md }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderLight }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm }}>
            <Testo variante="titolo" accessibilityRole="header" style={{ flex: 1 }}>{p.titolo}</Testo>
            <Pulsante variante="ghost" icona={X} etichetta={t('Chiudi')} onPress={chiudi} />
          </View>
          <Testo variante="aiuto">{t('Le correzioni restano col documento.')}</Testo>
          {p.testo === null ? (
            <View accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spazio.sm }}>
              <ActivityIndicator color={c.primary} />
              <Testo variante="aiuto">{t('Riconosco il testo…')}</Testo>
            </View>
          ) : (
            <TextInput
              ref={campo} accessibilityLabel={t('Testo riconosciuto')} value={valore} onChangeText={setValore} onBlur={salva} multiline textAlignVertical="top" spellCheck={false} autoCorrect={false}
              placeholder={t('Nessun testo riconosciuto in questa pagina.')} placeholderTextColor={c.textPlaceholder} selectionColor={c.primary}
              style={[tipo.corpo, { flex: 1, padding: spazio.md, color: c.textMain, backgroundColor: c.bgBase, borderWidth: 1, borderColor: c.borderInput, borderRadius: raggio.md }]}
            />
          )}
          <View style={{ flexDirection: 'row', gap: spazio.sm }}>
            <Pulsante variante="primario" icona={Copy} titolo={t('Copia testo')} disabilitato={p.testo === null || !valore.trim()} style={{ flex: 1 }}
              onPress={() => { salva(); p.onCopia(valore); }} />
            {p.pagine > 1 && <Pulsante titolo={t('Tutte le pagine')} caricamento={p.occupato && p.testo !== null} disabilitato={p.testo === null} onPress={() => { salva(); p.onCopiaTutte(); }} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
