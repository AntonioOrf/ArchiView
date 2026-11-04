import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Archive, Check, Folder, FolderPlus } from 'lucide-react-native';
import { LUNGHEZZA_NOME, nomeValido } from '../elencoDocumenti';
import { t } from '../lingua';
import { percorsoLeggibile, righeAlbero, tutteLeCartelle } from '../scelta';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { Campo } from '../ui/Campo';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';

type Props = { titolo: string; sotto: string; cartelle: string[]; attuale: string; onScegli: (cartella: string) => void; onIndietro: () => void; piede?: string;
  onNuova?: (percorso: string) => void };

export function ScegliCartella({ titolo, sotto, cartelle, attuale, onScegli, onIndietro, piede, onNuova }: Props) {
  const c = useColori();
  const [creando, setCreando] = useState(false);
  const [nome, setNome] = useState('');
  const esistenti = useMemo(() => new Set(tutteLeCartelle(cartelle)), [cartelle]);
  const pulito = nome.trim();
  const percorso = attuale ? `${attuale}/${pulito}` : pulito;
  const esiste = esistenti.has(percorso);
  const crea = () => { onNuova?.(percorso); onScegli(percorso); setNome(''); setCreando(false); };

  const nuovaCartella = onNuova && (
    <View style={{ paddingTop: spazio.md, gap: spazio.sm }}>
      {creando ? (
        <>
          <Campo etichetta={attuale ? t('Nuova cartella in «{cartella}»', { cartella: percorsoLeggibile(attuale) }) : t('Nome della cartella')} value={nome} onChangeText={setNome} maxLength={LUNGHEZZA_NOME} autoFocus />
          {pulito.includes('/') && <Testo variante="aiuto" tono="danger">{t('Niente «/» nel nome.')}</Testo>}
          {esiste && <Testo variante="aiuto">{t('Esiste già.')}</Testo>}
          <View style={{ flexDirection: 'row', gap: spazio.sm }}>
            <Pulsante variante="primario" titolo={t('Crea cartella')} disabilitato={!nomeValido(pulito, true) || esiste} style={{ flex: 1 }} onPress={crea} />
            <Pulsante variante="ghost" titolo={t('Annulla')} onPress={() => { setCreando(false); setNome(''); }} />
          </View>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreando(true)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spazio.md, minHeight: TOCCO, paddingHorizontal: spazio.md, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderInput, borderRadius: raggio.md, backgroundColor: pressed ? c.bgHover : 'transparent' })}
        >
          <FolderPlus size={20} color={c.primaryHover} />
          <Testo variante="controllo" tono="accento" numberOfLines={1} style={{ flex: 1 }}>{attuale ? t('Nuova cartella in «{cartella}»', { cartella: percorsoLeggibile(attuale) }) : t('Nuova cartella')}</Testo>
        </Pressable>
      )}
    </View>
  );
  const testoPiede = piede ?? (onNuova ? t('Le cartelle nuove arrivano sul computer con la prima scheda che contengono.') : t('Le cartelle nuove si creano sul computer.'));

  const voci = useMemo(() => {
    const tutte = [...esistenti];
    const righe = righeAlbero([], tutte, new Set(tutte));
    return [{ percorso: '', nome: t('Nessuna cartella'), livello: 0 }, ...righe.flatMap(r => (r.tipo === 'cartella' ? [{ percorso: r.percorso, nome: r.nome, livello: r.livello }] : []))];
  }, [esistenti]);

  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={titolo} sotto={sotto} onIndietro={onIndietro} />
      <FlatList
        data={voci}
        keyExtractor={v => 'c:' + v.percorso}
        accessibilityRole="radiogroup"
        contentContainerStyle={{ padding: spazio.md }}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={<>{nuovaCartella}<Testo variante="aiuto" style={{ paddingTop: spazio.md, paddingHorizontal: spazio.xs }}>{testoPiede}</Testo></>}
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
