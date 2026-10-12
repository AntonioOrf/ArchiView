// Un documento (design 15a): nome rinominabile (matita), cartella · pagine · data; Sposta ed
// Elimina, «Condividi o salva» (15c); le pagine in griglia (3 per riga), il tocco apre il
// visore. Il «+» della barra aggiunge pagine. Tenendo premuta una pagina la si trascina in un
// altro punto della griglia; con TalkBack «Sposta prima / dopo».

import { useRef, useState } from 'react';
import { FlatList, Image, Pressable, useWindowDimensions, View, type ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { FolderInput, Pencil, Share2, Trash2 } from 'lucide-react-native';
import { LUNGHEZZA_NOME, nomeValido, quando, type Documento as Doc, type PaginaDoc } from '../elencoDocumenti';
import { uriPagina } from '../documenti';
import { nomeFiltro } from '../filtri';
import { raggio, spazio, useColori } from '../theme';
import { SPORGENZA_BARRA } from '../ui/BarraFondo';
import { Campo } from '../ui/Campo';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';

const COLONNE = 3;

type Props = {
  doc: Doc;
  onIndietro: () => void;
  onApri: (indice: number) => void;
  onRinomina: (nome: string) => void;
  onSposta: () => void;
  onElimina: () => void;
  onCondividi: () => void;
  /** Riordino: la pagina `da` va in posizione `a`. */
  onRiordina: (da: number, a: number) => void;
};

type PropsMiniatura = {
  doc: Doc; pg: PaginaDoc; i: number; n: number; lato: number;
  onApri: (i: number) => void; onRiordina: (da: number, a: number) => void; onTrascina: (i: number | null) => void;
};

function Miniatura({ doc, pg, i, n, lato, onApri, onRiordina, onTrascina }: PropsMiniatura) {
  const c = useColori();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const su = useSharedValue(0);
  const alto = useRef(lato * 4 / 3);
  /** Fine dell'ultimo trascinamento: il rilascio non deve aprire anche il visore. */
  const finito = useRef(0);

  // Dallo spostamento del dito alla casella d'arrivo: colonna dentro la riga, riga qualunque.
  const rilascia = (tx: number, ty: number) => {
    finito.current = Date.now();
    onTrascina(null);
    const col = Math.min(COLONNE - 1, Math.max(0, (i % COLONNE) + Math.round(tx / (lato + spazio.md))));
    const riga = Math.floor(i / COLONNE) + Math.round(ty / (alto.current + spazio.md));
    onRiordina(i, riga * COLONNE + col);
  };
  const pan = Gesture.Pan()
    .activateAfterLongPress(350)
    .onStart(() => { su.set(1); scheduleOnRN(onTrascina, i); })
    .onUpdate(e => { x.set(e.translationX); y.set(e.translationY); })
    .onEnd(e => { scheduleOnRN(rilascia, e.translationX, e.translationY); })
    .onFinalize(() => { x.set(0); y.set(0); su.set(0); });
  const stile = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: su.get() ? 1.06 : 1 }],
    opacity: su.get() ? 0.9 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ width: lato }, stile]} onLayout={e => { alto.current = e.nativeEvent.layout.height; }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Apri la pagina ${i + 1}${pg.filtro ? `, filtro ${nomeFiltro(pg.filtro)}` : ''}`}
          accessibilityHint={n > 1 ? 'Tieni premuto e trascina per spostarla' : undefined}
          accessibilityActions={n > 1 ? [...(i > 0 ? [{ name: 'decrement', label: 'Sposta prima' }] : []), ...(i < n - 1 ? [{ name: 'increment', label: 'Sposta dopo' }] : [])] : undefined}
          onAccessibilityAction={e => onRiordina(i, i + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
          onPress={() => { if (Date.now() - finito.current > 400) onApri(i); }} style={{ gap: spazio.xs }}>
          {({ pressed }) => (
            <>
              <View style={{ width: lato, height: lato * 4 / 3, backgroundColor: c.bgHover, borderWidth: pressed ? 2 : 1, borderColor: pressed ? c.primary : c.divisore, borderRadius: raggio.md, overflow: 'hidden' }}>
                <Image source={{ uri: uriPagina(doc, pg) }} style={{ flex: 1 }} resizeMode="cover" resizeMethod="resize" accessibilityIgnoresInvertColors />
                {!!pg.filtro && <Testo variante="aiuto" numberOfLines={1} maxFontSizeMultiplier={1.5} style={{ position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, borderRadius: raggio.sm, overflow: 'hidden', backgroundColor: c.bgPanel, color: c.textMain, fontWeight: '600' }}>{nomeFiltro(pg.filtro)}</Testo>}
              </View>
              <Testo>{String(i + 1)}</Testo>
            </>
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

export function Documento({ doc, onIndietro, onApri, onRinomina, onSposta, onElimina, onCondividi, onRiordina }: Props) {
  const { width } = useWindowDimensions();
  const [nome, setNome] = useState<string | null>(null);
  /** Pagina che si sta trascinando: la sua riga va sopra le altre e l'elenco non scorre. */
  const [trascinata, setTrascinata] = useState<number | null>(null);
  const rigaSu = trascinata === null ? -1 : Math.floor(trascinata / COLONNE);
  const lato = (width - spazio.md * 2 - spazio.md * (COLONNE - 1)) / COLONNE;
  const n = doc.pagine.length;
  const sotto = [doc.cartella, `${n} ${n === 1 ? 'pagina' : 'pagine'}`, quando(doc.creatoIl, new Date())].filter(Boolean).join(' · ');
  const righe: PaginaDoc[][] = [];
  for (let i = 0; i < n; i += COLONNE) righe.push(doc.pagine.slice(i, i + COLONNE));

  const testa = (
    <View style={{ gap: spazio.md, paddingTop: spazio.md }}>
      {nome !== null && (
        <View style={{ paddingHorizontal: spazio.md, gap: spazio.sm }}>
          <Campo etichetta="Nome del documento" value={nome} onChangeText={setNome} maxLength={LUNGHEZZA_NOME} autoFocus selectTextOnFocus />
          <View style={{ flexDirection: 'row', gap: spazio.sm }}>
            <Pulsante variante="primario" titolo="Rinomina" disabilitato={!nomeValido(nome)} style={{ flex: 1 }} onPress={() => { onRinomina(nome.trim()); setNome(null); }} />
            <Pulsante variante="ghost" titolo="Annulla" onPress={() => setNome(null)} />
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: spazio.sm, paddingHorizontal: spazio.md }}>
        <Pulsante variante="primario" icona={Share2} titolo="Condividi o salva" onPress={onCondividi} style={{ flex: 1 }} />
        <Pulsante icona={FolderInput} titolo="Sposta" onPress={onSposta} />
        <Pulsante variante="pericoloGhost" icona={Trash2} etichetta="Elimina il documento" onPress={onElimina} />
      </View>
      <Testo variante="sezione" accessibilityRole="header" style={{ paddingHorizontal: spazio.md }}>Pagine</Testo>
      {n > 1 && <Testo variante="aiuto" style={{ paddingHorizontal: spazio.md, marginTop: -spazio.sm }}>Tieni premuta una pagina e trascinala per cambiare l'ordine.</Testo>}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={doc.nome} sotto={sotto} onIndietro={onIndietro}
        azioni={<Pulsante variante="ghost" icona={Pencil} etichetta="Rinomina il documento" onPress={() => setNome(doc.nome)} />} />
      <FlatList
        data={righe}
        keyExtractor={r => r[0].file}
        ListHeaderComponent={testa}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={trascinata === null}
        // ponytail: niente scorrimento automatico verso il bordo durante il trascinamento: con molte pagine si sposta in più passi.
        CellRendererComponent={({ index, style, ...resto }: ViewProps & { index: number }) => <View {...resto} style={[style, index === rigaSu && { zIndex: 1, elevation: 1 }]} />}
        contentContainerStyle={{ gap: spazio.md, paddingBottom: SPORGENZA_BARRA + spazio.md }}
        renderItem={({ item: r, index: riga }) => (
          <View style={{ flexDirection: 'row', gap: spazio.md, paddingHorizontal: spazio.md }}>
            {r.map((pg, k) => (
              <Miniatura key={pg.file} doc={doc} pg={pg} i={riga * COLONNE + k} n={n} lato={lato} onApri={onApri} onRiordina={onRiordina} onTrascina={setTrascinata} />
            ))}
          </View>
        )}
      />
    </View>
  );
}
