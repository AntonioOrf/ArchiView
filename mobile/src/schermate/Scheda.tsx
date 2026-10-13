// La scheda (design 11/10): intestazione con indietro, riquadro d'invio, per una scheda nata qui la
// cartella (Fase 14), «Numera le carte da», per «Senza scheda» titolo e nota delle pagine in attesa, poi le pagine in griglia (3 per riga): «Da inviare» e,
// se «Dopo l'invio» le tiene, «Inviate». Il tocco su una pagina apre il visore (Fase 13), dove
// stanno etichetta e azioni. Righe già spezzate in terzine: un elenco solo, virtualizzato.

import { useState, type ReactNode } from 'react';
import { FlatList, Image, Pressable, Switch, TextInput, useWindowDimensions, View } from 'react-native';
import { Archive, Camera, Check, Folder, Pencil, Trash2 } from 'lucide-react-native';
import { ScannerLotto, type Pagina } from '../contratto';
import { t } from '../lingua';
import { uriAnteprima, type Bozza } from '../lotti';
import { quantiGiorni, type DopoInvio } from '../pagine';
import { percorsoLeggibile, type SchedaScelta } from '../scelta';
import { raggio, spazio, tipo, TOCCO, useColori } from '../theme';
import { SPORGENZA_BARRA } from '../ui/BarraFondo';
import { Campo } from '../ui/Campo';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';

const COLONNE = 3;

type Cella = { b: Bozza; pg: Pagina; indice: number; inviata: boolean };
type Riga = { k: string; titolo?: string; azione?: ReactNode; celle?: Cella[] };

type Props = {
  scheda: SchedaScelta;
  archivio: string;
  /** Lotti con pagine ancora da inviare. */
  lotti: Bozza[];
  /** Lotti già inviati e tenuti («Dopo l'invio»): sola lettura. */
  inviati: Bozza[];
  /** Id del lotto che sta partendo: le sue pagine non si toccano. */
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
  /** Il riquadro d'invio, sotto l'intestazione. */
  attesa: ReactNode;
  onIndietro: () => void;
  /** Indice nell'ordine della griglia: prima le da inviare, poi le inviate. */
  onApri: (indice: number) => void;
  onTogliInviate: () => void;
  /** Solo per una scheda nata qui le cui pagine non sono ancora partite (Fase 14). */
  onCambiaCartella?: () => void;
  /** Stessa condizione di `onCambiaCartella` (Fase 3b): segnatura e cestino. */
  onRinomina?: (segnatura: string) => void;
  onElimina?: () => void;
  /** F7: fotocamera senza ritaglio (sigilli, filigrane, dettagli). */
  onFotoLibera: () => void;
};

function terzine(celle: Cella[], k: string): Riga[] {
  const out: Riga[] = [];
  for (let i = 0; i < celle.length; i += COLONNE) out.push({ k: `${k}${i}`, celle: celle.slice(i, i + COLONNE) });
  return out;
}

