import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Copy, TextSelect, X } from 'lucide-react-native';
import { t } from '../lingua';
import { parolaVicina, testoSelezionato, type Parola } from '../testo';
import { raggio, spazio, useColori } from '../theme';
import { notizia } from './Avviso';
import { Pulsante } from './Pulsante';

const MASSIMO = 5;
const DOPPIO_TOCCO = 2.5;
const SOGLIA = 80;
const PRESSIONE = 350;
const MANIGLIA = 22;

type Props = { uri: string; etichetta: string; onScorri: (verso: 1 | -1) => void; parole?: Parola[] | null; onCopia?: (testo: string) => void; onRiconosci?: () => void };

function Maniglia({ punto, vista, scala, x, y, inizio, colore, gesto }: { punto: { x: number; y: number }; vista: { w: number; h: number }; scala: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number>; inizio: boolean; colore: string; gesto: PanGesture }) {
  const stile = useAnimatedStyle(() => ({
    transform: [
      { translateX: vista.w / 2 + (punto.x - vista.w / 2) * scala.get() + x.get() - (inizio ? MANIGLIA : 0) },
      { translateY: vista.h / 2 + (punto.y - vista.h / 2) * scala.get() + y.get() }
    ]
  }));
  return (
    <GestureDetector gesture={gesto}>
      <Animated.View importantForAccessibility="no-hide-descendants" hitSlop={14}
        style={[{ position: 'absolute', left: 0, top: 0, width: MANIGLIA, height: MANIGLIA, borderRadius: MANIGLIA / 2, backgroundColor: colore }, inizio ? { borderTopRightRadius: 0 } : { borderTopLeftRadius: 0 }, stile]} />
    </GestureDetector>
  );
}

