import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { BackHandler } from 'react-native';
import { avviso, notizia } from './ui/Avviso';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { launchDocumentScannerAsync, ResultFormatOptions, ScannerModeOptions } from '@infinitered/react-native-mlkit-document-scanner';
import { FileText, ScanLine } from 'lucide-react-native';
import { aggiungiPagine, correggiTesto, dividiDocumento, eliminaDocumento, elencaDocumenti, impostaFiltro, leggiCartelle, nuovoDocumento, paroleOcr, riconosci, rimuoviPagina, salvaCartelle, salvaDocumento, sostituisciPagina, unisciDocumenti, uriFile, uriPagina } from './documenti';
import { nomeAutomatico, nomeSeguito, ocrAggiornato, spostata, type Documento as Doc } from './elencoDocumenti';
import { testoDiPiuPagine } from './testo';
import { TestoPagina } from './schermate/TestoPagina';
import { prontoAScansionare } from './consenso';
import { annullato, cartellaSalvata, condividi, salva, scegliCartella } from './esporta';
import { Condividi } from './schermate/Condividi';
import { t } from './lingua';
import { ritagliata, ruotata } from './immagini';
import { Documenti } from './schermate/Documenti';
import { Documento } from './schermate/Documento';
import { Ritaglia } from './schermate/Ritaglia';
import { ScegliCartella } from './schermate/ScegliCartella';
import { ScegliDocumento } from './schermate/ScegliDocumento';
import { Visore } from './schermate/Visore';
import { BarraFondo } from './ui/BarraFondo';
import { Schermo } from './ui/Schermo';

type VoceBarra = ComponentProps<typeof BarraFondo>['sinistra'];

type Props = { invio: VoceBarra; impostazioni: VoceBarra; onCambiaArchivio: () => void; archivio?: { nome: string; onManda: (titolo: string, uris: string[]) => Promise<void> } };

const scanner = async (pagine: number) => await prontoAScansionare()
  ? launchDocumentScannerAsync({ pageLimit: pagine, galleryImportAllowed: true, scannerMode: ScannerModeOptions.BASE, resultFormats: ResultFormatOptions.JPEG })
  : { canceled: true as const, pages: [] as string[] };

