import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Archive, Combine, FolderInput, Pencil, Share2, Trash2 } from 'lucide-react-native';
import { LUNGHEZZA_NOME, nomeValido, quando, type Documento as Doc } from '../elencoDocumenti';
import { uriPagina } from '../documenti';
import { nomeFiltro } from '../filtri';
import { t } from '../lingua';
import { raggio, spazio, useColori } from '../theme';
import { SPORGENZA_BARRA } from '../ui/BarraFondo';
import { Campo } from '../ui/Campo';
import { ContaSpostate, Griglia, useFinestra, useMisure } from '../ui/Griglia';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';
import { SegnoScelta, TestataSelezione, useSelezione } from '../ui/Selezione';
import { Testo } from '../ui/Testo';

type Props = {
  doc: Doc;
  onIndietro: () => void;
  onApri: (indice: number) => void;
  onRinomina: (nome: string) => void;
  onSposta: () => void;
  onElimina: () => void;
  onCondividi: () => void;
  onRiordina: (da: number, a: number, insieme: number[]) => void;
  archivio?: string;
  onArchivio?: () => void;
  onUnisci: () => void;
  onEliminaPagine: (file: string[]) => void;
};

export function Documento({ doc, onIndietro, onApri, onRinomina, onSposta, onElimina, onCondividi, onRiordina, archivio, onArchivio, onUnisci, onEliminaPagine }: Props) {
  const c = useColori();
  const sel = useSelezione();
  const { lato } = useMisure();
  const finestra = useFinestra();
  const [nome, setNome] = useState<string | null>(null);
  const n = doc.pagine.length;
  const sotto = [doc.cartella, n === 1 ? t('1 pagina') : t('{n} pagine', { n }), quando(doc.creatoIl, new Date())].filter(Boolean).join(' · ');

  const testa = (
    <View style={{ gap: spazio.md, paddingTop: spazio.md }}>
      {nome !== null && (
        <View style={{ paddingHorizontal: spazio.md, gap: spazio.sm }}>
          <Campo etichetta={t('Nome del documento')} value={nome} onChangeText={setNome} maxLength={LUNGHEZZA_NOME} autoFocus selectTextOnFocus />
          <View style={{ flexDirection: 'row', gap: spazio.sm }}>
            <Pulsante variante="primario" titolo={t('Rinomina')} disabilitato={!nomeValido(nome)} style={{ flex: 1 }} onPress={() => { onRinomina(nome.trim()); setNome(null); }} />
            <Pulsante variante="ghost" titolo={t('Annulla')} onPress={() => setNome(null)} />
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: spazio.sm, paddingHorizontal: spazio.md }}>
        <Pulsante variante="primario" icona={Share2} titolo={t('Condividi o salva')} onPress={onCondividi} style={{ flex: 1 }} />
        <Pulsante icona={FolderInput} titolo={t('Sposta')} onPress={onSposta} />
        <Pulsante variante="pericoloGhost" icona={Trash2} etichetta={t('Elimina il documento')} onPress={onElimina} />
      </View>
      {archivio && <Pulsante variante="ghost" icona={Archive} titolo={t('Manda all\'archivio «{nome}»', { nome: archivio })} onPress={onArchivio!} style={{ marginHorizontal: spazio.md, marginTop: -spazio.sm, alignSelf: 'flex-start' }} />}
      <Testo variante="sezione" accessibilityRole="header" style={{ paddingHorizontal: spazio.md }}>{t('Pagine')}</Testo>
      {n > 1 && <Testo variante="aiuto" style={{ paddingHorizontal: spazio.md, marginTop: -spazio.sm }}>{t('Tieni premuta una pagina per selezionarla, poi trascinala per spostare tutte le selezionate.')}</Testo>}
    </View>
  );

  // ponytail: niente scorrimento automatico al bordo durante il trascinamento: con molte pagine si sposta in più passi.
  return (
    <View style={{ flex: 1 }}>
      {sel.scelte ? (
        <TestataSelezione n={sel.scelte.length} totale={n} onTutte={() => sel.tutte(doc.pagine.map((_, i) => i))} onEsci={sel.esci}
          onElimina={() => { onEliminaPagine(sel.scelte!.map(i => doc.pagine[i]?.file).filter((x): x is string => !!x)); sel.esci(); }} />
      ) : (
        <Intestazione titolo={doc.nome} sotto={sotto} onIndietro={onIndietro}
          azioni={<>
            <Pulsante variante="ghost" icona={Combine} etichetta={t('Unisci un altro documento in fondo')} onPress={onUnisci} />
            <Pulsante variante="ghost" icona={Pencil} etichetta={t('Rinomina il documento')} onPress={() => setNome(doc.nome)} />
          </>} />
      )}
      <View style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spazio.md, paddingBottom: SPORGENZA_BARRA + spazio.md }} {...finestra.scorrimento}>
          {testa}
          <Griglia n={n} chiave={i => doc.pagine[i].file} vista={finestra.vista} sel={sel} onApri={onApri} onRiordina={onRiordina} onSpostando={finestra.setSpostando}
            descrivi={(i, scegliendo) => {
              const pg = doc.pagine[i];
              return {
                etichetta: scegliendo ? t('Pagina {n}', { n: i + 1 }) : pg.filtro ? t('Apri la pagina {n}, filtro {filtro}', { n: i + 1, filtro: nomeFiltro(pg.filtro) }) : t('Apri la pagina {n}', { n: i + 1 }),
                aiuto: scegliendo ? undefined : n > 1 ? t('Tieni premuto per selezionare, trascina per spostarla') : t('Tieni premuto per selezionare più pagine')
              };
            }}
            contenuto={(i, evidenza) => {
              const pg = doc.pagine[i];
              return (
                <View style={{ width: lato, height: lato * 4 / 3, backgroundColor: c.bgHover, borderWidth: evidenza ? 3 : 1, borderColor: evidenza ? c.primary : c.divisore, borderRadius: raggio.md, overflow: 'hidden' }}>
                  <Image source={{ uri: uriPagina(doc, pg) }} style={{ flex: 1 }} resizeMode="cover" resizeMethod="resize" accessibilityIgnoresInvertColors />
                  {!!pg.filtro && <Testo variante="aiuto" numberOfLines={1} maxFontSizeMultiplier={1.5} style={{ position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, borderRadius: raggio.sm, overflow: 'hidden', backgroundColor: c.bgPanel, color: c.textMain, fontWeight: '600' }}>{nomeFiltro(pg.filtro)}</Testo>}
                  {!!sel.scelte && <SegnoScelta scelta={sel.scelta(i)} />}
                </View>
              );
            }}
            etichetta={i => <Testo numberOfLines={1} maxFontSizeMultiplier={1.5}>{String(i + 1)}</Testo>} />
        </ScrollView>
        <ContaSpostate n={finestra.spostando} />
      </View>
    </View>
  );
}
