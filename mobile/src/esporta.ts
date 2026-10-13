// Fase 15c — uscita dei Documenti: PDF (pdf-lib, puro JS) o JPEG, condivisi col menu di Android
// (expo-sharing, un file per volta) o salvati in una cartella scelta una volta con lo Storage
// Access Framework (permesso persistente; si ricorda in `documenti/salva.json`).

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { paroleOcr, uriUscita } from './documenti';
import { perPdf } from './immagini';
import { t } from './lingua';
import { nomeFile, nomiImmagini, type Documento } from './elencoDocumenti';
import { soloCaratteri, stratoTesto } from './testo';

export type Formato = 'pdf' | 'jpeg';

/** Larghezza di pagina del PDF in punti (A4); l'altezza segue le proporzioni della foto. */
const LARGHEZZA_PDF = 595.28;

/** Pagine ridotte insieme per il PDF (vedi `pdfDi`). */
const RIDUZIONI_INSIEME = 3;

/** Cartella temporanea dell'uscita: si svuota a ogni esportazione, così non cresce. */
function uscita(): Directory {
  const d = new Directory(Paths.cache, 'uscita');
  if (d.exists) d.delete();
  d.create({ intermediates: true });
  return d;
}

/**
 * F12: font dello strato di testo. Un font di sistema di Android (latino, greco, cirillico), così
 * l'APK non porta font; in sottoinsieme, solo i glifi usati. Nessuno leggibile: Helvetica (WinAnsi).
 * Su Android 12+ Roboto è un font variabile: provato in Node (12/10) con Segoe UI Variable, il
 * sottoinsieme regge e pdf.js estrae greco e cirillico. ponytail: percorsi dei font fissi; se un
 * produttore li sposta si torna a Helvetica (si vede: «?» al posto dei caratteri non latini).
 */
const FONT_SISTEMA = ['/system/fonts/Roboto-Regular.ttf', '/system/fonts/NotoSans-Regular.ttf', '/system/fonts/DroidSans.ttf'];

async function fontStrato(pdf: PDFDocument): Promise<PDFFont> {
  pdf.registerFontkit(fontkit);
  for (const p of FONT_SISTEMA) {
    try {
      const f = new File(`file://${p}`);
      if (f.exists) return await pdf.embedFont(await f.bytes(), { subset: true });
    } catch (e) {
      console.warn('[esporta] font di sistema non usabile', p, e);
    }
  }
  return pdf.embedFont(StandardFonts.Helvetica);
}

/**
 * Un PDF con una pagina per foto, larga A4. `ricercabile` (15e): sotto ogni foto le parole
 * dell'OCR, invisibili, dove stanno nella foto (chi chiama ha già fatto `riconosci`; le pagine
 * senza parole aggiornate restano solo immagine). Font: `fontStrato` (F12); fuori dal font, «?».
 * ponytail: tiene tutte le foto (ridotte da `perPdf`) in memoria; se centinaia di pagine non
 * bastano ancora, PDF a volumi (PIANO-OTTIMIZZAZIONE-MOBILE, 1c).
 */
async function pdfDi(d: Documento, ricercabile: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(d.nome);
  pdf.setCreator('ArchiScanner');
  const font = ricercabile ? await fontStrato(pdf) : null;
  const ammessi = new Set(font?.getCharacterSet() ?? []);
  // `perPdf` decodifica fuori dal thread JS: qualche pagina insieme sfrutta i core (una bitmap
  // intera in memoria per pagina del gruppo).
  for (let i = 0; i < d.pagine.length; i += RIDUZIONI_INSIEME) {
    const gruppo = d.pagine.slice(i, i + RIDUZIONI_INSIEME);
    const ridotte = await Promise.all(gruppo.map(p => perPdf(uriUscita(d, p))));
    for (const [k, p] of gruppo.entries()) {
      const foto = ridotte[k];
      const img = await pdf.embedJpg(foto.bytes);
      const h = LARGHEZZA_PDF * img.height / img.width;
      const pagina = pdf.addPage([LARGHEZZA_PDF, h]);
      pagina.drawImage(img, { x: 0, y: 0, width: LARGHEZZA_PDF, height: h });
      const parole = font && paroleOcr(d, p);
      if (!font || !parole) continue;
      const strato = stratoTesto(parole.map(x => ({ ...x, t: soloCaratteri(x.t, ammessi) })), { w: foto.w, h: foto.h }, { w: LARGHEZZA_PDF, h }, t => font.widthOfTextAtSize(t, 1));
      for (const s of strato) pagina.drawText(s.t, { x: s.x, y: s.y, size: s.size, font, opacity: 0 });
    }
  }
  return pdf.save();
}

