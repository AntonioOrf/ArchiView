import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { Check, CheckCheck, Trash2 } from 'lucide-react-native';
import { t } from '../lingua';
import { raggio, useColori } from '../theme';
import { Intestazione } from './Intestazione';
import { Pulsante } from './Pulsante';

export function alternata(scelte: number[] | null, i: number): number[] | null {
  const a = scelte ?? [];
  const n = a.includes(i) ? a.filter(x => x !== i) : [...a, i];
  return n.length ? n : null;
}

export function useSelezione() {
  const [scelte, setScelte] = useState<number[] | null>(null);
  useEffect(() => {
    if (!scelte) return;
    const s = BackHandler.addEventListener('hardwareBackPress', () => { setScelte(null); return true; });
    return () => s.remove();
  }, [scelte]);
  return {
    scelte,
    scelta: (i: number) => !!scelte?.includes(i),
    alterna: (i: number) => setScelte(s => alternata(s, i)),
    tutte: (indici: number[]) => setScelte(indici.length ? indici : null),
    esci: () => setScelte(null)
  };
}

type Props = { n: number; totale: number; onTutte: () => void; onElimina: () => void; onEsci: () => void };

export function TestataSelezione({ n, totale, onTutte, onElimina, onEsci }: Props) {
  return (
    <Intestazione titolo={n === 1 ? t('1 selezionata') : t('{n} selezionate', { n })} onIndietro={onEsci} chiudi
      azioni={<>
        <Pulsante variante="ghost" icona={CheckCheck} etichetta={t('Seleziona tutte')} disabilitato={n === totale} onPress={onTutte} />
        <Pulsante variante="pericoloGhost" icona={Trash2} etichetta={t('Elimina le pagine selezionate')} onPress={onElimina} />
      </>} />
  );
}

export function SegnoScelta({ scelta }: { scelta: boolean }) {
  const c = useColori();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: raggio.tondo, borderWidth: 2, borderColor: scelta ? c.primary : c.onPrimary, backgroundColor: scelta ? c.primary : 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
      {scelta && <Check size={16} color={c.onPrimary} strokeWidth={3} />}
    </View>
  );
}
