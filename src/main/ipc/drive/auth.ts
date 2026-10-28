import { app, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { state, finestraPrincipale, getActiveVaultFlags } from '../../workspaceManager';
import * as tokenStore from '../../cloudTokenStore';
import { avviaServerLoopback, leggiCallbackOAuth } from '../loopbackServer';
import { scriviLogAuth, rimuoviLogVecchi } from '../../logAuth';

const REDIRECT_PORT = 3456;
const REDIRECT_PATH = '/oauth2callback';
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}${REDIRECT_PATH}`;
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const SCADENZA_BROWSER_MS = 5 * 60 * 1000;
const ERR_ACCESSO_SCADUTO = "ACCESSO_SCADUTO: l'accesso a Google non è stato completato nel browser entro 5 minuti.";

const driveState = {
  localServer: null as any,
  googleInstance: null as any,
  oauth2Client: null as any,
  drive: null as any
};

function writeTokenFile(tokenPath: string, tokenData: object): void {
  tokenStore.writeSerialized(tokenPath, JSON.stringify(tokenData));
}

function readTokenFile(tokenPath: string): object | null {
  const serialized = tokenStore.readSerialized(tokenPath);
  if (serialized == null) return null;
  try {
    return JSON.parse(serialized);
  } catch (e) {
    console.error("Errore parsing token Drive:", e);
    return null;
  }
}

function getLegacyGlobalTokenPath(): string {
  return path.join(app.getPath('userData'), 'google-drive-tokens-global.json');
}

function getLegacyLocalTokenPath(ws: string): string {
  return path.join(ws, '.archiview-chunks', '.credentials.json');
}

function getGlobalTokenPath(): string {
  return tokenStore.tokenPathFor('google', 'global');
}

function getLocalTokenPath(): string | null {
  const key = tokenStore.activeVaultKey();
  if (key === 'global') return null;
  return tokenStore.tokenPathFor('google', key);
}

function classifyDriveFolderError(err: any): 'forbidden' | 'notfound' | null {
  const status = err?.code || err?.status || err?.response?.status;
  const msg = (err?.message || '').toLowerCase();
  if (status === 403 || msg.includes('forbidden') || msg.includes('insufficientpermissions') ||
      msg.includes('insufficientfilepermissions') || msg.includes('caller does not have permission')) {
    return 'forbidden';
  }
  if (status === 404 || msg.includes('file not found')) return 'notfound';
  return null;
}

const ERR_VAULT_FORBIDDEN = "ACCESSO_NEGATO_VAULT: Questo account Google non è autorizzato ad accedere all'archivio condiviso. Accedi con l'account corretto o richiedi un nuovo invito al proprietario.";
const ERR_VAULT_NOTFOUND = "L'archivio condiviso non esiste o è stato eliminato. Richiedi un nuovo invito al proprietario.";
const ERR_BACKUP_ALTRO_ACCOUNT = "BACKUP_ALTRO_ACCOUNT: La cartella di questo backup non è sul Drive dell'account Google collegato. Torna all'account di prima, oppure collega o crea un backup su questo account.";

let logVecchiTolti: string | null = null;
function togliLogVecchi(): void {
  if (!state.workspacePath || logVecchiTolti === state.workspacePath) return;
  logVecchiTolti = state.workspacePath;
  void rimuoviLogVecchi(state.workspacePath, app.getPath('userData'));
}
function logAuthEvent(message: string): void {
  togliLogVecchi();
  void scriviLogAuth(path.join(app.getPath('userData'), 'logs', 'auth.log'), message);
}

function initGoogle(): void {
  if (driveState.googleInstance) return;

  let clientId = 'YOUR_GOOGLE_DRIVE_CLIENT_ID';
  let clientSecret = 'YOUR_GOOGLE_DRIVE_CLIENT_SECRET';

  try {
    const creds = require('../cloudCredentials');
    clientId = creds.GOOGLE_CLIENT_ID;
    clientSecret = creds.GOOGLE_CLIENT_SECRET;
  } catch (e) {
    console.warn("File cloudCredentials.ts non trovato o non configurato.");
  }

  if (!clientId || !clientSecret || clientId === 'YOUR_GOOGLE_DRIVE_CLIENT_ID') {
    throw new Error("Credenziali Google Drive mancanti. Il file cloudCredentials.ts non è configurato.");
  }

  const google = require('@googleapis/drive');
  driveState.googleInstance = google;
  driveState.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  driveState.oauth2Client.on('tokens', (tokens: any) => {
    const localPath = getLocalTokenPath();
    const globalPath = getGlobalTokenPath();
    const targetPath = (state.workspacePath && localPath) ? localPath : globalPath;
    if (!targetPath) return;
    const currentTokens = readTokenFile(targetPath);
    if (currentTokens) {
      writeTokenFile(targetPath, { ...currentTokens, ...tokens });
      logAuthEvent("REFRESH TOKEN RICEVUTO: Salvato in " + targetPath);
    } else if ((tokens as any).refresh_token) {
      writeTokenFile(targetPath, tokens);
      logAuthEvent("REFRESH TOKEN (file riscritto da zero): Salvato in " + targetPath);
    }
  });

  driveState.drive = google.drive({ version: 'v3', auth: driveState.oauth2Client });
}

function loadSavedTokens(): boolean {
  togliLogVecchi();
  try {
    initGoogle();
  } catch (e: any) {
    console.warn("Google Drive disabilitato:", e.message);
    logAuthEvent("ERRORE: initGoogle fallito in loadSavedTokens - " + e.message);
    return false;
  }

  tokenStore.migrateLegacy('google', getLegacyGlobalTokenPath(), getLegacyLocalTokenPath);

  let tokenPath: string | null;
  if (state.workspacePath) {
    const localPath = getLocalTokenPath();
    if (localPath && fs.existsSync(localPath)) {
      tokenPath = localPath;
    } else {
      const globalPath = getGlobalTokenPath();
      if (fs.existsSync(globalPath)) {
        logAuthEvent("Nessun token locale: fallback al token globale per questo workspace.");
        tokenPath = globalPath;
        if (localPath) {
          try {
            const globalTokenData = readTokenFile(globalPath);
            if (globalTokenData) {
              writeTokenFile(localPath, globalTokenData);
              logAuthEvent("Token globale copiato in locale: " + localPath);
              tokenPath = localPath;
            }
          } catch (e: any) {
            logAuthEvent("Impossibile copiare token globale in locale: " + e.message);
          }
        }
      } else {
        if (driveState.oauth2Client) driveState.oauth2Client.setCredentials(null);
        logAuthEvent("ATTENZIONE: Nessun token locale né globale per il workspace corrente. Login richiesto.");
        return false;
      }
    }
  } else {
    tokenPath = getGlobalTokenPath();
  }

  if (tokenPath && fs.existsSync(tokenPath)) {
    try {
      const tokens = readTokenFile(tokenPath) as any;
      if (!tokens) {
        logAuthEvent("ERRORE LETTURA TOKEN: impossibile decifrare " + tokenPath);
        return false;
      }
      if (tokens.scope && typeof tokens.scope === 'string') {
        const scopesArray = tokens.scope.split(' ');
        const hasValidScope =
          scopesArray.includes('https://www.googleapis.com/auth/drive.file') ||
          scopesArray.includes('https://www.googleapis.com/auth/drive.appdata') ||
          scopesArray.includes('https://www.googleapis.com/auth/drive');
        if (!hasValidScope) {
          logAuthEvent("SCOPE non riconosciuto: " + tokens.scope);
          return false;
        }
      }
      driveState.oauth2Client.setCredentials(tokens);
      return true;
    } catch (e: any) {
      logAuthEvent("ERRORE LETTURA: " + e.message);
      return false;
    }
  }
  logAuthEvent("FALLIMENTO: Il file " + tokenPath + " non esiste.");
  return false;
}

function erroreDiAutenticazione(e: any): boolean {
  const status = e?.code || e?.status || e?.response?.status;
  return status === 401 || (typeof e?.message === 'string' && (
    e.message.includes('invalid_grant') ||
    e.message.includes('Token has been expired') ||
    e.message.includes('unauthorized_client') ||
    e.message.includes('Invalid Credentials')
  ));
}

async function authenticateDrive(forceLocal = false): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const skipCheck = forceLocal === true;

      if (!skipCheck && loadSavedTokens()) {
        try {
          await driveState.drive.files.list({ pageSize: 1, spaces: 'drive' });
          let settings: any = {};
          try { settings = getActiveVaultFlags(); } catch (e) { console.error("Errore lettura settings:", e); }
          if (state.workspacePath && settings.isSharedVault && settings.sharedVaultId) {
            try {
              await driveState.drive.files.get({ fileId: settings.sharedVaultId, fields: 'id', supportsAllDrives: true });
            } catch (err: any) {
              const kind = classifyDriveFolderError(err);
              if (kind === 'forbidden') return reject(new Error(ERR_VAULT_FORBIDDEN));
              if (kind === 'notfound') return reject(new Error(ERR_VAULT_NOTFOUND));
            }
          }
          logAuthEvent("AUTH: token già validi, login saltato (nessun browser aperto).");
          return resolve(true);
        } catch (e: any) {
          if (!erroreDiAutenticazione(e)) {
            console.warn("Errore non-auth su Drive (rete/quota), non avvio nuovo login:", e.message);
            return reject(new Error("Errore di connessione a Google Drive: " + e.message));
          }
          console.warn("Token non valido (401/invalid_grant), avvio nuovo login OAuth:", e.message);
          logAuthEvent("TOKEN SCADUTO o non valido: " + e.message + " — avvio re-auth.");
        }
      }

      if (!driveState.oauth2Client) {
        try { initGoogle(); } catch (e) { return reject(e); }
        if (!driveState.oauth2Client) {
          return reject(new Error("Credenziali Google Drive mancanti."));
        }
      }

      let needConsent = true;
      try {
        const existingPath = getLocalTokenPath() || getGlobalTokenPath();
        if (existingPath) {
          const existingTok = readTokenFile(existingPath) as any;
          if (existingTok && existingTok.refresh_token) needConsent = false;
        }
      } catch (e) {}

      const authUrlParams: any = {
        access_type: 'offline',
        scope: SCOPES,
        prompt: (forceLocal || needConsent) ? 'select_account consent' : 'select_account'
      };

      const { codeVerifier, codeChallenge } = await driveState.oauth2Client.generateCodeVerifierAsync();
      const statoLogin = crypto.randomBytes(24).toString('hex');
      authUrlParams.code_challenge = codeChallenge;
      authUrlParams.code_challenge_method = 'S256';
      authUrlParams.state = statoLogin;

      const authUrl = driveState.oauth2Client.generateAuthUrl(authUrlParams);

      if (driveState.localServer) driveState.localServer.close();
      driveState.localServer = null;

      const gestore = async (req: any, res: any) => {
        let codeExtracted = false;
        try {
          const esito = leggiCallbackOAuth(req.url, { path: REDIRECT_PATH, stato: statoLogin });
          if (esito.tipo === 'estranea') { res.writeHead(404); res.end(); return; }
          if (esito.tipo === 'rifiutata') {
            logAuthEvent("OAUTH: callback scartato (state assente o diverso).");
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Richiesta di autenticazione non valida.');
            return;
          }
          codeExtracted = true;
          if (esito.tipo === 'negato') throw new Error("Accesso a Google Drive negato: " + esito.errore);

          {
            let tokens: any;
            try {
              const response = await driveState.oauth2Client.getToken({ code: esito.code, codeVerifier });
              tokens = response.tokens;
            } catch (tokenErr) {
              console.error("Errore token exchange OAuth:", tokenErr);
              throw tokenErr;
            }

            if (!tokens.refresh_token) {
              try {
                const existingPath = getLocalTokenPath() || getGlobalTokenPath();
                if (existingPath) {
                  const existingTok = readTokenFile(existingPath) as any;
                  if (existingTok && existingTok.refresh_token) {
                    tokens = { ...tokens, refresh_token: existingTok.refresh_token };
                    logAuthEvent("refresh_token preservato dal file token precedente.");
                  }
                }
              } catch (e) {}
            }

            driveState.oauth2Client.setCredentials(tokens);
            try {
              const about = await driveState.drive.about.get({ fields: 'user' });
              if (about?.data?.user?.emailAddress) tokens.email = about.data.user.emailAddress;
            } catch (e) {}
            const win = finestraPrincipale();
            if (win) win.webContents.send('drive-status-updated', { authenticated: true });

            const currentLocalPath = getLocalTokenPath();
            if (currentLocalPath) {
              writeTokenFile(currentLocalPath, tokens);
              logAuthEvent("LOGIN MANUALE: Token FORZATO su LOCAL PATH -> " + currentLocalPath);
            } else {
              const globalPath = getGlobalTokenPath();
              if (globalPath) {
                writeTokenFile(globalPath, tokens);
                logAuthEvent("LOGIN MANUALE: Nessun workspace, salvato su GLOBAL PATH -> " + globalPath);
              }
            }

            const successHtml = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Autenticazione Completata - ArchiView</title>
<style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#fafaf9;display:flex;justify-content:center;align-items:center;min-height:100vh;color:#1c1917}.card{background:#fff;border-radius:12px;box-shadow:0 10px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1);padding:40px;max-width:400px;text-align:center;border:1px solid #e7e5e4}.icon{width:64px;height:64px;background-color:#dcfce7;color:#166534;border-radius:50%;display:flex;justify-content:center;align-items:center;margin:0 auto 24px}.icon svg{width:32px;height:32px}h1{font-size:1.5rem;margin:0 0 12px;font-weight:600}p{color:#57534e;margin:0 0 24px;line-height:1.5}.btn{display:inline-block;background-color:#1c1917;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500;transition:background-color .2s;cursor:pointer;border:none;font-size:1rem}.btn:hover{background-color:#44403c}</style>
</head><body><div class="card">
<div class="icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
<h1>Autenticazione Completata</h1>
<p>Ti sei autenticato correttamente con Google Drive. Puoi chiudere questa scheda e tornare ad ArchiView.</p>
<button class="btn" id="closeBtn" onclick="tryClose()">Chiudi Scheda</button>
<p id="closeMsg" style="display:none;color:#dc2626;font-size:.9rem;margin-top:16px;">Il tuo browser blocca la chiusura automatica. Puoi chiudere liberamente questa scheda dalla "X" in alto.</p>
</div>
<script>function tryClose(){window.close();setTimeout(()=>{document.getElementById('closeMsg').style.display='block';document.getElementById('closeBtn').style.display='none';},300);}setTimeout(tryClose,3000);</script>
</body></html>`;

            if (!res.headersSent) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(successHtml); }
            resolve(true);
          }
        } catch (e) {
          console.error("Errore OAuth Server Locale:", e);
          const errHtml = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Errore - ArchiView</title><style>body{margin:0;font-family:sans-serif;background:#fafaf9;display:flex;justify-content:center;align-items:center;min-height:100vh;color:#1c1917}.card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);text-align:center;border:1px solid #e7e5e4}h2{color:#dc2626;margin-top:0}</style></head><body><div class="card"><h2>Errore di Autenticazione</h2><p>Si è verificato un errore durante il login. Chiudi la scheda e riprova da ArchiView.</p></div></body></html>`;
          if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/html' }); res.end(errHtml); }
          reject(e);
        } finally {
          if (codeExtracted) {
            if (driveState.localServer) { driveState.localServer.close(); driveState.localServer = null; }
          }
        }
      };

      try {
        driveState.localServer = await avviaServerLoopback(REDIRECT_PORT, gestore, {
          scadenzaMs: SCADENZA_BROWSER_MS,
          alloScadere: () => {
            driveState.localServer = null;
            logAuthEvent("OAUTH: login non completato entro il tempo, server chiuso.");
            reject(new Error(ERR_ACCESSO_SCADUTO));
          }
        });
      } catch (err: any) {
        console.error("Errore server locale:", err);
        return reject(new Error("Impossibile avviare il server locale per l'autenticazione. Riprova."));
      }
      shell.openExternal(authUrl);
    } catch (e) { reject(e); }
  });
}

