import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { ChevronDown, ChevronRight, CircleCheck, Eye, FileText, Folder, FolderOpen, Search } from 'lucide-react-native';
import type { ConfigScanner } from '../contratto';
import type { SchedaNuova } from '../coda';
import { quando } from '../elencoDocumenti';
import { t } from '../lingua';
import { righeAlbero, type Riga, type SchedaAlbero, type SchedaScelta } from '../scelta';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { SPORGENZA_BARRA } from '../ui/BarraFondo';
import { Campo } from '../ui/Campo';
import { Pulsante } from '../ui/Pulsante';
import { Avanzamento, Pallino, PrimoInvio, type StatoRiga } from '../ui/StatoInvio';
import { Testo } from '../ui/Testo';

const RIENTRO = 24;
const conta = (n: number) => (n === 1 ? t('1 pagina') : t('{n} pagine', { n }));

export type SchedaInAttesa = { scelta: SchedaScelta; pagine: number };
export type RigaInvio = { chiave: string; scelta: SchedaScelta; pagine: number; stato: StatoRiga; fatte?: number; totali?: number; arrivatoIl?: string };

type Props = {
  archivio: { nome: string; nuovo: boolean };
  elenco: ConfigScanner | null;
  caricando: boolean;
  nuove: SchedaNuova[];
  inAttesa: SchedaInAttesa[];
  invii: RigaInvio[];
  primoInvio: boolean;
  onInviaOra: () => void;
  aperte: string[];
  onAlterna: (percorso: string) => void;
  attesa: ReactNode;
  onApri: (s: SchedaScelta) => void;
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

export const minuscola = (s: string) => s.replace(/^\p{Lu}/u, x => x.toLowerCase());

function testoStato(r: RigaInvio): string {
  if (r.stato === 'telefono') return t('Sul telefono · premi Invia ora');
  if (r.stato === 'caricamento') return t('In caricamento su Drive · {fatte} di {totali}', { fatte: r.fatte ?? 0, totali: r.totali ?? r.pagine });
  if (r.stato === 'drive') return t('Su Drive · in attesa del computer');
  return t('Arrivato sul computer · {quando}', { quando: minuscola(quando(r.arrivatoIl || '', new Date())) });
}

function Invii({ righe, primo, onInviaOra, onApri }: { righe: RigaInvio[]; primo: boolean; onInviaOra: () => void; onApri: Props['onApri'] }) {
  const c = useColori();
  return (
    <>
      {primo && <PrimoInvio />}
      <View style={{ marginHorizontal: spazio.md, marginTop: spazio.md, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.divisore, borderRadius: raggio.lg, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: TOCCO + spazio.sm, paddingLeft: spazio.md, paddingRight: spazio.xs }}>
          <Testo variante="sezione" accessibilityRole="header" style={{ flex: 1 }}>{`${t('Invii')} · ${righe.length === 1 ? t('1 lotto') : t('{n} lotti', { n: righe.length })}`}</Testo>
          {righe.some(r => r.stato === 'telefono') && <Pulsante variante="ghost" titolo={t('Invia ora')} onPress={onInviaOra} />}
        </View>
        {righe.map(r => {
          const nome = r.scelta.tipo === 'smistare' ? t('Senza scheda') : r.scelta.segnatura || r.scelta.id;
          const stato = testoStato(r);
          const tono = r.stato === 'telefono' ? { color: c.warning } : r.stato === 'arrivato' ? { color: c.success } : r.stato === 'caricamento' ? { color: c.primaryHover } : { color: c.textMain };
          return (
            <Pressable key={r.chiave} accessibilityRole="button" accessibilityLabel={`${nome}, ${conta(r.pagine)}, ${stato}`} onPress={() => onApri(r.scelta)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spazio.sm + 2, minHeight: TOCCO + spazio.sm, paddingHorizontal: spazio.md, paddingVertical: spazio.sm, borderTopWidth: 1, borderColor: c.divisore, backgroundColor: pressed ? c.bgHover : r.stato === 'caricamento' ? c.primaryLight : c.bgPanel })}>
              <Pallino stato={r.stato} />
              <View style={{ flex: 1, gap: 2 }}>
                <Testo numberOfLines={1}>{r.scelta.tipo === 'smistare' ? nome : <Testo variante="mono">{nome}</Testo>}{` · ${conta(r.pagine)}`}</Testo>
                <Testo variante="aiuto" style={[tono, { fontWeight: '600' }]}>{stato}</Testo>
                {r.stato === 'caricamento' && <Avanzamento fatte={r.fatte ?? 0} totali={r.totali ?? r.pagine} />}
                {r.stato === 'drive' && <Testo variante="aiuto">{t('Arriva quando il computer con ArchiView è acceso')}</Testo>}
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
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

  const aggiornato = p.elenco && minuscola(quando(p.elenco.aggiornatoIl, new Date()));
  const stato = p.archivio.nuovo
    ? t('Archivio nuovo: il computer lo crea quando riceve le scansioni')
    : p.elenco ? [t('{n} schede sul computer', { n: p.elenco.schede.length }), aggiornato && t('aggiornato {quando}', { quando: aggiornato })].filter(Boolean).join(' · ') : p.caricando ? t('Caricamento dell\'archivio…') : t('Elenco delle schede non ancora arrivato');

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
      {!q.trim() && !!p.invii.length && <Invii righe={p.invii} primo={p.primoInvio} onInviaOra={p.onInviaOra} onApri={p.onApri} />}
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
          {q.trim() || soloDaVedere ? t('Nessuna scheda trovata.') : p.elenco ? t('Archivio vuoto.') : p.caricando ? t('Caricamento dell\'archivio…') : t('L\'elenco delle schede di questo archivio non è ancora sul telefono.')}
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
          <Testo numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: r.aperta ? '600' : undefined }}>{r.nome}</Testo>
          {r.conta ? <Testo variante="mono" tono="muted" style={{ fontSize: 13 }}>{String(r.conta)}</Testo> : <Testo variante="aiuto">{t('vuota')}</Testo>}
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
          <Testo variante="mono" numberOfLines={1}>{s.segnatura || s.id}</Testo>
          {!!sotto && (s.titolo
            ? <Testo variante="voce" numberOfLines={1} style={{ fontSize: 15, color: c.textSecondary }}>{sotto}</Testo>
            : <Testo variante="aiuto" numberOfLines={1}>{sotto}</Testo>)}
        </View>
        {!!s.daVedere && (vista ? <CircleCheck size={18} color={c.success} /> : <Eye size={18} color={c.textMuted} />)}
        {!!pagine && (
          <View style={{ minWidth: 22, minHeight: 22, paddingHorizontal: 6, borderRadius: raggio.tondo, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary }}>
            <Testo variante="mono" maxFontSizeMultiplier={1.5} style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: c.onPrimary }}>{String(pagine)}</Testo>
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
