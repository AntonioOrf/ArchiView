// PDF ricercabile: l'allegato originale con sopra il testo dell'OCR, invisibile.
//
// ── Due fonti, due ruoli ─────────────────────────────────────────────────────────────────
// Il livello testo lo scrive Tesseract (`pdfTextOnly`): è l'unico che sa posizionare ogni
// parola sulla sua riga e che porta un font senza glifi con la mappa Unicode, cioè che
// regge `ſ`, `ꝑ` e gli altri segni che un font standard di pdf-lib (WinAnsi) rifiuterebbe.
// La pagina sotto, invece, NON è la raster dell'OCR: è la pagina originale copiata con
// pdf-lib. Rimettere la PNG a 300 dpi al posto di un PDF vettoriale o di una scansione JPEG
// moltiplicherebbe il peso del file e ne peggiorerebbe la resa, per un testo che serve
// solo a essere cercato e copiato.
//
// ── Una sessione alla volta ──────────────────────────────────────────────────────────────
// Il documento si costruisce allegato dopo allegato mentre l'OCR procede, e si scrive su
// disco una volta sola a `concludi`. Vive qui e non viaggia via IPC: i byte di un fascicolo
// non hanno ragione di passare dal renderer, e il percorso di destinazione lo sceglie il
// dialogo del main, non il renderer. Un solo OCR alla volta (`ocrService`) ⇒ una sola
// sessione.

const fsp = require('fs').promises;
const path = require('path');
const { PDFDocument, degrees } = require('pdf-lib');

type Sessione = { percorso: string; doc: any; pagine: number };

let sessione: Sessione | null = null;

function attiva(): boolean { return sessione !== null; }

async function apri(percorso: string) {
  sessione = { percorso, doc: await PDFDocument.create(), pagine: 0 };
  sessione.doc.setProducer('ArchiView');
  sessione.doc.setTitle(path.basename(percorso, path.extname(percorso)));
}

function richiediSessione(): Sessione {
  if (!sessione) throw new Error('Nessun PDF ricercabile in preparazione');
  return sessione;
}

function eJpeg(b: Buffer) { return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; }

/**
 * Orientamento EXIF, con la stessa euristica di tesseract.js (`worker-script/utils/setImage`):
 * il motore raddrizza la foto PRIMA di riconoscerla, pdf-lib incorpora il JPEG così com'è.
 * Se i due non concordano il testo finirebbe ruotato rispetto alla carta.
 */
function orientamentoExif(b: Buffer): number {
  const testa = Array.from(b.subarray(0, 500)).join(' ');
  const m = testa.match(/1 18 0 3 0 0 0 1 0 (\d)/);
  return (m && parseInt(m[1], 10)) || 1;
}

/**
 * Il JPEG si può incorporare tale e quale (nessuna ricodifica, costo nullo). Tutto il resto
 * — PNG, TIFF, WebP, JPEG ruotati — prende la pagina completa di Tesseract: `embedPng` di
 * pdf-lib decodifica e ricomprime i pixel in JS, cioè secondi di event loop del main
 * bloccato su una scansione grande, mentre Tesseract lo fa nel suo worker thread.
 */
function immagineIncorporabile(b: Buffer): boolean {
  return eJpeg(b) && orientamentoExif(b) === 1;
}

/**
 * Sovrappone la pagina di solo testo di Tesseract a una pagina esistente.
 *
 * Tesseract ha visto la pagina come la mostra pdf.js: ritagliata sul CropBox e già ruotata
 * da `/Rotate`. Il contenuto di una pagina PDF si disegna invece nello spazio NON ruotato:
 * il livello va quindi ruotato dello stesso angolo attorno all'angolo giusto del CropBox,
 * altrimenti su una carta girata di 90° la ricerca evidenzierebbe il vuoto.
 */
async function sovrapponiTesto(doc: any, pagina: any, livello: Uint8Array) {
  const [strato] = await doc.embedPdf(livello, [0]);
  disegnaStrato(pagina, strato);
}

function disegnaStrato(pagina: any, strato: any) {
  const box = pagina.getCropBox();
  const rot = (((pagina.getRotation().angle || 0) % 360) + 360) % 360;
  const verticale = rot === 90 || rot === 270;
  let x = box.x;
  let y = box.y;
  if (rot === 90) x = box.x + box.width;
  else if (rot === 180) { x = box.x + box.width; y = box.y + box.height; }
  else if (rot === 270) y = box.y + box.height;
  pagina.drawPage(strato, {
    x,
    y,
    width: verticale ? box.height : box.width,
    height: verticale ? box.width : box.height,
    rotate: degrees(rot)
  });
}

