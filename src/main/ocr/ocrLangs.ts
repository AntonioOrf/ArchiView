// Pacchetti lingua dell'OCR (Fase 2.3).
//
// I dati di Tesseract NON sono imbarcati nel bundle: sono decine di MB per lingua e il
// singolo ricercatore ne usa due. Vivono in `userData/ocr-langs/`, si installano su richiesta
// esplicita dell'utente dal pannello delle impostazioni e si rimuovono allo stesso modo.
// Sono per macchina, non per workspace: la lingua di un archivio non ha motivo di essere
// riscaricata per ogni archivio aperto sullo stesso PC.
//
// Dopo l'installazione il riconoscimento è completamente offline: la rete serve solo qui.

const { app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const zlib = require('zlib');

// tessdata_fast: la variante che il progetto Tesseract raccomanda per l'uso generale.
// I modelli "best" sono 3-4 volte più lenti a parità di resa su stampato, e su hardware
// low-end (il caso che questa applicazione prende sul serio) la differenza si sente.
const BASE_URL = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/';

/**
 * Lingue proposte nel pannello. L'elenco è volutamente corto e centrato sul dominio:
 * italiano e latino per il testo dei documenti, le tre lingue della bibliografia
 * paleografica europea, l'inglese per gli inventari moderni, e `osd` che non è una lingua
 * ma il rilevatore di orientamento — è ciò che raddrizza una scansione storta.
 */
const LINGUE_NOTE = [
  { codice: 'ita', nome: 'Italiano' },
  { codice: 'lat', nome: 'Latino' },
  { codice: 'eng', nome: 'Inglese' },
  { codice: 'fra', nome: 'Francese' },
  { codice: 'deu', nome: 'Tedesco' },
  { codice: 'spa', nome: 'Spagnolo' },
  { codice: 'ita_old', nome: 'Italiano (ortografia antica)' },
  { codice: 'osd', nome: 'Rilevamento orientamento' }
];

/** Un codice lingua è `[a-z]{3}` più eventuale suffisso: nient'altro finisce in un path. */
function codiceValido(codice) {
  return typeof codice === 'string' && /^[a-z]{3}(_[a-z]+)?$/.test(codice);
}

function cartellaLingue() {
  const dir = path.join(app.getPath('userData'), 'ocr-langs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function percorsoLingua(codice) {
  if (!codiceValido(codice)) throw new Error(`Codice lingua non valido: ${codice}`);
  return path.join(cartellaLingue(), `${codice}.traineddata`);
}

function linguaInstallata(codice) {
  try {
    return codiceValido(codice) && fs.existsSync(percorsoLingua(codice));
  } catch {
    return false;
  }
}

/** Codici installati sul disco, anche quelli fuori da `LINGUE_NOTE` (copiati a mano dall'utente). */
function codiciInstallati(): string[] {
  try {
    return fs.readdirSync(cartellaLingue())
      .filter(f => f.endsWith('.traineddata'))
      .map(f => f.slice(0, -'.traineddata'.length))
      .filter(codiceValido)
      .sort();
  } catch {
    return [];
  }
}

/** Elenco per la UI: le lingue note più quelle trovate sul disco e non previste dall'elenco. */
function listaLingue() {
  const installate = new Set<string>(codiciInstallati());
  const out = LINGUE_NOTE.map(l => ({
    ...l,
    installata: installate.has(l.codice),
    dimensione: installate.has(l.codice) ? dimensioneLingua(l.codice) : 0
  }));
  for (const c of installate) {
    if (!LINGUE_NOTE.some(l => l.codice === c)) {
      out.push({ codice: c, nome: c, installata: true, dimensione: dimensioneLingua(c) });
    }
  }
  return out;
}

function dimensioneLingua(codice) {
  try {
    return fs.statSync(percorsoLingua(codice)).size;
  } catch {
    return 0;
  }
}

/**
 * Scarica e installa un pacchetto lingua.
 *
 * Scrittura su `.part` e rename finale: senza, un'interruzione di rete lascerebbe sul disco
 * un `.traineddata` troncato che Tesseract accetta come valido e che fa fallire ogni OCR
 * successivo con un errore incomprensibile. È lo stesso accorgimento di `zipStreaming.ts`.
 */
async function installaLingua(codice) {
  if (!codiceValido(codice)) return { ok: false, errore: 'codice_non_valido' };
  if (linguaInstallata(codice)) return { ok: true, gia: true };

  const destinazione = percorsoLingua(codice);
  const temporaneo = destinazione + '.part';

  try {
    // Prima si tenta il `.gz` (circa un terzo del peso), poi il file nudo: non tutte le
    // lingue del repository hanno l'archivio compresso.
    let dati = null;
    for (const [url, comprimuto] of [
      [BASE_URL + codice + '.traineddata.gz', true],
      [BASE_URL + codice + '.traineddata', false]
    ]) {
      const risposta = await net.fetch(url);
      if (!risposta.ok) continue;
      const buffer = Buffer.from(await risposta.arrayBuffer());
      dati = comprimuto ? zlib.gunzipSync(buffer) : buffer;
      break;
    }

    if (!dati || dati.length < 1024) {
      return { ok: false, errore: 'non_trovata' };
    }

    await fsp.writeFile(temporaneo, dati);
    await fsp.rename(temporaneo, destinazione);
    return { ok: true, dimensione: dati.length };
  } catch (errore) {
    console.error(`[OCR] Installazione lingua ${codice} fallita:`, errore);
    try { if (fs.existsSync(temporaneo)) await fsp.unlink(temporaneo); } catch { /* best effort */ }
    return { ok: false, errore: errore && errore.message ? errore.message : 'rete' };
  }
}

async function rimuoviLingua(codice) {
  if (!codiceValido(codice)) return { ok: false, errore: 'codice_non_valido' };
  try {
    const p = percorsoLingua(codice);
    if (fs.existsSync(p)) await fsp.unlink(p);
    return { ok: true };
  } catch (errore) {
    console.error(`[OCR] Rimozione lingua ${codice} fallita:`, errore);
    return { ok: false, errore: errore && errore.message ? errore.message : 'io' };
  }
}

module.exports = {
  LINGUE_NOTE,
  codiceValido,
  cartellaLingue,
  percorsoLingua,
  linguaInstallata,
  codiciInstallati,
  listaLingue,
  installaLingua,
  rimuoviLingua
};
export {};
