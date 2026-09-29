// Orchestrazione dell'OCR di un allegato (Fase 2.3).
//
// Mette insieme le tre parti: `pdfHost` (pagine e rasterizzazione), `ocrEngine`
// (riconoscimento) e `ocrText` (post-processing puro). Qui vivono le due decisioni che
// contano davvero per l'utente: quando NON fare l'OCR, e come non far crollare la macchina.

const path = require('path');
const fs = require('fs');
const { state } = require('../workspaceManager');
const pdfHost = require('./pdfHost');
const { riconosci, linguaMancanti, normalizzaLingue, rilevaOrientamento } = require('./ocrEngine');
const { testoOcrPiano, testoOcrInHtml, unisciPagine } = require('./ocrText');
const pdfRicercabile = require('./pdfRicercabile');

/**
 * Una pagina il cui livello testo supera questa soglia di caratteri alfanumerici è un PDF
 * digitale: si prende il testo così com'è. Non è zero perché gli scanner timbrano numeri di
 * pagina e nomi di file dentro PDF che restano immagini pure — con soglia zero quelle poche
 * cifre passerebbero per "documento con testo" e l'OCR non partirebbe mai dove serve.
 */
const SOGLIA_TESTO_PDF = 25;

/** Un solo lavoro alla volta. */
let inCorso = false;
let annullato = false;

function occupato() { return inCorso; }
function annulla() { annullato = true; }

function contaAlfanumerici(s) {
  const m = String(s || '').match(/[\p{L}\p{N}]/gu);
  return m ? m.length : 0;
}

function percorsoAllegato(nomeFile) {
  if (!state.attachmentsDirPath) throw new Error('Cartella allegati non definita');
  const sicuro = path.basename(String(nomeFile || ''));
  if (!sicuro) throw new Error('Nome allegato non valido');
  const p = path.join(state.attachmentsDirPath, sicuro);
  if (!fs.existsSync(p)) {
    const errore: any = new Error('Allegato non presente su questo PC');
    errore.codice = 'allegato_mancante';
    throw errore;
  }
  return p;
}

function verificaAnnullamento() {
  if (annullato) {
    const e: any = new Error('Operazione annullata');
    e.codice = 'annullato';
    throw e;
  }
}

/** Una pagina PDF: prima il livello testo, l'OCR solo se non c'è. */
async function elaboraPaginaPdf(numero, opzioni, segnala) {
  const risTesto = await pdfHost.testoPagina(numero);
  if (risTesto && risTesto.ok) {
    const righe = risTesto.righe || [];
    if (contaAlfanumerici(righe.join(' ')) >= SOGLIA_TESTO_PDF) {
      // Testo già nel file: resa perfetta, costo quasi nullo, nessuna confidenza da mostrare
      // perché non c'è stato alcun riconoscimento da mettere in dubbio.
      return { numero, righe, origine: 'testo', confidenza: 100 };
    }
  }

  verificaAnnullamento();
  segnala({ fase: 'rasterizzazione', pagina: numero });
  const img = await pdfHost.immaginePagina(numero, opzioni.dpi);
  if (!img || !img.ok) {
    return { numero, righe: [], origine: 'errore', confidenza: 0, errore: img && img.errore };
  }

  // La versione raddrizzata si rasterizza di nuovo con la rotazione aggiunta: pdf.js ruota il
  // vettoriale, nessuna perdita da ricampionare la PNG.
  const { esito, rotazione, orientamentoIncerto } = await riconosciOrientato({
    originale: Buffer.from(img.png, 'base64'),
    ruota: async (gradi) => {
      const r = await pdfHost.immaginePagina(numero, opzioni.dpi, gradi);
      return r && r.ok ? Buffer.from(r.png, 'base64') : null;
    },
    raddrizza: opzioni.raddrizza,
    lingue: opzioni.lingue,
    pdf: opzioni.pdf ? 'testo' : undefined,
    numero,
    segnala
  });
  return {
    numero, righe: esito.righe, origine: 'ocr', confidenza: esito.confidenza, livelloPdf: esito.pdf,
    rotazione, orientamentoIncerto
  };
}

/**
 * Di quanti punti la lettura nel verso proposto deve battere quella nel verso originale
 * perché una proposta incerta dell'OSD venga accettata. Il testo letto di traverso esce
 * come rumore a confidenza bassa (in prova: simboli sparsi contro 85+ sul verso giusto): il
 * margine serve solo a non girare una carta per un pareggio.
 */
const MARGINE_ARBITRATO = 10;

