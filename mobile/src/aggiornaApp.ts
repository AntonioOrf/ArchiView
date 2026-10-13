// Controllo all'avvio e installazione dell'APK nuovo (scelta della release in aggiornamento.ts).

import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { ultimaApk, type Nuova } from './aggiornamento';
import { t } from './lingua';

const RELEASES = 'https://api.github.com/repos/AntonioOrf/ArchiView/releases?per_page=30';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/** La versione installata ('' se Android non la dà). */
export const versioneApp = () => Application.nativeApplicationVersion || '';

/** Le note della release `versione` su GitHub. */
export const noteVersione = (versione: string) => `https://github.com/AntonioOrf/ArchiView/releases/tag/scanner-v${versione}`;

/**
 * La versione nuova pubblicata su GitHub, o null. All'avvio senza rete il controllo non deve
 * disturbare; da Impostazioni (`segnalaErrori`) l'errore sale, sennò «nessuna versione nuova» mentirebbe.
 */
export async function cercaAggiornamento(segnalaErrori = false): Promise<Nuova | null> {
  // Le build di sviluppo (e i flussi Maestro) non devono vedere l'avviso.
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

/** Scarica l'APK in cache e apre l'installer di Android (la firma deve coincidere: keystore EAS). */
export async function installaAggiornamento({ versione, url }: Nuova): Promise<void> {
  const apk = new File(Paths.cache, `ArchiScanner-${versione}.apk`);
  if (apk.exists) apk.delete(); // un download interrotto lascerebbe un APK troncato
  try {
    await File.downloadFileAsync(url, apk);
  } catch (e: any) {
    throw new Error(t('download dell\'aggiornamento non riuscito ({motivo})', { motivo: e?.message || String(e) }));
  }
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: apk.contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
    type: 'application/vnd.android.package-archive'
  });
}
