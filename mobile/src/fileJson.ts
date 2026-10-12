// Fase 6a (PIANO-REVIEW-MOBILE): i JSON dello stato (bozze, impostazioni, schede nuove, documenti)
// non si sovrascrivono al loro posto. Si scrive `<nome>.tmp`, poi lo si sposta sopra: se l'app muore
// a metà resta il file vecchio intero, o (tra cancellazione e spostamento) il `.tmp` già completo.

import { File } from 'expo-file-system';

const tmpDi = (f: File) => new File(f.parentDirectory, `${f.name}.tmp`);

export function scriviJson(f: File, dati: unknown, spazi?: number): void {
  const tmp = tmpDi(f);
  tmp.write(JSON.stringify(dati, null, spazi));
  tmp.moveSync(f, { overwrite: true });
}

/** Il contenuto del file, o del `.tmp` rimasto da una scrittura interrotta. `undefined` se non c'è nessuno dei due. */
export function leggiJson(f: File): unknown {
  if (f.exists) return JSON.parse(f.textSync());
  const tmp = tmpDi(f);
  return tmp.exists ? JSON.parse(tmp.textSync()) : undefined;
}
