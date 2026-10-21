import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { Archive, Camera, Check, Folder, Pencil, Trash2 } from 'lucide-react-native';
import { ScannerLotto, type Pagina } from '../contratto';
import { t } from '../lingua';
import { uriAnteprima, type Bozza } from '../lotti';
import { quantiGiorni, type DopoInvio } from '../pagine';
import { percorsoLeggibile, type SchedaScelta } from '../scelta';
import { raggio, spazio, tipo, TOCCO, useColori } from '../theme';
import { SPORGENZA_BARRA } from '../ui/BarraFondo';
import { Campo } from '../ui/Campo';
import { ContaSpostate, Griglia, useFinestra, useMisure } from '../ui/Griglia';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';
import { SegnoScelta, TestataSelezione, useSelezione } from '../ui/Selezione';
import { Testo } from '../ui/Testo';

type Cella = { b: Bozza; pg: Pagina; indice: number; inviata: boolean };

type Props = {
  scheda: SchedaScelta;
  archivio: string;
  lotti: Bozza[];
  inviati: Bozza[];
  inInvio?: string;
  numera: boolean;
  onNumera: (v: boolean) => void;
  cartaIniziale: string;
  onCartaIniziale: (v: string) => void;
  titoloSmistare: string;
  onTitoloSmistare: (v: string) => void;
  notaSmistare: string;
  onNotaSmistare: (v: string) => void;
  dopoInvio: DopoInvio;
  attesa: ReactNode;
  onIndietro: () => void;
  onApri: (indice: number) => void;
  onTogliInviate: () => void;
  onCambiaCartella?: () => void;
  onRinomina?: (segnatura: string) => void;
  onElimina?: () => void;
  onFotoLibera: () => void;
  onEliminaPagine: (indici: number[]) => void;
  onRiordina?: (da: number, a: number, insieme: number[]) => void;
};

