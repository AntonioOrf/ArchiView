const fsp = require('fs').promises;
import * as path from 'path';
let _pdfLib: any = null;
const pdfLib = () => (_pdfLib ??= require('pdf-lib'));

type Sessione = { percorso: string; doc: any; pagine: number };

let sessione: Sessione | null = null;

function attiva(): boolean { return sessione !== null; }

async function apri(percorso: string) {
  sessione = { percorso, doc: await pdfLib().PDFDocument.create(), pagine: 0 };
  sessione.doc.setProducer('ArchiView');
  sessione.doc.setTitle(path.basename(percorso, path.extname(percorso)));
}

function richiediSessione(): Sessione {
  if (!sessione) throw new Error('Nessun PDF ricercabile in preparazione');
  return sessione;
}

function eJpeg(b: Buffer) { return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; }

function orientamentoExif(b: Buffer): number {
  const testa = Array.from(b.subarray(0, 500)).join(' ');
  const m = testa.match(/1 18 0 3 0 0 0 1 0 (\d)/);
  return (m && parseInt(m[1], 10)) || 1;
}

function immagineIncorporabile(b: Buffer): boolean {
  return eJpeg(b) && orientamentoExif(b) === 1;
}

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
    rotate: pdfLib().degrees(rot)
  });
}

async function aggiungiPdf(percorsoSorgente: string, livelli: Map<number, Uint8Array>, rotazioni?: Map<number, number>) {
  const s = richiediSessione();
  const byte = await fsp.readFile(percorsoSorgente);
  let sorgente;
  try {
    sorgente = await pdfLib().PDFDocument.load(byte, { updateMetadata: false });
  } catch (errore) {
    const e: any = new Error(`PDF non copiabile: ${errore && errore.message}`);
    e.codice = /is encrypted/i.test(String(errore && errore.message)) ? 'pdf_cifrato' : 'pdf_illeggibile';
    throw e;
  }
  const copiate = await s.doc.copyPages(sorgente, sorgente.getPageIndices());
  for (let i = 0; i < copiate.length; i++) {
    const pagina = s.doc.addPage(copiate[i]);
    const extra = (rotazioni && rotazioni.get(i + 1)) || 0;
    if (extra) pagina.setRotation(pdfLib().degrees(((pagina.getRotation().angle || 0) + extra) % 360));
    const livello = livelli.get(i + 1);
    if (livello) await sovrapponiTesto(s.doc, pagina, livello);
    s.pagine++;
  }
}

async function aggiungiImmagine(percorsoSorgente: string, pdfTesseract: Uint8Array | null, incorporabile: boolean, rotazione = 0) {
  const s = richiediSessione();
  if (!pdfTesseract) throw new Error('Il motore non ha prodotto la pagina PDF');

  if (!incorporabile) {
    const completa = await pdfLib().PDFDocument.load(pdfTesseract);
    const [pagina] = await s.doc.copyPages(completa, [0]);
    s.doc.addPage(pagina);
    s.pagine++;
    return;
  }

  const byte = await fsp.readFile(percorsoSorgente);
  const immagine = await s.doc.embedJpg(byte);
  const [strato] = await s.doc.embedPdf(pdfTesseract, [0]);
  const verticale = rotazione === 90 || rotazione === 270;
  const w = verticale ? strato.height : strato.width;
  const h = verticale ? strato.width : strato.height;
  const pagina = s.doc.addPage([w, h]);
  pagina.drawImage(immagine, { x: 0, y: 0, width: w, height: h });
  if (rotazione) pagina.setRotation(pdfLib().degrees(rotazione));
  disegnaStrato(pagina, strato);
  s.pagine++;
}

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

export { apri, attiva, aggiungiPdf, aggiungiImmagine, concludi, immagineIncorporabile };
