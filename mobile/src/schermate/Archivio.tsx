// L'archivio (design 11/10, Fase 14): il nome in grande è il pulsante per cambiare archivio
// (freccia ⌄), sotto il riquadro «Da inviare» (chiuso; aperto mostra le pagine in attesa per
// scheda), la ricerca e l'albero delle cartelle come la sidebar del desktop. Albero appiattito
// in righe (`righeAlbero`): una sola FlatList anche con 50 000 schede; la ricerca lo filtra.

import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { ChevronDown, ChevronRight, ChevronUp, CloudUpload, FileText, Folder, FolderOpen, Inbox, Search } from 'lucide-react-native';
import type { ConfigScanner } from '../contratto';
import type { SchedaNuova } from '../coda';
import { quando } from '../elencoDocumenti';
import { righeAlbero, type Riga, type SchedaAlbero, type SchedaScelta } from '../scelta';
import { raggio, spazio, TOCCO, useColori } from '../theme';
import { SPORGENZA_BARRA } from '../ui/BarraFondo';
import { Campo } from '../ui/Campo';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';

const RIENTRO = 24;
const ANTEPRIME = 4;
const conta = (n: number) => `${n} ${n === 1 ? 'pagina' : 'pagine'}`;

/** Una scheda con pagine ancora sul telefono, con le prime miniature (nell'ordine del visore). */
export type SchedaInAttesa = { scelta: SchedaScelta; pagine: number; anteprime: { uri: string; etichetta?: string }[]; riassunto?: string };

type Props = {
  archivio: { nome: string; nuovo: boolean };
  elenco: ConfigScanner | null;
  nuove: SchedaNuova[];
  inAttesa: SchedaInAttesa[];
  /** Stato dell'invio sotto «Da inviare»: «aspetto il Wi-Fi», «invio 3/8»… */
  statoInvio: string;
  onInviaOra: () => void;
  aperte: string[];
  onAlterna: (percorso: string) => void;
  /** Errori d'invio, sotto l'intestazione. */
  attesa: ReactNode;
  onApri: (s: SchedaScelta) => void;
  onApriPagina: (s: SchedaScelta, indice: number) => void;
  onCambiaArchivio: () => void;
  /** Fase 6b: lotti con la bozza illeggibile, da ricostruire dalle foto in «Senza scheda». */
  daRecuperare: number;
  onRecupera: () => void;
};

