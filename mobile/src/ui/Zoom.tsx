// Fase 13: una pagina a tutto riquadro con pizzico, trascinamento e doppio tocco
// (gesture-handler + reanimated, sul thread dell'interfaccia). Non ingrandita, lo strisciare in
// orizzontale cambia pagina. Montarla con `key` per pagina: lo zoom riparte da 1.
// Shared value con `.get()`/`.set()` e non `.value`: così li accetta il React Compiler.

// Con `parole` (OCR dei Documenti): tieni premuto e trascina per selezionare il testo sulla foto,
// poi «Copia». Le parole stanno in pixel della foto, riportate allo spazio di `contain`.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Copy, X } from 'lucide-react-native';
import { t } from '../lingua';
import { parolaVicina, testoSelezionato, type Parola } from '../testo';
import { raggio, spazio, useColori } from '../theme';
import { Pulsante } from './Pulsante';

const MASSIMO = 5;
const DOPPIO_TOCCO = 2.5;
/** Px di strisciata per cambiare pagina. */
const SOGLIA = 80;
/** Ms di pressione prima che il trascinamento selezioni il testo. */
const PRESSIONE = 350;

type Props = { uri: string; etichetta: string; onScorri: (verso: 1 | -1) => void; parole?: Parola[] | null; onCopia?: (testo: string) => void };

export function Zoom({ uri, etichetta, onScorri, parole, onCopia }: Props) {
  const c = useColori();
  const [foto, setFoto] = useState<{ w: number; h: number } | null>(null);
  const [vista, setVista] = useState({ w: 1, h: 1 });
  /** Prima e ultima parola selezionate. */
  const [sel, setSel] = useState<[number, number] | null>(null);
  const selezionabile = !!(parole?.length && foto && onCopia);
  // Scala e scarto dell'immagine `contain` dentro la vista.
  const k = foto ? Math.min(vista.w / foto.w, vista.h / foto.h) : 1;
  const ox = foto ? (vista.w - foto.w * k) / 2 : 0, oy = foto ? (vista.h - foto.h * k) / 2 : 0;
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

  // Il punto toccato (nella vista) → pixel della foto, togliendo spostamento e ingrandimento
  // (che RN applica attorno al centro), poi la parola più vicina.
  const tocca = (px: number, py: number, s: number, tx: number, ty: number, inizio: boolean) => {
    if (!parole?.length || !foto) return;
    const qx = vista.w / 2 + (px - vista.w / 2 - tx) / s, qy = vista.h / 2 + (py - vista.h / 2 - ty) / s;
    const i = parolaVicina(parole, (qx - ox) / k, (qy - oy) / k);
    setSel(v => (inizio || !v ? [i, i] : v[1] === i ? v : [v[0], i]));
  };

  const seleziona = Gesture.Pan()
    .enabled(selezionabile)
    .activateAfterLongPress(PRESSIONE)
    .onStart(e => { scheduleOnRN(tocca, e.x, e.y, scala.get(), x.get(), y.get(), true); })
    .onUpdate(e => { scheduleOnRN(tocca, e.x, e.y, scala.get(), x.get(), y.get(), false); });

  const stile = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scala.get() }]
  }));

  const evidenziate = sel && parole ? parole.slice(Math.min(...sel), Math.max(...sel) + 1) : [];

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={Gesture.Race(doppio, seleziona, Gesture.Simultaneous(pizzico, trascina))}>
        <View
          style={{ flex: 1, overflow: 'hidden' }}
          onLayout={e => {
            const l = { w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 };
            lato.set(l);
            setVista(l);
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${etichetta}. ${t('Pizzica o tocca due volte per ingrandire, striscia per cambiare pagina.')}${selezionabile ? ` ${t('Tieni premuto e trascina per selezionare il testo.')}` : ''}`}
          accessibilityActions={[{ name: 'increment', label: t('Pagina successiva') }, { name: 'decrement', label: t('Pagina precedente') }]}
          onAccessibilityAction={e => onScorri(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        >
          <Animated.Image source={{ uri }} style={[StyleSheet.absoluteFill, stile]} resizeMode="contain" accessibilityIgnoresInvertColors
            onLoad={e => { const { width, height } = e.nativeEvent.source; if (width && height) setFoto({ w: width, h: height }); }} />
          {evidenziate.length > 0 && (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, stile]}>
              {evidenziate.map((p, j) => (
                <View key={j} style={{ position: 'absolute', left: ox + p.x0 * k, top: oy + p.y0 * k, width: (p.x1 - p.x0) * k, height: (p.y1 - p.y0) * k, backgroundColor: c.primary, opacity: 0.35 }} />
              ))}
            </Animated.View>
          )}
        </View>
      </GestureDetector>
      {sel && parole && onCopia && (
        <View style={{ position: 'absolute', bottom: spazio.md, alignSelf: 'center', flexDirection: 'row', gap: spazio.sm, padding: spazio.xs, borderRadius: raggio.lg, backgroundColor: c.bgPanel }}>
          <Pulsante variante="primario" icona={Copy} titolo={t('Copia')} onPress={() => { onCopia(testoSelezionato(parole, sel[0], sel[1])); setSel(null); }} />
          <Pulsante variante="ghost" icona={X} titolo={t('Annulla')} onPress={() => setSel(null)} />
        </View>
      )}
    </View>
  );
}
