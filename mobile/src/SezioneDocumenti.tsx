// Fase 15b — la sezione Documenti, scelta dalla tendina degli archivi: elenco con cartelle →
// documento → visore (Ruota, Ritaglia, Rifai, Elimina) e Ritaglia. Scanner ML Kit come per gli
// archivi (BASE, senza i filtri di ML Kit che non tengono l'originale), qui con la galleria;
// i filtri reversibili sono i nostri (15d, `filtri.ts`). OCR a richiesta (15e): «Testo» nel
// visore, «Tutte le pagine», PDF ricercabile; si rifà solo se la foto è cambiata.
// Indietro di Android: chiude il livello aperto; dalla radice lo lascia all'app.

import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Alert, BackHandler, ToastAndroid } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { launchDocumentScannerAsync, ResultFormatOptions, ScannerModeOptions } from '@infinitered/react-native-mlkit-document-scanner';
import { FileText, ScanLine } from 'lucide-react-native';
import { aggiungiPagine, correggiTesto, eliminaDocumento, elencaDocumenti, impostaFiltro, leggiCartelle, nuovoDocumento, riconosci, rimuoviPagina, salvaCartelle, salvaDocumento, sostituisciPagina, uriFile, uriPagina } from './documenti';
import { nomeAutomatico, ocrAggiornato, spostata, type Documento as Doc } from './elencoDocumenti';
import { testoDiPiuPagine } from './testo';
import { TestoPagina } from './schermate/TestoPagina';
import { annullato, cartellaSalvata, condividi, salva, scegliCartella } from './esporta';
import { Condividi } from './schermate/Condividi';
import { ritagliata, ruotata } from './immagini';
import { Documenti } from './schermate/Documenti';
import { Documento } from './schermate/Documento';
import { Ritaglia } from './schermate/Ritaglia';
import { ScegliCartella } from './schermate/ScegliCartella';
import { Visore } from './schermate/Visore';
import { BarraFondo } from './ui/BarraFondo';
import { Schermo } from './ui/Schermo';

type VoceBarra = ComponentProps<typeof BarraFondo>['sinistra'];

type Props = { invio: VoceBarra; impostazioni: VoceBarra; onCambiaArchivio: () => void };

const scanner = (pagine: number) => launchDocumentScannerAsync({ pageLimit: pagine, galleryImportAllowed: true, scannerMode: ScannerModeOptions.BASE, resultFormats: ResultFormatOptions.JPEG });

