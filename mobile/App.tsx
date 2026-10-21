import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform } from 'react-native';
import { Avvisi, avviso, notizia } from './src/ui/Avviso';
import { useIncomingShare } from 'expo-sharing';
import { nuovoDocumento } from './src/documenti';
import { nomeAutomatico } from './src/elencoDocumenti';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useNetworkState, NetworkStateType } from 'expo-network';
import * as Crypto from 'expo-crypto';
import { launchDocumentScannerAsync, ResultFormatOptions, ScannerModeOptions } from '@infinitered/react-native-mlkit-document-scanner';
import { CloudUpload, FilePlus, LogIn, Plus, ScanLine, SlidersHorizontal } from 'lucide-react-native';
import { accedi, esci, utenteSilenzioso, type Utente } from './src/accesso';
import { chiediFotocamera, prontoAScansionare } from './src/consenso';
import { azzeraCartelle, type Avanzamento } from './src/drive';
import { Dividi } from './src/Dividi';
import { messaggioErrore } from './src/errori';
import { aggiungiPagina, chiudiAperti, controllaSfocate, dividiPagina, elencaLotti, eliminaLotto, leggiLotti, recuperaLotto, etichettaPagina, notaPagina, nuovoLotto, pulisciInviati, rimuoviPagina, ritagliaPagina, ruotaPagina, salvaBozza, sostituisciPagina, uriAnteprima, type Bozza } from './src/lotti';
import { aggiornaArchivi, aggiornaElenco, archiviLocali, benvenutoFatto, elencoLocale, leggiImpostazioni, reteAdatta, salvaImpostazioni, salvaSchedeNuove, schedeNuove, segnaBenvenuto, svuotaCoda, type EventoCoda, type Impostazioni as ImpostazioniApp } from './src/coda';
import { alternaCartella, chiaveDestinazione, destinazioneDi, perArchivio, percorsoLeggibile, type SchedaScelta } from './src/scelta';
import { prossimaEtichetta } from './src/etichette';
import { Abbina } from './src/Abbina';
import { cercaAggiornamento, installaAggiornamento } from './src/aggiornaApp';
import type { Nuova } from './src/aggiornamento';
import { abbinamentoPerso, inviaLottoWifi, type Abbinamento } from './src/wifi';
import { ScannerLotto, type Modalita, type Pagina } from './src/contratto';
import { File } from 'expo-file-system';
import Nativo from './modules/nativo';
import { Fotocamera } from './src/schermate/Fotocamera';
import { Archivio, type SchedaInAttesa } from './src/schermate/Archivio';
import { Benvenuto } from './src/schermate/Benvenuto';
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
import { copiaDocumenti, ripristinaDocumenti, statoCopia } from './src/copiaDocumenti';
import { impostaLingua, t } from './src/lingua';

const DISPOSITIVO = Platform.OS === 'android' ? `${Platform.constants.Manufacturer} ${Platform.constants.Model}` : Platform.OS;

function sceltaDelLotto(b: Bozza): SchedaScelta {
  const d = b.destinazione;
  if (d.tipo === 'nessuna') return { tipo: 'smistare' };
  if (d.tipo === 'esistente') return { tipo: 'esistente', id: d.schedaId, segnatura: b.titolo || d.schedaId };
  return { tipo: 'nuova', id: d.schedaId || b.id, segnatura: d.campi.segnatura || b.titolo || '', nota: b.nota, cartella: d.cartella };
}

const chiaveScelta = (s: SchedaScelta) => (s.tipo === 'smistare' ? '' : s.id);

export default function App() {
  // ponytail: si perde l'abbinamento Wi-Fi (va rifatto col QR); è raro.
  const [giro, setGiro] = useState(0);  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><Principale key={giro} riapriImpostazioni={giro > 0} onLingua={() => setGiro(g => g + 1)} /><Avvisi key={`avvisi${giro}`} /></SafeAreaProvider></GestureHandlerRootView>;
}