/**
 * Riconoscimento con raddrizzamento.
 *
 * - OSD sicuro → si riconosce solo la versione ruotata.
 * - OSD incerto → ARBITRATO: si riconosce nei due versi e vince la lettura con confidenza
 *   nettamente migliore. Costa un OCR in più, ma solo sulle pagine dubbie, ed evita sia di
 *   girare per errore una carta dritta sia di lasciarne storta una che l'OSD aveva capito.
 * - Nessuna proposta, rotazione fallita → l'originale, come senza l'opzione.
 */
async function riconosciOrientato({ originale, ruota, raddrizza, lingue, pdf, numero, segnala }) {
  const leggi = (sorgente) => riconosci(sorgente, lingue, (p) => {
    segnala({ fase: p.fase, pagina: numero, progresso: p.progresso });
  }, pdf);
  const semplice = async (orientamentoIncerto = false) => {
    verificaAnnullamento();
    segnala({ fase: 'riconoscimento', pagina: numero });
    return { esito: await leggi(originale), rotazione: 0, orientamentoIncerto };
  };

  if (!raddrizza) return semplice();
  verificaAnnullamento();
  segnala({ fase: 'orientamento', pagina: numero });
  const orient = await rilevaOrientamento(originale);
  if (!orient || !orient.gradi) return semplice();

  const ruotata = await ruota(orient.gradi);
  if (!ruotata) {
    console.error('[OCR] Rotazione della pagina fallita, si riconosce l\'originale');
    return semplice();
  }

  verificaAnnullamento();
  segnala({ fase: 'riconoscimento', pagina: numero });
  const suRuotata = await leggi(ruotata);
  if (!orient.incerto) return { esito: suRuotata, rotazione: orient.gradi, orientamentoIncerto: false };

  verificaAnnullamento();
  segnala({ fase: 'orientamento', pagina: numero });
  const suOriginale = await leggi(originale);
  if (suRuotata.confidenza >= suOriginale.confidenza + MARGINE_ARBITRATO) {
    return { esito: suRuotata, rotazione: orient.gradi, orientamentoIncerto: false };
  }
  return { esito: suOriginale, rotazione: 0, orientamentoIncerto: true };
}

/**
 * OCR di un allegato.
 *
 * `opzioni`: `{ nomeFile, tipo, lingue, dpi, maxPagine, intestazione, pdf, raddrizza }`.
 * Con `pdf` l'allegato si accoda anche al PDF ricercabile aperto da `pdfRicercabile.apri`.
 * Con `raddrizza` le pagine scansionate di traverso si ruotano prima del riconoscimento
 * (serve `osd` installato; senza, l'opzione è ignorata in silenzio).
 * `onProgresso` riceve `{fase, pagina, pagine, progresso}` ad ogni passo: su un PDF di
 * trenta carte l'operazione dura minuti, e una barra ferma è indistinguibile da un blocco.
 */
async function eseguiOcr(opzioni, onProgresso) {
  const o = opzioni || {};
  const lingue = normalizzaLingue(o.lingue);

  if (inCorso) {
    const e: any = new Error('Un riconoscimento è già in corso');
    e.codice = 'occupato';
    throw e;
  }

  const mancanti = linguaMancanti(lingue);
  if (mancanti.length) {
    return { ok: false, codice: 'lingue_mancanti', lingue: mancanti };
  }

  inCorso = true;
  annullato = false;
  const segnala = (dati) => {
    try { if (typeof onProgresso === 'function') onProgresso(dati); } catch { /* la UI non deve poter far fallire un OCR */ }
  };

  try {
    const percorso = percorsoAllegato(o.nomeFile);
    const conPdf = !!o.pdf && pdfRicercabile.attiva();

    if (o.tipo !== 'pdf') {
      let incorporabile = false;
      if (conPdf) {
        // Bastano i primi byte per il formato e l'EXIF, non il file intero.
        const fh = await fs.promises.open(percorso, 'r');
        try {
          const testa = Buffer.alloc(512);
          const { bytesRead } = await fh.read(testa, 0, 512, 0);
          incorporabile = pdfRicercabile.immagineIncorporabile(testa.subarray(0, bytesRead));
        } finally {
          await fh.close();
        }
      }
      // La rotazione di un'immagine la fa il canvas della finestra host: il main non ne ha uno.
      const { esito, rotazione, orientamentoIncerto } = await riconosciOrientato({
        originale: percorso,
        ruota: async (gradi) => {
          const r = await pdfHost.immagineRuotata(path.basename(percorso), gradi);
          if (!r || !r.ok) console.error('[OCR] Rotazione immagine fallita:', r && r.errore);
          return r && r.ok ? Buffer.from(r.png, 'base64') : null;
        },
        raddrizza: !!o.raddrizza,
        lingue,
        pdf: conPdf ? (incorporabile ? 'testo' : 'completa') : undefined,
        numero: 1,
        segnala: (d) => segnala({ ...d, pagine: 1 })
      });
      const pagine = [{ numero: 1, righe: esito.righe, origine: 'ocr', confidenza: esito.confidenza, rotazione, orientamentoIncerto }];
      const risultato = componiRisultato(pagine, lingue, o);
      if (conPdf) {
        risultato.pdfErrore = await accodaAlPdf(() => pdfRicercabile.aggiungiImmagine(percorso, esito.pdf, incorporabile, rotazione));
      }
      return risultato;
    }

    const apertura = await pdfHost.apriPdf(path.basename(o.nomeFile));
    if (!apertura || !apertura.ok) {
      return { ok: false, codice: 'pdf_illeggibile', errore: apertura && apertura.errore };
    }

    const totale = Math.min(apertura.pagine, o.maxPagine || apertura.pagine);
    const pagine = [];
    for (let n = 1; n <= totale; n++) {
      verificaAnnullamento();
      segnala({ fase: 'pagina', pagina: n, pagine: totale });
      pagine.push(await elaboraPaginaPdf(n, { ...o, lingue, pdf: conPdf }, (d) => segnala({ ...d, pagine: totale })));
    }
    await pdfHost.chiudiPdf();
    const risultato = componiRisultato(pagine, lingue, o, apertura.pagine, totale);
    if (conPdf) {
      const livelli = new Map();
      const rotazioni = new Map();
      for (const p of pagine) {
        if (p.livelloPdf) livelli.set(p.numero, p.livelloPdf);
        if (p.rotazione) rotazioni.set(p.numero, p.rotazione);
      }
      risultato.pdfErrore = await accodaAlPdf(() => pdfRicercabile.aggiungiPdf(percorso, livelli, rotazioni));
    }
    return risultato;
  } catch (errore) {
    if (errore && errore.codice === 'annullato') return { ok: false, codice: 'annullato' };
    console.error('[OCR] Riconoscimento fallito:', errore);
    return { ok: false, codice: errore && errore.codice ? errore.codice : 'errore', errore: errore && errore.message };
  } finally {
    inCorso = false;
    annullato = false;
  }
}