async function logoutDrive(): Promise<boolean> {
  const localTokenPath = getLocalTokenPath();
  const globalTokenPath = getGlobalTokenPath();
  let cartellaTokenPath: string | null = null;
  try {
    const flags = getActiveVaultFlags();
    if (flags.sharedVaultId) cartellaTokenPath = tokenStore.tokenPathFor('google', flags.sharedVaultId);
  } catch (e) {}
  const percorsi = new Set([localTokenPath, globalTokenPath, cartellaTokenPath]);

  try {
    for (const p of percorsi) {
      if (!p || !fs.existsSync(p)) continue;
      const tok = readTokenFile(p) as any;
      const toRevoke = tok && (tok.refresh_token || tok.access_token);
      if (!toRevoke) continue;
      try { initGoogle(); } catch (e) { break; }
      if (!driveState.oauth2Client) break;
      await driveState.oauth2Client.revokeToken(toRevoke);
      logAuthEvent("LOGOUT: token revocato su Google (" + p + ").");
      break;
    }
  } catch (e: any) {
    logAuthEvent("LOGOUT: revoca su Google fallita (non bloccante): " + e.message);
  }

  for (const p of percorsi) {
    try {
      if (p && fs.existsSync(p)) {
        fs.unlinkSync(p);
        logAuthEvent("LOGOUT: token rimosso -> " + p);
      }
    } catch (e: any) {
      logAuthEvent("LOGOUT: impossibile rimuovere " + p + ": " + e.message);
    }
  }

  try { if (driveState.localServer) driveState.localServer.close(); } catch (e) {}
  driveState.localServer = null;
  if (driveState.oauth2Client) {
    try { driveState.oauth2Client.setCredentials(null); } catch (e) {}
    try { driveState.oauth2Client.removeAllListeners('tokens'); } catch (e) {}
  }
  driveState.oauth2Client = null;
  driveState.drive = null;
  driveState.googleInstance = null;

  return true;
}

