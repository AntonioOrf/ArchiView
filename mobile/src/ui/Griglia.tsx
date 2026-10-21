import { useRef, useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { inizioGruppo, spostata } from '../elencoDocumenti';
import { t } from '../lingua';
import { raggio, spazio, useColori } from '../theme';
import { Testo } from './Testo';
import type { useSelezione } from './Selezione';

export const COLONNE = 3;
const MOTO = { duration: 220 };

export function useMisure() {
  const { width, height, fontScale } = useWindowDimensions();
  const lato = (width - spazio.md * 2 - spazio.md * (COLONNE - 1)) / COLONNE;
  const etichetta = Math.max(24, Math.ceil(20 * Math.min(fontScale, 1.5)));
  return { lato, etichetta, passo: lato * 4 / 3 + spazio.xs + etichetta + spazio.md, altezzaFinestra: height };
}

export function useFinestra() {
  const { passo, altezzaFinestra } = useMisure();
  const [y, setY] = useState(0);
  const [h, setH] = useState(altezzaFinestra);
  const [spostando, setSpostando] = useState<number | null>(null);
  return {
    vista: { y, h },
    spostando,
    setSpostando,
    scorrimento: {
      scrollEnabled: spostando === null,
      scrollEventThrottle: 16,
      onLayout: (e: { nativeEvent: { layout: { height: number } } }) => setH(e.nativeEvent.layout.height),
      onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => { const s = Math.floor(e.nativeEvent.contentOffset.y / passo) * passo; if (s !== y) setY(s); }
    }
  };
}

export function ContaSpostate({ n }: { n: number | null }) {
  const c = useColori();
  if (!n || n < 2) return null;
  return (
    <Testo variante="controllo" maxFontSizeMultiplier={1.5} pointerEvents="none"
      style={{ position: 'absolute', top: spazio.sm, right: spazio.md, paddingHorizontal: spazio.md, paddingVertical: spazio.xs, borderRadius: raggio.tondo, overflow: 'hidden', backgroundColor: c.primary, color: c.onPrimary, fontWeight: '700' }}>
      {t('{n} pagine', { n })}
    </Testo>
  );
}

type Descrizione = { etichetta: string; aiuto?: string };

type Props = {
  n: number;
  chiave: (i: number) => string;
  vista: { y: number; h: number };
  sel: ReturnType<typeof useSelezione>;
  primo?: number;
  bloccata?: (i: number) => boolean;
  onApri: (i: number) => void;
  onRiordina?: (da: number, a: number, insieme: number[]) => void;
  onSpostando: (n: number | null) => void;
  descrivi: (i: number, scegliendo: boolean) => Descrizione;
  contenuto: (i: number, evidenza: boolean) => ReactNode;
  etichetta: (i: number) => ReactNode;
};

type PropsCella = {
  i: number; n: number; lato: number; passo: number; alto: number;
  trascinabile: boolean; selezionabile: boolean; scegliendo: boolean; scelta: boolean;
  attenuata: boolean; sopra: boolean; barra: 'prima' | 'dopo' | null;
  onApri: (i: number) => void; onScegli: (i: number) => void; onRiordina: (da: number, a: number) => void;
  onTrascina: (i: number | null) => void; onPosto: (a: number) => void;
  descrizione: Descrizione; contenuto: (evidenza: boolean) => ReactNode; etichetta: ReactNode;
};

function Cella({ i, n, lato, passo, alto, trascinabile, selezionabile, scegliendo, scelta, attenuata, sopra, barra, onApri, onScegli, onRiordina, onTrascina, onPosto, descrizione, contenuto, etichetta }: PropsCella) {
  const c = useColori();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const su = useSharedValue(0);
  const posto = useSharedValue(i);
  const finito = useRef(0);
  const sx = spazio.md + (i % COLONNE) * (lato + spazio.md);
  const sy = Math.floor(i / COLONNE) * passo;

  const rilascia = (a: number) => {
    finito.current = Date.now();
    if (a !== i) onRiordina(i, a);
    onTrascina(null);
  };
  const pan = Gesture.Pan()
    .enabled(trascinabile)
    .activateAfterLongPress(350)
    .onStart(() => { su.set(withTiming(1, { duration: 120 })); posto.set(i); scheduleOnRN(onTrascina, i); })
    .onUpdate(e => {
      x.set(e.translationX); y.set(e.translationY);
      const col = Math.min(COLONNE - 1, Math.max(0, (i % COLONNE) + Math.round(e.translationX / (lato + spazio.md))));
      const a = Math.min(n - 1, Math.max(0, (Math.floor(i / COLONNE) + Math.round(e.translationY / passo)) * COLONNE + col));
      if (a !== posto.get()) { posto.set(a); scheduleOnRN(onPosto, a); }
    })
    .onEnd(() => { scheduleOnRN(rilascia, posto.get()); })
    .onFinalize(() => { x.set(withTiming(0, MOTO)); y.set(withTiming(0, MOTO)); su.set(withTiming(0, MOTO)); });
  const stile = useAnimatedStyle(() => ({
    left: withTiming(sx, MOTO),
    top: withTiming(sy, MOTO),
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: 1 + su.get() * 0.06 }],
    opacity: 1 - su.get() * 0.1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ position: 'absolute', width: lato, opacity: attenuata ? 0.35 : 1 }, sopra && { zIndex: 1, elevation: 1 }, stile]}>
        {barra && <View pointerEvents="none" style={{ position: 'absolute', top: 0, height: alto, width: 4, borderRadius: 2, backgroundColor: c.primary, [barra === 'prima' ? 'left' : 'right']: -spazio.md / 2 - 2 }} />}
        <Pressable accessibilityRole={scegliendo ? 'checkbox' : 'button'} accessibilityState={scegliendo ? { checked: scelta, disabled: !selezionabile } : undefined}
          accessibilityLabel={descrizione.etichetta} accessibilityHint={descrizione.aiuto}
          accessibilityActions={trascinabile && n > 1 ? [...(i > 0 ? [{ name: 'decrement', label: t('Sposta prima') }] : []), ...(i < n - 1 ? [{ name: 'increment', label: t('Sposta dopo') }] : [])] : undefined}
          onAccessibilityAction={e => onRiordina(i, i + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
          onLongPress={!trascinabile && selezionabile ? () => onScegli(i) : undefined}
          onPress={() => { if (Date.now() - finito.current > 400) { if (!scegliendo) onApri(i); else if (selezionabile) onScegli(i); } }} style={{ gap: spazio.xs }}>
          {({ pressed }) => (
            <>
              {contenuto(pressed || scelta)}
              <View style={{ height: passo - spazio.md - alto - spazio.xs, justifyContent: 'center' }}>{etichetta}</View>
            </>
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

export function Griglia({ n, chiave, vista, sel, primo = 0, bloccata = () => false, onApri, onRiordina, onSpostando, descrivi, contenuto, etichetta }: Props) {
  const { lato, passo } = useMisure();
  const [cima, setCima] = useState(0);
  const [trascinata, setTrascinata] = useState<number | null>(null);
  const [bersaglio, setBersaglio] = useState<number | null>(null);
  const [gruppo, setGruppo] = useState<number[]>([]);
  const indici = Array.from({ length: n }, (_, i) => i);
  const locali = (sel.scelte ?? []).map(j => j - primo).filter(j => j >= 0 && j < n && !bloccata(j));
  const fuori = (sel.scelte ?? []).filter(j => j < primo || j >= primo + n);
  const daRiga = Math.floor((vista.y - cima) / passo) - 2;
  const aRiga = Math.ceil((vista.y + vista.h - cima) / passo) + 2;
  let prima = -1;
  if (trascinata !== null && bersaglio !== null && spostata(indici, trascinata, bersaglio, gruppo) !== indici) {
    prima = indici.filter(j => !gruppo.includes(j))[inizioGruppo(n, trascinata, bersaglio, gruppo)] ?? n;
  }

  const trascina = (i: number | null) => {
    setTrascinata(i);
    setBersaglio(null);
    if (i === null) { setGruppo([]); onSpostando(null); return; }
    const g = locali.includes(i) ? locali : [...locali, i];
    setGruppo(g);
    onSpostando(g.length);
    sel.tutte([...fuori, ...g.map(j => j + primo)]);
  };
  const riordina = (da: number, a: number) => {
    const g = gruppo.length ? gruppo : [da];
    if (!onRiordina || spostata(indici, da, a, g) === indici) return;
    onRiordina(da, a, g);
    if (!gruppo.length) { sel.esci(); return; }
    const k = inizioGruppo(n, da, a, g);
    sel.tutte([...fuori, ...g.map((_, j) => k + j + primo)]);
  };

  return (
    <View onLayout={e => setCima(e.nativeEvent.layout.y)} style={{ height: Math.max(0, Math.ceil(n / COLONNE) * passo - spazio.md) }}>
      {indici.map(i => {
        const riga = Math.floor(i / COLONNE);
        if ((riga < daRiga || riga > aRiga) && i !== trascinata) return null;
        return (
          <Cella key={chiave(i)} i={i} n={n} lato={lato} passo={passo} alto={lato * 4 / 3}
            trascinabile={!!onRiordina && !bloccata(i)} selezionabile={!bloccata(i)}
            scegliendo={!!sel.scelte} scelta={sel.scelta(i + primo)}
            attenuata={trascinata !== null && trascinata !== i && gruppo.includes(i)}
            sopra={trascinata === i}
            barra={prima === i ? 'prima' : prima === n && i === n - 1 ? 'dopo' : null}
            onApri={onApri} onScegli={j => sel.alterna(j + primo)} onRiordina={riordina} onTrascina={trascina} onPosto={setBersaglio}
            descrizione={descrivi(i, !!sel.scelte)} contenuto={ev => contenuto(i, ev)} etichetta={etichetta(i)} />
        );
      })}
    </View>
  );
}
