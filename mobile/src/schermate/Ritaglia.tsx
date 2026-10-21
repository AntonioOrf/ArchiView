import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Crop, Maximize } from 'lucide-react-native';
import { t } from '../lingua';
import { eIntera, ritaglioValido, spostaPunto } from '../pagine';
import { INTERI, type Angoli } from '../scanner/bordi';
import { colori } from '../theme/colori';
import { spazio, TOCCO, useColori } from '../theme';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';

const NOMI = [
  () => t('Angolo in alto a sinistra'),
  () => t('Angolo in alto a destra'),
  () => t('Angolo in basso a destra'),
  () => t('Angolo in basso a sinistra')
];
const VERSO_INTERNO = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
const PASSO = 0.02;
const INDICI = [0, 1, 2, 3];

type Props = { titolo: string; uri: string; iniziali?: Angoli; onRitaglia: (q: Angoli) => Promise<void>; onAnnulla: () => void };

export function Ritaglia({ titolo, uri, iniziali, onRitaglia, onAnnulla }: Props) {
  const c = useColori();
  const [proporzione, setProporzione] = useState<number | null>(null);
  const [q, setQ] = useState<Angoli>(iniziali ?? INTERI);
  const [occupato, setOccupato] = useState(false);
  const [lato, setLato] = useState({ w: 1, h: 1 });
  const attuale = useRef(q);
  const inizio = useRef(q);
  const misure = useRef(lato);
  const imposta = (n: Angoli) => { attuale.current = n; setQ(n); };

  useEffect(() => {
    Image.getSize(uri, (w, h) => setProporzione(w / h), e => { console.warn('[ritaglia] dimensioni non lette', e); setProporzione(3 / 4); });
  }, [uri]);

  const maniglie = useRef(INDICI.map(k => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { inizio.current = attuale.current; },
    onPanResponderMove: (_e, g) => imposta(spostaPunto(inizio.current, k, g.dx / misure.current.w, g.dy / misure.current.h))
  }))).current;

  async function conferma() {
    setOccupato(true);
    try {
      await onRitaglia(attuale.current);
    } finally {
      setOccupato(false);
    }
  }

  const { w, h } = lato;
  const poligono = INDICI.map(k => `${k ? 'L' : 'M'}${q[2 * k] * w} ${q[2 * k + 1] * h}`).join(' ') + ' Z';
  const valido = ritaglioValido(q);
  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={titolo} sotto={t('Trascina gli angoli')} onIndietro={onAnnulla} chiudi />
      <View style={{ flex: 1, backgroundColor: colori.scuro.bgBase, alignItems: 'center', justifyContent: 'center', padding: spazio.lg }}>
        {!proporzione ? <ActivityIndicator color={colori.scuro.textMain} /> : (
          <View
            style={{ width: '100%', maxHeight: '100%', aspectRatio: proporzione }}
            onLayout={e => { misure.current = { w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 }; setLato(misure.current); }}
          >
            <Image source={{ uri }} style={{ flex: 1 }} resizeMode="stretch" resizeMethod="resize" accessibilityIgnoresInvertColors />
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path d={`M0 0 H${w} V${h} H0 Z ${poligono}`} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
              <Path d={poligono} fill="none" stroke={valido ? colori.scuro.textMain : colori.scuro.danger} strokeWidth={2} />
            </Svg>
            {INDICI.map(k => (
              <View
                key={k}
                {...maniglie[k].panHandlers}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={NOMI[k]()}
                accessibilityActions={[{ name: 'increment', label: t('Verso l\'interno') }, { name: 'decrement', label: t('Verso l\'esterno') }]}
                onAccessibilityAction={e => {
                  const d = (e.nativeEvent.actionName === 'increment' ? 1 : -1) * PASSO;
                  imposta(spostaPunto(attuale.current, k, VERSO_INTERNO[k][0] * d, VERSO_INTERNO[k][1] * d));
                }}
                style={{ position: 'absolute', width: TOCCO, height: TOCCO, marginLeft: -TOCCO / 2, marginTop: -TOCCO / 2, left: `${q[2 * k] * 100}%`, top: `${q[2 * k + 1] * 100}%`, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: 22, height: 22, borderColor: colori.scuro.textMain, borderWidth: 4, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.3)' }} />
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spazio.md, padding: spazio.md, backgroundColor: c.bgPanel, borderTopWidth: 1, borderColor: c.divisore }}>
        <Pulsante variante="secondario" icona={Maximize} titolo={t('Pagina intera')} disabilitato={occupato || eIntera(q)} onPress={() => imposta(INTERI)} style={{ flex: 1 }} />
        <Pulsante variante="primario" icona={Crop} titolo={t('Ritaglia')} caricamento={occupato} disabilitato={!valido || (!iniziali && eIntera(q))} onPress={conferma} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
