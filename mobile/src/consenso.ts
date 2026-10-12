// Consenso informato (GDPR art. 7, ePrivacy art. 5(3)) prima di fotocamera, galleria e cartelle.
// L'accesso tecnico resta ai selettori di sistema, senza permessi su foto e memoria (policy
// Google Play su foto e video): qui si chiede, si registra la scelta e la si revoca da Impostazioni.

import { Alert, Linking } from 'react-native';
import { File, Paths } from 'expo-file-system';

/** Da alzare quando cambia cosa si chiede: il consenso dato prima non vale più. */
const VERSIONE = 1;
export const INFORMATIVA = 'https://github.com/AntonioOrf/Schedatore/blob/main/mobile/PRIVACY_POLICY.md';
const TESTO = 'ArchiScanner usa la fotocamera per scansionare i documenti, le foto che scegli dalla galleria e la cartella che scegli per salvarli. '
  + 'Restano sul telefono finché non li invii tu al tuo Drive o al tuo computer, o li condividi. Puoi revocare il consenso da Impostazioni.';

const fileConsenso = () => new File(Paths.document, 'consenso.json');

/** Data (ISO) del consenso valido, o null. */
export function consenso(): string | null {
  try {
    const f = fileConsenso();
    if (!f.exists) return null;
    const c = JSON.parse(f.textSync());
    return c?.versione === VERSIONE && typeof c.data === 'string' ? c.data : null;
  } catch (e) {
    console.warn('[consenso] file illeggibile, lo richiedo', e);
    return null;
  }
}

/** true se c'è già il consenso o l'utente lo dà ora; «Non ora» e «Informativa» non concedono. */
export function chiediConsenso(): Promise<boolean> {
  if (consenso()) return Promise.resolve(true);
  return new Promise(ok => Alert.alert('Fotocamera, foto e file', TESTO, [
    { text: 'Informativa', onPress: () => { Linking.openURL(INFORMATIVA).catch(e => console.warn('[consenso] informativa non aperta', e)); ok(false); } },
    { text: 'Non ora', style: 'cancel', onPress: () => ok(false) },
    {
      text: 'Consenti', onPress: () => {
        try { fileConsenso().write(JSON.stringify({ versione: VERSIONE, data: new Date().toISOString() })); }
        catch (e) { console.warn('[consenso] non salvato, lo richiederò', e); }
        ok(true);
      }
    }
  ], { cancelable: true, onDismiss: () => ok(false) }));
}

export function revocaConsenso(): void {
  const f = fileConsenso();
  if (f.exists) f.delete();
}
