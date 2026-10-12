// Cambia cartella (design 14a): elenco tutto aperto (le cartelle di un archivio sono poche), una
// sola scelta, «Nessuna cartella» in testa. Le cartelle nuove si creano sul computer.

import { useMemo } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Archive, Check, Folder } from 'lucide-react-native';
import { righeAlbero, tutteLeCartelle } from '../scelta';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { Intestazione } from '../ui/Intestazione';
import { Testo } from '../ui/Testo';

/** `piede`: la riga d'aiuto in fondo (i Documenti hanno le loro cartelle, create sul telefono). */
type Props = { titolo: string; sotto: string; cartelle: string[]; attuale: string; onScegli: (cartella: string) => void; onIndietro: () => void; piede?: string };

export function ScegliCartella({ titolo, sotto, cartelle, attuale, onScegli, onIndietro, piede = 'Le cartelle nuove si creano sul computer.' }: Props) {
  const c = useColori();
  const voci = useMemo(() => {
    const tutte = tutteLeCartelle(cartelle);
    const righe = righeAlbero([], tutte, new Set(tutte));
    return [{ percorso: '', nome: 'Nessuna cartella', livello: 0 }, ...righe.flatMap(r => (r.tipo === 'cartella' ? [{ percorso: r.percorso, nome: r.nome, livello: r.livello }] : []))];
  }, [cartelle]);

  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={titolo} sotto={sotto} onIndietro={onIndietro} />
      <FlatList
        data={voci}
        keyExtractor={v => 'c:' + v.percorso}
        accessibilityRole="radiogroup"
        contentContainerStyle={{ padding: spazio.md }}
        ListFooterComponent={<Testo variante="aiuto" style={{ paddingTop: spazio.md, paddingHorizontal: spazio.xs }}>{piede}</Testo>}
        renderItem={({ item: v, index }) => {
          const scelta = v.percorso === attuale;
          const Icona = v.percorso ? Folder : Archive;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: scelta }}
              accessibilityLabel={v.percorso ? v.percorso.split('/').join(', ') : v.nome}
              onPress={() => onScegli(v.percorso)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spazio.sm + 2, minHeight: TOCCO + 4,
                paddingLeft: spazio.md + v.livello * 24, paddingRight: spazio.md,
                backgroundColor: pressed ? c.bgHover : scelta ? c.primaryLight : c.bgPanel,
                borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopWidth: index === 0 ? 1 : 0, borderColor: c.divisore,
                borderTopLeftRadius: index === 0 ? raggio.lg : 0, borderTopRightRadius: index === 0 ? raggio.lg : 0,
                borderBottomLeftRadius: index === voci.length - 1 ? raggio.lg : 0, borderBottomRightRadius: index === voci.length - 1 ? raggio.lg : 0
              })}
            >
              <Icona size={20} color={scelta ? c.primaryHover : c.textMuted} />
              <Testo variante={v.percorso ? 'voce' : 'corpo'} numberOfLines={1} style={{ flex: 1, fontWeight: scelta ? '600' : undefined }}>{v.nome}</Testo>
              {scelta && <Check size={20} color={c.primaryHover} strokeWidth={2.5} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
