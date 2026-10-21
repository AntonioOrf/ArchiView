import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { ultimaApk, type Nuova } from './aggiornamento';
import { t } from './lingua';

const RELEASES = 'https://api.github.com/repos/AntonioOrf/ArchiView/releases?per_page=30';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

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

export async function installaAggiornamento({ versione, url }: Nuova, onPercento: (p: number | null) => void): Promise<void> {
  const apk = new File(Paths.cache, `ArchiScanner-${versione}.apk`);
  if (apk.exists) apk.delete();
  try {
    await File.downloadFileAsync(url, apk, {
      onProgress: ({ bytesWritten, totalBytes }) => onPercento(totalBytes > 0 ? Math.floor(bytesWritten * 100 / totalBytes) : null)
    });
  } catch (e: any) {
    throw new Error(t('download dell\'aggiornamento non riuscito ({motivo})', { motivo: e?.message || String(e) }));
  }
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: apk.contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
    type: 'application/vnd.android.package-archive'
  });
}