async function checkDriveStatus(): Promise<{ isAuthenticated: boolean; user?: string; unauthorizedVault?: boolean; backupAltroAccount?: boolean }> {
  if (!loadSavedTokens()) return { isAuthenticated: false };

  let userEmail = 'Utente (Drive)';
  try {
    const res = await driveState.drive.about.get({ fields: 'user' });
    userEmail = res.data.user.emailAddress;
  } catch (e: any) {
    if (erroreDiAutenticazione(e)) {
      logAuthEvent("STATO: token rifiutato da Google (" + e.message + "), risulta non connesso.");
      return { isAuthenticated: false };
    }
    console.warn("checkDriveStatus about.get fallita (scope drive.file):", e.message);
  }

  try {
    const settings = getActiveVaultFlags();
    if (settings.isSharedVault && settings.sharedVaultId) {
      try {
        await driveState.drive.files.get({ fileId: settings.sharedVaultId, fields: 'id', supportsAllDrives: true });
      } catch (err: any) {
        if (classifyDriveFolderError(err) === 'forbidden') {
          logAuthEvent(`ACCESSO_NEGATO_VAULT: account ${userEmail} non autorizzato per vault ${settings.sharedVaultId}`);
          return { isAuthenticated: true, user: userEmail, unauthorizedVault: true };
        }
      }
    } else if (settings.isPersonalCloud && settings.sharedVaultId) {
      try {
        await driveState.drive.files.get({ fileId: settings.sharedVaultId, fields: 'id', supportsAllDrives: true });
      } catch (err: any) {
        if (classifyDriveFolderError(err)) {
          logAuthEvent(`BACKUP_ALTRO_ACCOUNT: cartella ${settings.sharedVaultId} non visibile all'account ${userEmail}`);
          return { isAuthenticated: true, user: userEmail, backupAltroAccount: true };
        }
      }
    }
  } catch (e) {}

  return { isAuthenticated: true, user: userEmail };
}

export { driveState, writeTokenFile, readTokenFile, getGlobalTokenPath, getLocalTokenPath, logAuthEvent, classifyDriveFolderError, ERR_VAULT_FORBIDDEN, ERR_VAULT_NOTFOUND, ERR_BACKUP_ALTRO_ACCOUNT, ERR_ACCESSO_SCADUTO, SCADENZA_BROWSER_MS, initGoogle, loadSavedTokens, authenticateDrive, logoutDrive, checkDriveStatus };
