import { File } from 'expo-file-system';

const tmpDi = (f: File) => new File(f.parentDirectory, `${f.name}.tmp`);

export function scriviJson(f: File, dati: unknown, spazi?: number): void {
  const tmp = tmpDi(f);
  tmp.write(JSON.stringify(dati, null, spazi));
  tmp.moveSync(f, { overwrite: true });
}

export async function rimpiazzaFile(dest: File, uriNuova: string): Promise<void> {
  const tmp = new File(dest.parentDirectory, `${dest.name}.nuova`);
  if (tmp.exists) tmp.delete();
  await new File(uriNuova).copy(tmp);
  if (dest.exists) dest.delete();
  await tmp.move(dest);
  try { new File(uriNuova).delete(); } catch (e) { console.warn('[file] temporaneo non eliminato', uriNuova, e); }
}

export function leggiJson(f: File): unknown {
  if (f.exists) return JSON.parse(f.textSync());
  const tmp = tmpDi(f);
  return tmp.exists ? JSON.parse(tmp.textSync()) : undefined;
}
