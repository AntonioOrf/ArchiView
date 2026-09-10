// Orchestrazione dell'OCR di un allegato (Fase 2.3).
//
// Mette insieme le tre parti: `pdfHost` (pagine e rasterizzazione), `ocrEngine`
// (riconoscimento) e `ocrText` (post-processing puro). Qui vivono le due decisioni che
// contano davvero per l'utente: quando NON fare l'OCR, e come non far crollare la macchina.

const path = require('path');
const fs = require('fs');
const { state } = require('../workspaceManager');
const pdfHost = require('./pdfHost');
const { riconosci, linguaMancanti, normalizzaLingue } = require('./ocrEngine');
const { testoOcrPiano, testoOcrInHtml, unisciPagine } = require('./ocrText');

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

  verificaAnnullamento();
  segnala({ fase: 'riconoscimento', pagina: numero });
  const esito = await riconosci(Buffer.from(img.png, 'base64'), opzioni.lingue, (p) => {
    segnala({ fase: p.fase, pagina: numero, progresso: p.progresso });
  });
  return { numero, righe: esito.righe, origine: 'ocr', confidenza: esito.confidenza };
}

/**
 * OCR di un allegato.
 *
 * `opzioni`: `{ nomeFile, tipo, lingue, dpi, maxPagine, intestazione }`.
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

    if (o.tipo !== 'pdf') {
      segnala({ fase: 'riconoscimento', pagina: 1, pagine: 1 });
      const esito = await riconosci(percorso, lingue, (p) => segnala({ ...p, pagina: 1, pagine: 1 }));
      const pagine = [{ numero: 1, righe: esito.righe, origine: 'ocr', confidenza: esito.confidenza }];
      return componiRisultato(pagine, lingue, o);
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
      pagine.push(await elaboraPaginaPdf(n, { ...o, lingue }, (d) => segnala({ ...d, pagine: totale })));
    }
    await pdfHost.chiudiPdf();
    return componiRisultato(pagine, lingue, o, apertura.pagine, totale);
  } catch (errore) {
    if (errore && errore.codice === 'annullato') return { ok: false, codice: 'annullato' };
    console.error('[OCR] Riconoscimento fallito:', errore);
    return { ok: false, codice: errore && errore.codice ? errore.codice : 'errore', errore: errore && errore.message };
  } finally {
    inCorso = false;
    annullato = false;
  }
}

function componiRisultato(pagine, lingue, o, paginePdf?, pagineFatte?) {
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
    pagine: pagine.map(p => ({ numero: p.numero, origine: p.origine, confidenza: p.confidenza })),
    paginePdf: paginePdf || pagine.length,
    pagineElaborate: pagineFatte || pagine.length,
    caratteri: piano.length
  };
}

module.exports = { eseguiOcr, annulla, occupato, SOGLIA_TESTO_PDF, contaAlfanumerici };
export {};
