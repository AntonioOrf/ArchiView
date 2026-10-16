import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Archive, Folder, ScanLine, X } from 'lucide-react-native';
import { t } from '../lingua';
import { percorsoLeggibile } from '../scelta';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { Campo } from '../ui/Campo';
import { Pulsante } from '../ui/Pulsante';
import { Schermo } from '../ui/Schermo';
import { Testo } from '../ui/Testo';
import { ScegliCartella } from './ScegliCartella';

type Props = {
  visibile: boolean;
  archivio: string;
  cartelle: string[];
  cartellaIniziale: string;
  onChiudi: () => void;
  onNuova: (segnatura: string, nota: string, cartella: string) => void;
};

export function Nuovo({ visibile, archivio, cartelle, cartellaIniziale, onChiudi, onNuova }: Props) {
  const c = useColori();
  const margini = useSafeAreaInsets();
  const [segnatura, setSegnatura] = useState('');
  const [nota, setNota] = useState('');
  const [cartella, setCartella] = useState(cartellaIniziale);
  const [scegli, setScegli] = useState(false);
  useEffect(() => { if (visibile) { setCartella(cartellaIniziale); setScegli(false); } }, [visibile, cartellaIniziale]);
  const chiudi = () => { setSegnatura(''); setNota(''); onChiudi(); };
  const Icona = cartella ? Folder : Archive;

  return (
    <Modal visible={visibile} transparent={!scegli} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => (scegli ? setScegli(false) : chiudi())}>
      {scegli ? (
        <Schermo>
          <ScegliCartella titolo={segnatura.trim() ? t('Cartella di «{nome}»', { nome: segnatura.trim() }) : t('Cartella della scheda')} sotto={archivio} cartelle={cartelle} attuale={cartella}
            onScegli={v => { setCartella(v); setScegli(false); }} onIndietro={() => setScegli(false)} />
        </Schermo>
      ) : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable accessibilityLabel={t('Chiudi')} onPress={chiudi} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.55)' }} />
          <View accessibilityViewIsModal style={{ backgroundColor: c.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spazio.md, paddingTop: spazio.sm, paddingBottom: spazio.lg + margini.bottom, gap: spazio.md }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderLight }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm }}>
              <Testo variante="titolo" accessibilityRole="header" style={{ flex: 1 }}>{t('Nuova scheda')}</Testo>
              <Pulsante variante="ghost" icona={X} etichetta={t('Chiudi')} onPress={chiudi} />
            </View>

            <View style={{ gap: spazio.xs }}>
              <Testo variante="aiuto">{t('Cartella')}</Testo>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('Cartella: {nome}', { nome: cartella ? percorsoLeggibile(cartella) : t('nessuna') })}. ${t('Cambia')}`}
                onPress={() => setScegli(true)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spazio.sm + 2, minHeight: TOCCO, paddingLeft: 14, paddingRight: spazio.md, borderWidth: 1, borderColor: c.borderInput, borderRadius: raggio.md, backgroundColor: pressed ? c.bgHover : c.bgPanel })}
              >
                <Icona size={20} color={c.primaryHover} />
                <Testo numberOfLines={1} style={{ flex: 1 }}>{cartella ? percorsoLeggibile(cartella) : t('Nessuna cartella')}</Testo>
                <Testo variante="controllo" tono="accento">{t('Cambia')}</Testo>
              </Pressable>
            </View>
            <Campo etichetta={t('Segnatura')} placeholder={t('Es. Reg. 41')} value={segnatura} onChangeText={setSegnatura} maxLength={200} />
            <Campo etichetta={t('Nota')} placeholder={t('Es. legatura fragile, cc. 1-40')} value={nota} onChangeText={setNota} multiline maxLength={2000} />
            <Pulsante variante="primario" icona={ScanLine} titolo={t('Crea e scansiona')} disabilitato={!segnatura.trim()}
              onPress={() => { const s = segnatura.trim(), n = nota.trim(); chiudi(); onNuova(s, n, cartella); }} />
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}
