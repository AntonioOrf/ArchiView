import * as path from 'path';
import * as fs from 'fs';
import { state } from '../workspaceManager';
import * as pdfHost from './pdfHost';
import { riconosci, linguaMancanti, normalizzaLingue, rilevaOrientamento } from './ocrEngine';
import { testoOcrPiano, testoOcrInHtml, unisciPagine } from './ocrText';
import * as pdfRicercabile from './pdfRicercabile';

const SOGLIA_TESTO_PDF = 25;

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

async function elaboraPaginaPdf(numero, opzioni, segnala) {
  const risTesto = await pdfHost.testoPagina(numero);
  if (risTesto && risTesto.ok) {
    const righe = risTesto.righe || [];
    if (contaAlfanumerici(righe.join(' ')) >= SOGLIA_TESTO_PDF) {
      return { numero, righe, origine: 'testo', confidenza: 100 };
    }
  }

  verificaAnnullamento();
  segnala({ fase: 'rasterizzazione', pagina: numero });
  const img = await pdfHost.immaginePagina(numero, opzioni.dpi);
  if (!img || !img.ok) {
    return { numero, righe: [], origine: 'errore', confidenza: 0, errore: img && img.errore };
  }

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

const MARGINE_ARBITRATO = 10;

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
    try { if (typeof onProgresso === 'function') onProgresso(dati); } catch {}
  };

  try {
    const percorso = percorsoAllegato(o.nomeFile);
    const conPdf = !!o.pdf && pdfRicercabile.attiva();

    if (o.tipo !== 'pdf') {
      let incorporabile = false;
      if (conPdf) {
        const fh = await fs.promises.open(percorso, 'r');
        try {
          const testa = Buffer.alloc(512);
          const { bytesRead } = await fh.read(testa, 0, 512, 0);
          incorporabile = pdfRicercabile.immagineIncorporabile(testa.subarray(0, bytesRead));
        } finally {
          await fh.close();
        }
      }
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
    const pagine: any[] = [];
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

export { eseguiOcr, annulla, occupato, SOGLIA_TESTO_PDF, contaAlfanumerici };
