// F11 — «Unisci»: quale documento mettere in fondo a quello aperto. Elenco piatto, dal più recente,
// con cartella e pagine; il tocco sceglie (la conferma la chiede chi apre questa schermata).

import { FlatList, Pressable, View } from 'react-native';
import { FileText } from 'lucide-react-native';
import { quando, type Documento } from '../elencoDocumenti';
import { t } from '../lingua';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { Intestazione } from '../ui/Intestazione';
import { Testo } from '../ui/Testo';

type Props = { titolo: string; documenti: Documento[]; onScegli: (d: Documento) => void; onIndietro: () => void };

export function ScegliDocumento({ titolo, documenti, onScegli, onIndietro }: Props) {
  const c = useColori();
  const voci = [...documenti].sort((a, b) => b.creatoIl.localeCompare(a.creatoIl));
  const adesso = new Date();
  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={t('Unisci un documento')} sotto={t('In fondo a «{nome}»', { nome: titolo })} onIndietro={onIndietro} />
      <FlatList
        data={voci}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: spazio.md }}
        ListEmptyComponent={<Testo variante="aiuto">{t('Non ci sono altri documenti.')}</Testo>}
        renderItem={({ item: d, index }) => {
          const sotto = [d.cartella, d.pagine.length === 1 ? t('1 pagina') : t('{n} pagine', { n: d.pagine.length }), quando(d.creatoIl, adesso)].filter(Boolean).join(' · ');
          return (
            <Pressable
              accessibilityRole="button" accessibilityLabel={`${d.nome}, ${sotto}`} onPress={() => onScegli(d)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spazio.sm + 2, minHeight: TOCCO + spazio.sm, paddingHorizontal: spazio.md, paddingVertical: spazio.xs,
                backgroundColor: pressed ? c.bgHover : c.bgPanel,
                borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopWidth: index === 0 ? 1 : 0, borderColor: c.divisore,
                borderTopLeftRadius: index === 0 ? raggio.lg : 0, borderTopRightRadius: index === 0 ? raggio.lg : 0,
                borderBottomLeftRadius: index === voci.length - 1 ? raggio.lg : 0, borderBottomRightRadius: index === voci.length - 1 ? raggio.lg : 0
              })}
            >
              <FileText size={20} color={c.textMuted} />
              <View style={{ flex: 1, gap: 1 }}>
                <Testo variante="voce" numberOfLines={1}>{d.nome}</Testo>
                <Testo variante="aiuto" numberOfLines={1}>{sotto}</Testo>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