export function Scheda(p: Props) {
  const c = useColori();
  const { width } = useWindowDimensions();
  const lato = (width - spazio.md * 2 - spazio.md * (COLONNE - 1)) / COLONNE;
  const daInviare = p.lotti.flatMap(b => b.pagine.map(pg => ({ b, pg })));
  const inviate = p.inviati.flatMap(b => b.pagine.map(pg => ({ b, pg })));
  const celle: Cella[] = [...daInviare, ...inviate].map((x, indice) => ({ ...x, indice, inviata: indice >= daInviare.length }));
  const titolo = p.scheda.tipo === 'smistare' ? t('Senza scheda') : p.scheda.segnatura || p.scheda.id;
  const sotto = p.archivio + (p.scheda.tipo === 'nuova' ? ` · ${t('creata qui')}` : p.scheda.tipo === 'smistare' ? ` · ${t('da smistare al computer')}` : '');
  const cartella = p.scheda.tipo === 'nuova' ? p.scheda.cartella || '' : null;
  const conta = (n: number) => (n === 1 ? t('1 pagina') : t('{n} pagine', { n }));
  const [segnatura, setSegnatura] = useState<string | null>(null);

  const righe: Riga[] = [];
  if (daInviare.length) righe.push({ k: 'td', titolo: `${t('Da inviare')} · ${conta(daInviare.length)}` }, ...terzine(celle.slice(0, daInviare.length), 'd'));
  if (inviate.length) {
    righe.push({ k: 'ti', titolo: `${t('Inviate')} · ${conta(inviate.length)}`, azione: <Pulsante variante="ghost" titolo={t('Rimuovi tutte')} onPress={p.onTogliInviate} /> });
    righe.push(...terzine(celle.slice(daInviare.length), 'i'));
  }

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

  const tessera = ({ b, pg, indice, inviata }: Cella) => {
    const bloccata = p.inInvio === b.id;
    const nome = pg.etichetta || t('Pagina {n}', { n: indice + 1 });
    const sfocata = !inviata && !!b.sfocate?.includes(pg.file);
    return (
      <Pressable
        key={b.id + pg.file}
        accessibilityRole="button"
        accessibilityLabel={[t('Apri {nome}', { nome }), bloccata ? t('in invio') : inviata ? t('inviata') : '', sfocata ? t('forse sfocata') : ''].filter(Boolean).join(', ')}
        onPress={() => p.onApri(indice)}
        style={{ width: lato, gap: spazio.xs }}
      >
        {({ pressed }) => (
          <>
            <View style={{ width: lato, height: lato * 4 / 3, backgroundColor: c.bgHover, borderWidth: pressed ? 2 : 1, borderColor: pressed ? c.primary : c.divisore, borderRadius: raggio.md, overflow: 'hidden', opacity: inviata ? 0.7 : 1 }}>
              <Image source={{ uri: uriAnteprima(b, pg) }} style={{ flex: 1 }} resizeMode="cover" resizeMethod="resize" accessibilityIgnoresInvertColors />
              {bloccata && <Testo variante="aiuto" numberOfLines={1} maxFontSizeMultiplier={1.5} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: c.primary, color: c.onPrimary, fontWeight: '600' }}>{t('In invio')}</Testo>}
              {!!pg.doppia && <Testo variante="aiuto" style={{ position: 'absolute', top: 0, right: 0, paddingHorizontal: 6, backgroundColor: c.bgPanel }}>{pg.doppia.lato === 'sx' ? t('sx') : t('dx')}</Testo>}
              {sfocata && !bloccata && <Testo variante="aiuto" numberOfLines={1} maxFontSizeMultiplier={1.5} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: c.warningLight, borderTopWidth: 1, borderColor: c.warningBorder, color: c.textMain, fontWeight: '600' }}>{t('Sfocata?')}</Testo>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.xs, minHeight: 24 }}>
              {inviata && <Check size={14} color={c.primary} />}
              <Testo numberOfLines={1} tono={inviata || !pg.etichetta ? 'muted' : 'main'} style={{ flex: 1 }}>{inviata ? `${pg.etichetta || '—'} · ${t('inviata')}` : pg.etichetta || '—'}</Testo>
            </View>
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={titolo} sotto={sotto} onIndietro={p.onIndietro} azioni={p.onRinomina && p.onElimina && p.scheda.tipo === 'nuova' ? (
        <>
          <Pulsante variante="ghost" icona={Pencil} etichetta={t('Rinomina la scheda')} onPress={() => setSegnatura(p.scheda.tipo === 'nuova' ? p.scheda.segnatura : '')} />
          <Pulsante variante="pericoloGhost" icona={Trash2} etichetta={t('Elimina la scheda')} onPress={p.onElimina} />
        </>
      ) : undefined} />
      <FlatList
        data={righe}
        keyExtractor={r => r.k}
        ListHeaderComponent={testa}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: spazio.md, paddingBottom: SPORGENZA_BARRA + spazio.md }}
        renderItem={({ item: r }) => r.titolo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: spazio.md, paddingRight: spazio.sm, paddingTop: spazio.sm }}>
            <View style={{ flex: 1 }}>
              <Testo variante="sezione" accessibilityRole="header">{r.titolo}</Testo>
              {r.k === 'ti' && p.dopoInvio.modo === 'giorni' && <Testo variante="aiuto">{t('Restano {giorni} dopo l\'invio, poi si cancellano da sole.', { giorni: quantiGiorni(p.dopoInvio.giorni) })}</Testo>}
            </View>
            {r.azione}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spazio.md, paddingHorizontal: spazio.md }}>{r.celle!.map(tessera)}</View>
        )}
      />
    </View>
  );
}