/** Condivide il documento: il PDF, o la sola immagine se il documento ha una pagina. */
export async function condividi(d: Documento, formato: Formato, ricercabile = false): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(t('Condivisione non disponibile su questo telefono'));
  const dir = uscita();
  if (formato === 'pdf') {
    const f = new File(dir, `${nomeFile(d.nome)}.pdf`);
    f.write(await pdfDi(d, ricercabile));
    return Sharing.shareAsync(f.uri, { mimeType: 'application/pdf', dialogTitle: d.nome });
  }
  if (d.pagine.length !== 1) throw new Error(t('Si condivide una sola immagine per volta: usa il PDF o «Salva»'));
  const f = new File(dir, nomiImmagini(d.nome, 1)[0]);
  await new File(uriUscita(d, d.pagine[0])).copy(f);
  return Sharing.shareAsync(f.uri, { mimeType: 'image/jpeg', dialogTitle: d.nome });
}

function fileSalva(): File {
  return new File(Paths.document, 'documenti', 'salva.json');
}

/** La cartella scelta l'ultima volta (URI `content://`), se c'è. */
export function cartellaSalvata(): string | null {
  try {
    const f = fileSalva();
    return f.exists ? (JSON.parse(f.textSync()).cartella as string) || null : null;
  } catch (e) {
    console.warn('[esporta] cartella salvata illeggibile', e);
    return null;
  }
}

/** L'utente ha chiuso il selettore di cartella senza scegliere: non è un errore da mostrare. */
export const annullato = (e: any) => e?.code === 'ERR_PICKER_CANCELLED' || /cancelled by the user/i.test(String(e?.message));

/** Fa scegliere la cartella a Android e la ricorda. Annullato → errore (vedi `annullato`). */
export async function scegliCartella(): Promise<Directory> {
  const dir = await Directory.pickDirectoryAsync();
  fileSalva().write(JSON.stringify({ cartella: dir.uri }));
  return dir;
}

/**
 * Salva il documento nella cartella ricordata (o la fa scegliere). Se la cartella non è più
 * scrivibile (permesso revocato, cartella cancellata) la fa scegliere di nuovo, una volta.
 * Restituisce i nomi dei file scritti (Android può aggiungere « (1)» se esistono già).
 */
export async function salva(d: Documento, formato: Formato, ricercabile = false): Promise<{ cartella: string; file: string[] }> {
  const scrivi = async (dir: Directory) => {
    if (formato === 'pdf') {
      const bytes = await pdfDi(d, ricercabile);
      const f = dir.createFile(`${nomeFile(d.nome)}.pdf`, 'application/pdf');
      f.write(bytes);
      return [f.name];
    }
    const nomi = nomiImmagini(d.nome, d.pagine.length);
    const fatti: string[] = [];
    for (const [i, p] of d.pagine.entries()) {
      const f = dir.createFile(nomi[i], 'image/jpeg');
      f.write(await new File(uriUscita(d, p)).bytes());
      fatti.push(f.name);
    }
    return fatti;
  };
  // Il ripiego vale solo se la cartella non si apre più: un errore a metà scrittura risale
  // (rifare tutto altrove lascerebbe file doppi).
  let dir: Directory | null = null;
  const ricordata = cartellaSalvata();
  if (ricordata) {
    try {
      const d = new Directory(ricordata);
      if (d.exists) dir = d;
    } catch (e) {
      console.warn('[esporta] cartella ricordata non accessibile, la richiedo', e);
    }
  }
  dir ??= await scegliCartella();
  return { cartella: dir.name, file: await scrivi(dir) };
}
