import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { ChevronDown, ChevronRight, ChevronUp, CircleCheck, CloudUpload, Eye, FileText, Folder, FolderOpen, Inbox, Search } from 'lucide-react-native';
import type { ConfigScanner } from '../contratto';
import type { SchedaNuova } from '../coda';
import { quando } from '../elencoDocumenti';
import { t } from '../lingua';
import { righeAlbero, type Riga, type SchedaAlbero, type SchedaScelta } from '../scelta';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { SPORGENZA_BARRA } from '../ui/BarraFondo';
import { Campo } from '../ui/Campo';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';

const RIENTRO = 24;
const ANTEPRIME = 4;
const conta = (n: number) => (n === 1 ? t('1 pagina') : t('{n} pagine', { n }));

export type SchedaInAttesa = { scelta: SchedaScelta; pagine: number; anteprime: { uri: string; etichetta?: string }[]; riassunto?: string };

type Props = {
  archivio: { nome: string; nuovo: boolean };
  elenco: ConfigScanner | null;
  nuove: SchedaNuova[];
  inAttesa: SchedaInAttesa[];
  statoInvio: string;
  onInviaOra: () => void;
  aperte: string[];
  onAlterna: (percorso: string) => void;
  attesa: ReactNode;
  onApri: (s: SchedaScelta) => void;
  onApriPagina: (s: SchedaScelta, indice: number) => void;
  onCambiaArchivio: () => void;
  daRecuperare: number;
  onRecupera: () => void;
  viste: string[];
};

export function NomeArchivio({ nome, aperta, onPress }: { nome: string; aperta?: boolean; onPress: () => void }) {
  const c = useColori();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('{nome}, cambia archivio', { nome })}
      accessibilityState={{ expanded: !!aperta }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
        minHeight: 48, marginLeft: -spazio.sm, paddingHorizontal: spazio.sm, borderRadius: raggio.md,
        backgroundColor: pressed || aperta ? c.bgHover : 'transparent'
      })}
    >
      <Testo variante="titolo" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 38, flexShrink: 1 }}>{nome}</Testo>
      <ChevronDown size={24} color={c.textMuted} strokeWidth={2.25} style={aperta ? { transform: [{ rotate: '180deg' }] } : undefined} />
    </Pressable>
  );
}

