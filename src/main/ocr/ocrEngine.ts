// Motore di riconoscimento (Fase 2.3).
//
// ── Dove gira davvero il lavoro pesante ──────────────────────────────────────────────────
// Il riconoscimento NON blocca l'event loop del main pur essendo avviato da qui:
// `tesseract.js` in ambiente Node crea internamente un `worker_threads.Worker`
// (`src/worker/node/spawnWorker.js`) e vi esegue il wasm. Il main fa solo passaggio di
// messaggi e trasferimento dei buffer. È il motivo per cui questa fase non introduce un
// `utilityProcess` proprio: ce n'è già uno, ed è quello della libreria.
//
// ── Perché il worker resta vivo ──────────────────────────────────────────────────────────
// Inizializzare un motore e caricare i dati di una lingua costa qualche secondo e un centinaio
// di MB. Un OCR in massa su trecento carte pagherebbe quel prezzo trecento volte. Il worker è
// quindi tenuto in vita e riusato finché le lingue richieste non cambiano, e chiuso da solo
// dopo un periodo di inattività: tenere occupata quella memoria mentre l'utente sta scrivendo
// una scheda è esattamente ciò che la modalità Prestazioni ridotte vuole evitare.

const { linguaInstallata, cartellaLingue } = require('./ocrLangs');

const INATTIVITA_MS = 120000;

let worker = null;
let chiaveLingue = '';
let timerInattivita = null;
let inUso = false;

function normalizzaLingue(lingue) {
  const lista = Array.isArray(lingue) ? lingue : String(lingue || 'ita').split('+');
  const pulite = lista.map(l => String(l || '').trim()).filter(Boolean);
  return pulite.length ? pulite : ['ita'];
}

function rinviaChiusura() {
  if (timerInattivita) clearTimeout(timerInattivita);
  timerInattivita = setTimeout(() => {
    if (!inUso) chiudiMotore();
  }, INATTIVITA_MS);
  // Un timer di pulizia non deve tenere sveglio il processo all'uscita dell'app.
  if (timerInattivita.unref) timerInattivita.unref();
}

async function chiudiMotore() {
  const aperti = [worker, workerOsd].filter(Boolean);
  worker = null;
  workerOsd = null;
  chiaveLingue = '';
  if (timerInattivita) { clearTimeout(timerInattivita); timerInattivita = null; }
  for (const w of aperti) {
    try { await w.terminate(); } catch (errore) { console.error('[OCR] Terminazione worker:', errore); }
  }
}

// ── Rilevamento dell'orientamento ────────────────────────────────────────────────────────
// Worker a sé: l'OSD esiste solo nel motore legacy di Tesseract (OEM 0), il riconoscimento
// gira sull'LSTM. Un worker combinato caricherebbe i modelli legacy di OGNI lingua, che i
// dati `tessdata_fast` installati da `ocrLangs` nemmeno contengono.
let workerOsd = null;

/**
 * Da qui in su la rotazione si applica senza discutere. È la soglia predefinita di OCRmyPDF
 * (`--rotate-pages-threshold`). Fra `SOGLIA_MINIMA_ORIENTAMENTO` e questa la proposta è
 * `incerto` e il servizio la verifica riconoscendo nei due versi: su una carta di sei righe
 * a 200 dpi il verso giusto usciva con 13,06, cioè scartato da una soglia secca.
 * Sotto il minimo l'OSD tira a indovinare (pagine quasi bianche) e la proposta si ignora.
 */
const SOGLIA_ORIENTAMENTO = 14;
const SOGLIA_MINIMA_ORIENTAMENTO = 2;

function orientamentoDisponibile() { return linguaInstallata('osd'); }

/**
 * Di quanti gradi (0/90/180/270, senso orario) va ruotata `sorgente` per avere il testo
 * dritto. `null` se l'OSD non è installato o non ha trovato abbastanza testo per decidere;
 * `incerto` se ha un'ipotesi sotto soglia, che il chiamante deve verificare prima di applicarla.
 */
async function rilevaOrientamento(sorgente): Promise<{ gradi: number; confidenza: number; incerto: boolean } | null> {
  if (!orientamentoDisponibile()) return null;
  if (!workerOsd) {
    const { createWorker } = require('tesseract.js');
    workerOsd = await createWorker('osd', 0, {
      langPath: cartellaLingue(),
      gzip: false,
      cacheMethod: 'none',
      legacyCore: true,
      legacyLang: true,
      errorHandler: (e) => console.error('[OCR] Errore worker OSD:', e)
    });
  }
  inUso = true;
  try {
    const { data } = await workerOsd.detect(sorgente);
    // `orientation_degrees` è già la correzione oraria: verificato su una carta ruotata nei
    // quattro versi (90° orari → 270, 270° orari → 90).
    const gradi = Number(data && data.orientation_degrees);
    const confidenza = Number(data && data.orientation_confidence) || 0;
    if (![0, 90, 180, 270].includes(gradi)) return null;
    if (gradi !== 0 && confidenza < SOGLIA_MINIMA_ORIENTAMENTO) return { gradi: 0, confidenza, incerto: false };
    return { gradi, confidenza, incerto: gradi !== 0 && confidenza < SOGLIA_ORIENTAMENTO };
  } catch (errore) {
    // Pagina bianca o quasi: DetectOS fallisce, e non è un motivo per fermare l'OCR.
    console.error('[OCR] Rilevamento orientamento:', errore);
    return null;
  } finally {
    inUso = false;
    rinviaChiusura();
  }
}

