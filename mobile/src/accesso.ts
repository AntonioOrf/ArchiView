import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file';

let configurato = false;
function configura(): void {
  if (configurato) return;
  GoogleSignin.configure({ scopes: [SCOPE_DRIVE] });
  configurato = true;
}

export type Utente = { email: string; nome: string | null };

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

let inCorso: Promise<string> | null = null;

export function tokenDrive(): Promise<string> {
  configura();
  inCorso ??= GoogleSignin.getTokens()
    .then(({ accessToken }) => {
      if (!accessToken) throw new Error('token_assente');
      return accessToken;
    })
    .finally(() => { inCorso = null; });
  return inCorso;
}

export async function scartaToken(token: string): Promise<void> {
  try {
    await GoogleSignin.clearCachedAccessToken(token);
  } catch (e) {
    console.warn('[accesso] impossibile scartare il token', e);
  }
}
