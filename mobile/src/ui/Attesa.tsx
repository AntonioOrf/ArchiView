// Riquadro sotto l'intestazione (design 11/10): compare solo durante l'invio (avanzamento) o con
// errori dei lotti. Le pagine in attesa e «Invia ora» stanno in «Invio» nella barra in fondo.
// Annunciato ai lettori di schermo quando cambia.

import { ActivityIndicator, View } from 'react-native';
import { raggio, spazio, useColori } from '../theme';
import { Testo } from './Testo';

type Props = {
  invio: { fatte: number; totali: number } | null;
  errori: string[];
};

export function Attesa({ invio, errori }: Props) {
  const c = useColori();
  if (!invio && !errori.length) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ marginHorizontal: spazio.md, marginTop: spazio.md, paddingHorizontal: spazio.md, paddingVertical: spazio.xs, gap: spazio.xs, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.divisore, borderRadius: raggio.md }}>
      {invio && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm, minHeight: 40 }}>
            <ActivityIndicator size="small" color={c.primary} />
            <Testo variante="aiuto" tono="main" style={{ flex: 1 }}>{`Invio ${invio.fatte}/${invio.totali} · tieni l'app aperta`}</Testo>
          </View>
          <View style={{ height: 4, marginBottom: spazio.xs, borderRadius: 2, backgroundColor: c.bgHover }}>
            <View style={{ height: 4, borderRadius: 2, width: `${Math.round((invio.fatte / Math.max(1, invio.totali)) * 100)}%`, backgroundColor: c.primary }} />
          </View>
        </>
      )}
      {errori.map((e, i) => <Testo key={i} variante="aiuto" tono="danger" style={{ paddingVertical: spazio.xs }}>{e}</Testo>)}
    </View>
  );
}
