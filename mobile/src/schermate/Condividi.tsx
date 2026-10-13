// «Condividi o salva» (design 15a): pannello dal basso. Formato PDF (predefinito) o JPEG, poi
// «Condividi…» (menu di Android) o «Salva in Download» (cartella scelta una volta). Condividi
// manda un file solo: con JPEG vale per i documenti di una pagina.
// «Testo cercabile nel PDF» (15e, acceso di predefinito): prima riconosce il testo delle pagine.

import { useState } from 'react';
import { Modal, Pressable, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download, Share2, X } from 'lucide-react-native';
import type { Formato } from '../esporta';
import { t } from '../lingua';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';

type Props = {
  visibile: boolean;
  pagine: number;
  /** Una cartella è già stata scelta: la nota lo dice e si può cambiare. */
  cartellaScelta: boolean;
  occupato: boolean;
  onChiudi: () => void;
  onCondividi: (f: Formato, ricercabile: boolean) => void;
  onSalva: (f: Formato, ricercabile: boolean) => void;
  onCambiaCartella: () => void;
};

export function Condividi(p: Props) {
  const c = useColori();
  const margini = useSafeAreaInsets();
  const [formato, setFormato] = useState<Formato>('pdf');
  const [ricercabile, setRicercabile] = useState(true);
  const conTesto = formato === 'pdf' && ricercabile;
  const condivisibile = formato === 'pdf' || p.pagine === 1;
  const scelte: { f: Formato; titolo: string; sotto: string }[] = [
    { f: 'pdf', titolo: 'PDF', sotto: t('Un file con tutte le pagine') },
    { f: 'jpeg', titolo: t('Immagini JPEG'), sotto: p.pagine === 1 ? t('Un\'immagine') : t('Una per pagina · {n} file', { n: p.pagine }) }
  ];

  return (
    <Modal visible={p.visibile} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={p.onChiudi}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel={t('Chiudi')} onPress={p.onChiudi} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.55)' }} />
        <View accessibilityViewIsModal style={{ backgroundColor: c.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spazio.md, paddingTop: spazio.sm, paddingBottom: spazio.lg + margini.bottom, gap: spazio.md }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderLight }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm }}>
            <Testo variante="titolo" accessibilityRole="header" style={{ flex: 1 }}>{t('Condividi o salva')}</Testo>
            <Pulsante variante="ghost" icona={X} etichetta={t('Chiudi')} onPress={p.onChiudi} />
          </View>

          <View accessibilityRole="radiogroup" accessibilityLabel={t('Formato')} style={{ borderWidth: 1, borderColor: c.divisore, borderRadius: raggio.lg, overflow: 'hidden' }}>
            {scelte.map((s, i) => {
              const scelta = s.f === formato;
              return (
                <Pressable key={s.f} accessibilityRole="radio" accessibilityState={{ checked: scelta }} accessibilityLabel={`${s.titolo}, ${s.sotto}`} onPress={() => setFormato(s.f)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spazio.md, minHeight: TOCCO + spazio.md, paddingHorizontal: spazio.md, borderTopWidth: i ? 1 : 0, borderColor: c.divisore, backgroundColor: pressed ? c.bgHover : scelta ? c.primaryLight : c.bgPanel })}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: scelta ? c.primary : c.borderInput, alignItems: 'center', justifyContent: 'center' }}>
                    {scelta && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Testo variante="voce" style={{ fontWeight: '600' }}>{s.titolo}</Testo>
                    <Testo variante="aiuto">{s.sotto}</Testo>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {formato === 'pdf' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md }}>
              <Testo variante="voce" style={{ flex: 1, fontWeight: '600' }}>{t('Testo cercabile nel PDF')}</Testo>
              <Switch value={ricercabile} onValueChange={setRicercabile} accessibilityLabel={t('Testo cercabile nel PDF')}
                trackColor={{ false: c.borderInput, true: c.primary }} thumbColor={ricercabile ? c.onPrimary : c.textMuted} />
            </View>
          )}

          <Pulsante variante="primario" icona={Share2} titolo={t('Condividi…')} disabilitato={!condivisibile} caricamento={p.occupato} onPress={() => p.onCondividi(formato, conTesto)} />
          {!condivisibile && <Testo variante="aiuto">{t('Condividi manda un file solo: per più immagini usa il PDF o «Salva in Download».')}</Testo>}
          <Pulsante icona={Download} titolo={t('Salva in Download')} caricamento={p.occupato} onPress={() => p.onSalva(formato, conTesto)} />
          {p.cartellaScelta ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm }}>
              <Testo variante="aiuto" style={{ flex: 1 }}>{t('Salva nella cartella scelta l\'ultima volta.')}</Testo>
              <Pulsante variante="ghost" titolo={t('Cambia cartella')} onPress={p.onCambiaCartella} />
            </View>
          ) : (
            <Testo variante="aiuto">{t('La prima volta Android ti chiede la cartella: dentro «Download» creane una (per esempio «Scansioni») e usa quella, poi la ricorda. Download da sola non è ammessa.')}</Testo>
          )}
        </View>
      </View>
    </Modal>
  );
}
