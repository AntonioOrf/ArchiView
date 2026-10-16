import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Images } from 'react-native-nitro-image';
import { createWorkletRuntime, runOnRuntimeAsync, type WorkletRuntime } from 'react-native-worklets';
import { applicaFiltro, nitidezza, quadratoCentrale, SOGLIA_NITIDEZZA, type Filtro } from './filtri';
import { misureJpeg, rettangoloRitaglio, type Riquadro } from './pagine';

const percorso = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));

let runtimeFiltri: WorkletRuntime | null = null;

const GRADI_EXIF: Record<number, number> = { 3: 180, 6: 90, 8: 270 };

/** ponytail: orientamenti specchiati (2, 4, 5, 7) non gestiti, le fotocamere non li producono.
 */
export async function filtrata(uriSorgente: string, filtro: Filtro, uriDest: string): Promise<void> {
  const img = await Images.loadFromFileAsync(percorso(uriSorgente));
  const raw = await img.toRawPixelDataAsync(false);
  runtimeFiltri ??= createWorkletRuntime({ name: 'filtri' });
  const buffer = await runOnRuntimeAsync(runtimeFiltri, (px: ArrayBuffer, f: Filtro, formato: string) => {
    'worklet';
    applicaFiltro(f, new Uint8Array(px), formato);
    return px;
  }, raw.buffer, filtro, raw.pixelFormat);
  let nuova = await Images.loadFromRawPixelDataAsync({ ...raw, buffer }, false);
  const gradi = GRADI_EXIF[misureDi(uriSorgente)?.orientamento ?? 1];
  if (gradi) nuova = await nuova.rotateAsync(gradi);
  await nuova.saveToFileAsync(percorso(uriDest), 'jpg', 95);
}

export async function sfocata(uri: string): Promise<boolean> {
  const img = await Images.loadFromFileAsync(percorso(uri));
  const [x0, y0, x1, y1] = quadratoCentrale(img.width, img.height);
  const raw = await (await img.cropAsync(x0, y0, x1, y1)).toRawPixelDataAsync(false);
  runtimeFiltri ??= createWorkletRuntime({ name: 'filtri' });
  const v = await runOnRuntimeAsync(runtimeFiltri, (px: ArrayBuffer, formato: string, w: number, h: number) => {
    'worklet';
    return nitidezza(new Uint8Array(px), formato, w, h);
  }, raw.buffer, raw.pixelFormat, raw.width, raw.height);
  return v < SOGLIA_NITIDEZZA;
}

export type Immagine = { uri: string; width: number; height: number };

export async function ruotata(uri: string): Promise<Immagine> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.rotate(90);
  return (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 1 });
}

const LATO_PDF = 3000;

const TESTA_JPEG = 1024 * 1024;

function misureDi(uri: string): ReturnType<typeof misureJpeg> {
  const fh = new File(uri).open();
  try {
    return misureJpeg(fh.readBytes(Math.min(TESTA_JPEG, fh.size ?? TESTA_JPEG)));
  } finally {
    fh.close();
  }
}

export async function perPdf(uri: string): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const m = misureDi(uri);
  if (m && m.orientamento === 1 && Math.max(m.w, m.h) <= LATO_PDF) return { bytes: await new File(uri).bytes(), w: m.w, h: m.h };
  const ctx = ImageManipulator.manipulate(uri);
  if (m && Math.max(m.w, m.h) > LATO_PDF) ctx.resize(m.w >= m.h ? { width: LATO_PDF } : { height: LATO_PDF });
  const img = await ctx.renderAsync();
  try {
    const out = new File((await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 })).uri);
    try {
      return { bytes: await out.bytes(), w: m?.w ?? img.width, h: m?.h ?? img.height };
    } finally {
      out.delete();
    }
  } finally {
    img.release();
  }
}

export async function ritagliata(uri: string, r: Riquadro): Promise<Immagine> {
  const intera = await ImageManipulator.manipulate(uri).renderAsync();
  const ctx = ImageManipulator.manipulate(uri);
  ctx.crop(rettangoloRitaglio(r, intera.width, intera.height));
  return (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 1 });
}
