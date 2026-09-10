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
  const w = worker;
  worker = null;
  chiaveLingue = '';
  if (timerInattivita) { clearTimeout(timerInattivita); timerInattivita = null; }
  if (w) {
    try { await w.terminate(); } catch (errore) { console.error('[OCR] Terminazione worker:', errore); }
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
 */
async function riconosci(sorgente, lingue, onProgresso) {
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
    const risultato = await w.recognize(sorgente, {}, { text: true, blocks: true });
    const dati = (risultato && risultato.data) || {};
    return {
      righe: righeDaBlocchi(dati.blocks),
      testoGrezzo: dati.text || '',
      confidenza: typeof dati.confidence === 'number' ? dati.confidence : 0
    };
  } finally {
    inUso = false;
    rinviaChiusura();
  }
}

module.exports = { riconosci, chiudiMotore, linguaMancanti, normalizzaLingue, righeDaBlocchi };
export {};