function DaInviare({ gruppi, stato, onInviaOra, onApri, onApriPagina }: { gruppi: SchedaInAttesa[]; stato: string; onInviaOra: () => void; onApri: Props['onApri']; onApriPagina: Props['onApriPagina'] }) {
  const c = useColori();
  const [aperto, setAperto] = useState(false);
  const totale = gruppi.reduce((n, g) => n + g.pagine, 0);
  const nomi = gruppi.map(g => (g.scelta.tipo === 'smistare' ? t('senza scheda') : g.scelta.segnatura || g.scelta.id));
  const Freccia = aperto ? ChevronUp : ChevronDown;
  const lato = 54;
  return (
    <View style={{ marginHorizontal: spazio.md, marginTop: spazio.md, backgroundColor: c.primaryLight, borderWidth: 1, borderColor: c.primaryBorder, borderRadius: raggio.lg, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: spazio.xs }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('Da inviare')}, ${conta(totale)}, ${stato}`}
          accessibilityState={{ expanded: aperto }}
          onPress={() => setAperto(a => !a)}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spazio.sm, minHeight: TOCCO + spazio.sm, paddingLeft: spazio.md, paddingVertical: spazio.xs, opacity: pressed ? 0.7 : 1 })}
        >
          <CloudUpload size={20} color={c.primaryHover} />
          <View style={{ flex: 1 }}>
            <Testo variante="sezione" tono="accento">{`${t('Da inviare')} · ${conta(totale)}`}</Testo>
            {!aperto && <Testo variante="aiuto" numberOfLines={1}>{nomi.length > 2 ? t('{a}, {b} e altre {n}', { a: nomi[0], b: nomi[1], n: nomi.length - 2 }) : nomi.join(t(' e '))}</Testo>}
            <Testo variante="aiuto">{stato}</Testo>
          </View>
          <Freccia size={20} color={c.primaryHover} />
        </Pressable>
        <Pulsante variante="ghost" titolo={t('Invia ora')} onPress={onInviaOra} />
      </View>
      {aperto && gruppi.map(g => {
        const smistare = g.scelta.tipo === 'smistare';
        const nome = g.scelta.tipo === 'smistare' ? t('Senza scheda') : g.scelta.segnatura || g.scelta.id;
        const altre = g.pagine - g.anteprime.length;
        return (
          <View key={g.scelta.tipo === 'smistare' ? '' : g.scelta.id} style={{ borderTopWidth: 1, borderColor: c.primaryBorder, paddingHorizontal: spazio.md, paddingVertical: spazio.sm, gap: spazio.sm }}>
            <Pressable accessibilityRole="button" onPress={() => onApri(g.scelta)} style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm, minHeight: TOCCO - spazio.xs }}>
              {smistare ? <Inbox size={20} color={c.primaryHover} /> : <FileText size={20} color={c.primaryHover} />}
              <View style={{ flex: 1 }}>
                <Testo variante="voce">{`${nome} · ${g.pagine}`}</Testo>
                <Testo variante="aiuto" numberOfLines={1}>{smistare ? t('Da smistare al computer') : g.riassunto || ''}</Testo>
              </View>
              <ChevronRight size={20} color={c.textMuted} />
            </Pressable>
            {smistare && !!g.riassunto && <Testo numberOfLines={2} style={{ marginLeft: 28 }}>{`«${g.riassunto}»`}</Testo>}
            <View style={{ flexDirection: 'row', gap: spazio.sm, marginLeft: 28 }}>
              {g.anteprime.map((a, i) => (
                <Pressable key={i} accessibilityRole="button" accessibilityLabel={a.etichetta ? t('Apri {nome}', { nome: a.etichetta }) : t('Apri la pagina {n}', { n: i + 1 })} onPress={() => onApriPagina(g.scelta, i)} style={{ alignItems: 'center', gap: 2 }}>
                  <Image source={{ uri: a.uri }} style={{ width: lato, height: lato * 4 / 3, borderRadius: raggio.sm, borderWidth: 1, borderColor: c.primaryBorder, backgroundColor: c.bgPanel }} resizeMode="cover" resizeMethod="resize" accessibilityIgnoresInvertColors />
                  <Testo variante="aiuto" numberOfLines={1} style={{ maxWidth: lato }}>{a.etichetta || '—'}</Testo>
                </Pressable>
              ))}
              {altre > 0 && (
                <Pressable accessibilityRole="button" accessibilityLabel={t('Altre: {pagine}', { pagine: conta(altre) })} onPress={() => onApri(g.scelta)}
                  style={{ width: lato, height: lato * 4 / 3, borderRadius: raggio.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.primaryBorder }}>
                  <Testo variante="controllo" tono="accento">{`+${altre}`}</Testo>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function Archivio(p: Props) {
  const c = useColori();
  const [q, setQ] = useState('');

  const schede = useMemo<SchedaAlbero[]>(() => {
    const sulComputer = (p.elenco?.schede || []).map(s => ({ ...s, nuova: false }));
    const ids = new Set(sulComputer.map(s => s.id));
    const nuove = p.nuove.filter(n => !ids.has(n.id)).map(n => ({ id: n.id, segnatura: n.segnatura, titolo: '', cartella: n.cartella || '', nuova: true }));
    return [...sulComputer, ...nuove];
  }, [p.elenco, p.nuove]);
  const aperte = useMemo(() => new Set(p.aperte), [p.aperte]);
  const [soloDaVedere, setSoloDaVedere] = useState(false);
  const viste = useMemo(() => new Set(p.viste), [p.viste]);
  const daVedere = useMemo(() => schede.filter(s => s.daVedere), [schede]);
  const mancanti = daVedere.filter(s => !viste.has(s.id)).length;
  const righe = useMemo(() => righeAlbero(schede, p.elenco?.cartelle || [], aperte, q, soloDaVedere && !!daVedere.length), [schede, p.elenco, aperte, q, soloDaVedere, daVedere.length]);
  const inAttesa = useMemo(() => new Map(p.inAttesa.map(g => [g.scelta.tipo === 'smistare' ? '' : g.scelta.id, g.pagine])), [p.inAttesa]);

  const apri = (s: SchedaAlbero) => {
    const n = p.nuove.find(x => x.id === s.id);
    p.onApri(s.nuova && n ? { tipo: 'nuova', id: n.id, segnatura: n.segnatura, nota: n.nota, cartella: n.cartella } : { tipo: 'esistente', id: s.id, segnatura: s.segnatura || s.id });
  };

  const aggiornato = p.elenco && quando(p.elenco.aggiornatoIl, new Date()).replace(/^\p{Lu}/u, x => x.toLowerCase());
  const stato = p.archivio.nuovo
    ? t('Archivio nuovo: il computer lo crea quando riceve le scansioni')
    : p.elenco ? [t('{n} schede sul computer', { n: p.elenco.schede.length }), aggiornato && t('aggiornato {quando}', { quando: aggiornato })].filter(Boolean).join(' · ') : t('Elenco delle schede non ancora arrivato');

  const testa = (
    <View>
      <View style={{ paddingHorizontal: spazio.md, paddingTop: spazio.sm, paddingBottom: spazio.md, backgroundColor: c.bgPanel, borderBottomWidth: 1, borderColor: c.divisore, gap: 2 }}>
        <NomeArchivio nome={p.archivio.nome} onPress={p.onCambiaArchivio} />
        <Testo variante="aiuto">{stato}</Testo>
      </View>
      {p.attesa}
      {!!p.daRecuperare && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm, marginHorizontal: spazio.md, marginTop: spazio.md, paddingLeft: spazio.md, paddingRight: spazio.xs, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.divisore, borderRadius: raggio.lg }}>
          <Testo style={{ flex: 1 }}>{p.daRecuperare === 1 ? t('1 scansione da recuperare') : t('{n} scansioni da recuperare', { n: p.daRecuperare })}</Testo>
          <Pulsante variante="ghost" titolo={t('Recupera')} onPress={p.onRecupera} />
        </View>
      )}
      {!q.trim() && !!p.inAttesa.length && <DaInviare gruppi={p.inAttesa} stato={p.statoInvio} onInviaOra={p.onInviaOra} onApri={p.onApri} onApriPagina={p.onApriPagina} />}
      <View style={{ padding: spazio.md }}>
        <Campo placeholder={t('Cerca segnatura, titolo o cartella')} segnapostoBreve={t('Cerca')} value={q} onChangeText={setQ} accessibilityLabel={t('Cerca nell\'archivio')} style={{ paddingLeft: 42 }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: spazio.md + 14, top: spazio.md + 15 }}><Search size={18} color={c.textMuted} /></View>
        {!!daVedere.length && (
          <Pressable
            accessibilityRole="switch" accessibilityState={{ checked: soloDaVedere }}
            accessibilityLabel={mancanti ? t('Solo da vedere: {n} schede, {m} ancora da fotografare', { n: daVedere.length, m: mancanti }) : t('Solo da vedere: {n} schede, tutte fotografate', { n: daVedere.length })}
            onPress={() => setSoloDaVedere(v => !v)}
            style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spazio.xs, minHeight: TOCCO, marginTop: spazio.sm, paddingHorizontal: spazio.md, borderRadius: raggio.tondo, borderWidth: 1, borderColor: soloDaVedere ? c.primary : c.divisore, backgroundColor: pressed ? c.bgHover : soloDaVedere ? c.primaryLight : c.bgPanel })}
          >
            <Eye size={18} color={soloDaVedere ? c.primaryHover : c.textMuted} />
            <Testo variante="controllo" tono={soloDaVedere ? 'accento' : 'main'}>{`${t('Da vedere')} · ${mancanti ? t('{m} di {n}', { m: mancanti, n: daVedere.length }) : t('fatte tutte')}`}</Testo>
          </Pressable>
        )}
      </View>
      {!righe.length && (
        <Testo variante="aiuto" style={{ paddingHorizontal: spazio.lg }}>
          {q.trim() || soloDaVedere ? t('Nessuna scheda trovata.') : p.elenco ? t('Archivio vuoto.') : t('L\'elenco delle schede di questo archivio non è ancora sul telefono.')}
        </Testo>
      )}
    </View>
  );

  const riga = ({ item: r, index }: { item: Riga; index: number }) => {
    const prima = index === 0, ultima = index === righe.length - 1;
    const bordo = {
      marginHorizontal: spazio.md, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.divisore,
      borderTopWidth: prima ? 1 : 0, borderBottomWidth: 1, borderBottomColor: c.divisore,
      borderTopLeftRadius: prima ? raggio.lg : 0, borderTopRightRadius: prima ? raggio.lg : 0,
      borderBottomLeftRadius: ultima ? raggio.lg : 0, borderBottomRightRadius: ultima ? raggio.lg : 0
    };
    if (r.tipo === 'cartella') {
      const Icona = r.aperta ? FolderOpen : Folder;
      const Freccia = r.aperta ? ChevronDown : ChevronRight;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Cartella {nome}, {contenuto}', { nome: r.nome, contenuto: r.conta ? t('{n} schede', { n: r.conta }) : t('vuota') })}
          accessibilityState={{ expanded: r.aperta }}
          disabled={!!q.trim()}
          onPress={() => p.onAlterna(r.percorso)}
          style={({ pressed }) => [bordo, { flexDirection: 'row', alignItems: 'center', gap: spazio.sm, minHeight: TOCCO + 4, paddingLeft: spazio.sm + r.livello * RIENTRO, paddingRight: spazio.md, backgroundColor: pressed ? c.bgHover : c.bgPanel }]}
        >
          <Freccia size={20} color={r.conta ? c.textMuted : c.borderInput} />
          <Icona size={20} color={r.aperta ? c.primaryHover : c.textMuted} />
          <Testo variante="voce" numberOfLines={1} style={{ flex: 1, fontWeight: r.aperta ? '600' : undefined }}>{r.nome}</Testo>
          <Testo variante="aiuto">{r.conta ? String(r.conta) : t('vuota')}</Testo>
        </Pressable>
      );
    }
    const s = r.scheda;
    const pagine = inAttesa.get(s.id);
    const sotto = s.titolo || (s.nuova ? t('Creata qui') : '');
    const vista = !!s.daVedere && viste.has(s.id);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[s.segnatura || s.id, sotto, s.daVedere ? (vista ? t('da vedere, fotografata') : t('da vedere')) : '', pagine ? t('{pagine} da inviare', { pagine: conta(pagine) }) : ''].filter(Boolean).join(', ')}
        onPress={() => apri(s)}
        style={({ pressed }) => [bordo, { flexDirection: 'row', alignItems: 'center', gap: spazio.sm + 2, minHeight: TOCCO + spazio.sm + 4, paddingVertical: spazio.xs, paddingLeft: spazio.sm + r.livello * RIENTRO + 28, paddingRight: spazio.md, backgroundColor: pressed ? c.bgHover : c.bgPanel }]}
      >
        <FileText size={18} color={pagine ? c.primaryHover : c.textMuted} />
        <View style={{ flex: 1, gap: 1 }}>
          <Testo variante="voce" numberOfLines={1}>{s.segnatura || s.id}</Testo>
          {!!sotto && <Testo variante="aiuto" numberOfLines={1}>{sotto}</Testo>}
        </View>
        {!!s.daVedere && (vista ? <CircleCheck size={18} color={c.success} /> : <Eye size={18} color={c.textMuted} />)}
        {!!pagine && (
          <View style={{ minWidth: 22, minHeight: 22, paddingHorizontal: 6, borderRadius: raggio.tondo, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary }}>
            <Testo variante="aiuto" maxFontSizeMultiplier={1.5} style={{ fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.onPrimary }}>{String(pagine)}</Testo>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <FlatList
      data={righe}
      keyExtractor={r => (r.tipo === 'cartella' ? 'c:' + r.percorso : 's:' + r.scheda.id)}
      renderItem={riga}
      ListHeaderComponent={testa}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: SPORGENZA_BARRA + spazio.md }}
    />
  );
}
