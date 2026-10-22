import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { ultimaApk, type Nuova } from './aggiornamento';
import { t } from './lingua';

const RELEASES = 'https://api.github.com/repos/AntonioOrf/ArchiView/releases?per_page=30';
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const RETE = /timeout|timed out|UnknownHost|resolve host|ConnectException|SocketException|SSL|connection|network/i;

export const versioneApp = () => Application.nativeApplicationVersion || '';

export const noteVersione = (versione: string) => `https://github.com/AntonioOrf/ArchiView/releases/tag/scanner-v${versione}`;

export async function cercaAggiornamento(segnalaErrori = false): Promise<Nuova | null> {
  const attuale = versioneApp();
  if (__DEV__ || !attuale) return null;
  try {
    const r = await fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    return ultimaApk(await r.json(), attuale);
  } catch (e) {
    if (segnalaErrori) throw e;
    console.warn('[aggiornamento] controllo non riuscito', e);
    return null;
  }
}

let inCorso: Promise<void> | null = null;

export function installaAggiornamento(n: Nuova, onPercento: (p: number | null) => void): Promise<void> {
  inCorso ??= scaricaEInstalla(n, onPercento).finally(() => { inCorso = null; });
  return inCorso;
}

async function scaricaEInstalla({ versione, url, byte }: Nuova, onPercento: (p: number | null) => void): Promise<void> {
  const apk = new File(Paths.cache, `ArchiScanner-${versione}.apk`);
  if (apk.exists) apk.delete();
  try {
    await File.downloadFileAsync(url, apk, {
      onProgress: ({ bytesWritten, totalBytes }) => onPercento(totalBytes > 0 ? Math.floor(bytesWritten * 100 / totalBytes) : null)
    });
  } catch (e: any) {
    console.warn('[aggiornamento] download non riuscito', e);
    if (apk.exists) apk.delete();
    const motivo = e?.message || String(e);
    throw new Error(RETE.test(motivo)
      ? t('Il download si è interrotto: la connessione è lenta o assente. Collegati a un Wi-Fi stabile e riprova.')
      : t('Il download non è riuscito ({motivo}). Riprova, oppure scarica l\'aggiornamento dal browser.', { motivo }));
  }
  if (byte > 0 && apk.size !== byte) {
    apk.delete();
    throw new Error(t('Il file scaricato è incompleto. Riprova; se succede ancora, scarica l\'aggiornamento dal browser.'));
  }
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: apk.contentUri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      type: 'application/vnd.android.package-archive'
    });
  } catch (e) {
    console.warn('[aggiornamento] installer non aperto', e);
    throw new Error(t('L\'installer di Android non si è aperto. Scarica l\'aggiornamento dal browser e aprilo dai Download.'));
  }
}
