// Fase 13: una pagina a tutto riquadro con pizzico, trascinamento e doppio tocco
// (gesture-handler + reanimated, sul thread dell'interfaccia). Non ingrandita, lo strisciare in
// orizzontale cambia pagina. Montarla con `key` per pagina: lo zoom riparte da 1.
// Shared value con `.get()`/`.set()` e non `.value`: così li accetta il React Compiler.

import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MASSIMO = 5;
const DOPPIO_TOCCO = 2.5;
/** Px di strisciata per cambiare pagina. */
const SOGLIA = 80;

type Props = { uri: string; etichetta: string; onScorri: (verso: 1 | -1) => void };

export function Zoom({ uri, etichetta, onScorri }: Props) {
  const scala = useSharedValue(1);
  const scalaInizio = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const xInizio = useSharedValue(0);
  const yInizio = useSharedValue(0);
  const lato = useSharedValue({ w: 1, h: 1 });

  // Lo spostamento resta entro il bordo dell'immagine ingrandita.
  const limita = (v: number, s: number, l: number) => {
    'worklet';
    const m = ((s - 1) * l) / 2;
    return Math.min(m, Math.max(-m, v));
  };
  const azzera = () => {
    'worklet';
    scala.set(withTiming(1));
    x.set(withTiming(0));
    y.set(withTiming(0));
  };

  const pizzico = Gesture.Pinch()
    .onStart(() => { scalaInizio.set(scala.get()); })
    .onUpdate(e => { scala.set(Math.min(MASSIMO, Math.max(0.8, scalaInizio.get() * e.scale))); })
    .onEnd(() => {
      const s = scala.get();
      if (s <= 1) { azzera(); return; }
      x.set(withTiming(limita(x.get(), s, lato.get().w)));
      y.set(withTiming(limita(y.get(), s, lato.get().h)));
    });

  const trascina = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => { xInizio.set(x.get()); yInizio.set(y.get()); })
    .onUpdate(e => {
      const s = scala.get();
      if (s > 1) {
        x.set(limita(xInizio.get() + e.translationX, s, lato.get().w));
        y.set(limita(yInizio.get() + e.translationY, s, lato.get().h));
      } else {
        x.set(e.translationX / 2); // segue il dito, frenato: si capisce che la pagina cambia
      }
    })
    .onEnd(e => {
      if (scala.get() > 1) return;
      if (Math.abs(e.translationX) > SOGLIA) scheduleOnRN(onScorri, e.translationX < 0 ? 1 : -1);
      x.set(withTiming(0));
    });

  const doppio = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(e => {
      if (scala.get() > 1) { azzera(); return; }
      // Il punto toccato resta sotto il dito.
      const { w, h } = lato.get();
      scala.set(withTiming(DOPPIO_TOCCO));
      x.set(withTiming(limita((w / 2 - e.x) * (DOPPIO_TOCCO - 1), DOPPIO_TOCCO, w)));
      y.set(withTiming(limita((h / 2 - e.y) * (DOPPIO_TOCCO - 1), DOPPIO_TOCCO, h)));
    });

  const stile = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scala.get() }]
  }));

  return (
    <GestureDetector gesture={Gesture.Race(doppio, Gesture.Simultaneous(pizzico, trascina))}>
      <View
        style={{ flex: 1, overflow: 'hidden' }}
        onLayout={e => { lato.set({ w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 }); }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${etichetta}. Pizzica o tocca due volte per ingrandire, striscia per cambiare pagina.`}
        accessibilityActions={[{ name: 'increment', label: 'Pagina successiva' }, { name: 'decrement', label: 'Pagina precedente' }]}
        onAccessibilityAction={e => onScorri(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <Animated.Image source={{ uri }} style={[StyleSheet.absoluteFill, stile]} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    </GestureDetector>
  );
}
