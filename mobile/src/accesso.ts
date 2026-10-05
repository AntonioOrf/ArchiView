// Accesso Google. Stesso progetto Google Cloud del desktop e stesso scope `drive.file`: il
// telefono vede solo le cartelle create dall'app (desktop o telefono), nient'altro del Drive.
// Su Android il client OAuth è riconosciuto da pacchetto + SHA-1 del certificato di firma
// (console Google Cloud): nessun segreto nell'app, nessun config plugin.

import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file';

let configurato = false;
function configura(): void {
  if (configurato) return;
  GoogleSignin.configure({ scopes: [SCOPE_DRIVE] });
  configurato = true;
}

export type Utente = { email: string; nome: string | null };

/** Sessione già aperta, senza mostrare nulla. `null` se serve l'accesso. */
export async function utenteSilenzioso(): Promise<Utente | null> {
  configura();
  try {
    const r = await GoogleSignin.signInSilently();
    if (r.type !== 'success') return null;
    return { email: r.data.user.email, nome: r.data.user.name };
  } catch (e) {
    console.warn('[accesso] accesso silenzioso fallito', e);
    return null;
  }
}

/** Accesso interattivo. `null` se l'utente annulla. */
export async function accedi(): Promise<Utente | null> {
  configura();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const r = await GoogleSignin.signIn();
    if (!isSuccessResponse(r)) return null;
    return { email: r.data.user.email, nome: r.data.user.name };
  } catch (e: any) {
    if (e && e.code === statusCodes.IN_PROGRESS) return null;
    throw e;
  }
}

export async function esci(): Promise<void> {
  configura();
  await GoogleSignin.signOut();
}

/** Token d'accesso Drive valido (la libreria lo rinnova quando scade). */
export async function tokenDrive(): Promise<string> {
  configura();
  const { accessToken } = await GoogleSignin.getTokens();
  if (!accessToken) throw new Error('token_assente');
  return accessToken;
}

/**
 * Dopo un 401 il token in cache è da buttare: la prossima `getTokens` ne chiede uno nuovo.
 */
export async function scartaToken(token: string): Promise<void> {
  try {
    await GoogleSignin.clearCachedAccessToken(token);
  } catch (e) {
    console.warn('[accesso] impossibile scartare il token', e);
  }
}