/** Lingue richieste ma non installate: si segnalano, non si scaricano di nascosto. */
function linguaMancanti(lingue) {
  return normalizzaLingue(lingue).filter(l => !linguaInstallata(l));
}

async function ottieniWorker(lingue, onProgresso) {
  const lista = normalizzaLingue(lingue);
  const chiave = lista.slice().sort().join('+');

  if (worker && chiaveLingue === chiave) {
    rinviaChiusura();
    return worker;
  }
  if (worker) await chiudiMotore();

  // `require` differito: caricare tesseract.js all'avvio dell'app costerebbe a tutti, anche a
  // chi non userà mai l'OCR. Qui lo paga solo il primo riconoscimento.
  const { createWorker } = require('tesseract.js');

  worker = await createWorker(lista, 1, {
    langPath: cartellaLingue(),
    // I file sono già decompressi da `installaLingua`: con `gzip: true` tesseract cercherebbe
    // un `.traineddata.gz` che non c'è e fallirebbe dopo il download apparentemente riuscito.
    gzip: false,
    // Nessuna cache: i dati sono già i nostri file su disco, una seconda copia in userData
    // sarebbe solo spazio occupato due volte.
    cacheMethod: 'none',
    logger: (m) => {
      if (typeof onProgresso === 'function' && m && typeof m.progress === 'number') {
        onProgresso({ fase: m.status, progresso: m.progress });
      }
    },
    errorHandler: (e) => console.error('[OCR] Errore worker:', e)
  });

  chiaveLingue = chiave;
  rinviaChiusura();
  return worker;
}

/** blocks → un array piatto di righe, la forma che `ocrText.ts` sa trattare. */
function righeDaBlocchi(blocchi) {
  const righe = [];
  for (const b of blocchi || []) {
    for (const p of (b.paragraphs || [])) {
      for (const l of (p.lines || [])) {
        righe.push({
          text: l.text,
          confidence: l.confidence,
          words: (l.words || []).map(w => ({ text: w.text, confidence: w.confidence }))
        });
      }
      // Fine paragrafo: `ocrText.raggruppaParagrafi` legge la riga vuota come separatore.
      righe.push('');
    }
  }
  return righe;
}

/**
 * Riconosce un'immagine. `sorgente` è un percorso su disco (allegato immagine) oppure un
 * Buffer (pagina PDF appena rasterizzata): tesseract.js accetta entrambi in Node.
 *
 * `pdf`: `'testo'` chiede anche la pagina PDF di solo testo invisibile, `'completa'` quella
 * con l'immagine sotto (vedi `pdfRicercabile.ts`). Il PDF lo scrive il renderer di
 * Tesseract nel worker thread, sullo stesso riconoscimento: nessuna seconda passata.
 */
async function riconosci(sorgente, lingue, onProgresso, pdf?: 'testo' | 'completa') {
  const mancanti = linguaMancanti(lingue);
  if (mancanti.length) {
    // `any` esplicito: il codice d'errore viaggia fino al renderer, che lo traduce in un
    // messaggio, e un `Error` nudo perderebbe l'unica informazione utile — quali lingue.
    const errore: any = new Error(`Lingue non installate: ${mancanti.join(', ')}`);
    errore.codice = 'lingue_mancanti';
    errore.lingue = mancanti;
    throw errore;
  }

  const w = await ottieniWorker(lingue, onProgresso);
  inUso = true;
  try {
    const risultato = await w.recognize(
      sorgente,
      pdf ? { pdfTitle: 'ArchiView OCR', pdfTextOnly: pdf === 'testo' } : {},
      { text: true, blocks: true, pdf: !!pdf }
    );
    const dati = (risultato && risultato.data) || {};
    return {
      righe: righeDaBlocchi(dati.blocks),
      testoGrezzo: dati.text || '',
      confidenza: typeof dati.confidence === 'number' ? dati.confidence : 0,
      pdf: pdf && dati.pdf ? Uint8Array.from(dati.pdf) : null
    };
  } finally {
    inUso = false;
    rinviaChiusura();
  }
}

module.exports = {
  riconosci, chiudiMotore, linguaMancanti, normalizzaLingue, righeDaBlocchi,
  rilevaOrientamento, orientamentoDisponibile, SOGLIA_ORIENTAMENTO, SOGLIA_MINIMA_ORIENTAMENTO
};
export {};
