// Fase 10b/11 (PIANO-SCANNER.md): l'utente ragiona per archivio → scheda → pagine. Il lotto resta
// solo come busta di trasferimento: ogni «Salva» dello scanner è un lotto, subito in coda.
// Schermate a stato, niente router (design 11/10): archivio (con la tendina degli archivi e il
// «+»), scheda, impostazioni; Dividi e Abbina a tutto schermo.
// Stringhe in italiano senza i18n (decisione della Fase 6).

import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, BackHandler, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useNetworkState, NetworkStateType } from 'expo-network';
import * as Crypto from 'expo-crypto';
import { launchDocumentScannerAsync, ResultFormatOptions, ScannerModeOptions } from '@infinitered/react-native-mlkit-document-scanner';
import { CloudUpload, FilePlus, LogIn, Plus, ScanLine, SlidersHorizontal } from 'lucide-react-native';
import { accedi, esci, utenteSilenzioso, type Utente } from './src/accesso';
import { azzeraCartelle, type Avanzamento } from './src/drive';
import { Dividi } from './src/Dividi';
import { messaggioErrore } from './src/errori';
import { aggiungiPagina, chiudiAperti, dividiPagina, elencaLotti, eliminaLotto, leggiLotti, recuperaLotto, etichettaPagina, nuovoLotto, pulisciInviati, rimuoviPagina, ritagliaPagina, ruotaPagina, salvaBozza, sostituisciPagina, uriAnteprima, type Bozza } from './src/lotti';
import { aggiornaArchivi, aggiornaElenco, archiviLocali, elencoLocale, leggiImpostazioni, reteAdatta, salvaImpostazioni, salvaSchedeNuove, schedeNuove, svuotaCoda, type EventoCoda, type Impostazioni as ImpostazioniApp } from './src/coda';
import { alternaCartella, chiaveDestinazione, destinazioneDi, perArchivio, percorsoLeggibile, type SchedaScelta } from './src/scelta';
import { prossimaEtichetta } from './src/etichette';
import { Abbina } from './src/Abbina';
import { cercaAggiornamento, installaAggiornamento } from './src/aggiornaApp';
import { abbinamentoPerso, inviaLottoWifi, type Abbinamento } from './src/wifi';
import { ScannerLotto, type Pagina } from './src/contratto';
import { Archivio, type SchedaInAttesa } from './src/schermate/Archivio';
import { Impostazioni } from './src/schermate/Impostazioni';
import { Nuovo } from './src/schermate/Nuovo';
import { Ritaglia } from './src/schermate/Ritaglia';
import { ScegliCartella } from './src/schermate/ScegliCartella';
import { Scheda } from './src/schermate/Scheda';
import { Visore, type PaginaVisore } from './src/schermate/Visore';
import { TendinaArchivi } from './src/schermate/TendinaArchivi';
import { Attesa } from './src/ui/Attesa';
import { BarraFondo } from './src/ui/BarraFondo';
import { MenuPiu } from './src/ui/MenuPiu';
import { Pulsante } from './src/ui/Pulsante';
import { Schermo } from './src/ui/Schermo';
import { SezioneDocumenti } from './src/SezioneDocumenti';

const DISPOSITIVO = Platform.OS === 'android' ? `${Platform.constants.Manufacturer} ${Platform.constants.Model}` : Platform.OS;

/** La scheda a cui va un lotto, ricostruita dalla sua destinazione (per riaprirla dall'elenco). */
function sceltaDelLotto(b: Bozza): SchedaScelta {
  const d = b.destinazione;
  if (d.tipo === 'nessuna') return { tipo: 'smistare' };
  if (d.tipo === 'esistente') return { tipo: 'esistente', id: d.schedaId, segnatura: b.titolo || d.schedaId };
  return { tipo: 'nuova', id: d.schedaId || b.id, segnatura: d.campi.segnatura || b.titolo || '', nota: b.nota, cartella: d.cartella };
}

const chiaveScelta = (s: SchedaScelta) => (s.tipo === 'smistare' ? '' : s.id);

export default function App() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><Principale /></SafeAreaProvider></GestureHandlerRootView>;
}