/** Il nome dell'archivio come pulsante: apre la tendina degli archivi. */
export function NomeArchivio({ nome, aperta, onPress }: { nome: string; aperta?: boolean; onPress: () => void }) {
  const c = useColori();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nome}, cambia archivio`}
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

/** «Da inviare»: una riga chiusa; aperta, un gruppo per scheda con le miniature. */
function DaInviare({ gruppi, stato, onInviaOra, onApri, onApriPagina }: { gruppi: SchedaInAttesa[]; stato: string; onInviaOra: () => void; onApri: Props['onApri']; onApriPagina: Props['onApriPagina'] }) {
  const c = useColori();
  const [aperto, setAperto] = useState(false);
  const totale = gruppi.reduce((n, g) => n + g.pagine, 0);
  const nomi = gruppi.map(g => (g.scelta.tipo === 'smistare' ? 'senza scheda' : g.scelta.segnatura || g.scelta.id));
  const Freccia = aperto ? ChevronUp : ChevronDown;
  const lato = 54;
  return (
    <View style={{ marginHorizontal: spazio.md, marginTop: spazio.md, backgroundColor: c.primaryLight, borderWidth: 1, borderColor: c.primaryBorder, borderRadius: raggio.lg, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: spazio.xs }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Da inviare, ${conta(totale)}, ${stato}`}
          accessibilityState={{ expanded: aperto }}
          onPress={() => setAperto(a => !a)}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spazio.sm, minHeight: TOCCO + spazio.sm, paddingLeft: spazio.md, paddingVertical: spazio.xs, opacity: pressed ? 0.7 : 1 })}
        >
          <CloudUpload size={20} color={c.primaryHover} />
          <View style={{ flex: 1 }}>
            <Testo variante="sezione" tono="accento">{`Da inviare · ${conta(totale)}`}</Testo>
            {/* Lo stato (perché non parte, «invio 3/8») su una riga sua, che può andare a capo: col
                carattere grande, accodato ai nomi delle schede, era il primo a sparire tagliato. */}
            {!aperto && <Testo variante="aiuto" numberOfLines={1}>{`${nomi.slice(0, 2).join(' e ')}${nomi.length > 2 ? ` e altre ${nomi.length - 2}` : ''}`}</Testo>}
            <Testo variante="aiuto">{stato}</Testo>
          </View>
          <Freccia size={20} color={c.primaryHover} />
        </Pressable>
        <Pulsante variante="ghost" titolo="Invia ora" onPress={onInviaOra} />
      </View>
      {aperto && gruppi.map(g => {
        const smistare = g.scelta.tipo === 'smistare';
        const nome = g.scelta.tipo === 'smistare' ? 'Senza scheda' : g.scelta.segnatura || g.scelta.id;
        const altre = g.pagine - g.anteprime.length;
        return (
          <View key={g.scelta.tipo === 'smistare' ? '' : g.scelta.id} style={{ borderTopWidth: 1, borderColor: c.primaryBorder, paddingHorizontal: spazio.md, paddingVertical: spazio.sm, gap: spazio.sm }}>
            <Pressable accessibilityRole="button" onPress={() => onApri(g.scelta)} style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm, minHeight: TOCCO - spazio.xs }}>
              {smistare ? <Inbox size={20} color={c.primaryHover} /> : <FileText size={20} color={c.primaryHover} />}
              <View style={{ flex: 1 }}>
                <Testo variante="voce">{`${nome} · ${g.pagine}`}</Testo>
                <Testo variante="aiuto" numberOfLines={1}>{smistare ? 'Da smistare al computer' : g.riassunto || ''}</Testo>
              </View>
              <ChevronRight size={20} color={c.textMuted} />
            </Pressable>
            {smistare && !!g.riassunto && <Testo numberOfLines={2} style={{ marginLeft: 28 }}>{`«${g.riassunto}»`}</Testo>}
            <View style={{ flexDirection: 'row', gap: spazio.sm, marginLeft: 28 }}>
              {g.anteprime.map((a, i) => (
                <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Apri ${a.etichetta || `pagina ${i + 1}`}`} onPress={() => onApriPagina(g.scelta, i)} style={{ alignItems: 'center', gap: 2 }}>
                  <Image source={{ uri: a.uri }} style={{ width: lato, height: lato * 4 / 3, borderRadius: raggio.sm, borderWidth: 1, borderColor: c.primaryBorder, backgroundColor: c.bgPanel }} resizeMode="cover" resizeMethod="resize" accessibilityIgnoresInvertColors />
                  <Testo variante="aiuto" numberOfLines={1} style={{ maxWidth: lato }}>{a.etichetta || '—'}</Testo>
                </Pressable>
              ))}
              {altre > 0 && (
                <Pressable accessibilityRole="button" accessibilityLabel={`Altre ${conta(altre)}`} onPress={() => onApri(g.scelta)}
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

  // Le schede del computer più quelle nate qui e non ancora arrivate (con la cartella scelta qui).
  const schede = useMemo<SchedaAlbero[]>(() => {
    const sulComputer = (p.elenco?.schede || []).map(s => ({ ...s, nuova: false }));
    const ids = new Set(sulComputer.map(s => s.id));
    const nuove = p.nuove.filter(n => !ids.has(n.id)).map(n => ({ id: n.id, segnatura: n.segnatura, titolo: '', cartella: n.cartella || '', nuova: true }));
    return [...sulComputer, ...nuove];
  }, [p.elenco, p.nuove]);
  const aperte = useMemo(() => new Set(p.aperte), [p.aperte]);
  const righe = useMemo(() => righeAlbero(schede, p.elenco?.cartelle || [], aperte, q), [schede, p.elenco, aperte, q]);
  const inAttesa = useMemo(() => new Map(p.inAttesa.map(g => [g.scelta.tipo === 'smistare' ? '' : g.scelta.id, g.pagine])), [p.inAttesa]);

  const apri = (s: SchedaAlbero) => {
    const n = p.nuove.find(x => x.id === s.id);
    p.onApri(s.nuova && n ? { tipo: 'nuova', id: n.id, segnatura: n.segnatura, nota: n.nota, cartella: n.cartella } : { tipo: 'esistente', id: s.id, segnatura: s.segnatura || s.id });
  };

  // Fase 4b: quanto è vecchio l'elenco (fuori dal Wi-Fi non si riscarica il database).
  const aggiornato = p.elenco && quando(p.elenco.aggiornatoIl, new Date()).toLowerCase();
  const stato = p.archivio.nuovo
    ? 'Archivio nuovo: il computer lo crea quando riceve le scansioni'
    : p.elenco ? [`${p.elenco.schede.length} schede sul computer`, aggiornato && `aggiornato ${aggiornato}`].filter(Boolean).join(' · ') : 'Elenco delle schede non ancora arrivato';

  const testa = (
    <View>
      <View style={{ paddingHorizontal: spazio.md, paddingTop: spazio.sm, paddingBottom: spazio.md, backgroundColor: c.bgPanel, borderBottomWidth: 1, borderColor: c.divisore, gap: 2 }}>
        <NomeArchivio nome={p.archivio.nome} onPress={p.onCambiaArchivio} />
        <Testo variante="aiuto">{stato}</Testo>
      </View>
      {p.attesa}
      {!!p.daRecuperare && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm, marginHorizontal: spazio.md, marginTop: spazio.md, paddingLeft: spazio.md, paddingRight: spazio.xs, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.divisore, borderRadius: raggio.lg }}>
          <Testo style={{ flex: 1 }}>{`${p.daRecuperare} ${p.daRecuperare === 1 ? 'scansione' : 'scansioni'} da recuperare`}</Testo>
          <Pulsante variante="ghost" titolo="Recupera" onPress={p.onRecupera} />
        </View>
      )}
      {!q.trim() && !!p.inAttesa.length && <DaInviare gruppi={p.inAttesa} stato={p.statoInvio} onInviaOra={p.onInviaOra} onApri={p.onApri} onApriPagina={p.onApriPagina} />}
      <View style={{ padding: spazio.md }}>
        <Campo placeholder="Cerca segnatura, titolo o cartella" segnapostoBreve="Cerca" value={q} onChangeText={setQ} accessibilityLabel="Cerca nell'archivio" style={{ paddingLeft: 42 }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: spazio.md + 14, top: spazio.md + 15 }}><Search size={18} color={c.textMuted} /></View>
      </View>
      {!righe.length && (
        <Testo variante="aiuto" style={{ paddingHorizontal: spazio.lg }}>
          {q.trim() ? 'Nessuna scheda trovata.' : p.elenco ? 'Archivio vuoto.' : "L'elenco delle schede di questo archivio non è ancora sul telefono."}
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
          accessibilityLabel={`Cartella ${r.nome}, ${r.conta ? `${r.conta} schede` : 'vuota'}`}
          accessibilityState={{ expanded: r.aperta }}
          disabled={!!q.trim()}
          onPress={() => p.onAlterna(r.percorso)}
          style={({ pressed }) => [bordo, { flexDirection: 'row', alignItems: 'center', gap: spazio.sm, minHeight: TOCCO + 4, paddingLeft: spazio.sm + r.livello * RIENTRO, paddingRight: spazio.md, backgroundColor: pressed ? c.bgHover : c.bgPanel }]}
        >
          <Freccia size={20} color={r.conta ? c.textMuted : c.borderInput} />
          <Icona size={20} color={r.aperta ? c.primaryHover : c.textMuted} />
          <Testo variante="voce" numberOfLines={1} style={{ flex: 1, fontWeight: r.aperta ? '600' : undefined }}>{r.nome}</Testo>
          <Testo variante="aiuto">{r.conta ? String(r.conta) : 'vuota'}</Testo>
        </Pressable>
      );
    }
    const s = r.scheda;
    const pagine = inAttesa.get(s.id);
    const sotto = s.titolo || (s.nuova ? 'Creata qui' : '');
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[s.segnatura || s.id, sotto, pagine ? `${conta(pagine)} da inviare` : ''].filter(Boolean).join(', ')}
        onPress={() => apri(s)}
        style={({ pressed }) => [bordo, { flexDirection: 'row', alignItems: 'center', gap: spazio.sm + 2, minHeight: TOCCO + spazio.sm + 4, paddingVertical: spazio.xs, paddingLeft: spazio.sm + r.livello * RIENTRO + 28, paddingRight: spazio.md, backgroundColor: pressed ? c.bgHover : c.bgPanel }]}
      >
        <FileText size={18} color={pagine ? c.primaryHover : c.textMuted} />
        <View style={{ flex: 1, gap: 1 }}>
          <Testo variante="voce" numberOfLines={1}>{s.segnatura || s.id}</Testo>
          {!!sotto && <Testo variante="aiuto" numberOfLines={1}>{sotto}</Testo>}
        </View>
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
