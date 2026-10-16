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

const LARGHEZZA_PDF = 595.28;

const RIDUZIONI_INSIEME = 3;

function uscita(): Directory {
  const d = new Directory(Paths.cache, 'uscita');
  if (d.exists) d.delete();
  d.create({ intermediates: true });
  return d;
}

/** ponytail: percorsi dei font fissi; se un
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

/** ponytail: tiene tutte le foto (ridotte da `perPdf`) in memoria; se centinaia di pagine non
 * bastano ancora, PDF a volumi (PIANO-OTTIMIZZAZIONE-MOBILE, 1c).
 */
async function pdfDi(d: Documento, ricercabile: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(d.nome);
  pdf.setCreator('ArchiScanner');
  const font = ricercabile ? await fontStrato(pdf) : null;
  const ammessi = new Set(font?.getCharacterSet() ?? []);
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

export function cartellaSalvata(): string | null {
  try {
    const f = fileSalva();
    return f.exists ? (JSON.parse(f.textSync()).cartella as string) || null : null;
  } catch (e) {
    console.warn('[esporta] cartella salvata illeggibile', e);
    return null;
  }
}

export const annullato = (e: any) => e?.code === 'ERR_PICKER_CANCELLED' || /cancelled by the user/i.test(String(e?.message));

export async function scegliCartella(): Promise<Directory> {
  const dir = await Directory.pickDirectoryAsync();
  fileSalva().write(JSON.stringify({ cartella: dir.uri }));
  return dir;
}

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