/**
 * Accoda un PDF allegato: tutte le sue pagine, anche quelle oltre il limite dell'OCR (un PDF
 * ricercabile con pagine mancanti sarebbe un documento diverso dall'originale). `livelli` ha
 * il testo delle sole pagine riconosciute; quelle col testo già nel file restano intatte.
 *
 * `rotazioni`: pagine scansionate di traverso, raddrizzate prima dell'OCR. Si sommano a
 * `/Rotate`, che cambia solo come la pagina si mostra: nessuna ricodifica, nessuna perdita.
 * Va fatto PRIMA di sovrapporre il testo, che Tesseract ha letto sulla pagina già raddrizzata.
 */
async function aggiungiPdf(percorsoSorgente: string, livelli: Map<number, Uint8Array>, rotazioni?: Map<number, number>) {
  const s = richiediSessione();
  const byte = await fsp.readFile(percorsoSorgente);
  let sorgente;
  try {
    sorgente = await PDFDocument.load(byte, { updateMetadata: false });
  } catch (errore) {
    // pdf-lib non decifra: con `ignoreEncryption` copierebbe flussi ancora cifrati, cioè
    // pagine bianche. Meglio dirlo che consegnare un PDF che sembra riuscito.
    const e: any = new Error(`PDF non copiabile: ${errore && errore.message}`);
    // Né `name` né `instanceof`: pdf-lib è compilato in ES5, le sue classi d'errore estendono
    // `Error` via tslib e perdono entrambi. Resta il messaggio, fissato dalla libreria.
    e.codice = /is encrypted/i.test(String(errore && errore.message)) ? 'pdf_cifrato' : 'pdf_illeggibile';
    throw e;
  }
  const copiate = await s.doc.copyPages(sorgente, sorgente.getPageIndices());
  for (let i = 0; i < copiate.length; i++) {
    const pagina = s.doc.addPage(copiate[i]);
    const extra = (rotazioni && rotazioni.get(i + 1)) || 0;
    if (extra) pagina.setRotation(degrees(((pagina.getRotation().angle || 0) + extra) % 360));
    const livello = livelli.get(i + 1);
    if (livello) await sovrapponiTesto(s.doc, pagina, livello);
    s.pagine++;
  }
}

/**
 * Accoda un'immagine. `pdfTesseract` è il livello di solo testo se l'immagine è
 * incorporabile, altrimenti la pagina completa (immagine + testo) prodotta dal motore.
 *
 * `rotazione`: gradi orari con cui l'immagine è stata raddrizzata per l'OCR. La pagina
 * completa di Tesseract è già dritta (il motore ha visto la PNG ruotata); il JPEG incorporato
 * resta com'è nel file e si raddrizza con `/Rotate`.
 */
async function aggiungiImmagine(percorsoSorgente: string, pdfTesseract: Uint8Array, incorporabile: boolean, rotazione = 0) {
  const s = richiediSessione();
  if (!pdfTesseract) throw new Error('Il motore non ha prodotto la pagina PDF');

  if (!incorporabile) {
    const completa = await PDFDocument.load(pdfTesseract);
    const [pagina] = await s.doc.copyPages(completa, [0]);
    s.doc.addPage(pagina);
    s.pagine++;
    return;
  }

  const byte = await fsp.readFile(percorsoSorgente);
  const immagine = await s.doc.embedJpg(byte);
  // Dimensioni prese dalla pagina di Tesseract: il motore le ricava dai dpi dichiarati nel
  // file, e usare le stesse evita di dover indovinare una risoluzione per ogni scansione.
  const [strato] = await s.doc.embedPdf(pdfTesseract, [0]);
  // Lo strato è orientato come il testo dritto; la pagina come il JPEG nel file.
  const verticale = rotazione === 90 || rotazione === 270;
  const w = verticale ? strato.height : strato.width;
  const h = verticale ? strato.width : strato.height;
  const pagina = s.doc.addPage([w, h]);
  pagina.drawImage(immagine, { x: 0, y: 0, width: w, height: h });
  if (rotazione) pagina.setRotation(degrees(rotazione));
  disegnaStrato(pagina, strato);
  s.pagine++;
}

/**
 * Chiude la sessione. `scarta` (annullamento, nessuna pagina) non scrive nulla. La scrittura
 * passa da un `.tmp` + `rename`: un PDF troncato a metà da un errore di disco sovrascriverebbe
 * un file che l'utente poteva avere già, e sembrerebbe comunque un PDF.
 */
async function concludi(scarta: boolean) {
  const s = sessione;
  sessione = null;
  if (!s) return { ok: true, pagine: 0 };
  if (scarta || s.pagine === 0) return { ok: true, pagine: 0, scartato: true };

  const tmp = s.percorso + '.tmp';
  try {
    const byte = await s.doc.save({ useObjectStreams: true });
    await fsp.writeFile(tmp, byte);
    await fsp.rename(tmp, s.percorso);
    return { ok: true, pagine: s.pagine, nome: path.basename(s.percorso) };
  } catch (errore) {
    await fsp.unlink(tmp).catch(() => {});
    throw errore;
  }
}

module.exports = { apri, attiva, aggiungiPdf, aggiungiImmagine, concludi, immagineIncorporabile };
export {};
