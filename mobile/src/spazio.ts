import { t } from './lingua';

/** ponytail: peso fisso per pagina (JPEG di ML Kit 3–5 MB); se sbaglia, media dei file in coda. */
export const PESO_FOTO = 5 * 1024 * 1024;
export const SOGLIA_FOTO = 150;

export const fotoRimaste = (byteLiberi: number) => Math.max(0, Math.floor(byteLiberi / PESO_FOTO));

export function avvisoSpazio(byteLiberi: number): string | null {
  if (!Number.isFinite(byteLiberi)) return null;
  const n = fotoRimaste(byteLiberi);
  if (n >= SOGLIA_FOTO) return null;
  return n === 0
    ? t('Il telefono è pieno: le pagine scansionate non si possono salvare. Libera spazio o invia le pagine in attesa.')
    : t('Sul telefono c\'è spazio per circa {n} foto. Libera spazio o invia le pagine in attesa.', { n });
}
