// Fase 13 (design 11/10): «Ritaglia di nuovo» con un riquadro dritto. ML Kit non riapre una foto
// già fatta e la prospettiva richiederebbe OpenCV (provato e tolto nella Fase 9). Si trascinano i
// quattro angoli; il riquadro sta in frazioni dell'immagine, che ha le proporzioni della foto.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, View } from 'react-native';
import { Crop, Maximize } from 'lucide-react-native';
import { t } from '../lingua';
import { INTERA, eIntera, spostaAngolo, type Riquadro } from '../pagine';
import { colori } from '../theme/colori';
import { spazio, TOCCO, useColori } from '../theme';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';

type Angolo = { x: 'x0' | 'x1'; y: 'y0' | 'y1' };
const ANGOLI: Angolo[] = [{ x: 'x0', y: 'y0' }, { x: 'x1', y: 'y0' }, { x: 'x0', y: 'y1' }, { x: 'x1', y: 'y1' }];
const nomeAngolo = (a: Angolo) => (a.y === 'y0'
  ? (a.x === 'x0' ? t('Angolo in alto a sinistra') : t('Angolo in alto a destra'))
  : (a.x === 'x0' ? t('Angolo in basso a sinistra') : t('Angolo in basso a destra')));
/** Passo dei comandi del lettore di schermo, in frazione. */
const PASSO = 0.02;

type Props = { titolo: string; uri: string; onRitaglia: (r: Riquadro) => Promise<void>; onAnnulla: () => void };

export function Ritaglia({ titolo, uri, onRitaglia, onAnnulla }: Props) {
  const c = useColori();
  const [proporzione, setProporzione] = useState<number | null>(null);
  const [r, setR] = useState<Riquadro>(INTERA);
  const [occupato, setOccupato] = useState(false);
  const attuale = useRef(INTERA);
  const inizio = useRef(INTERA);
  const lato = useRef({ w: 1, h: 1 });
  const imposta = (n: Riquadro) => { attuale.current = n; setR(n); };

  useEffect(() => {
    Image.getSize(uri, (w, h) => setProporzione(w / h), e => { console.warn('[ritaglia] dimensioni non lette', e); setProporzione(3 / 4); });
  }, [uri]);

  const maniglie = useRef(ANGOLI.map(a => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { inizio.current = attuale.current; },
    onPanResponderMove: (_e, g) => imposta(spostaAngolo(inizio.current, a, g.dx / lato.current.w, g.dy / lato.current.h))
  }))).current;

  async function conferma() {
    setOccupato(true);
    try {
      await onRitaglia(attuale.current);
    } finally {
      setOccupato(false);
    }
  }

  const ombra = { position: 'absolute' as const, backgroundColor: 'rgba(0,0,0,0.55)' };
  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={titolo} sotto={t('Trascina gli angoli')} onIndietro={onAnnulla} chiudi />
      <View style={{ flex: 1, backgroundColor: colori.scuro.bgBase, alignItems: 'center', justifyContent: 'center', padding: spazio.lg }}>
        {!proporzione ? <ActivityIndicator color={colori.scuro.textMain} /> : (
          <View
            style={{ width: '100%', maxHeight: '100%', aspectRatio: proporzione }}
            onLayout={e => { lato.current = { w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 }; }}
          >
            <Image source={{ uri }} style={{ flex: 1 }} resizeMode="stretch" resizeMethod="resize" accessibilityIgnoresInvertColors />
            <View pointerEvents="none" style={[ombra, { left: 0, right: 0, top: 0, height: `${r.y0 * 100}%` }]} />
            <View pointerEvents="none" style={[ombra, { left: 0, right: 0, bottom: 0, height: `${(1 - r.y1) * 100}%` }]} />
            <View pointerEvents="none" style={[ombra, { left: 0, width: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`, height: `${(r.y1 - r.y0) * 100}%` }]} />
            <View pointerEvents="none" style={[ombra, { right: 0, width: `${(1 - r.x1) * 100}%`, top: `${r.y0 * 100}%`, height: `${(r.y1 - r.y0) * 100}%` }]} />
            <View pointerEvents="none" style={{ position: 'absolute', left: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`, width: `${(r.x1 - r.x0) * 100}%`, height: `${(r.y1 - r.y0) * 100}%`, borderWidth: 2, borderColor: colori.scuro.textMain }} />
            {ANGOLI.map((a, k) => (
              <View
                key={a.x + a.y}
                {...maniglie[k].panHandlers}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={nomeAngolo(a)}
                accessibilityActions={[{ name: 'increment', label: t('Verso l\'interno') }, { name: 'decrement', label: t('Verso l\'esterno') }]}
                onAccessibilityAction={e => {
                  const d = (e.nativeEvent.actionName === 'increment' ? 1 : -1) * PASSO;
                  imposta(spostaAngolo(attuale.current, a, a.x === 'x0' ? d : -d, a.y === 'y0' ? d : -d));
                }}
                style={{ position: 'absolute', width: TOCCO, height: TOCCO, marginLeft: -TOCCO / 2, marginTop: -TOCCO / 2, left: `${r[a.x] * 100}%`, top: `${r[a.y] * 100}%`, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: 22, height: 22, borderColor: colori.scuro.textMain, borderWidth: 4, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.3)' }} />
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spazio.md, padding: spazio.md, backgroundColor: c.bgPanel, borderTopWidth: 1, borderColor: c.divisore }}>
        <Pulsante variante="secondario" icona={Maximize} titolo={t('Pagina intera')} disabilitato={occupato || eIntera(r)} onPress={() => imposta(INTERA)} style={{ flex: 1 }} />
        <Pulsante variante="primario" icona={Crop} titolo={t('Ritaglia')} caricamento={occupato} disabilitato={eIntera(r)} onPress={conferma} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
