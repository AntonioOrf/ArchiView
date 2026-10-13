// Documenti (design 15a): «Documenti ⌄» apre la tendina degli archivi; ricerca sul nome (in tutti
// i documenti), cartelle di un livello col numero di documenti, poi i documenti fuori dalle
// cartelle. Dentro una cartella: i suoi documenti; vuota si può eliminare.

import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { Folder, FolderPlus, Search, Trash2 } from 'lucide-react-native';
import { cartelleConConta, documentiDi, LUNGHEZZA_NOME, nomeValido, quando, type Documento } from '../elencoDocumenti';
import { uriPagina } from '../documenti';
import { t } from '../lingua';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { SPORGENZA_BARRA } from '../ui/BarraFondo';
import { Campo } from '../ui/Campo';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';
import { Gruppo, Voce } from '../ui/Voce';
import { NomeArchivio } from './Archivio';

const documenti = (n: number) => (n === 1 ? t('1 documento') : t('{n} documenti', { n }));
const pagine = (n: number) => (n === 1 ? t('1 pagina') : t('{n} pagine', { n }));

type Props = {
  docs: Documento[];
  cartelle: string[];
  /** Cartella aperta; `null` = la radice. */
  cartella: string | null;
  onApriCartella: (nome: string) => void;
  onIndietro: () => void;
  onApri: (d: Documento) => void;
  onNuovaCartella: (nome: string) => void;
  onEliminaCartella: (nome: string) => void;
  onCambiaArchivio: () => void;
};

