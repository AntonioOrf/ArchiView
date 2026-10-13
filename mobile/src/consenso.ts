// Permesso della fotocamera prima di scansionare, e informativa sulla privacy. Il consenso è il
// dialogo di Android: niente consenso proprio dell'app (13/10). Lo scanner ML Kit scatta dentro
// Google Play Services e non avrebbe bisogno del permesso: lo si chiede comunque, per scelta,
// così chi scansiona vede sempre la richiesta di sistema. Galleria e cartelle passano dai
// selettori di Android, senza permessi.

import { Linking } from 'react-native';
import { Paths } from 'expo-file-system';
import { VisionCamera } from 'react-native-vision-camera';
import { avviso } from './ui/Avviso';
import { lingua, t } from './lingua';
import { avvisoSpazio } from './spazio';

export const informativa = () => `https://github.com/AntonioOrf/Schedatore/blob/main/mobile/PRIVACY_POLICY${lingua() === 'en' ? '.en' : ''}.md`;

/** true se la fotocamera è consentita. */
export function fotocameraConsentita(): boolean {
  try { return VisionCamera.cameraPermissionStatus === 'authorized'; }
  catch (e) { console.warn('[permessi] stato della fotocamera non letto', e); return false; }
}

/**
 * Chiede il permesso con il dialogo di Android. Negato: lo spiega, con la via per le impostazioni
 * di sistema (negato due volte, Android non mostra più il dialogo e la richiesta torna subito).
 */
export async function chiediFotocamera(): Promise<boolean> {
  if (fotocameraConsentita()) return true;
  try {
    if (await VisionCamera.requestCameraPermission()) return true;
  } catch (e) {
    console.warn('[permessi] permesso della fotocamera non chiesto', e);
  }
  avviso(t('Fotocamera non consentita'), t('Senza il permesso della fotocamera non si scansiona. Se Android non lo chiede più, attivalo dalle impostazioni dell\'app.'), [
    { text: t('Non ora'), style: 'cancel' },
    { text: t('Apri impostazioni'), onPress: apriImpostazioni }
  ]);
  return false;
}

/** La pagina dell'app nelle impostazioni di Android (permessi). */
export function apriImpostazioni(): void {
  Linking.openSettings().catch(e => avviso(t('Errore'), t('Impostazioni di sistema non aperte: {motivo}', { motivo: e?.message || String(e) })));
}

/** Prima dello scanner: permesso della fotocamera, poi l'avviso di spazio quasi finito (F4), che non blocca. */
export async function prontoAScansionare(): Promise<boolean> {
  if (!await chiediFotocamera()) return false;
  let poco: string | null = null;
  try { poco = avvisoSpazio(Paths.availableDiskSpace); }
  catch (e) { console.warn('[spazio] spazio libero non letto', e); }
  if (!poco) return true;
  return new Promise(ok => avviso(t('Poco spazio'), poco, [
    { text: t('Annulla'), style: 'cancel', onPress: () => ok(false) },
    { text: t('Scansiona comunque'), onPress: () => ok(true) }
  ]));
}
