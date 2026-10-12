// «Testo» del visore (design 15a, solo Documenti): foglio dal basso col testo riconosciuto sul
// telefono, correggibile prima di copiarlo (la correzione resta col documento). «Copia testo» per
// la pagina, «Tutte le pagine» per il documento intero.

import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, X } from 'lucide-react-native';
import { raggio, spazio, tipo, useColori } from '../theme';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';

type Props = {
  visibile: boolean;
  titolo: string;
  /** `null` = riconoscimento in corso. */
  testo: string | null;
  pagine: number;
  occupato: boolean;
  /** Il testo cambiato a mano, da salvare (alla copia o alla chiusura). */
  onCorreggi: (testo: string) => void;
  onCopia: (testo: string) => void;
  onCopiaTutte: () => void;
  onChiudi: () => void;
};

export function TestoPagina(p: Props) {
  const c = useColori();
  const margini = useSafeAreaInsets();
  const [valore, setValore] = useState(p.testo ?? '');
  useEffect(() => { setValore(p.testo ?? ''); }, [p.testo]);
  const salva = () => { if (p.testo !== null && valore !== p.testo) p.onCorreggi(valore); };
  const chiudi = () => { salva(); p.onChiudi(); };

  return (
    <Modal visible={p.visibile} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={chiudi}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Chiudi" onPress={chiudi} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.55)' }} />
        <View accessibilityViewIsModal style={{ height: '70%', backgroundColor: c.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spazio.md, paddingTop: spazio.sm, paddingBottom: spazio.lg + margini.bottom, gap: spazio.md }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderLight }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm }}>
            <Testo variante="titolo" accessibilityRole="header" style={{ flex: 1 }}>{p.titolo}</Testo>
            <Pulsante variante="ghost" icona={X} etichetta="Chiudi" onPress={chiudi} />
          </View>
          <Testo variante="aiuto">Le correzioni restano col documento.</Testo>
          {p.testo === null ? (
            <View accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spazio.sm }}>
              <ActivityIndicator color={c.primary} />
              <Testo variante="aiuto">Riconosco il testo…</Testo>
            </View>
          ) : (
            <TextInput
              accessibilityLabel="Testo riconosciuto" value={valore} onChangeText={setValore} onBlur={salva} multiline textAlignVertical="top"
              placeholder="Nessun testo riconosciuto in questa pagina." placeholderTextColor={c.textPlaceholder} selectionColor={c.primary}
              style={[tipo.corpo, { flex: 1, padding: spazio.md, color: c.textMain, backgroundColor: c.bgBase, borderWidth: 1, borderColor: c.borderInput, borderRadius: raggio.md }]}
            />
          )}
          <View style={{ flexDirection: 'row', gap: spazio.sm }}>
            <Pulsante variante="primario" icona={Copy} titolo="Copia testo" disabilitato={p.testo === null || !valore.trim()} style={{ flex: 1 }}
              onPress={() => { salva(); p.onCopia(valore); }} />
            {p.pagine > 1 && <Pulsante titolo="Tutte le pagine" caricamento={p.occupato && p.testo !== null} disabilitato={p.testo === null} onPress={() => { salva(); p.onCopiaTutte(); }} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
