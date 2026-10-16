import { useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View, type AlertButton } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../lingua';
import { raggio, spazio, useColori } from '../theme';
import { ALTEZZA_BARRA } from './BarraFondo';
import { Pulsante } from './Pulsante';
import { Testo } from './Testo';

type Voce = { titolo: string; messaggio?: string; pulsanti: AlertButton[] };

let coda: Voce[] = [];
let notifica: { testo: string; id: number } | null = null;
const ascolta = new Set<() => void>();
const avvisa = () => ascolta.forEach(f => f());
const cambia = (c: Voce[]) => { coda = c; avvisa(); };
const iscrivi = (f: () => void) => { ascolta.add(f); return () => { ascolta.delete(f); }; };

export function avviso(titolo: string, messaggio?: string, pulsanti?: AlertButton[]) {
  cambia([...coda, { titolo, messaggio, pulsanti: pulsanti?.length ? pulsanti : [{ text: 'OK' }] }]);
}

export function notizia(testo: string, lunga = false) {
  const id = Date.now();
  notifica = { testo, id };
  avvisa();
  setTimeout(() => { if (notifica?.id === id) { notifica = null; avvisa(); } }, lunga ? 3500 : 2000);
}

export function Avvisi() {
  return <><Notizia /><Finestra /></>;
}

function Notizia() {
  const c = useColori();
  const margini = useSafeAreaInsets();
  const n = useSyncExternalStore(iscrivi, () => notifica);
  if (!n) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: spazio.md, right: spazio.md, bottom: ALTEZZA_BARRA + margini.bottom + spazio.md, alignItems: 'center' }}>
      <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: spazio.md, paddingVertical: 12, borderRadius: raggio.md, backgroundColor: c.textMain }}>
        <Testo style={{ color: c.bgPanel, textAlign: 'center' }}>{n.testo}</Testo>
      </View>
    </View>
  );
}

function Finestra() {
  const c = useColori();
  const { height } = useWindowDimensions();
  const v = useSyncExternalStore(iscrivi, () => coda)[0];
  if (!v) return null;

  const premi = (p?: AlertButton) => {
    cambia(coda.slice(1));
    p?.onPress?.();
  };
  const annulla = v.pulsanti.find(p => p.style === 'cancel') ?? (v.pulsanti.length === 1 ? v.pulsanti[0] : undefined);
  const chiudi = () => { if (annulla) premi(annulla); };
  const colonna = v.pulsanti.length > 2;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={chiudi}>
      <View style={{ flex: 1, justifyContent: 'center', padding: spazio.lg }}>
        <Pressable accessibilityLabel={t('Chiudi')} disabled={!annulla} onPress={chiudi}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.55)' }} />
        <View accessibilityViewIsModal accessibilityRole="alert"
          style={{ backgroundColor: c.bgPanel, borderRadius: raggio.lg, borderWidth: 1, borderColor: c.divisore, padding: spazio.lg, gap: spazio.md, maxHeight: height * 0.8 }}>
          <Testo variante="sezione" accessibilityRole="header">{v.titolo}</Testo>
          {!!v.messaggio && <ScrollView style={{ flexGrow: 0 }}><Testo tono="muted">{v.messaggio}</Testo></ScrollView>}
          <View style={{ flexDirection: colonna ? 'column-reverse' : 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spazio.sm, marginTop: spazio.xs }}>
            {v.pulsanti.map((p, i) => (
              <Pulsante key={i} titolo={p.text} onPress={() => premi(p)}
                variante={p.style === 'destructive' ? 'pericolo' : p.style === 'cancel' ? 'ghost' : i === v.pulsanti.length - 1 ? 'primario' : 'secondario'} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