export function Zoom({ uri, etichetta, onScorri, parole, onCopia, onRiconosci }: Props) {
  const c = useColori();
  const [foto, setFoto] = useState<{ w: number; h: number } | null>(null);
  const [vista, setVista] = useState({ w: 1, h: 1 });
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [inAttesa, setInAttesa] = useState<{ x: number; y: number } | null>(null);
  const selezionabile = !!(foto && onCopia && (parole || onRiconosci));
  const k = foto ? Math.min(vista.w / foto.w, vista.h / foto.h) : 1;
  const ox = foto ? (vista.w - foto.w * k) / 2 : 0, oy = foto ? (vista.h - foto.h * k) / 2 : 0;
  const scala = useSharedValue(1);
  const scalaInizio = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const xInizio = useSharedValue(0);
  const yInizio = useSharedValue(0);
  const lato = useSharedValue({ w: 1, h: 1 });
  const presa = useSharedValue({ x: 0, y: 0 });

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
        x.set(e.translationX / 2);
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
      const { w, h } = lato.get();
      scala.set(withTiming(DOPPIO_TOCCO));
      x.set(withTiming(limita((w / 2 - e.x) * (DOPPIO_TOCCO - 1), DOPPIO_TOCCO, w)));
      y.set(withTiming(limita((h / 2 - e.y) * (DOPPIO_TOCCO - 1), DOPPIO_TOCCO, h)));
    });

  const inFoto = (px: number, py: number, s: number, tx: number, ty: number) => ({
    x: (vista.w / 2 + (px - vista.w / 2 - tx) / s - ox) / k,
    y: (vista.h / 2 + (py - vista.h / 2 - ty) / s - oy) / k
  });

  const tocca = (px: number, py: number, s: number, tx: number, ty: number, inizio: boolean) => {
    if (!foto) return;
    const q = inFoto(px, py, s, tx, ty);
    if (!parole) {
      if (inizio && onRiconosci) { setInAttesa(q); onRiconosci(); }
      return;
    }
    if (!parole.length) { if (inizio) notizia(t('Nessun testo riconosciuto in questa pagina.')); return; }
    const i = parolaVicina(parole, q.x, q.y);
    setSel(v => (inizio || !v ? [i, i] : v[1] === i ? v : [v[0], i]));
  };

  if (inAttesa && parole) {
    setInAttesa(null);
    if (parole.length) { const i = parolaVicina(parole, inAttesa.x, inAttesa.y); setSel([i, i]); }
  }

  const seleziona = Gesture.Pan()
    .enabled(selezionabile)
    .activateAfterLongPress(PRESSIONE)
    .onStart(e => { scheduleOnRN(tocca, e.x, e.y, scala.get(), x.get(), y.get(), true); })
    .onUpdate(e => { scheduleOnRN(tocca, e.x, e.y, scala.get(), x.get(), y.get(), false); });

  const togli = Gesture.Tap()
    .enabled(!!sel)
    .onEnd(() => { scheduleOnRN(setSel, null); });

  const puntoManiglia = (p: Parola, inizio: boolean) => ({ x: ox + (inizio ? p.x0 : p.x1) * k, y: oy + p.y1 * k });

  const sposta = (quale: 0 | 1, px: number, py: number, s: number, tx: number, ty: number) => {
    if (!parole?.length) return;
    const q = inFoto(px, py, s, tx, ty);
    const i = parolaVicina(parole, q.x, q.y);
    setSel(v => (!v || v[quale] === i ? v : quale === 0 ? [i, v[1]] : [v[0], i]));
  };
  const gestoManiglia = (quale: 0 | 1, cx: number, cy: number) => Gesture.Pan()
    .minDistance(0)
    .onStart(() => {
      const s = scala.get();
      presa.set({ x: vista.w / 2 + (cx - vista.w / 2) * s + x.get(), y: vista.h / 2 + (cy - vista.h / 2) * s + y.get() });
    })
    .onUpdate(e => {
      const a = presa.get();
      scheduleOnRN(sposta, quale, a.x + e.translationX, a.y + e.translationY, scala.get(), x.get(), y.get());
    });

  const stile = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scala.get() }]
  }));

  const valida = sel && parole && Math.max(...sel) < parole.length ? sel : null;
  const evidenziate = valida && parole ? parole.slice(Math.min(...valida), Math.max(...valida) + 1) : [];
  const tutte = !!valida && parole && Math.min(...valida) === 0 && Math.max(...valida) === parole.length - 1;

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={Gesture.Race(Gesture.Exclusive(doppio, togli), seleziona, Gesture.Simultaneous(pizzico, trascina))}>
        <View
          style={{ flex: 1, overflow: 'hidden' }}
          onLayout={e => {
            const l = { w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 };
            lato.set(l);
            setVista(l);
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${etichetta}. ${t('Pizzica o tocca due volte per ingrandire, striscia per cambiare pagina.')}${selezionabile ? ` ${t('Tieni premuto su una parola per selezionarla, poi trascina le maniglie.')}` : ''}`}
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
      {valida && parole && ([0, 1] as const).map(quale => {
        const inizio = quale === 0 ? valida[0] <= valida[1] : valida[1] < valida[0];
        const p = parole[valida[quale]];
        return <Maniglia key={quale} punto={puntoManiglia(p, inizio)} vista={vista} scala={scala} x={x} y={y} inizio={inizio} colore={c.primary}
          gesto={gestoManiglia(quale, ox + ((p.x0 + p.x1) / 2) * k, oy + ((p.y0 + p.y1) / 2) * k)} />;
      })}
      {valida && parole && onCopia && (
        <View style={{ position: 'absolute', bottom: spazio.md, alignSelf: 'center', flexDirection: 'row', gap: spazio.sm, padding: spazio.xs, borderRadius: raggio.lg, backgroundColor: c.bgPanel }}>
          <Pulsante variante="primario" icona={Copy} titolo={t('Copia')} onPress={() => { onCopia(testoSelezionato(parole, valida[0], valida[1])); setSel(null); }} />
          {!tutte && <Pulsante variante="ghost" icona={TextSelect} titolo={t('Seleziona tutto')} onPress={() => setSel([0, parole.length - 1])} />}
          <Pulsante variante="ghost" icona={X} titolo={t('Annulla')} onPress={() => setSel(null)} />
        </View>
      )}
    </View>
  );
}
