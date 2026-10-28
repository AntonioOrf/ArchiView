import { View } from 'react-native';
import { ArrowUp, Check, Clock, Monitor, Pause } from 'lucide-react-native';
import { t } from '../lingua';
import { raggio, spazio, useColori } from '../theme';
import { Testo } from './Testo';

export type StatoRiga = 'telefono' | 'caricamento' | 'drive' | 'arrivato';

export function Pallino({ stato }: { stato: StatoRiga | 'futuro' }) {
  const c = useColori();
  const [sfondo, bordo, Icona, colore] =
    stato === 'telefono' ? [c.warningLight, c.warningBorder, Pause, c.warning]
      : stato === 'caricamento' ? [c.primary, c.primary, ArrowUp, c.onPrimary]
        : stato === 'drive' ? [c.bgPanel, c.primary, Monitor, c.primary]
          : stato === 'arrivato' ? [c.successLight, c.successBorder, Check, c.success]
            : [c.bgPanel, c.border, null, c.border];
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: stato === 'drive' ? 2 : 1, borderColor: bordo, backgroundColor: sfondo, alignItems: 'center', justifyContent: 'center' }}>
      {Icona && <Icona size={16} color={colore} strokeWidth={2.25} />}
    </View>
  );
}

export function Avanzamento({ fatte, totali }: { fatte: number; totali: number }) {
  const c = useColori();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.primaryBorder }}>
      <View style={{ height: 6, borderRadius: 3, width: `${Math.round((fatte / Math.max(1, totali)) * 100)}%`, backgroundColor: c.primary }} />
    </View>
  );
}

export function PrimoInvio() {
  const c = useColori();
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', gap: spazio.sm, marginHorizontal: spazio.md, marginTop: spazio.md, padding: spazio.md, backgroundColor: c.primaryLight, borderWidth: 1, borderColor: c.primaryBorder, borderRadius: raggio.lg }}>
      <Clock size={20} color={c.primaryHover} />
      <View style={{ flex: 1, gap: 2 }}>
        <Testo variante="sezione" tono="accento">{t('Primo invio a questo archivio')}</Testo>
        <Testo variante="aiuto" tono="main">{t('La prima volta il computer può metterci qualche minuto. Gli invii dopo arrivano prima.')}</Testo>
      </View>
    </View>
  );
}
