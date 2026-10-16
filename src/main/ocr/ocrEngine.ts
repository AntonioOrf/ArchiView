import { linguaInstallata, cartellaLingue } from './ocrLangs';

const INATTIVITA_MS = 120000;

let worker: any = null;
let chiaveLingue = '';
let timerInattivita: NodeJS.Timeout | null = null;
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

let workerOsd: any = null;

const SOGLIA_ORIENTAMENTO = 14;
const SOGLIA_MINIMA_ORIENTAMENTO = 2;

function orientamentoDisponibile() { return linguaInstallata('osd'); }

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
    const gradi = Number(data && data.orientation_degrees);
    const confidenza = Number(data && data.orientation_confidence) || 0;
    if (![0, 90, 180, 270].includes(gradi)) return null;
    if (gradi !== 0 && confidenza < SOGLIA_MINIMA_ORIENTAMENTO) return { gradi: 0, confidenza, incerto: false };
    return { gradi, confidenza, incerto: gradi !== 0 && confidenza < SOGLIA_ORIENTAMENTO };
  } catch (errore) {
    console.error('[OCR] Rilevamento orientamento:', errore);
    return null;
  } finally {
    inUso = false;
    rinviaChiusura();
  }
}

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

  const { createWorker } = require('tesseract.js');

  worker = await createWorker(lista, 1, {
    langPath: cartellaLingue(),
    gzip: false,
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

function righeDaBlocchi(blocchi) {
  const righe: any[] = [];
  for (const b of blocchi || []) {
    for (const p of (b.paragraphs || [])) {
      for (const l of (p.lines || [])) {
        righe.push({
          text: l.text,
          confidence: l.confidence,
          words: (l.words || []).map(w => ({ text: w.text, confidence: w.confidence }))
        });
      }
      righe.push('');
    }
  }
  return righe;
}

async function riconosci(sorgente, lingue, onProgresso, pdf?: 'testo' | 'completa') {
  const mancanti = linguaMancanti(lingue);
  if (mancanti.length) {
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

export { riconosci, chiudiMotore, linguaMancanti, normalizzaLingue, righeDaBlocchi, rilevaOrientamento, orientamentoDisponibile, SOGLIA_ORIENTAMENTO, SOGLIA_MINIMA_ORIENTAMENTO };