function Principale() {
  const [utente, setUtente] = useState<Utente | null>(null);
  const [lotti, setLotti] = useState<Bozza[]>([]);
  /** Lotti con la bozza illeggibile: foto su disco da ricostruire (Fase 6b). */
  const [rotti, setRotti] = useState<string[]>([]);
  const [impostazioni, setImpostazioni] = useState<ImpostazioniApp>(leggiImpostazioni);
  const archivio = impostazioni.archivio;
  const [archivi, setArchivi] = useState(archiviLocali);
  const [tendina, setTendina] = useState(false);
  const [elenco, setElenco] = useState(() => elencoLocale(archivio?.nome));
  const [nuove, setNuove] = useState(schedeNuove);
  const [scheda, setScheda] = useState<SchedaScelta | null>(null);
  const [vista, setVista] = useState<'archivio' | 'impostazioni'>('archivio');
  /** Fase 15: la sezione Documenti al posto dell'archivio (scelta dalla tendina), ricordata alla riapertura. */
  const documenti = !!impostazioni.documenti;
  const [foglioNuovo, setFoglioNuovo] = useState(false);
  const [menuPiu, setMenuPiu] = useState(false);
  /** Schermata «Cambia cartella» della scheda nuova aperta. */
  const [sceltaCartella, setSceltaCartella] = useState(false);
  const [occupato, setOccupato] = useState<string | null>(null);
  const [invio, setInvio] = useState<{ id: string } & Avanzamento | null>(null);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [auto, setAuto] = useState(false);
  const [cartaIniziale, setCartaIniziale] = useState('1r');
  /** Titolo e nota della prossima scansione "da smistare": dicono sul computer cosa sono quelle pagine. */
  const [titoloSmistare, setTitoloSmistare] = useState('');
  const [notaSmistare, setNotaSmistare] = useState('');
  const [daDividere, setDaDividere] = useState<{ lotto: string; file: string } | null>(null);
  const [daRitagliare, setDaRitagliare] = useState<{ lotto: string; file: string } | null>(null);
  /** Pagina aperta nel visore (indice nell'ordine della griglia della scheda). */
  const [visore, setVisore] = useState<number | null>(null);
  const [abbinando, setAbbinando] = useState(false);
  const [abbinamento, setAbbinamento] = useState<{ a: Abbinamento; archivio: string } | null>(null);
  const rete = useNetworkState();

  const cambiaImpostazioni = (i: ImpostazioniApp) => { salvaImpostazioni(i); setImpostazioni(i); };

  // Gli archivi (nomi di cartelle) si aggiornano su qualunque rete, all'accesso, al ritorno della
  // rete e al cambio d'archivio; il database dell'archivio solo su una rete adatta (Fase 4a),
  // altrimenti basta l'elenco pubblicato. Un archivio nuovo pubblicato dal desktop smette di essere "nuovo".
  const reteBuona = reteAdatta(rete, impostazioni.soloWifi);
  useEffect(() => {
    if (!utente || !rete.isConnected) return;
    (async () => {
      try {
        const nomi = await aggiornaArchivi();
        setArchivi(nomi);
        const a = leggiImpostazioni();
        if (a.archivio?.nuovo && nomi.includes(a.archivio.nome)) cambiaImpostazioni({ ...a, archivio: { nome: a.archivio.nome, nuovo: false } });
      } catch (e) {
        console.warn('[app] archivi non aggiornati', e);
      }
      if (!archivio) return;
      try {
        setElenco(await aggiornaElenco(archivio.nome, reteBuona));
      } catch (e) {
        console.warn('[app] elenco schede non aggiornato', e);
      }
    })();
  }, [utente, rete.isConnected, reteBuona, archivio?.nome]);

  const ricarica = useCallback(() => {
    try {
      const l = leggiLotti();
      setLotti(l.lotti);
      setRotti(l.rotti);
    } catch (e: any) {
      Alert.alert('Errore', `Lettura delle scansioni: ${e?.message || String(e)}`);
    }
  }, []);
  const aggiorna = (b: Bozza) => setLotti(ls => (ls.some(l => l.id === b.id) ? ls.map(l => (l.id === b.id ? b : l)) : [...ls, b]));

  useEffect(() => {
    utenteSilenzioso().then(setUtente);
    try { chiudiAperti(); } catch (e) { console.warn('[app] lotti aperti non chiusi', e); }
    try { pulisciInviati(leggiImpostazioni().dopoInvio); } catch (e) { console.warn('[app] pulizia delle inviate non riuscita', e); }
    ricarica();
    cercaAggiornamento().then(n => n && Alert.alert(
      `ArchiScanner ${n.versione}`,
      'È uscita una versione nuova dell\'app. Le pagine in attesa restano dove sono.',
      [
        { text: 'Più tardi', style: 'cancel' },
        { text: 'Aggiorna', onPress: () => esegui('Aggiornamento', () => installaAggiornamento(n)) }
      ]
    ));
  }, [ricarica]);

  const evento = useCallback((e: EventoCoda) => {
    if (e.tipo === 'lotto') { setInvio({ id: e.id, ...e.avanzamento }); return; }
    setInvio(null);
    if (e.tipo === 'inviato') {
      setErrori(({ [e.id]: _, ...resto }) => resto);
      ricarica(); // eliminato o tenuto come `inviato`: lo dice il disco
      setNuove(schedeNuove()); // la scheda nuova del lotto ora è «partita»
    } else {
      setErrori(er => ({ ...er, [e.id]: messaggioErrore(e.messaggio) }));
    }
  }, [ricarica]);

  // Fase 1b: la coda parte su Drive solo con l'account che l'ha riempita (un solo utente per telefono).
  const driveOk = !!utente && impostazioni.account === utente.email;
  const chiediAccount = (vecchio: string, nuovo: string, n: number) => Alert.alert(
    'Account cambiato',
    `${n} ${n === 1 ? 'pagina scansionata' : 'pagine scansionate'} con ${vecchio}: inviarle a ${nuovo}?`,
    [
      { text: 'Tieni in attesa', style: 'cancel' },
      { text: 'Invia', onPress: () => cambiaImpostazioni({ ...leggiImpostazioni(), account: nuovo }) }
    ]
  );
  useEffect(() => {
    if (!utente || impostazioni.account === utente.email) return;
    const n = elencaLotti().filter(l => l.stato === 'in_coda').reduce((t, l) => t + l.pagine.length, 0);
    if (impostazioni.account && n) chiediAccount(impostazioni.account, utente.email, n);
    else cambiaImpostazioni({ ...leggiImpostazioni(), account: utente.email });
  }, [utente?.email]);

  /**
   * Coda verso il computer abbinato (Fase 2): solo i lotti del suo archivio, senza account Google
   * né regola "solo Wi-Fi". Computer che non risponde o token cambiato → abbinamento tolto (2c).
   */
  const inviaWifi = useCallback(async () => {
    if (!abbinamento || !reteAdatta(rete, true)) return;
    const invia = inviaLottoWifi(abbinamento.a);
    let perso = false;
    await svuotaCoda(DISPOSITIVO, evento, async (...x: Parameters<typeof invia>) => {
      try { await invia(...x); } catch (e) { perso ||= abbinamentoPerso(e); throw e; }
    }, perArchivio(abbinamento.archivio, ScannerLotto.nomeArchivio));
    ricarica();
    if (perso) {
      setAbbinamento(null);
      Alert.alert('Computer scollegato', 'Il computer non risponde: riapri «Ricevi via Wi-Fi» e riabbina.');
    }
  }, [abbinamento, rete, evento, ricarica]);

  /** Un giro della coda: prima il Wi-Fi diretto, poi Drive. `forza`: l'utente ha premuto "Invia ora", vale anche sui dati mobili. */
  const giro = useCallback(async (forza = false) => {
    await inviaWifi();
    if (!driveOk || !reteAdatta(rete, impostazioni.soloWifi && !forza)) return;
    await svuotaCoda(DISPOSITIVO, evento);
    ricarica();
  }, [inviaWifi, driveOk, rete, impostazioni.soloWifi, evento, ricarica]);

  // Rete che cambia, accesso, impostazione: si riprova. Così la coda si svuota da sola a casa.
  useEffect(() => { giro(); }, [giro]);
  useEffect(() => {
    const s = AppState.addEventListener('change', st => { if (st === 'active') { ricarica(); giro(); } });
    return () => s.remove();
  }, [giro, ricarica]);
  useEffect(() => {
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      if (documenti && vista === 'archivio') return false; // ci pensa SezioneDocumenti
      if (daDividere) { setDaDividere(null); return true; }
      if (daRitagliare) { setDaRitagliare(null); return true; }
      if (abbinando) { setAbbinando(false); return true; }
      if (visore !== null) { setVisore(null); return true; }
      if (sceltaCartella) { setSceltaCartella(false); return true; }
      if (scheda) { setScheda(null); return true; }
      if (vista !== 'archivio') { setVista('archivio'); return true; }
      return false;
    });
    return () => s.remove();
  }, [documenti, daDividere, daRitagliare, abbinando, visore, sceltaCartella, scheda, vista]);

  async function esegui(etichetta: string, fn: () => Promise<void> | void) {
    setOccupato(etichetta);
    try {
      await fn();
    } catch (e: any) {
      console.error('[app]', etichetta, e);
      Alert.alert('Errore', `${etichetta}: ${e?.message || String(e)}`);
    } finally {
      setOccupato(null);
    }
  }

  // Lotti di questo archivio (quelli di prima della Fase 10 non hanno archivio: valgono ovunque).
  const delArchivio = lotti.filter(l => !l.archivio || l.archivio === archivio?.nome);
  const inCoda = lotti.filter(l => l.stato === 'in_coda');
  const pagineInCoda = inCoda.reduce((n, l) => n + l.pagine.length, 0);

  const scegliArchivio = (nome: string, nuovo: boolean) => {
    cambiaImpostazioni({ ...impostazioni, archivio: { nome, nuovo }, documenti: false });
    setElenco(elencoLocale(nome));
    setTendina(false);
    setScheda(null);
  };
  const apriDocumenti = () => { cambiaImpostazioni({ ...impostazioni, documenti: true }); setTendina(false); setScheda(null); };

  const nuovaScheda = (segnatura: string, nota: string, cartella: string): SchedaScelta | null => {
    if (!archivio) return null;
    const s = { archivio: archivio.nome, id: Crypto.randomUUID(), segnatura, nota: nota || undefined, cartella: cartella || undefined };
    const tutte = [...schedeNuove(), s];
    salvaSchedeNuove(tutte);
    setNuove(tutte);
    const scelta: SchedaScelta = { tipo: 'nuova', id: s.id, segnatura, nota: s.nota, cartella: s.cartella };
    setSceltaCartella(false);
    setScheda(scelta);
    return scelta;
  };

  // Albero (Fase 14): cartelle aperte per archivio; l'ultima aperta è dove nasce una scheda nuova.
  const aperte = (archivio && impostazioni.aperte?.[archivio.nome]) || [];
  const alterna = (percorso: string) => {
    if (!archivio) return;
    cambiaImpostazioni({ ...impostazioni, aperte: { ...impostazioni.aperte, [archivio.nome]: alternaCartella(aperte, percorso) } });
  };
  const cartellaCorrente = aperte[aperte.length - 1] || '';
  const cartelleArchivio = [...(elenco?.cartelle || []), ...(elenco?.schede || []).map(s => s.cartella), ...nuove.filter(n => n.archivio === archivio?.nome).map(n => n.cartella || '')];

  /** Apre una scheda; per «Senza scheda» i campi mostrano titolo e nota delle pagine in attesa. */
  const apriScheda = (s: SchedaScelta) => {
    if (s.tipo === 'smistare') {
      const ultimo = [...delArchivio].reverse().find(l => l.stato === 'in_coda' && l.destinazione.tipo === 'nessuna');
      setTitoloSmistare(ultimo?.titolo || '');
      setNotaSmistare(ultimo?.nota || '');
    }
    setSceltaCartella(false);
    setScheda(s);
  };

  /**
   * Titolo e nota di «Senza scheda» valgono anche per le pagine in attesa (non per quelle in invio).
   * ponytail: riscrive i manifest a ogni tasto; sono pochi e piccoli. Se pesa: salvare all'uscita dal campo.
   */
  const smistareInAttesa = (titolo: string, nota: string) => {
    for (const l of delArchivio) {
      if (l.stato !== 'in_coda' || l.destinazione.tipo !== 'nessuna' || l.id === invio?.id) continue;
      try {
        aggiorna(salvaBozza({ ...l, titolo: titolo.trim() || undefined, nota: nota.trim() || undefined }));
      } catch (e) {
        console.warn('[app] titolo delle pagine in attesa non salvato', l.id, e);
      }
    }
  };

  /**
   * Segnatura e cartella di una scheda nata qui, finché nessuna sua pagina è partita (Fase 3b):
   * scheda ricordata e lotti in attesa. `cartella: ''` = nessuna.
   */
  const aggiornaSchedaNuova = (s: Extract<SchedaScelta, { tipo: 'nuova' }>, m: { segnatura?: string; cartella?: string }) => esegui('Scheda', () => {
    const segnatura = m.segnatura ?? s.segnatura;
    const cartella = m.cartella !== undefined ? m.cartella || undefined : s.cartella;
    const tutte = schedeNuove().map(n => (n.id === s.id ? { ...n, segnatura, cartella } : n));
    salvaSchedeNuove(tutte);
    setNuove(tutte);
    for (const l of lotti) {
      const d = l.destinazione;
      if (d.tipo !== 'nuova' || d.schedaId !== s.id || l.stato === 'inviato' || l.id === invio?.id) continue;
      const { cartella: _vecchia, ...resto } = d;
      const destinazione = { ...resto, ...(cartella ? { cartella } : {}), campi: { ...d.campi, segnatura } };
      aggiorna(salvaBozza({ ...l, titolo: segnatura, destinazione }));
    }
    setScheda({ ...s, segnatura, cartella });
  });

  /** Toglie una scheda nata qui e non ancora partita, con le sue pagine in attesa. */
  const togliSchedaNuova = (id: string) => {
    for (const l of lotti) if (l.destinazione.tipo === 'nuova' && l.destinazione.schedaId === id && l.stato !== 'inviato' && l.id !== invio?.id) eliminaLotto(l);
    const tutte = schedeNuove().filter(n => n.id !== id);
    salvaSchedeNuove(tutte);
    setNuove(tutte);
    setScheda(null);
    ricarica();
  };
  const eliminaSchedaNuova = (s: Extract<SchedaScelta, { tipo: 'nuova' }>, pagine: number) => Alert.alert(
    `Eliminare «${s.segnatura}»?`,
    pagine === 1 ? 'La pagina non inviata si perde.' : pagine ? `Le ${pagine} pagine non inviate si perdono.` :'La scheda non è ancora sul computer: sparisce dal telefono.',
    [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => esegui('Eliminazione', () => togliSchedaNuova(s.id)) }
    ]
  );

  /** Etichetta della pagina che si sta aggiungendo, se la numerazione automatica è attiva. */
  function etichettaNuova(precedenti: Pagina[]): string | undefined {
    if (!auto) return undefined;
    const ultima = [...precedenti].reverse().find(p => p.etichetta);
    return ultima ? prossimaEtichetta(ultima.etichetta) : cartaIniziale.trim() || undefined;
  }

  // Fase 9: lo scanner ML Kit in serie (pagina dopo pagina, poi «Salva»). BASE = ritaglio,
  // prospettiva e rotazione senza filtri che alterano l'inchiostro. Fase 10: il «Salva» è un
  // lotto per la scheda aperta, in coda appena copiate le pagine.
  // Fase 3a: `appenaCreata` = «Crea e scansiona»; scanner annullato → la scheda vuota non resta.
  const scansiona = (s: SchedaScelta, precedenti: Pagina[], appenaCreata = false) => esegui('Scansione', async () => {
    if (!archivio) return;
    const r = await launchDocumentScannerAsync({
      pageLimit: 100,
      galleryImportAllowed: false,
      scannerMode: ScannerModeOptions.BASE,
      resultFormats: ResultFormatOptions.JPEG
    });
    if (r.canceled || !r.pages?.length) {
      if (appenaCreata && s.tipo === 'nuova') togliSchedaNuova(s.id);
      return;
    }
    let b = nuovoLotto(destinazioneDi(s), {
      archivio: archivio.nome,
      archivioNuovo: archivio.nuovo || undefined,
      titolo: (s.tipo === 'smistare' ? titoloSmistare.trim() : s.segnatura) || undefined,
      nota: s.tipo === 'nuova' ? s.nota : s.tipo === 'smistare' ? notaSmistare.trim() || undefined : undefined
    });
    if (s.tipo === 'smistare') { setTitoloSmistare(''); setNotaSmistare(''); }
    aggiorna(b);
    try {
      for (const uri of r.pages) {
        b = await aggiungiPagina(b, uri, 'documento', { etichetta: etichettaNuova([...precedenti, ...b.pagine]) });
        aggiorna(b);
      }
    } finally {
      // Anche a metà (memoria piena, file sparito): le pagine copiate partono, nessun lotto resta aperto.
      if (b.pagine.length) aggiorna(salvaBozza({ ...b, stato: 'in_coda' }));
      else { eliminaLotto(b); setLotti(ls => ls.filter(l => l.id !== b.id)); }
    }
    setTimeout(() => giro(), 0);
  });

  /**
   * Modifica di una pagina: non del lotto che sta partendo, e un lotto rimasto vuoto si elimina.
   * ponytail: `invio` si accende alla prima pagina caricata; una modifica in quell'istante vale
   * dal giro dopo (pagina tolta → invio fallito e ripetuto). Se dà fastidio: segnale "in partenza" dalla coda.
   */
  const modifica = (b: Bozza, fn: () => Bozza | Promise<Bozza>) => {
    if (invio?.id === b.id) { Alert.alert('Invio in corso', 'Queste pagine stanno partendo: aspetta la fine dell\'invio.'); return; }
    return esegui('Modifica', async () => {
      const nb = await fn();
      if (nb.pagine.length) { aggiorna(nb); return; }
      eliminaLotto(nb);
      setLotti(ls => ls.filter(l => l.id !== nb.id));
    });
  };

  // Azioni del visore (Fase 13).
  const elimina = (b: Bozza, p: Pagina, ultima: boolean) => Alert.alert(
    b.stato === 'inviato' ? 'Togliere dal telefono?' : 'Eliminare la pagina?',
    b.stato === 'inviato' ? 'Il computer ha già questa pagina.' : 'Non è ancora stata inviata: la perdi.',
    [
      { text: 'Annulla', style: 'cancel' },
      { text: b.stato === 'inviato' ? 'Togli' : 'Elimina', style: 'destructive', onPress: () => { if (ultima) setVisore(null); modifica(b, () => rimuoviPagina(b, p.file)); } }
    ]
  );

  // «Rifai questa pagina»: ML Kit per una pagina sola, la foto nuova prende nome ed etichetta della vecchia.
  const rifai = (b: Bozza, p: Pagina) => modifica(b, async () => {
    const r = await launchDocumentScannerAsync({ pageLimit: 1, galleryImportAllowed: false, scannerMode: ScannerModeOptions.BASE, resultFormats: ResultFormatOptions.JPEG });
    return r.canceled || !r.pages?.length ? b : sostituisciPagina(b, p.file, r.pages[0]);
  });

  const recupera = () => esegui('Recupero', async () => {
    for (const id of rotti) await recuperaLotto(id, archivio?.nome);
    ricarica();
    setTimeout(() => giro(), 0);
  });

  const togliInviati = (inviati: Bozza[]) => Alert.alert('Togliere le pagine inviate?', 'Il computer le ha già: spariscono solo dal telefono.', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Togli tutte', style: 'destructive', onPress: () => esegui('Pulizia', () => { inviati.forEach(eliminaLotto); ricarica(); }) }
  ]);

  const nomeRete = !rete.isConnected ? 'offline' : rete.type === NetworkStateType.WIFI ? 'Wi-Fi' : rete.type === NetworkStateType.CELLULAR ? 'dati mobili' : 'rete';
  // Abbinati a un computer, l'account Google non serve: le pagine del suo archivio partono via Wi-Fi.
  const motivo = !utente && !abbinamento ? 'accedi per inviare' : !rete.isConnected ? 'offline' : abbinamento ? undefined
    : !driveOk ? 'account cambiato' : !reteAdatta(rete, impostazioni.soloWifi) ? 'aspetto il Wi-Fi' : undefined;
  const attesa = <Attesa invio={invio} errori={inCoda.filter(l => errori[l.id]).map(l => `${l.titolo || 'Senza scheda'}: ${errori[l.id]}`)} />;

  /** «Invio» nella barra: il numero delle pagine in attesa; toccato le manda subito (anche coi dati mobili). */
  const vaiInvio = {
    etichetta: invio ? `${invio.fatte}/${invio.totali}` : 'Invio',
    descrizione: invio ? `Invio in corso, ${invio.fatte} di ${invio.totali}` : `Invia ora, ${pagineInCoda} ${pagineInCoda === 1 ? 'pagina' : 'pagine'} in attesa${motivo ? ', ' + motivo : ''}`,
    icona: CloudUpload,
    conta: pagineInCoda,
    onPress: () => {
      if (invio) return;
      if (!pagineInCoda) return Alert.alert('Niente da inviare', 'Tutte le pagine sono già partite.');
      if ((!utente && !abbinamento) || !rete.isConnected) return Alert.alert(`${pagineInCoda} ${pagineInCoda === 1 ? 'pagina' : 'pagine'} in attesa`, `Non posso inviarle ora: ${motivo}.`);
      if (utente && !driveOk && impostazioni.account) chiediAccount(impostazioni.account, utente.email, pagineInCoda);
      giro(true);
    }
  };

  const vaiImpostazioni = { etichetta: 'Impostazioni', icona: SlidersHorizontal, onPress: () => { setScheda(null); setVista('impostazioni'); } };
  const accedere = () => esegui('Accesso', async () => setUtente(await accedi()));

  if (abbinando) {
    return <Schermo><Abbina onAnnulla={() => setAbbinando(false)} onAbbinato={(a, nome) => { setAbbinamento({ a, archivio: nome }); setAbbinando(false); }} /></Schermo>;
  }

  if (daDividere) {
    const b = lotti.find(l => l.id === daDividere.lotto);
    if (b) {
      return (
        <Schermo>
          <Dividi
            uri={uriAnteprima(b, b.pagine.find(p => p.file === daDividere.file) ?? b.pagine[0])}
            onAnnulla={() => setDaDividere(null)}
            onDividi={async frazione => {
              await modifica(b, () => dividiPagina(b, daDividere.file, frazione));
              setDaDividere(null);
            }}
          />
        </Schermo>
      );
    }
  }

  if (daRitagliare) {
    const b = lotti.find(l => l.id === daRitagliare.lotto);
    const pg = b?.pagine.find(p => p.file === daRitagliare.file);
    if (b && pg) {
      return (
        <Schermo>
          <Ritaglia
            titolo={`Ritaglia ${pg.etichetta || 'la pagina'}`}
            uri={uriAnteprima(b, pg)}
            onAnnulla={() => setDaRitagliare(null)}
            onRitaglia={async r => {
              await modifica(b, () => ritagliaPagina(b, pg.file, r));
              setDaRitagliare(null);
            }}
          />
          <StatusBar style="auto" />
        </Schermo>
      );
    }
  }

  if (vista === 'impostazioni' && !scheda) {
    return (
      <Schermo>
        <Impostazioni
          email={utente?.email}
          onAccedi={accedere}
          onEsci={() => esegui('Uscita', async () => { await esci(); azzeraCartelle(); setUtente(null); })}
          soloWifi={impostazioni.soloWifi}
          onSoloWifi={v => cambiaImpostazioni({ ...impostazioni, soloWifi: v })}
          nomeRete={nomeRete}
          dopoInvio={impostazioni.dopoInvio}
          onDopoInvio={d => {
            cambiaImpostazioni({ ...impostazioni, dopoInvio: d });
            try { pulisciInviati(d); } catch (e) { console.warn('[app] pulizia delle inviate non riuscita', e); }
            ricarica();
          }}
          abbinamento={abbinamento ? { archivio: abbinamento.archivio, host: abbinamento.a.host } : null}
          archivio={archivio?.nome}
          inCoda={!!inCoda.length}
          invioInCorso={!!invio}
          onAbbina={() => setAbbinando(true)}
          onInviaWifi={inviaWifi}
          onScollega={() => setAbbinamento(null)}
          onIndietro={() => setVista('archivio')}
        />
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  // I Documenti non chiedono archivio né account: si aprono anche dalla prima schermata.
  if (documenti) {
    return (
      <>
        <SezioneDocumenti invio={vaiInvio} impostazioni={vaiImpostazioni} onCambiaArchivio={() => setTendina(true)} />
        {tendina && <TendinaArchivi archivi={archivi} attuale={archivio} inDocumenti onScegli={scegliArchivio} onDocumenti={() => setTendina(false)} onChiudi={() => setTendina(false)} />}
      </>
    );
  }

  if (!archivio) {
    return (
      <Schermo>
        <TendinaArchivi
          archivi={archivi}
          onScegli={scegliArchivio}
          onDocumenti={apriDocumenti}
          testa={utente ? null : <Pulsante variante="primario" icona={LogIn} titolo="Accedi con Google" onPress={accedere} style={{ marginHorizontal: 16 }} />}
        />
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  if (scheda) {
    const k = chiaveScelta(scheda);
    const suoi = delArchivio.filter(l => chiaveDestinazione(l.destinazione) === k);
    const precedenti = suoi.flatMap(l => l.pagine);
    const daInviare = suoi.filter(l => l.stato !== 'inviato');
    const inviati = suoi.filter(l => l.stato === 'inviato');
    const titoloScheda = scheda.tipo === 'smistare' ? 'Senza scheda' : scheda.segnatura || scheda.id;
    // La cartella di una scheda nata qui si cambia finché il computer non l'ha creata.
    const cartellaCambiabile = scheda.tipo === 'nuova' && !inviati.length && !suoi.some(l => l.id === invio?.id)
      && !nuove.find(n => n.id === scheda.id)?.partita && !elenco?.schede.some(s => s.id === scheda.id);

    if (sceltaCartella && scheda.tipo === 'nuova' && cartellaCambiabile) {
      return (
        <Schermo>
          <ScegliCartella titolo={`Cartella di «${titoloScheda}»`} sotto={archivio.nome} cartelle={cartelleArchivio} attuale={scheda.cartella || ''}
            onScegli={v => { setSceltaCartella(false); aggiornaSchedaNuova(scheda, { cartella: v }); }} onIndietro={() => setSceltaCartella(false)} />
          <StatusBar style="auto" />
        </Schermo>
      );
    }

    // Stesso ordine della griglia: prima le da inviare, poi le inviate.
    const sorgenti = [
      ...daInviare.flatMap(b => b.pagine.map(pg => ({ b, pg, stato: invio?.id === b.id ? 'invio' as const : undefined }))),
      ...inviati.flatMap(b => b.pagine.map(pg => ({ b, pg, stato: 'inviata' as const })))
    ];
    const pagineVisore: PaginaVisore[] = sorgenti.map(({ b, pg, stato }) => ({
      chiave: b.id + pg.file + pg.sha256, uri: uriAnteprima(b, pg), etichetta: pg.etichetta, doppia: !!pg.doppia, stato, inviatoIl: b.inviatoIl
    }));
    if (visore !== null && sorgenti.length) {
      const su = (fn: (b: Bozza, pg: Pagina) => void) => (i: number) => fn(sorgenti[i].b, sorgenti[i].pg);
      return (
        <Schermo>
          <Visore
            titolo={titoloScheda}
            pagine={pagineVisore}
            indice={visore}
            onIndice={setVisore}
            dopoInvio={impostazioni.dopoInvio}
            occupato={!!occupato}
            onChiudi={() => setVisore(null)}
            onEtichetta={(i, t) => aggiorna(etichettaPagina(sorgenti[i].b, sorgenti[i].pg.file, t))}
            onRuota={su((b, p) => modifica(b, () => ruotaPagina(b, p.file)))}
            onRitaglia={su((b, p) => setDaRitagliare({ lotto: b.id, file: p.file }))}
            onRifai={su(rifai)}
            onDividi={su((b, p) => setDaDividere({ lotto: b.id, file: p.file }))}
            onElimina={su((b, p) => elimina(b, p, sorgenti.length === 1))}
          />
          <StatusBar style="auto" />
        </Schermo>
      );
    }

    return (
      <Schermo conBarra>
        <Scheda
          scheda={scheda}
          archivio={archivio.nome}
          lotti={daInviare}
          inviati={inviati}
          dopoInvio={impostazioni.dopoInvio}
          onApri={setVisore}
          onTogliInviate={() => togliInviati(inviati)}
          inInvio={invio?.id}
          attesa={attesa}
          numera={auto}
          onNumera={setAuto}
          cartaIniziale={cartaIniziale}
          onCartaIniziale={setCartaIniziale}
          titoloSmistare={titoloSmistare}
          onTitoloSmistare={v => { setTitoloSmistare(v); smistareInAttesa(v, notaSmistare); }}
          notaSmistare={notaSmistare}
          onNotaSmistare={v => { setNotaSmistare(v); smistareInAttesa(titoloSmistare, v); }}
          onCambiaCartella={cartellaCambiabile ? () => setSceltaCartella(true) : undefined}
          onRinomina={cartellaCambiabile && scheda.tipo === 'nuova' ? v => aggiornaSchedaNuova(scheda, { segnatura: v }) : undefined}
          onElimina={cartellaCambiabile && scheda.tipo === 'nuova' ? () => eliminaSchedaNuova(scheda, precedenti.length) : undefined}
          onIndietro={() => setScheda(null)}
        />
        <BarraFondo
          sinistra={vaiInvio}
          centro={{ etichetta: `Scansiona pagine ${scheda.tipo === 'smistare' ? 'senza scheda' : `di ${scheda.segnatura}`}`, icona: ScanLine, onPress: () => scansiona(scheda, precedenti), disabilitata: !!occupato }}
          destra={vaiImpostazioni}
        />
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  // Schede con pagine sul telefono, raggruppate (una scheda può avere più lotti), nell'ordine
  // della griglia della scheda: l'indice di una miniatura è quello del visore.
  const gruppi = new Map<string, SchedaInAttesa>();
  for (const l of delArchivio) {
    if (l.stato === 'inviato') continue;
    const s = sceltaDelLotto(l);
    const k = chiaveScelta(s);
    const g = gruppi.get(k) ?? { scelta: s, pagine: 0, anteprime: [] };
    if (!gruppi.has(k)) {
      const cartella = s.tipo === 'nuova' ? s.cartella : s.tipo === 'esistente' ? elenco?.schede.find(x => x.id === s.id)?.cartella : undefined;
      g.riassunto = s.tipo === 'smistare' ? undefined : [cartella && percorsoLeggibile(cartella), s.tipo === 'nuova' && 'creata qui'].filter(Boolean).join(' · ');
      gruppi.set(k, g);
    }
    if (s.tipo === 'smistare' && !g.riassunto) g.riassunto = l.titolo || l.nota?.split('\n')[0] || undefined;
    g.pagine += l.pagine.length;
    for (const pg of l.pagine) if (g.anteprime.length < 4) g.anteprime.push({ uri: uriAnteprima(l, pg), etichetta: pg.etichetta });
  }
  const statoInvio = invio ? `invio ${invio.fatte}/${invio.totali}` : motivo || 'in partenza';
  const precedentiSmistare = delArchivio.filter(l => l.destinazione.tipo === 'nessuna').flatMap(l => l.pagine);

  return (
    <Schermo conBarra>
      <Archivio
        archivio={archivio}
        elenco={elenco}
        nuove={nuove.filter(s => s.archivio === archivio.nome)}
        inAttesa={[...gruppi.values()]}
        statoInvio={statoInvio}
        onInviaOra={vaiInvio.onPress}
        aperte={aperte}
        onAlterna={alterna}
        attesa={attesa}
        onApri={apriScheda}
        onApriPagina={(s, i) => { apriScheda(s); setVisore(i); }}
        onCambiaArchivio={() => setTendina(true)}
        daRecuperare={rotti.length}
        onRecupera={recupera}
      />
      <BarraFondo
        sinistra={vaiInvio}
        centro={{ etichetta: 'Scansiona o crea una scheda', icona: Plus, onPress: () => setMenuPiu(true), disabilitata: !!occupato }}
        destra={vaiImpostazioni}
      />
      {tendina && <TendinaArchivi archivi={archivi} attuale={archivio} onScegli={scegliArchivio} onDocumenti={apriDocumenti} onChiudi={() => setTendina(false)} />}
      <MenuPiu
        visibile={menuPiu}
        onChiudi={() => setMenuPiu(false)}
        voci={[
          { titolo: 'Nuova scheda', sotto: cartellaCorrente ? `in «${percorsoLeggibile(cartellaCorrente)}»` : 'senza cartella', icona: FilePlus, onPress: () => setFoglioNuovo(true) },
          { titolo: 'Scannerizza senza scheda', sotto: 'da smistare al computer', icona: ScanLine, onPress: () => { const s: SchedaScelta = { tipo: 'smistare' }; apriScheda(s); scansiona(s, precedentiSmistare); } }
        ]}
      />
      <Nuovo
        visibile={foglioNuovo}
        archivio={archivio.nome}
        cartelle={cartelleArchivio}
        cartellaIniziale={cartellaCorrente}
        onChiudi={() => setFoglioNuovo(false)}
        onNuova={(segnatura, nota, cartella) => { const s = nuovaScheda(segnatura, nota, cartella); if (s) scansiona(s, [], true); }}
      />
      <StatusBar style="auto" />
    </Schermo>
  );
}