export function Scheda(p: Props) {
  const c = useColori();
  const { lato } = useMisure();
  const finestra = useFinestra();
  const daInviare = p.lotti.flatMap(b => b.pagine.map(pg => ({ b, pg })));
  const inviate = p.inviati.flatMap(b => b.pagine.map(pg => ({ b, pg })));
  const celle: Cella[] = [...daInviare, ...inviate].map((x, indice) => ({ ...x, indice, inviata: indice >= daInviare.length }));
  const titolo = p.scheda.tipo === 'smistare' ? t('Senza scheda') : p.scheda.segnatura || p.scheda.id;
  const sotto = p.archivio + (p.scheda.tipo === 'nuova' ? ` · ${t('creata qui')}` : p.scheda.tipo === 'smistare' ? ` · ${t('da smistare al computer')}` : '');
  const cartella = p.scheda.tipo === 'nuova' ? p.scheda.cartella || '' : null;
  const conta = (n: number) => (n === 1 ? t('1 pagina') : t('{n} pagine', { n }));
  const [segnatura, setSegnatura] = useState<string | null>(null);
  const sel = useSelezione();
  const selezionabile = (x: Cella) => p.inInvio !== x.b.id;


  const riquadro = { marginHorizontal: spazio.md, marginTop: spazio.md, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.divisore, borderRadius: raggio.lg };
  const testa = (
    <View>
      {p.attesa}
      {segnatura !== null && p.onRinomina && (
        <View style={{ paddingHorizontal: spazio.md, paddingTop: spazio.md, gap: spazio.sm }}>
          <Campo etichetta={t('Segnatura')} value={segnatura} onChangeText={setSegnatura} maxLength={200} autoFocus selectTextOnFocus />
          <View style={{ flexDirection: 'row', gap: spazio.sm }}>
            <Pulsante variante="primario" titolo={t('Rinomina')} disabilitato={!segnatura.trim()} style={{ flex: 1 }} onPress={() => { p.onRinomina!(segnatura.trim()); setSegnatura(null); }} />
            <Pulsante variante="ghost" titolo={t('Annulla')} onPress={() => setSegnatura(null)} />
          </View>
        </View>
      )}
      {cartella !== null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('Cartella: {nome}', { nome: cartella ? percorsoLeggibile(cartella) : t('nessuna') })}${p.onCambiaCartella ? `. ${t('Cambia')}` : ''}`}
          disabled={!p.onCambiaCartella}
          onPress={p.onCambiaCartella}
          style={({ pressed }) => [riquadro, { flexDirection: 'row', alignItems: 'center', gap: spazio.sm + 2, minHeight: TOCCO, paddingHorizontal: spazio.md, backgroundColor: pressed ? c.bgHover : c.bgPanel }]}
        >
          {cartella ? <Folder size={20} color={c.textMuted} /> : <Archive size={20} color={c.textMuted} />}
          <Testo numberOfLines={1} style={{ flex: 1 }}>{cartella ? percorsoLeggibile(cartella) : t('Nessuna cartella')}</Testo>
          {p.onCambiaCartella && <Testo variante="controllo" tono="accento">{t('Cambia')}</Testo>}
        </Pressable>
      )}
      <View style={[riquadro, { flexDirection: 'row', alignItems: 'center', gap: spazio.md, paddingHorizontal: spazio.md, paddingVertical: spazio.sm }]}>
        <Switch value={p.numera} onValueChange={p.onNumera} accessibilityLabel={t('Numera le carte')}
          trackColor={{ false: c.borderInput, true: c.primary }} thumbColor={p.numera ? c.onPrimary : c.textMuted} />
        <Testo style={{ flex: 1 }}>{t('Numera le carte da')}</Testo>
        <TextInput
          accessibilityLabel={t('Prima carta')} value={p.cartaIniziale} onChangeText={p.onCartaIniziale} editable={p.numera}
          maxLength={ScannerLotto.LIMITI.etichetta} placeholder="1r" placeholderTextColor={c.textPlaceholder}
          style={[tipo.corpo, { width: 72, minHeight: TOCCO, paddingHorizontal: spazio.sm, color: c.textMain, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.borderInput, borderRadius: raggio.md, opacity: p.numera ? 1 : 0.5 }]}
        />
      </View>
      <Pulsante variante="ghost" icona={Camera} titolo={t('Foto libera, senza ritaglio')} onPress={p.onFotoLibera} style={{ marginHorizontal: spazio.md, marginTop: spazio.xs, alignSelf: 'flex-start' }} />
      {p.scheda.tipo === 'smistare' && (
        <View style={[riquadro, { padding: spazio.md, gap: spazio.sm }]}>
          <Campo etichetta={t('Titolo')} placeholder={t('Es. la segnatura, se la sai')} value={p.titoloSmistare} onChangeText={p.onTitoloSmistare} maxLength={ScannerLotto.LIMITI.titolo} />
          <Campo etichetta={t('Nota')} placeholder={t('Cosa sono queste pagine')} value={p.notaSmistare} onChangeText={p.onNotaSmistare} multiline maxLength={ScannerLotto.LIMITI.nota} />
          <Testo variante="aiuto">{t('Valgono per le pagine in attesa e per la prossima scansione: li vedrai sul computer.')}</Testo>
        </View>
      )}
      {!daInviare.length && (
        <Testo variante="aiuto" style={{ paddingHorizontal: spazio.md, paddingTop: spazio.md }}>
          {inviate.length ? t('Nessuna pagina da inviare.') : t('Nessuna pagina.')}
        </Testo>
      )}
    </View>
  );

  const bloccata = (x: Cella) => p.inInvio === x.b.id;
  const descrivi = ({ b, pg, indice, inviata }: Cella, scegliendo: boolean) => {
    const nome = pg.etichetta || t('Pagina {n}', { n: indice + 1 });
    const sfocata = !inviata && !!b.sfocate?.includes(pg.file);
    return {
      etichetta: [scegliendo ? nome : t('Apri {nome}', { nome }), p.inInvio === b.id ? t('in invio') : inviata ? t('inviata') : '', sfocata ? t('forse sfocata') : ''].filter(Boolean).join(', '),
      aiuto: scegliendo ? undefined : !inviata && p.onRiordina && daInviare.length > 1 ? t('Tieni premuto per selezionare, trascina per spostarla') : t('Tieni premuto per selezionare più pagine')
    };
  };
  const contenuto = (x: Cella, evidenza: boolean) => {
    const { b, pg, indice, inviata } = x;
    const ferma = bloccata(x);
    const sfocata = !inviata && !!b.sfocate?.includes(pg.file);
    return (
      <View style={{ width: lato, height: lato * 4 / 3, backgroundColor: c.bgHover, borderWidth: evidenza ? 3 : 1, borderColor: evidenza ? c.primary : c.divisore, borderRadius: raggio.md, overflow: 'hidden', opacity: inviata || (sel.scelte && ferma) ? 0.7 : 1 }}>
        <Image source={{ uri: uriAnteprima(b, pg) }} style={{ flex: 1 }} resizeMode="cover" resizeMethod="resize" accessibilityIgnoresInvertColors />
        {ferma && <Testo variante="aiuto" numberOfLines={1} maxFontSizeMultiplier={1.5} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: c.primary, color: c.onPrimary, fontWeight: '600' }}>{t('In invio')}</Testo>}
        {!!pg.doppia && <Testo variante="aiuto" style={{ position: 'absolute', top: 0, right: 0, paddingHorizontal: 6, backgroundColor: c.bgPanel }}>{pg.doppia.lato === 'sx' ? t('sx') : t('dx')}</Testo>}
        {sfocata && !ferma && <Testo variante="aiuto" numberOfLines={1} maxFontSizeMultiplier={1.5} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: c.warningLight, borderTopWidth: 1, borderColor: c.warningBorder, color: c.textMain, fontWeight: '600' }}>{t('Sfocata?')}</Testo>}
        {!!sel.scelte && !ferma && <SegnoScelta scelta={sel.scelta(indice)} />}
      </View>
    );
  };
  const etichetta = ({ pg, inviata }: Cella) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.xs }}>
      {inviata && <Check size={14} color={c.primary} />}
      <Testo numberOfLines={1} maxFontSizeMultiplier={1.5} tono={inviata || !pg.etichetta ? 'muted' : 'main'} style={{ flex: 1 }}>{inviata ? `${pg.etichetta || '—'} · ${t('inviata')}` : pg.etichetta || '—'}</Testo>
    </View>
  );
  const griglia = (parte: Cella[], primo: number, onRiordina?: Props['onRiordina']) => (
    <Griglia n={parte.length} chiave={i => parte[i].b.id + parte[i].pg.file} vista={finestra.vista} sel={sel} primo={primo}
      bloccata={i => bloccata(parte[i])} onApri={i => p.onApri(primo + i)} onRiordina={onRiordina} onSpostando={finestra.setSpostando}
      descrivi={(i, scegliendo) => descrivi(parte[i], scegliendo)} contenuto={(i, ev) => contenuto(parte[i], ev)} etichetta={i => etichetta(parte[i])} />
  );
  const titoloSezione = (titolo: string, testo?: ReactNode, azione?: ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: spazio.md, paddingRight: spazio.sm, paddingTop: spazio.sm }}>
      <View style={{ flex: 1 }}>
        <Testo variante="sezione" accessibilityRole="header">{titolo}</Testo>
        {testo}
      </View>
      {azione}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {sel.scelte ? (
        <TestataSelezione n={sel.scelte.length} totale={celle.filter(selezionabile).length}
          onTutte={() => sel.tutte(celle.filter(selezionabile).map(x => x.indice))} onEsci={sel.esci}
          onElimina={() => { p.onEliminaPagine(sel.scelte!.filter(i => celle[i] && selezionabile(celle[i]))); sel.esci(); }} />
      ) : (
        <Intestazione titolo={titolo} sotto={sotto} onIndietro={p.onIndietro} azioni={p.onRinomina && p.onElimina && p.scheda.tipo === 'nuova' ? (
          <>
            <Pulsante variante="ghost" icona={Pencil} etichetta={t('Rinomina la scheda')} onPress={() => setSegnatura(p.scheda.tipo === 'nuova' ? p.scheda.segnatura : '')} />
            <Pulsante variante="pericoloGhost" icona={Trash2} etichetta={t('Elimina la scheda')} onPress={p.onElimina} />
          </>
        ) : undefined} />
      )}
      <View style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spazio.md, paddingBottom: SPORGENZA_BARRA + spazio.md }} {...finestra.scorrimento}>
          {testa}
          {!!daInviare.length && titoloSezione(`${t('Da inviare')} · ${conta(daInviare.length)}`,
            p.onRiordina && daInviare.length > 1 ? <Testo variante="aiuto">{t('Tieni premuta una pagina per selezionarla, poi trascinala per spostare tutte le selezionate.')}</Testo> : undefined)}
          {!!daInviare.length && griglia(celle.slice(0, daInviare.length), 0, p.onRiordina)}
          {!!inviate.length && titoloSezione(`${t('Inviate')} · ${conta(inviate.length)}`,
            p.dopoInvio.modo === 'giorni' ? <Testo variante="aiuto">{t('Restano {giorni} dopo l\'invio, poi si cancellano da sole.', { giorni: quantiGiorni(p.dopoInvio.giorni) })}</Testo> : undefined,
            <Pulsante variante="ghost" titolo={t('Rimuovi tutte')} onPress={p.onTogliInviate} />)}
          {!!inviate.length && griglia(celle.slice(daInviare.length), daInviare.length)}
        </ScrollView>
        <ContaSpostate n={finestra.spostando} />
      </View>
    </View>
  );
}