export function Documenti(p: Props) {
  const c = useColori();
  const [q, setQ] = useState('');
  const [creando, setCreando] = useState(false);
  const [nome, setNome] = useState('');
  const adesso = new Date();
  const cerca = p.cartella === null ? q : '';
  const elenco = useMemo(() => documentiDi(p.docs, p.cartella || '', cerca), [p.docs, p.cartella, cerca]);
  const cartelle = useMemo(() => cartelleConConta(p.cartelle, p.docs), [p.cartelle, p.docs]);
  const pulito = nome.trim();
  const esiste = cartelle.some(x => x.nome === pulito);

  const nuovaCartella = (
    <View style={{ paddingHorizontal: spazio.md, gap: spazio.sm }}>
      {creando ? (
        <>
          <Campo etichetta={t('Nome della cartella')} placeholder={t('Es. Ricevute')} value={nome} onChangeText={setNome} maxLength={LUNGHEZZA_NOME} autoFocus />
          {pulito.includes('/') && <Testo variante="aiuto" tono="danger">{t('Niente «/» nel nome.')}</Testo>}
          {esiste && <Testo variante="aiuto">{t('Esiste già.')}</Testo>}
          <View style={{ flexDirection: 'row', gap: spazio.sm }}>
            <Pulsante variante="primario" titolo={t('Crea cartella')} disabilitato={!nomeValido(pulito, true) || esiste} style={{ flex: 1 }}
              onPress={() => { p.onNuovaCartella(pulito); setNome(''); setCreando(false); }} />
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
          <Testo variante="controllo" tono="accento">{t('Nuova cartella')}</Testo>
        </Pressable>
      )}
    </View>
  );

  const testa = p.cartella === null ? (
    <View style={{ gap: spazio.md }}>
      <View style={{ paddingHorizontal: spazio.md, paddingTop: spazio.sm, paddingBottom: spazio.md, backgroundColor: c.bgPanel, borderBottomWidth: 1, borderColor: c.divisore, gap: 2 }}>
        <NomeArchivio nome={t('Documenti')} onPress={p.onCambiaArchivio} />
        <Testo variante="aiuto">{`${t('Solo su questo telefono')} · ${documenti(p.docs.length)}`}</Testo>
      </View>
      <View style={{ paddingHorizontal: spazio.md }}>
        <Campo placeholder={t('Cerca nome o testo riconosciuto')} segnapostoBreve={t('Cerca')} value={q} onChangeText={setQ} accessibilityLabel={t('Cerca nei documenti')} style={{ paddingLeft: 42 }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: spazio.md + 14, top: 15 }}><Search size={18} color={c.textMuted} /></View>
      </View>
      {!q.trim() && !!cartelle.length && (
        <Gruppo>
          {cartelle.map((x, i) => (
            <Voce key={x.nome} titolo={x.nome} icona={Folder} ultima={i === cartelle.length - 1}
              destra={<Testo variante="aiuto">{x.conta ? String(x.conta) : t('vuota')}</Testo>} onPress={() => p.onApriCartella(x.nome)} />
          ))}
        </Gruppo>
      )}
      {!q.trim() && nuovaCartella}
      {!!elenco.length && <Testo variante="sezione" accessibilityRole="header" style={{ paddingHorizontal: spazio.md }}>{q.trim() ? t('Trovati') : t('Fuori dalle cartelle')}</Testo>}
      {!elenco.length && (
        <Testo variante="aiuto" style={{ paddingHorizontal: spazio.md }}>
          {q.trim() ? t('Nessun documento trovato.') : p.docs.length ? '' : t('Nessun documento.')}
        </Testo>
      )}
    </View>
  ) : (
    <View style={{ gap: spazio.md }}>
      <Intestazione
        titolo={p.cartella}
        sotto={`${t('Documenti')} · ${documenti(elenco.length)}`}
        onIndietro={p.onIndietro}
        azioni={!elenco.length ? <Pulsante variante="pericoloGhost" icona={Trash2} etichetta={t('Elimina la cartella {nome}', { nome: p.cartella })} onPress={() => p.onEliminaCartella(p.cartella!)} /> : undefined}
      />
      {!elenco.length && <Testo variante="aiuto" style={{ paddingHorizontal: spazio.md }}>{t('Cartella vuota.')}</Testo>}
    </View>
  );

  const riga = ({ item: d, index }: { item: Documento; index: number }) => {
    const prima = index === 0, ultima = index === elenco.length - 1;
    const sotto = [cerca.trim() && d.cartella, quando(d.creatoIl, adesso), pagine(d.pagine.length)].filter(Boolean).join(' · ');
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${d.nome}, ${sotto}`}
        onPress={() => p.onApri(d)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: spazio.md, minHeight: 72, paddingHorizontal: spazio.md, paddingVertical: spazio.sm,
          marginHorizontal: spazio.md, backgroundColor: pressed ? c.bgHover : c.bgPanel,
          borderLeftWidth: 1, borderRightWidth: 1, borderTopWidth: prima ? 1 : 0, borderBottomWidth: 1, borderColor: c.divisore,
          borderTopLeftRadius: prima ? raggio.lg : 0, borderTopRightRadius: prima ? raggio.lg : 0,
          borderBottomLeftRadius: ultima ? raggio.lg : 0, borderBottomRightRadius: ultima ? raggio.lg : 0
        })}
      >
        <View style={{ width: 42, height: 56, borderRadius: raggio.sm, borderWidth: 1, borderColor: c.divisore, overflow: 'hidden', backgroundColor: c.bgHover }}>
          {!!d.pagine[0] && <Image source={{ uri: uriPagina(d, d.pagine[0]) }} style={{ flex: 1 }} resizeMode="cover" resizeMethod="resize" accessibilityIgnoresInvertColors />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Testo variante="voce" numberOfLines={1} style={{ fontWeight: '600' }}>{d.nome}</Testo>
          <Testo variante="aiuto" numberOfLines={1}>{sotto}</Testo>
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      data={elenco}
      keyExtractor={d => d.id}
      renderItem={riga}
      ListHeaderComponent={testa}
      ListHeaderComponentStyle={{ paddingBottom: spazio.sm }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: SPORGENZA_BARRA + spazio.md }}
    />
  );
}