/**
 * Un errore nel PDF ricercabile non invalida l'OCR: il testo è già riconosciuto e va comunque
 * nella trascrizione. Torna il codice, che il renderer mostra accanto al risultato.
 */
async function accodaAlPdf(azione) {
  try {
    await azione();
    return null;
  } catch (errore) {
    console.error('[OCR] PDF ricercabile:', errore);
    return (errore && errore.codice) || 'errore';
  }
}

function componiRisultato(pagine, lingue, o, paginePdf?, pagineFatte?): any {
  const utili = pagine.filter(p => p.righe && p.righe.length);
  const multipagina = pagine.length > 1;

  const piano = multipagina
    ? unisciPagine(pagine).piano
    : testoOcrPiano(utili.length ? utili[0].righe : []);

  const html = multipagina
    ? unisciPagine(pagine).html
    : testoOcrInHtml(utili.length ? utili[0].righe : [], { intestazione: o.intestazione });

  // La confidenza dichiarata copre le sole pagine davvero riconosciute: mediarla con le
  // pagine prese dal livello testo (100 per definizione) gonfierebbe il numero proprio sui
  // PDF misti, cioè dove all'utente serve sapere quanto fidarsi.
  const daOcr = pagine.filter(p => p.origine === 'ocr');
  const confidenza = daOcr.length
    ? Math.round((daOcr.reduce((s, p) => s + (p.confidenza || 0), 0) / daOcr.length) * 10) / 10
    : (utili.length ? 100 : 0);

  return {
    ok: true,
    piano,
    html: multipagina && o.intestazione
      ? `<p class="ocr-origine"><em>${String(o.intestazione).replace(/[<>&]/g, '')}</em></p>\n${html}`
      : html,
    confidenza,
    lingue,
    motore: 'tesseract',
    // L'HTML di ciascuna pagina, oltre al blocco unito: il renderer scrive ogni pagina di un
    // PDF sulla SUA trascrizione. Rifarlo dividendo `html` sui marcatori sarebbe possibile,
    // ma farebbe dipendere la scrittura dal formato di un testo pensato per essere letto.
    pagine: pagine.map(p => ({
      numero: p.numero,
      origine: p.origine,
      confidenza: p.confidenza,
      rotazione: p.rotazione || 0,
      orientamentoIncerto: !!p.orientamentoIncerto,
      html: p.righe && p.righe.length ? testoOcrInHtml(p.righe) : ''
    })),
    paginePdf: paginePdf || pagine.length,
    pagineElaborate: pagineFatte || pagine.length,
    caratteri: piano.length
  };
}

module.exports = { eseguiOcr, annulla, occupato, SOGLIA_TESTO_PDF, contaAlfanumerici };
export {};
