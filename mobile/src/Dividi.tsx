import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, View } from 'react-native';
import { Columns2 } from 'lucide-react-native';
import { t } from './lingua';
import { colori } from './theme/colori';
import { spazio, TOCCO, useColori } from './theme';
import { Intestazione } from './ui/Intestazione';
import { Pulsante } from './ui/Pulsante';

const tra = (f: number) => Math.min(0.9, Math.max(0.1, f));
const PASSO = 0.02;

type Props = {
  uri: string;
  onDividi: (frazione: number) => Promise<void>;
  onAnnulla: () => void;
};

export function Dividi({ uri, onDividi, onAnnulla }: Props) {
  const c = useColori();
  const [proporzione, setProporzione] = useState<number | null>(null);
  const [frazione, setFrazione] = useState(0.5);
  const [occupato, setOccupato] = useState(false);
  const larghezza = useRef(1);
  const inizio = useRef(0.5);
  const attuale = useRef(0.5);
  const imposta = (f: number) => { attuale.current = tra(f); setFrazione(attuale.current); };

  useEffect(() => {
    Image.getSize(uri, (w, h) => setProporzione(w / h), e => { console.warn('[dividi] dimensioni non lette', e); setProporzione(4 / 3); });
  }, [uri]);

  const trascina = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { inizio.current = attuale.current; },
    onPanResponderMove: (_e, g) => imposta(inizio.current + g.dx / larghezza.current)
  })).current;

  async function conferma() {
    setOccupato(true);
    try {
      await onDividi(attuale.current);
    } finally {
      setOccupato(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={t('Dividi la pagina doppia')} sotto={t('Trascina la linea sulla piega del registro')} onIndietro={onAnnulla} chiudi />
      <View style={{ flex: 1, backgroundColor: colori.scuro.bgBase, alignItems: 'center', justifyContent: 'center', padding: spazio.md }}>
        {!proporzione ? <ActivityIndicator color={colori.scuro.textMain} /> : (
          <View
            style={{ width: '100%', maxHeight: '100%', aspectRatio: proporzione }}
            onLayout={e => { larghezza.current = e.nativeEvent.layout.width || 1; }}
            {...trascina.panHandlers}
          >
            <Image source={{ uri }} style={{ flex: 1 }} resizeMode="stretch" resizeMethod="resize" accessibilityIgnoresInvertColors />
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={t('Linea della piega')}
              accessibilityValue={{ text: t('{n}% da sinistra', { n: Math.round(frazione * 100) }) }}
              accessibilityActions={[{ name: 'increment', label: t('A destra') }, { name: 'decrement', label: t('A sinistra') }]}
              onAccessibilityAction={e => imposta(attuale.current + (e.nativeEvent.actionName === 'increment' ? PASSO : -PASSO))}
              style={{ position: 'absolute', top: 0, bottom: 0, width: TOCCO, marginLeft: -TOCCO / 2, left: `${frazione * 100}%`, alignItems: 'center' }}
            >
              <View pointerEvents="none" style={{ flex: 1, width: 3, backgroundColor: colori.scuro.primary }} />
            </View>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spazio.md, padding: spazio.md, backgroundColor: c.bgPanel, borderTopWidth: 1, borderColor: c.divisore }}>
        <Pulsante variante="secondario" titolo={t('Annulla')} disabilitato={occupato} onPress={onAnnulla} style={{ flex: 1 }} />
        <Pulsante variante="primario" icona={Columns2} titolo={t('Dividi in due pagine')} caricamento={occupato} disabilitato={!proporzione} onPress={conferma} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