export function SezioneDocumenti({ invio, impostazioni, onCambiaArchivio }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [cartelle, setCartelle] = useState<string[]>([]);
  const [cartella, setCartella] = useState<string | null>(null);
  const [aperto, setAperto] = useState<string | null>(null);
  const [visore, setVisore] = useState<number | null>(null);
  const [ritaglio, setRitaglio] = useState<string | null>(null);
  const [spostando, setSpostando] = useState(false);
  const [occupato, setOccupato] = useState(false);
  /** Foglio «Condividi o salva» del documento aperto. */
  const [foglio, setFoglio] = useState(false);
  /** Foglio «Testo» del visore: indice della pagina. */
  const [testo, setTesto] = useState<number | null>(null);

  const ricarica = useCallback(() => {
    try {
      setDocs(elencaDocumenti());
      setCartelle(leggiCartelle());
    } catch (e: any) {
      Alert.alert('Errore', `Lettura dei documenti: ${e?.message || String(e)}`);
    }
  }, []);
  useEffect(ricarica, [ricarica]);

  useEffect(() => {
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ritaglio) { setRitaglio(null); return true; }
      if (visore !== null) { setVisore(null); return true; }
      if (spostando) { setSpostando(false); return true; }
      if (aperto) { setAperto(null); return true; }
      if (cartella !== null) { setCartella(null); return true; }
      return false;
    });
    return () => s.remove();
  }, [ritaglio, visore, spostando, aperto, cartella]);

  const doc = docs.find(d => d.id === aperto);
  const aggiorna = (d: Doc) => setDocs(ds => (ds.some(x => x.id === d.id) ? ds.map(x => (x.id === d.id ? d : x)) : [...ds, d]));

  async function esegui(etichetta: string, fn: () => Promise<void> | void) {
    setOccupato(true);
    try {
      await fn();
    } catch (e: any) {
      if (annullato(e)) return;
      console.error('[documenti]', etichetta, e);
      Alert.alert('Errore', `${etichetta}: ${e?.message || String(e)}`);
      ricarica(); // dopo un errore a metà, il disco dice com'è andata
    } finally {
      setOccupato(false);
    }
  }

  /** OCR delle pagine che non l'hanno aggiornato, una alla volta (salvate a ogni passo). */
  const riconosciTutte = async (d: Doc) => {
    for (const p of d.pagine) { d = await riconosci(d, p.file); aggiorna(d); }
    return d;
  };

  const copia = async (t: string) => {
    await Clipboard.setStringAsync(t);
    ToastAndroid.show('Testo copiato', ToastAndroid.SHORT);
  };

  const nuovo = () => esegui('Scansione', async () => {
    const r = await scanner(100);
    if (r.canceled || !r.pages?.length) return;
    const d = await nuovoDocumento(nomeAutomatico(new Date()), cartella || '', r.pages);
    if (d) { aggiorna(d); setAperto(d.id); }
  });

  const altrePagine = (d: Doc) => esegui('Scansione', async () => {
    const r = await scanner(100);
    if (!r.canceled && r.pages?.length) aggiorna(await aggiungiPagine(d, r.pages));
  });

  const elimina = (d: Doc) => Alert.alert('Eliminare il documento?', `«${d.nome}» e le sue pagine spariscono dal telefono.`, [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Elimina', style: 'destructive', onPress: () => esegui('Eliminazione', () => { eliminaDocumento(d); setAperto(null); setDocs(ds => ds.filter(x => x.id !== d.id)); }) }
  ]);

  const eliminaPagina = (d: Doc, file: string) => {
    const ultima = d.pagine.length === 1;
    Alert.alert(ultima ? 'Eliminare il documento?' : 'Eliminare la pagina?', ultima ? 'È l\'ultima pagina: si elimina tutto il documento.' : 'La perdi.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive', onPress: () => esegui('Eliminazione', () => {
          if (ultima) { eliminaDocumento(d); setVisore(null); setAperto(null); setDocs(ds => ds.filter(x => x.id !== d.id)); return; }
          aggiorna(rimuoviPagina(d, file));
        })
      }
    ]);
  };

  if (doc && ritaglio) {
    const pg = doc.pagine.find(p => p.file === ritaglio);
    if (pg) {
      return (
        <Schermo>
          <Ritaglia titolo="Ritaglia la pagina" uri={uriPagina(doc, pg)} onAnnulla={() => setRitaglio(null)}
            onRitaglia={r => esegui('Ritaglio', async () => { aggiorna(await sostituisciPagina(doc, pg.file, (await ritagliata(uriFile(doc, pg), r)).uri)); setRitaglio(null); })} />
          <StatusBar style="auto" />
        </Schermo>
      );
    }
  }

  if (doc && visore !== null && doc.pagine.length) {
    const file = (i: number) => doc.pagine[i].file;
    return (
      <Schermo>
        <Visore
          titolo={doc.nome}
          pagine={doc.pagine.map(p => ({ chiave: p.file + p.v, uri: uriPagina(doc, p), filtro: p.filtro }))}
          filtri={{
            onScegli: (i, f) => esegui('Filtro', async () => aggiorna(await impostaFiltro(doc, file(i), f))),
            // Una pagina alla volta, salvando ogni passo: se si ferma a metà le fatte restano.
            onTutte: f => esegui('Filtro', async () => {
              let d = doc;
              for (const p of doc.pagine) { d = await impostaFiltro(d, p.file, f); aggiorna(d); }
            })
          }}
          indice={visore}
          onIndice={setVisore}
          occupato={occupato}
          onChiudi={() => setVisore(null)}
          onRuota={i => esegui('Rotazione', async () => aggiorna(await sostituisciPagina(doc, file(i), (await ruotata(uriFile(doc, doc.pagine[i]))).uri)))}
          onRitaglia={i => setRitaglio(file(i))}
          onRifai={i => esegui('Scansione', async () => {
            const r = await scanner(1);
            if (!r.canceled && r.pages?.length) aggiorna(await sostituisciPagina(doc, file(i), r.pages[0]));
          })}
          onElimina={i => eliminaPagina(doc, file(i))}
          onTesto={i => {
            setTesto(i);
            esegui('Riconoscimento del testo', async () => {
              try { aggiorna(await riconosci(doc, file(i))); } catch (e) { setTesto(null); throw e; }
            });
          }}
        />
        {testo !== null && doc.pagine[testo] && (() => {
          const pg = doc.pagine[testo];
          return (
            <TestoPagina
              visibile
              titolo={`Testo della pagina ${testo + 1}`}
              testo={pg.ocr && (ocrAggiornato(pg) || pg.ocr.corretto) ? pg.ocr.testo : null}
              pagine={doc.pagine.length}
              occupato={occupato}
              onCorreggi={t => esegui('Correzione', () => { aggiorna(correggiTesto(doc, pg.file, t)); })}
              onCopia={t => esegui('Copia', async () => { await copia(t); })}
              onCopiaTutte={() => esegui('Copia', async () => { await copia(testoDiPiuPagine((await riconosciTutte(doc)).pagine.map(p => p.ocr?.testo))); })}
              onChiudi={() => setTesto(null)}
            />
          );
        })()}
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  if (doc && spostando) {
    return (
      <Schermo>
        <ScegliCartella titolo={`Sposta «${doc.nome}»`} sotto="Documenti" cartelle={[...cartelle, ...docs.map(d => d.cartella || '')]} attuale={doc.cartella || ''}
          piede="Le cartelle nuove si creano dall'elenco dei Documenti."
          onIndietro={() => setSpostando(false)}
          onScegli={v => esegui('Spostamento', () => {
            const { cartella: _vecchia, ...resto } = doc;
            aggiorna(salvaDocumento(v ? { ...resto, cartella: v } : resto));
            setSpostando(false);
          })} />
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  if (doc) {
    return (
      <Schermo conBarra>
        <Documento doc={doc} onIndietro={() => setAperto(null)} onApri={setVisore} onSposta={() => setSpostando(true)} onElimina={() => elimina(doc)}
          onCondividi={() => setFoglio(true)}
          onRinomina={nome => esegui('Rinomina', () => { aggiorna(salvaDocumento({ ...doc, nome })); })}
          onRiordina={(da, a) => {
            const pagine = spostata(doc.pagine, da, a);
            if (pagine !== doc.pagine) esegui('Riordino', () => { aggiorna(salvaDocumento({ ...doc, pagine })); });
          }} />
        <Condividi
          visibile={foglio}
          pagine={doc.pagine.length}
          cartellaScelta={!!cartellaSalvata()}
          occupato={occupato}
          onChiudi={() => setFoglio(false)}
          onCondividi={(f, r) => esegui('Condivisione', async () => { await condividi(r ? await riconosciTutte(doc) : doc, f, r); setFoglio(false); })}
          onSalva={(f, ricercabile) => esegui('Salvataggio', async () => {
            const r = await salva(ricercabile ? await riconosciTutte(doc) : doc, f, ricercabile);
            setFoglio(false);
            Alert.alert('Salvato', `${r.file.length === 1 ? `«${r.file[0]}»` : `${r.file.length} immagini`} in «${r.cartella}».`);
          })}
          onCambiaCartella={() => esegui('Cartella', async () => { await scegliCartella(); })}
        />
        <BarraFondo
          sinistra={{ etichetta: 'Documenti', icona: FileText, onPress: () => setAperto(null) }}
          centro={{ etichetta: `Aggiungi pagine a ${doc.nome}`, icona: ScanLine, onPress: () => altrePagine(doc), disabilitata: occupato }}
          destra={impostazioni}
        />
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  return (
    <Schermo conBarra>
      <Documenti
        docs={docs}
        cartelle={cartelle}
        cartella={cartella}
        onApriCartella={setCartella}
        onIndietro={() => setCartella(null)}
        onApri={d => setAperto(d.id)}
        onNuovaCartella={nome => esegui('Cartella', () => { const tutte = [...cartelle, nome]; salvaCartelle(tutte); setCartelle(tutte); })}
        onEliminaCartella={nome => esegui('Cartella', () => { const tutte = cartelle.filter(x => x !== nome); salvaCartelle(tutte); setCartelle(tutte); setCartella(null); })}
        onCambiaArchivio={onCambiaArchivio}
      />
      <BarraFondo
        sinistra={invio}
        centro={{ etichetta: cartella ? `Scansiona un documento in ${cartella}` : 'Scansiona un documento', icona: ScanLine, onPress: nuovo, disabilitata: occupato }}
        destra={impostazioni}
      />
      <StatusBar style="auto" />
    </Schermo>
  );
}