export function SezioneDocumenti({ invio, impostazioni, onCambiaArchivio, archivio }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [cartelle, setCartelle] = useState<string[]>([]);
  const [cartella, setCartella] = useState<string | null>(null);
  const [aperto, setAperto] = useState<string | null>(null);
  const [visore, setVisore] = useState<number | null>(null);
  const [ritaglio, setRitaglio] = useState<string | null>(null);
  const [spostando, setSpostando] = useState(false);
  const [unendo, setUnendo] = useState(false);
  const [occupato, setOccupato] = useState(false);
  const [foglio, setFoglio] = useState(false);
  const [testo, setTesto] = useState<number | null>(null);

  const ricarica = useCallback(() => {
    try {
      setDocs(elencaDocumenti());
      setCartelle(leggiCartelle());
    } catch (e: any) {
      avviso(t('Errore'), t('Lettura dei documenti: {motivo}', { motivo: e?.message || String(e) }));
    }
  }, []);
  useEffect(ricarica, [ricarica]);

  useEffect(() => {
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ritaglio) { setRitaglio(null); return true; }
      if (visore !== null) { setVisore(null); return true; }
      if (spostando) { setSpostando(false); return true; }
      if (unendo) { setUnendo(false); return true; }
      if (aperto) { setAperto(null); return true; }
      if (cartella !== null) { setCartella(null); return true; }
      return false;
    });
    return () => s.remove();
  }, [ritaglio, visore, spostando, unendo, aperto, cartella]);

  const doc = docs.find(d => d.id === aperto);
  const aggiorna = (d: Doc) => setDocs(ds => (ds.some(x => x.id === d.id) ? ds.map(x => (x.id === d.id ? d : x)) : [...ds, d]));

  async function esegui(etichetta: string, fn: () => Promise<void> | void) {
    setOccupato(true);
    try {
      await fn();
    } catch (e: any) {
      if (annullato(e)) return;
      console.error('[documenti]', etichetta, e);
      avviso(t('Errore'), `${etichetta}: ${e?.message || String(e)}`);
      ricarica();
    } finally {
      setOccupato(false);
    }
  }

  const riconosciTutte = async (d: Doc) => {
    for (const p of d.pagine) { d = await riconosci(d, p.file); aggiorna(d); }
    return d;
  };

  const copia = async (s: string) => {
    await Clipboard.setStringAsync(s);
    notizia(t('Testo copiato'));
  };

  const nuovo = () => esegui(t('Scansione'), async () => {
    const r = await scanner(100);
    if (r.canceled || !r.pages?.length) return;
    const d = await nuovoDocumento(nomeAutomatico(new Date()), cartella || '', r.pages);
    if (d) { aggiorna(d); setAperto(d.id); }
  });

  const altrePagine = (d: Doc) => esegui(t('Scansione'), async () => {
    const r = await scanner(100);
    if (!r.canceled && r.pages?.length) aggiorna(await aggiungiPagine(d, r.pages));
  });

  const elimina = (d: Doc) => avviso(t('Eliminare il documento?'), t('«{nome}» e le sue pagine spariscono dal telefono.', { nome: d.nome }), [
    { text: t('Annulla'), style: 'cancel' },
    { text: t('Elimina'), style: 'destructive', onPress: () => esegui(t('Eliminazione'), () => { eliminaDocumento(d); setAperto(null); setDocs(ds => ds.filter(x => x.id !== d.id)); }) }
  ]);

  const eliminaPagina = (d: Doc, file: string) => {
    const ultima = d.pagine.length === 1;
    avviso(ultima ? t('Eliminare il documento?') : t('Eliminare la pagina?'), ultima ? t('È l\'ultima pagina: si elimina tutto il documento.') : t('La perdi.'), [
      { text: t('Annulla'), style: 'cancel' },
      {
        text: t('Elimina'), style: 'destructive', onPress: () => esegui(t('Eliminazione'), () => {
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
          <Ritaglia titolo={t('Ritaglia la pagina')} uri={uriPagina(doc, pg)} onAnnulla={() => setRitaglio(null)}
            onRitaglia={r => esegui(t('Ritaglio'), async () => { aggiorna(await sostituisciPagina(doc, pg.file, (await ritagliata(uriFile(doc, pg), r)).uri)); setRitaglio(null); })} />
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
            onScegli: (i, f) => esegui(t('Filtro'), async () => aggiorna(await impostaFiltro(doc, file(i), f))),
            onTutte: f => esegui(t('Filtro'), async () => {
              let d = doc;
              for (const p of doc.pagine) { d = await impostaFiltro(d, p.file, f); aggiorna(d); }
            })
          }}
          parole={i => paroleOcr(doc, doc.pagine[i])}
          onCopia={s => esegui(t('Copia'), async () => { await copia(s); })}
          onRiconosci={i => esegui(t('Riconoscimento del testo'), async () => {
            const d = await riconosci(doc, file(i));
            aggiorna(d);
            if (!paroleOcr(d, d.pagine[i])?.length) notizia(t('Nessun testo riconosciuto in questa pagina.'));
          })}
          indice={visore}
          onIndice={setVisore}
          occupato={occupato}
          onChiudi={() => setVisore(null)}
          onRuota={i => esegui(t('Rotazione'), async () => aggiorna(await sostituisciPagina(doc, file(i), (await ruotata(uriFile(doc, doc.pagine[i]))).uri)))}
          onRitaglia={i => setRitaglio(file(i))}
          onRifai={i => esegui(t('Scansione'), async () => {
            const r = await scanner(1);
            if (!r.canceled && r.pages?.length) aggiorna(await sostituisciPagina(doc, file(i), r.pages[0]));
          })}
          onElimina={i => eliminaPagina(doc, file(i))}
          onSepara={i => {
            const nome = nomeSeguito(doc.nome);
            avviso(t('Separare il documento?'), t('Le pagine da {da} a {a} diventano «{nome}», nella stessa cartella.', { da: i + 1, a: doc.pagine.length, nome }), [
              { text: t('Annulla'), style: 'cancel' },
              {
                text: t('Separa'), onPress: () => esegui(t('Separazione'), async () => {
                  const { prima, seconda } = await dividiDocumento(doc, i, nome);
                  aggiorna(prima);
                  aggiorna(seconda);
                  setVisore(null);
                  notizia(t('Creato «{nome}»', { nome: seconda.nome }));
                })
              }
            ]);
          }}
          onTesto={i => {
            setTesto(i);
            esegui(t('Riconoscimento del testo'), async () => {
              try { aggiorna(await riconosci(doc, file(i))); } catch (e) { setTesto(null); throw e; }
            });
          }}
        />
        {testo !== null && doc.pagine[testo] && (() => {
          const pg = doc.pagine[testo];
          return (
            <TestoPagina
              visibile
              titolo={t('Testo della pagina {n}', { n: testo + 1 })}
              testo={pg.ocr && (ocrAggiornato(pg) || pg.ocr.corretto) ? pg.ocr.testo : null}
              pagine={doc.pagine.length}
              occupato={occupato}
              onCorreggi={s => esegui(t('Correzione'), () => { aggiorna(correggiTesto(doc, pg.file, s)); })}
              onCopia={s => esegui(t('Copia'), async () => { await copia(s); })}
              onCopiaTutte={() => esegui(t('Copia'), async () => { await copia(testoDiPiuPagine((await riconosciTutte(doc)).pagine.map(p => p.ocr?.testo))); })}
              onChiudi={() => setTesto(null)}
            />
          );
        })()}
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  if (doc && unendo) {
    return (
      <Schermo>
        <ScegliDocumento titolo={doc.nome} documenti={docs.filter(d => d.id !== doc.id)} onIndietro={() => setUnendo(false)}
          onScegli={altro => avviso(t('Unire i documenti?'), altro.pagine.length === 1
            ? t('La pagina di «{altro}» va in fondo a «{doc}». «{altro}» sparisce.', { altro: altro.nome, doc: doc.nome })
            : t('Le {n} pagine di «{altro}» vanno in fondo a «{doc}». «{altro}» sparisce.', { n: altro.pagine.length, altro: altro.nome, doc: doc.nome }), [
            { text: t('Annulla'), style: 'cancel' },
            {
              text: t('Unisci'), onPress: () => esegui(t('Unione'), async () => {
                const unito = await unisciDocumenti(doc, altro);
                setDocs(ds => ds.filter(x => x.id !== altro.id).map(x => (x.id === unito.id ? unito : x)));
                setUnendo(false);
              })
            }
          ])} />
        <StatusBar style="auto" />
      </Schermo>
    );
  }

  if (doc && spostando) {
    return (
      <Schermo>
        <ScegliCartella titolo={t('Sposta «{nome}»', { nome: doc.nome })} sotto={t('Documenti')} cartelle={[...cartelle, ...docs.map(d => d.cartella || '')]} attuale={doc.cartella || ''}
          piede={t('Le cartelle nuove si creano dall\'elenco dei Documenti.')}
          onIndietro={() => setSpostando(false)}
          onScegli={v => esegui(t('Spostamento'), () => {
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
          onUnisci={() => setUnendo(true)}
          archivio={archivio?.nome}
          onArchivio={archivio ? () => avviso(t('Mandare all\'archivio «{nome}»?', { nome: archivio.nome }),
            doc.pagine.length === 1
              ? t('La pagina va in «Senza scheda» e parte col prossimo invio, senza filtri. Il documento resta qui.')
              : t('Le {n} pagine vanno in «Senza scheda» e partono col prossimo invio, senza filtri. Il documento resta qui.', { n: doc.pagine.length }), [
              { text: t('Annulla'), style: 'cancel' },
              { text: t('Manda'), onPress: () => esegui(t('Invio all\'archivio'), async () => { await archivio.onManda(doc.nome, doc.pagine.map(p => uriFile(doc, p))); notizia(t('Pagine in «Da inviare»')); }) }
            ]) : undefined}
          onRinomina={nome => esegui(t('Rinomina'), () => { aggiorna(salvaDocumento({ ...doc, nome })); })}
          onRiordina={(da, a) => {
            const pagine = spostata(doc.pagine, da, a);
            if (pagine !== doc.pagine) esegui(t('Riordino'), () => { aggiorna(salvaDocumento({ ...doc, pagine })); });
          }} />
        <Condividi
          visibile={foglio}
          pagine={doc.pagine.length}
          cartellaScelta={!!cartellaSalvata()}
          occupato={occupato}
          onChiudi={() => setFoglio(false)}
          onCondividi={(f, r) => esegui(t('Condivisione'), async () => { await condividi(r ? await riconosciTutte(doc) : doc, f, r); setFoglio(false); })}
          onSalva={(f, ricercabile) => esegui(t('Salvataggio'), async () => {
            const r = await salva(ricercabile ? await riconosciTutte(doc) : doc, f, ricercabile);
            setFoglio(false);
            avviso(t('Salvato'), r.file.length === 1
              ? t('«{file}» in «{cartella}».', { file: r.file[0], cartella: r.cartella })
              : t('{n} immagini in «{cartella}».', { n: r.file.length, cartella: r.cartella }));
          })}
          onCambiaCartella={() => esegui(t('Cartella'), async () => { await scegliCartella(); })}
        />
        <BarraFondo
          sinistra={{ etichetta: t('Documenti'), icona: FileText, onPress: () => setAperto(null) }}
          centro={{ etichetta: t('Aggiungi pagine a {nome}', { nome: doc.nome }), icona: ScanLine, onPress: () => altrePagine(doc), disabilitata: occupato }}
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
        onNuovaCartella={nome => esegui(t('Cartella'), () => { const tutte = [...cartelle, nome]; salvaCartelle(tutte); setCartelle(tutte); })}
        onEliminaCartella={nome => esegui(t('Cartella'), () => { const tutte = cartelle.filter(x => x !== nome); salvaCartelle(tutte); setCartelle(tutte); setCartella(null); })}
        onCambiaArchivio={onCambiaArchivio}
      />
      <BarraFondo
        sinistra={invio}
        centro={{ etichetta: cartella ? t('Scansiona un documento in {cartella}', { cartella }) : t('Scansiona un documento'), icona: ScanLine, onPress: nuovo, disabilitata: occupato }}
        destra={impostazioni}
      />
      <StatusBar style="auto" />
    </Schermo>
  );
}