function Principale({ riapriImpostazioni, onLingua }: { riapriImpostazioni: boolean; onLingua: () => void }) {
  const [utente, setUtente] = useState<Utente | null>(null);
  const [nuova, setNuova] = useState<Nuova | null>(null);
  const [lotti, setLotti] = useState<Bozza[]>([]);
  const [rotti, setRotti] = useState<string[]>([]);
  const [impostazioni, setImpostazioni] = useState<ImpostazioniApp>(() => {
    const i = leggiImpostazioni();
    impostaLingua(i.lingua);
    return i;
  });
  const archivio = impostazioni.archivio;
  const [archivi, setArchivi] = useState(archiviLocali);
  const [tendina, setTendina] = useState(false);
  const [elenco, setElenco] = useState(() => elencoLocale(archivio?.nome));
  const [nuove, setNuove] = useState(schedeNuove);
  const [scheda, setScheda] = useState<SchedaScelta | null>(null);
  const [vista, setVista] = useState<'archivio' | 'impostazioni'>(riapriImpostazioni ? 'impostazioni' : 'archivio');
  const [benvenuto, setBenvenuto] = useState(() => !benvenutoFatto());
  const documenti = !!impostazioni.documenti;
  const [foglioNuovo, setFoglioNuovo] = useState(false);
  const [menuPiu, setMenuPiu] = useState(false);
  const [sceltaCartella, setSceltaCartella] = useState(false);
  const [occupato, setOccupato] = useState<string | null>(null);
  const [invio, setInvio] = useState<{ id: string } & Avanzamento | null>(null);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [auto, setAuto] = useState(false);
  const [cartaIniziale, setCartaIniziale] = useState('1r');
  const [titoloSmistare, setTitoloSmistare] = useState('');
  const [notaSmistare, setNotaSmistare] = useState('');
  const [daDividere, setDaDividere] = useState<{ lotto: string; file: string } | null>(null);
  const [daRitagliare, setDaRitagliare] = useState<{ lotto: string; file: string } | null>(null);
  const [visore, setVisore] = useState<number | null>(null);
  const [fotoLibera, setFotoLibera] = useState(false);
  const [abbinando, setAbbinando] = useState(false);
  const [abbinamento, setAbbinamento] = useState<{ a: Abbinamento; archivio: string } | null>(null);
  const rete = useNetworkState();

  const cambiaImpostazioni = (i: ImpostazioniApp) => { salvaImpostazioni(i); impostaLingua(i.lingua); setImpostazioni(i); };

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
      avviso(t('Errore'), t('Lettura delle scansioni: {motivo}', { motivo: e?.message || String(e) }));
    }
  }, []);
  const aggiorna = (b: Bozza) => setLotti(ls => (ls.some(l => l.id === b.id) ? ls.map(l => (l.id === b.id ? b : l)) : [...ls, b]));
  const scarta = (b: Bozza) => { eliminaLotto(b); setLotti(ls => ls.filter(l => l.id !== b.id)); };

  useEffect(() => {
    utenteSilenzioso().then(setUtente);
    Nativo.preparaScanner().catch(e => console.warn('[app] modulo dello scanner non scaricato in anticipo', e));
    try { chiudiAperti(); } catch (e) { console.warn('[app] lotti aperti non chiusi', e); }
    try { pulisciInviati(leggiImpostazioni().dopoInvio); } catch (e) { console.warn('[app] pulizia delle inviate non riuscita', e); }
    ricarica();
    cercaAggiornamento().then(n => {
      if (!n) return;
      setNuova(n);
      avviso(`ArchiScanner ${n.versione}`, t('È uscita una versione nuova dell\'app. Le pagine in attesa restano dove sono.'), [
        { text: t('Più tardi'), style: 'cancel' },
        { text: t('Aggiorna'), onPress: () => installaNuova(n) }
      ]);
    });
  }, [ricarica]);

  const evento = useCallback((e: EventoCoda) => {
    if (e.tipo === 'lotto') { setInvio({ id: e.id, ...e.avanzamento }); return; }
    setInvio(null);
    if (e.tipo === 'inviato') {
      setErrori(({ [e.id]: _, ...resto }) => resto);
      ricarica();
      setNuove(schedeNuove());
    } else {
      setErrori(er => ({ ...er, [e.id]: messaggioErrore(e.messaggio) }));
    }
  }, [ricarica]);

  const driveOk = !!utente && impostazioni.account === utente.email;
  const chiediAccount = (vecchio: string, nuovo: string, n: number) => avviso(
    t('Account cambiato'),
    n === 1 ? t('1 pagina scansionata con {vecchio}: inviarla a {nuovo}?', { vecchio, nuovo }) : t('{n} pagine scansionate con {vecchio}: inviarle a {nuovo}?', { n, vecchio, nuovo }),
    [
      { text: t('Mantieni in attesa'), style: 'cancel' },
      { text: t('Invia'), onPress: () => cambiaImpostazioni({ ...leggiImpostazioni(), account: nuovo }) }
    ]
  );
  useEffect(() => {
    if (!utente || impostazioni.account === utente.email) return;
    const n = elencaLotti().filter(l => l.stato === 'in_coda').reduce((t, l) => t + l.pagine.length, 0);
    if (impostazioni.account && n) chiediAccount(impostazioni.account, utente.email, n);
    else cambiaImpostazioni({ ...leggiImpostazioni(), account: utente.email });
  }, [utente?.email]);

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
      avviso(t('Computer scollegato'), t('Il computer non risponde: riapri «Ricevi via Wi-Fi» e riabbina.'));
    }
  }, [abbinamento, rete, evento, ricarica]);

  const condivise = useIncomingShare();
  const [arrivi, setArrivi] = useState(0);
  useEffect(() => {
    const uris = condivise.resolvedSharedPayloads
      .filter(x => x.contentUri && (x.contentMimeType ?? x.mimeType ?? '').startsWith('image/'))
      .map(x => x.contentUri!);
    if (!uris.length) return;
    condivise.clearSharedPayloads();
    esegui(t('Immagini condivise'), async () => {
      const d = await nuovoDocumento(nomeAutomatico(new Date()), '', uris);
      if (!d) return;
      cambiaImpostazioni({ ...leggiImpostazioni(), documenti: true });
      setArrivi(n => n + 1);
      notizia(d.pagine.length === 1 ? t('Un\'immagine in «{nome}»', { nome: d.nome }) : t('{n} immagini in «{nome}»', { n: d.pagine.length, nome: d.nome }), true);
    });
  }, [condivise.resolvedSharedPayloads]);

  const copiaInCorso = useRef(false);
  const giro = useCallback(async (forza = false) => {
    await inviaWifi();
    if (!driveOk || !reteAdatta(rete, impostazioni.soloWifi && !forza)) return;
    await svuotaCoda(DISPOSITIVO, evento);
    ricarica();
    if (!impostazioni.copiaDocumenti || !reteAdatta(rete, true) || copiaInCorso.current) return;
    copiaInCorso.current = true;
    try { await copiaDocumenti(); }
    catch (e) { console.warn('[app] copia dei Documenti non riuscita, riprovo al prossimo giro', e); }
    finally { copiaInCorso.current = false; }
  }, [inviaWifi, driveOk, rete, impostazioni.soloWifi, impostazioni.copiaDocumenti, evento, ricarica]);

  useEffect(() => { giro(); }, [giro]);
  useEffect(() => {
    const s = AppState.addEventListener('change', st => { if (st === 'active') { ricarica(); giro(); } });
    return () => s.remove();
  }, [giro, ricarica]);
  useEffect(() => {
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      if (benvenuto) return false;
      if (documenti && vista === 'archivio') return false;
      if (fotoLibera) return false;
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
  }, [benvenuto, documenti, fotoLibera, daDividere, daRitagliare, abbinando, visore, sceltaCartella, scheda, vista]);

  async function esegui(etichetta: string, fn: () => Promise<void> | void) {
    setOccupato(etichetta);
    try {
      await fn();
    } catch (e: any) {
      console.error('[app]', etichetta, e);
      avviso(t('Errore'), `${etichetta}: ${e?.message || String(e)}`);
    } finally {
      setOccupato(null);
    }
  }

  const installaNuova = (n: Nuova) => esegui(t('Aggiornamento'), () => installaAggiornamento(n));

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

  const aperte = (archivio && impostazioni.aperte?.[archivio.nome]) || [];
  const alterna = (percorso: string) => {
    if (!archivio) return;
    cambiaImpostazioni({ ...impostazioni, aperte: { ...impostazioni.aperte, [archivio.nome]: alternaCartella(aperte, percorso) } });
  };
  const cartellaCorrente = aperte[aperte.length - 1] || '';
  const cartelleArchivio = [...(elenco?.cartelle || []), ...(elenco?.schede || []).map(s => s.cartella), ...nuove.filter(n => n.archivio === archivio?.nome).map(n => n.cartella || '')];

  const apriScheda = (s: SchedaScelta) => {
    if (s.tipo === 'smistare') {
      const ultimo = [...delArchivio].reverse().find(l => l.stato === 'in_coda' && l.destinazione.tipo === 'nessuna');
      setTitoloSmistare(ultimo?.titolo || '');
      setNotaSmistare(ultimo?.nota || '');
    }
    setSceltaCartella(false);
    setScheda(s);
  };

  /** ponytail: riscrive i manifest a ogni tasto; sono pochi e piccoli. Se pesa: salvare all'uscita dal campo.
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

  const aggiornaSchedaNuova = (s: Extract<SchedaScelta, { tipo: 'nuova' }>, m: { segnatura?: string; cartella?: string }) => esegui(t('Scheda'), () => {
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

  const togliSchedaNuova = (id: string) => {
    for (const l of lotti) if (l.destinazione.tipo === 'nuova' && l.destinazione.schedaId === id && l.stato !== 'inviato' && l.id !== invio?.id) eliminaLotto(l);
    const tutte = schedeNuove().filter(n => n.id !== id);
    salvaSchedeNuove(tutte);
    setNuove(tutte);
    setScheda(null);
    ricarica();
  };
  const eliminaSchedaNuova = (s: Extract<SchedaScelta, { tipo: 'nuova' }>, pagine: number) => avviso(
    t('Eliminare «{nome}»?', { nome: s.segnatura }),
    pagine === 1 ? t('La pagina non inviata si perde.') : pagine ? t('Le {n} pagine non inviate si perdono.', { n: pagine }) : t('La scheda non è ancora sul computer: sparisce dal telefono.'),
    [
      { text: t('Annulla'), style: 'cancel' },
      { text: t('Elimina'), style: 'destructive', onPress: () => esegui(t('Eliminazione'), () => togliSchedaNuova(s.id)) }
    ]
  );

  function etichettaNuova(precedenti: Pagina[]): string | undefined {
    if (!auto) return undefined;
    const ultima = [...precedenti].reverse().find(p => p.etichetta && p.modalita !== 'grezza');
    return ultima ? prossimaEtichetta(ultima.etichetta) : cartaIniziale.trim() || undefined;
  }

  const scansiona = (s: SchedaScelta, precedenti: Pagina[], appenaCreata = false) => esegui(t('Scansione'), async () => {
    if (!archivio) return;
    if (!await prontoAScansionare()) {
      if (appenaCreata && s.tipo === 'nuova') togliSchedaNuova(s.id);
      return;
    }
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
    await salvaPagine(s, r.pages, 'documento', precedenti);
  });

  const salvaPagine = async (s: SchedaScelta, uris: string[], modalita: Modalita, precedenti: Pagina[]) => {
    if (!archivio) return;
    let b = nuovoLotto(destinazioneDi(s), {
      archivio: archivio.nome,
      archivioNuovo: archivio.nuovo || undefined,
      titolo: (s.tipo === 'smistare' ? titoloSmistare.trim() : s.segnatura) || undefined,
      nota: s.tipo === 'nuova' ? s.nota : s.tipo === 'smistare' ? notaSmistare.trim() || undefined : undefined
    });
    if (s.tipo === 'smistare') { setTitoloSmistare(''); setNotaSmistare(''); }
    b = await riempiLotto(b, uris, modalita, x => (modalita === 'grezza' ? undefined : etichettaNuova([...precedenti, ...x.pagine])), true);
    misuraSfocate(b, b.pagine.map(p => p.file));
    if (b.pagine.length && s.tipo === 'esistente' && elenco?.schede.some(x => x.id === s.id && x.daVedere)) {
      const ora = leggiImpostazioni();
      const gia = ora.viste?.[archivio.nome] || [];
      if (!gia.includes(s.id)) cambiaImpostazioni({ ...ora, viste: { ...ora.viste, [archivio.nome]: [...gia, s.id] } });
    }
  };

  const fineFotoLibera = (s: SchedaScelta, uris: string[], precedenti: Pagina[]) => {
    setFotoLibera(false);
    if (!uris.length) return;
    esegui(t('Foto libera'), async () => {
      try { await salvaPagine(s, uris, 'grezza', precedenti); }
      finally {
        for (const u of uris) { try { const f = new File(u); if (f.exists) f.delete(); } catch (e) { console.warn('[app] foto temporanea non eliminata', u, e); } }
      }
    });
  };

  const mandaDaDocumento = async (titolo: string, uris: string[]) => {
    if (!archivio) return;
    await riempiLotto(nuovoLotto({ tipo: 'nessuna' }, { archivio: archivio.nome, archivioNuovo: archivio.nuovo || undefined, titolo }), uris, 'documento');
  };

  const riempiLotto = async (b: Bozza, uris: string[], modalita: Modalita, etichetta?: (b: Bozza) => string | undefined, sposta = false) => {
    const inizio = Date.now();
    try {
      for (const uri of uris) b = await aggiungiPagina(b, uri, modalita, { etichetta: etichetta?.(b), sposta });
    } finally {
      if (b.pagine.length) aggiorna(salvaBozza({ ...b, stato: 'in_coda' }));
      else scarta(b);
    }
    if (__DEV__) console.log(`[scansione] ${uris.length} pagine salvate in ${Date.now() - inizio} ms`);
    setTimeout(() => giro(), 0);
    return b;
  };

  const misuraSfocate = (b: Bozza, file: string[]) => {
    controllaSfocate(b, file)
      .then(nb => { if (nb) aggiorna(nb); })
      .catch(e => console.warn('[app] nitidezza non misurata', b.id, e));
  };

  /** ponytail: `invio` si accende alla prima pagina caricata; una modifica in quell'istante vale
   * dal giro dopo (pagina tolta → invio fallito e ripetuto). Se dà fastidio: segnale "in partenza" dalla coda.
   */
  const modifica = (b: Bozza, fn: () => Bozza | Promise<Bozza>) => {
    if (invio?.id === b.id) { avviso(t('Invio in corso'), t('Queste pagine stanno partendo: aspetta la fine dell\'invio.')); return; }
    return esegui(t('Modifica'), async () => {
      const nb = await fn();
      if (nb.pagine.length) aggiorna(nb); else scarta(nb);
    });
  };

  const elimina = (b: Bozza, p: Pagina, ultima: boolean) => avviso(
    b.stato === 'inviato' ? t('Rimuovere dal telefono?') : t('Eliminare la pagina?'),
    b.stato === 'inviato' ? t('Il computer ha già questa pagina.') : t('Non è ancora stata inviata: la perdi.'),
    [
      { text: t('Annulla'), style: 'cancel' },
      { text: b.stato === 'inviato' ? t('Rimuovi') : t('Elimina'), style: 'destructive', onPress: () => { if (ultima) setVisore(null); modifica(b, () => rimuoviPagina(b, p.file)); } }
    ]
  );

  const rifai = (b: Bozza, p: Pagina) => modifica(b, async () => {
    if (!await chiediFotocamera()) return b;
    const r = await launchDocumentScannerAsync({ pageLimit: 1, galleryImportAllowed: false, scannerMode: ScannerModeOptions.BASE, resultFormats: ResultFormatOptions.JPEG });
    if (r.canceled || !r.pages?.length) return b;
    const nb = await sostituisciPagina(b, p.file, r.pages[0]);
    setTimeout(() => misuraSfocate(nb, [p.file]), 0);
    return nb;
  });

  const recupera = () => esegui(t('Recupero'), async () => {
    for (const id of rotti) await recuperaLotto(id, archivio?.nome);
    ricarica();
    setTimeout(() => giro(), 0);
  });

  const togliInviati = (inviati: Bozza[]) => avviso(t('Rimuovere le pagine inviate?'), t('Il computer le ha già: spariscono solo dal telefono.'), [
    { text: t('Annulla'), style: 'cancel' },
    { text: t('Rimuovi tutte'), style: 'destructive', onPress: () => esegui(t('Pulizia'), () => { inviati.forEach(eliminaLotto); ricarica(); }) }
  ]);

  const nomeRete = !rete.isConnected ? t('offline') : rete.type === NetworkStateType.WIFI ? 'Wi-Fi' : rete.type === NetworkStateType.CELLULAR ? t('dati mobili') : t('rete');
  const motivo = !utente && !abbinamento ? t('accedi per inviare') : !rete.isConnected ? t('offline') : abbinamento ? undefined
    : !driveOk ? t('account cambiato') : !reteAdatta(rete, impostazioni.soloWifi) ? t('aspetto il Wi-Fi') : undefined;
  const attesa = <Attesa invio={invio} errori={inCoda.filter(l => errori[l.id]).map(l => `${l.titolo || t('Senza scheda')}: ${errori[l.id]}`)} />;
  const quantePagine = (n: number) => (n === 1 ? t('1 pagina in attesa') : t('{n} pagine in attesa', { n }));

  const vaiInvio = {
    etichetta: invio ? `${invio.fatte}/${invio.totali}` : t('Invio'),
    descrizione: invio ? t('Invio in corso, {fatte} di {totali}', invio) : `${t('Invia ora')}, ${quantePagine(pagineInCoda)}${motivo ? ', ' + motivo : ''}`,
    icona: CloudUpload,
    conta: pagineInCoda,
    onPress: () => {
      if (invio) return;
      if (!pagineInCoda) return avviso(t('Niente da inviare'), t('Tutte le pagine sono già partite.'));
      if ((!utente && !abbinamento) || !rete.isConnected) return avviso(quantePagine(pagineInCoda), t('Non posso inviarle ora: {motivo}.', { motivo: motivo || '' }));
      if (utente && !driveOk && impostazioni.account) chiediAccount(impostazioni.account, utente.email, pagineInCoda);
      giro(true);
    }
  };

  const vaiImpostazioni = { etichetta: t('Impostazioni'), icona: SlidersHorizontal, onPress: () => { setScheda(null); setVista('impostazioni'); } };
  const accedere = () => esegui(t('Accesso'), async () => setUtente(await accedi()));

  if (benvenuto) {
    return (
      <Schermo>
        <Benvenuto
          dopoInvio={impostazioni.dopoInvio}
          soloWifi={impostazioni.soloWifi}
          email={utente?.email}
          onAccedi={accedere}
          onFine={(dopoInvio, soloWifi) => {
            try {
              cambiaImpostazioni({ ...impostazioni, dopoInvio, soloWifi });
              segnaBenvenuto();
            } catch (e: any) {
              avviso(t('Errore'), t('Scelte del benvenuto non salvate: {motivo}', { motivo: e?.message || String(e) }));
            }
            setBenvenuto(false);
          }}
        />
        <StatusBar style="auto" />
      </Schermo>
    );
  }

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
            titolo={pg.etichetta ? t('Ritaglia {etichetta}', { etichetta: pg.etichetta }) : t('Ritaglia la pagina')}
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
          onEsci={() => esegui(t('Uscita'), async () => { await esci(); azzeraCartelle(); setUtente(null); })}
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
          copiaDocumenti={!!impostazioni.copiaDocumenti}
          ultimaCopia={statoCopia().ultima}
          onCopiaDocumenti={v => cambiaImpostazioni({ ...impostazioni, copiaDocumenti: v })}
          onRipristina={() => esegui(t('Ripristino dei Documenti'), async () => {
            const n = await ripristinaDocumenti();
            avviso(t('Ripristino'), n === 1 ? t('Un documento ripristinato da Drive.') : n ? t('{n} documenti ripristinati da Drive.', { n }) : t('Su Drive non c\'è nessun documento che manchi qui.'));
          })}
          lingua={impostazioni.lingua || 'auto'}
          onLingua={l => { cambiaImpostazioni({ ...impostazioni, lingua: l === 'auto' ? undefined : l }); onLingua(); }}
          onIndietro={() => setVista('archivio')}
          nuova={nuova}
          onAggiorna={installaNuova}
        />
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  if (documenti) {
    return (
      <>
        <SezioneDocumenti key={arrivi} invio={vaiInvio} impostazioni={vaiImpostazioni} onCambiaArchivio={() => setTendina(true)}
          archivio={archivio ? { nome: archivio.nome, onManda: mandaDaDocumento } : undefined} />
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
          testa={utente ? null : <Pulsante variante="primario" icona={LogIn} titolo={t('Accedi con Google')} onPress={accedere} style={{ marginHorizontal: 16 }} />}
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
    const titoloScheda = scheda.tipo === 'smistare' ? t('Senza scheda') : scheda.segnatura || scheda.id;
    const cartellaCambiabile = scheda.tipo === 'nuova' && !inviati.length && !suoi.some(l => l.id === invio?.id)
      && !nuove.find(n => n.id === scheda.id)?.partita && !elenco?.schede.some(s => s.id === scheda.id);

    if (fotoLibera) {
      return (
        <Schermo>
          <Fotocamera titolo={titoloScheda} onFine={uris => fineFotoLibera(scheda, uris, precedenti)} />
          <StatusBar style="light" />
        </Schermo>
      );
    }

    if (sceltaCartella && scheda.tipo === 'nuova' && cartellaCambiabile) {
      return (
        <Schermo>
          <ScegliCartella titolo={t('Cartella di «{nome}»', { nome: titoloScheda })} sotto={archivio.nome} cartelle={cartelleArchivio} attuale={scheda.cartella || ''}
            onScegli={v => { setSceltaCartella(false); aggiornaSchedaNuova(scheda, { cartella: v }); }} onIndietro={() => setSceltaCartella(false)} />
          <StatusBar style="auto" />
        </Schermo>
      );
    }

    const sorgenti = [
      ...daInviare.flatMap(b => b.pagine.map(pg => ({ b, pg, stato: invio?.id === b.id ? 'invio' as const : undefined }))),
      ...inviati.flatMap(b => b.pagine.map(pg => ({ b, pg, stato: 'inviata' as const })))
    ];
    const pagineVisore: PaginaVisore[] = sorgenti.map(({ b, pg, stato }) => ({
      chiave: b.id + pg.file + pg.sha256, uri: uriAnteprima(b, pg), etichetta: pg.etichetta, nota: pg.nota, doppia: !!pg.doppia, stato, inviatoIl: b.inviatoIl,
      sfocata: !!b.sfocate?.includes(pg.file)
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
            onNota={(i, t) => aggiorna(notaPagina(sorgenti[i].b, sorgenti[i].pg.file, t))}
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
          onFotoLibera={() => esegui(t('Foto libera'), async () => { if (await prontoAScansionare()) setFotoLibera(true); })}
          onRinomina={cartellaCambiabile && scheda.tipo === 'nuova' ? v => aggiornaSchedaNuova(scheda, { segnatura: v }) : undefined}
          onElimina={cartellaCambiabile && scheda.tipo === 'nuova' ? () => eliminaSchedaNuova(scheda, precedenti.length) : undefined}
          onIndietro={() => setScheda(null)}
        />
        <BarraFondo
          sinistra={vaiInvio}
          centro={{ etichetta: scheda.tipo === 'smistare' ? t('Scansiona pagine senza scheda') : t('Scansiona pagine di {nome}', { nome: scheda.segnatura }), icona: ScanLine, onPress: () => scansiona(scheda, precedenti), disabilitata: !!occupato }}
          destra={vaiImpostazioni}
        />
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  const gruppi = new Map<string, SchedaInAttesa>();
  for (const l of delArchivio) {
    if (l.stato === 'inviato') continue;
    const s = sceltaDelLotto(l);
    const k = chiaveScelta(s);
    const g = gruppi.get(k) ?? { scelta: s, pagine: 0, anteprime: [] };
    if (!gruppi.has(k)) {
      const cartella = s.tipo === 'nuova' ? s.cartella : s.tipo === 'esistente' ? elenco?.schede.find(x => x.id === s.id)?.cartella : undefined;
      g.riassunto = s.tipo === 'smistare' ? undefined : [cartella && percorsoLeggibile(cartella), s.tipo === 'nuova' && t('creata qui')].filter(Boolean).join(' · ');
      gruppi.set(k, g);
    }
    if (s.tipo === 'smistare' && !g.riassunto) g.riassunto = l.titolo || l.nota?.split('\n')[0] || undefined;
    g.pagine += l.pagine.length;
    for (const pg of l.pagine) if (g.anteprime.length < 4) g.anteprime.push({ uri: uriAnteprima(l, pg), etichetta: pg.etichetta });
  }
  const statoInvio = invio ? t('invio {fatte}/{totali}', invio) : motivo || t('in partenza');
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
        viste={impostazioni.viste?.[archivio.nome] || []}
      />
      <BarraFondo
        sinistra={vaiInvio}
        centro={{ etichetta: t('Scansiona o crea una scheda'), icona: Plus, onPress: () => setMenuPiu(true), disabilitata: !!occupato }}
        destra={vaiImpostazioni}
      />
      {tendina && <TendinaArchivi archivi={archivi} attuale={archivio} onScegli={scegliArchivio} onDocumenti={apriDocumenti} onChiudi={() => setTendina(false)} />}
      <MenuPiu
        visibile={menuPiu}
        onChiudi={() => setMenuPiu(false)}
        voci={[
          { titolo: t('Nuova scheda'), sotto: cartellaCorrente ? t('in «{cartella}»', { cartella: percorsoLeggibile(cartellaCorrente) }) : t('senza cartella'), icona: FilePlus, onPress: () => setFoglioNuovo(true) },
          { titolo: t('Scannerizza senza scheda'), sotto: t('da smistare al computer'), icona: ScanLine, onPress: () => { const s: SchedaScelta = { tipo: 'smistare' }; apriScheda(s); scansiona(s, precedentiSmistare); } }
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
