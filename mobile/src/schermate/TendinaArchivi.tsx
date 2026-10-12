// La tendina degli archivi (design 11/10): si apre toccando il nome dell'archivio. Elenco degli
// archivi noti (quelli su Drive più quello in uso), l'attuale con la spunta, poi «Nuovo
// archivio» (il computer lo crea quando riceve le scansioni). Senza `onChiudi` è la prima
// schermata dell'app, quando nessun archivio è ancora scelto.

import { useRef, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, FileText, Plus } from 'lucide-react-native';
import { nomeArchivioValido } from '../scelta';
import { raggio, spazio, useColori } from '../theme';
import { Campo } from '../ui/Campo';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';
import { Gruppo, Voce } from '../ui/Voce';
import { NomeArchivio } from './Archivio';

type Props = {
  archivi: string[];
  attuale?: { nome: string; nuovo: boolean };
  onScegli: (nome: string, nuovo: boolean) => void;
  /** Assente = scelta obbligatoria (primo avvio). */
  onChiudi?: () => void;
  /** Mostrato sopra l'elenco al primo avvio (es. «Accedi con Google»). */
  testa?: ReactNode;
  /** Fase 15: «Documenti», in fondo sotto «Solo su questo telefono». */
  onDocumenti: () => void;
  /** I Documenti sono la sezione aperta: il titolo è «Documenti», nessun archivio spuntato. */
  inDocumenti?: boolean;
};

function Contenuto({ archivi, attuale: inUsoArchivio, onScegli, onChiudi, testa, onDocumenti, inDocumenti }: Props) {
  const attuale = inDocumenti ? undefined : inUsoArchivio;
  const c = useColori();
  const [creando, setCreando] = useState(false);
  const [nome, setNome] = useState('');
  const pulito = nome.trim();
  const valido = nomeArchivioValido(pulito);
  const esiste = archivi.includes(pulito);
  const tutti = inUsoArchivio && !archivi.includes(inUsoArchivio.nome) ? [inUsoArchivio.nome, ...archivi] : archivi;
  const titolo = inDocumenti ? 'Documenti' : attuale?.nome;

  return (
    <View style={{ gap: spazio.md, paddingBottom: spazio.md }}>
      <View style={{ paddingHorizontal: spazio.md, paddingTop: spazio.sm, gap: 2 }}>
        {titolo && onChiudi
          ? <NomeArchivio nome={titolo} aperta onPress={onChiudi} />
          : <Testo variante="titolo" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 38 }}>ArchiScanner</Testo>}
      </View>
      {testa}
      <Testo variante="sezione" accessibilityRole="header" style={{ paddingHorizontal: spazio.md }}>Archivi · vanno al computer</Testo>

      {tutti.length ? (
        <Gruppo>
          {tutti.map((a, i) => {
            const inUso = a === attuale?.nome;
            return (
              <Voce key={a} titolo={a} ultima={i === tutti.length - 1} evidenziata={inUso}
                sotto={inUso && attuale?.nuovo ? 'Creato qui · il computer lo crea alla prima ricezione' : undefined}
                destra={inUso ? <Check size={20} color={c.primaryHover} strokeWidth={2.5} accessibilityLabel="Archivio in uso" /> : undefined}
                onPress={() => onScegli(a, a === inUsoArchivio?.nome ? !!inUsoArchivio.nuovo : false)} />
            );
          })}
        </Gruppo>
      ) : (
        <Testo variante="aiuto" style={{ paddingHorizontal: spazio.md }}>Nessun archivio su Drive: compaiono quelli sincronizzati col cloud dal computer.</Testo>
      )}

      <View style={{ paddingHorizontal: spazio.md, gap: spazio.sm }}>
        {creando ? (
          <>
            <Campo etichetta="Nome del nuovo archivio" placeholder="Diventa la cartella sul computer" value={nome} onChangeText={setNome} maxLength={200} autoFocus />
            {!!pulito && !valido && <Testo variante="aiuto" tono="danger">{'Nome non valido come cartella: niente \\ / : * ? " < > |, né punto finale.'}</Testo>}
            {esiste && <Testo variante="aiuto">Esiste già: si userà quello.</Testo>}
            <View style={{ flexDirection: 'row', gap: spazio.sm }}>
              <Pulsante variante="primario" titolo={esiste ? `Usa «${pulito}»` : 'Crea archivio'} disabilitato={!valido} style={{ flex: 1 }}
                onPress={() => { onScegli(pulito, !esiste); setNome(''); setCreando(false); }} />
              <Pulsante variante="ghost" titolo="Annulla" onPress={() => { setCreando(false); setNome(''); }} />
            </View>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setCreando(true)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spazio.md, minHeight: 52, paddingHorizontal: spazio.md, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderInput, borderRadius: raggio.md, backgroundColor: pressed ? c.bgHover : 'transparent' })}
          >
            <Plus size={20} color={c.primaryHover} strokeWidth={2.25} />
            <Testo variante="controllo" tono="accento">Nuovo archivio</Testo>
          </Pressable>
        )}
      </View>

      <Testo variante="sezione" accessibilityRole="header" style={{ paddingHorizontal: spazio.md, paddingTop: spazio.sm }}>Solo su questo telefono</Testo>
      <Gruppo>
        <Voce titolo="Documenti" sotto="Ricevute, articoli, fotocopie" icona={FileText} ultima evidenziata={inDocumenti}
          destra={inDocumenti ? <Check size={20} color={c.primaryHover} strokeWidth={2.5} accessibilityLabel="Sezione in uso" /> : undefined}
          onPress={onDocumenti} />
      </Gruppo>
    </View>
  );
}

export function TendinaArchivi(p: Props) {
  const c = useColori();
  const margini = useSafeAreaInsets();
  const scorri = useRef<ScrollView>(null);
  // L'unico campo è «Nome del nuovo archivio», in fondo: con la tastiera aperta si scorre lì,
  // dopo che il pannello si è accorciato (onLayout), non all'apertura della tastiera.
  const inFondo = () => { if (Keyboard.isVisible()) scorri.current?.scrollToEnd(); };
  const elenco = <ScrollView ref={scorri} keyboardShouldPersistTaps="handled" onLayout={inFondo} onContentSizeChange={inFondo}><Contenuto {...p} /></ScrollView>;
  // Edge-to-edge (Android 15+): la finestra non si ridimensiona da sola con la tastiera.
  if (!p.onChiudi) {
    return (
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.bgPanel }}>{elenco}</KeyboardAvoidingView>
    );
  }
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={p.onChiudi}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Chiudi l'elenco degli archivi" onPress={p.onChiudi} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.45)' }} />
        <View accessibilityViewIsModal style={{ maxHeight: '85%', paddingTop: margini.top, backgroundColor: c.bgPanel, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, overflow: 'hidden' }}>
          {elenco}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
