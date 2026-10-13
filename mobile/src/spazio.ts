// Spazio libero prima dello scanner (F4): con la coda «solo Wi-Fi» le foto restano sul telefono
// tutto il giorno, e finire lo spazio a metà busta vuol dire perdere pagine.

import { t } from './lingua';

/** ponytail: peso fisso per pagina (JPEG di ML Kit 3–5 MB); se sbaglia, media dei file in coda. */
export const PESO_FOTO = 5 * 1024 * 1024;
/** Sotto questo numero di foto l'app avvisa prima di aprire lo scanner (~1,5 giorni d'archivio). */
export const SOGLIA_FOTO = 150;

export const fotoRimaste = (byteLiberi: number) => Math.max(0, Math.floor(byteLiberi / PESO_FOTO));

/** Testo dell'avviso, o null se lo spazio basta (o non si sa: valore non numerico). */
export function avvisoSpazio(byteLiberi: number): string | null {
  if (!Number.isFinite(byteLiberi)) return null;
  const n = fotoRimaste(byteLiberi);
  if (n >= SOGLIA_FOTO) return null;
  return n === 0
    ? t('Il telefono è pieno: le pagine scansionate non si possono salvare. Libera spazio o invia le pagine in attesa.')
    : t('Sul telefono c\'è spazio per circa {n} foto. Libera spazio o invia le pagine in attesa.', { n });
}
