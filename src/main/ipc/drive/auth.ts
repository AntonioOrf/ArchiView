const { app, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { state, getAllSettings } = require('../../workspaceManager');

const REDIRECT_URI = 'http://localhost:3456/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Stato condiviso del client Drive — mutato da initGoogle(), letto dagli altri moduli
const driveState = {
  localServer: null as any,
  googleInstance: null as any,
  oauth2Client: null as any,
  drive: null as any
};

// --- Token Storage ---

function writeTokenFile(tokenPath: string, tokenData: object): void {
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(JSON.stringify(tokenData)).toString('base64');
    fs.writeFileSync(tokenPath, JSON.stringify({ encrypted, v: 1 }));
  } else {
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
  }
}

function readTokenFile(tokenPath: string): object | null {
  if (!fs.existsSync(tokenPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    if (raw.v === 1 && raw.encrypted) {
      return JSON.parse(safeStorage.decryptString(Buffer.from(raw.encrypted, 'base64')));
    }
    return raw;
  } catch (e) {
    console.error("Errore lettura token Drive:", e);
    return null;
  }
}

function getGlobalTokenPath(): string {
  return path.join(app.getPath('userData'), 'google-drive-tokens-global.json');
}

function getLocalTokenPath(): string | null {
  if (!state.workspacePath) return null;
  return path.join(state.workspacePath, '.archiview-chunks', '.credentials.json');
}

// --- Auth Logging ---

function logAuthEvent(message: string): void {
  let logPath: string;
  if (state.workspacePath) {
    logPath = path.join(state.workspacePath, '.archiview-chunks', 'auth_debug.log');
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } else {
    logPath = path.join(app.getPath('userData'), 'auth_debug.log');
  }
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch (e) { console.error("Errore scrittura log auth:", e); }
}

// --- Google OAuth2 Client ---

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

  const { google } = require('googleapis');
  driveState.googleInstance = google;
  driveState.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  driveState.oauth2Client.on('tokens', (tokens: any) => {
    const localPath = getLocalTokenPath();
    const globalPath = getGlobalTokenPath();
    const targetPath = (state.workspacePath && localPath) ? localPath : globalPath;
    if (!targetPath) return;
    const currentTokens = readTokenFile(targetPath);
    if (currentTokens) {
      // Merge preservando refresh_token e scope dal file esistente.
      // I token di refresh event non includono refresh_token: il merge lo preserva.
      writeTokenFile(targetPath, { ...currentTokens, ...tokens });
      logAuthEvent("REFRESH TOKEN RICEVUTO: Salvato in " + targetPath);
    } else if ((tokens as any).refresh_token) {
      // File non leggibile (corrotto/chiave cambiata) ma abbiamo un refresh_token nuovo
      writeTokenFile(targetPath, tokens);
      logAuthEvent("REFRESH TOKEN (file riscritto da zero): Salvato in " + targetPath);
    }
    // Se currentTokens è null E tokens non ha refresh_token → NON sovrascrivere.
    // Scrivere un token parziale senza refresh_token corromperebbe il file e causerebbe
    // un loop di re-auth ogni volta che l'access_token scade (dopo 1h).
  });

  driveState.drive = google.drive({ version: 'v3', auth: driveState.oauth2Client });
}

function loadSavedTokens(): boolean {
  try {
    initGoogle();
  } catch (e: any) {
    console.warn("Google Drive disabilitato:", e.message);
    logAuthEvent("ERRORE: initGoogle fallito in loadSavedTokens - " + e.message);
    return false;
  }

  let tokenPath: string | null;
  if (state.workspacePath) {
    const localPath = getLocalTokenPath();
    if (localPath && fs.existsSync(localPath)) {
      tokenPath = localPath;
    } else {
      // Nessun token locale: fallback al token globale per evitare re-auth inutile.
      // Se il globale è valido, lo copiamo in locale per isolare il workspace da qui in poi.
      const globalPath = getGlobalTokenPath();
      if (fs.existsSync(globalPath)) {
        logAuthEvent("Nessun token locale: fallback al token globale per questo workspace.");
        tokenPath = globalPath;
        // Copia in locale così i successivi avvii usano il percorso locale.
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

  logAuthEvent("Tentativo lettura token da: " + tokenPath);
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
      logAuthEvent("Token letto e impostato con SUCCESSO. Scope: " + (tokens.scope || 'n/d'));
      return true;
    } catch (e: any) {
      logAuthEvent("ERRORE LETTURA: " + e.message);
      return false;
    }
  }
  logAuthEvent("FALLIMENTO: Il file " + tokenPath + " non esiste.");
  return false;
}

async function authenticateDrive(forceLocal = false): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const skipCheck = forceLocal === true;

      if (!skipCheck && loadSavedTokens()) {
        try {
          await driveState.drive.files.list({ pageSize: 1, spaces: 'drive' });
          let settings: any = {};
          try { settings = getAllSettings(); } catch (e) { console.error("Errore lettura settings:", e); }
          if (state.workspacePath && settings.sharedVaultId) {
            try {
              await driveState.drive.files.get({ fileId: settings.sharedVaultId, fields: 'id', supportsAllDrives: true });
            } catch (err: any) {
              const errStatus = err.code || err.status || (err.response && err.response.status);
              const msg = (err.message || '').toLowerCase();
              if (errStatus === 403 || msg.includes('forbidden') || msg.includes('insufficientpermissions') || msg.includes('insufficientfilepermissions') || msg.includes('caller does not have permission')) {
                return reject(new Error("ACCESSO_NEGATO_VAULT: Questo account Google non è autorizzato ad accedere all'archivio condiviso. Accedi con l'account corretto o richiedi un nuovo invito al proprietario."));
              }
              if (errStatus === 404 || msg.includes('file not found')) {
                return reject(new Error("L'archivio condiviso non esiste o è stato eliminato. Richiedi un nuovo invito al proprietario."));
              }
            }
          }
          return resolve(true);
        } catch (e: any) {
          // Distingui errori di autenticazione (401/invalid_grant) da errori transienti
          // (rete, quota, timeout). Solo gli errori di auth reali richiedono un nuovo login.
          // Un fallthrough cieco causava OAuth ad ogni disconnessione temporanea di rete.
          const status = e.code || e.status || (e.response && e.response.status);
          const isAuthError = status === 401 || (typeof e.message === 'string' && (
            e.message.includes('invalid_grant') ||
            e.message.includes('Token has been expired') ||
            e.message.includes('unauthorized_client') ||
            e.message.includes('Invalid Credentials')
          ));
          if (!isAuthError) {
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

      // consent serve solo al primo login per ottenere il refresh_token.
      // Con consent fisso → consent screen ad ogni re-auth → esperienza pessima.
      // Senza consent se abbiamo già refresh_token → Google non lo re-emette (comportamento corretto).
      let needConsent = true;
      try {
        const existingPath = getLocalTokenPath() || getGlobalTokenPath();
        if (existingPath) {
          const existingTok = readTokenFile(existingPath) as any;
          if (existingTok && existingTok.refresh_token) needConsent = false;
        }
      } catch (e) { /* non bloccante: fallback a consent=true */ }

      const authUrl = driveState.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: needConsent ? 'select_account consent' : 'select_account'
      });

      if (driveState.localServer) driveState.localServer.close();

      driveState.localServer = http.createServer(async (req: any, res: any) => {
        let codeExtracted = false;
        try {
          const urlObj = new URL(req.url, `http://localhost:3456`);
          const code = urlObj.searchParams.get('code');

          if (code) {
            codeExtracted = true;
            let tokens: any;
            try {
              const response = await driveState.oauth2Client.getToken(code);
              tokens = response.tokens;
            } catch (tokenErr) {
              console.error("Errore token exchange OAuth:", tokenErr);
              throw tokenErr;
            }

            // Se Google non restituisce refresh_token (consenso già dato, prompt senza consent),
            // preserva il refresh_token dal file token precedente per non perdere la capacità
            // di auto-refresh alla scadenza dell'access_token.
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
              } catch (e) { /* non bloccante */ }
            }

            driveState.oauth2Client.setCredentials(tokens);
            const win = require('electron').BrowserWindow.getAllWindows()[0];
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
          } else {
            const waitHtml = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>In Attesa - ArchiView</title><style>body{margin:0;font-family:sans-serif;background:#fafaf9;display:flex;justify-content:center;align-items:center;min-height:100vh;color:#1c1917}.card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);text-align:center;border:1px solid #e7e5e4}</style></head><body><div class="card"><h2>In attesa di autenticazione...</h2><p>Completa il login su Google per continuare.</p></div></body></html>`;
            if (!res.headersSent) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(waitHtml); }
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
      }).on('error', (err: any) => {
        console.error("Errore server locale:", err);
        reject(new Error("Impossibile avviare il server locale per l'autenticazione. Riprova."));
      }).listen(3456, () => {
        shell.openExternal(authUrl);
      });
    } catch (e) { reject(e); }
  });
}

async function logoutDrive(): Promise<boolean> {
  if (state.workspacePath) {
    const localTokenPath = getLocalTokenPath();
    if (localTokenPath && fs.existsSync(localTokenPath)) fs.unlinkSync(localTokenPath);
  } else {
    const globalTokenPath = getGlobalTokenPath();
    if (globalTokenPath && fs.existsSync(globalTokenPath)) fs.unlinkSync(globalTokenPath);
  }
  if (driveState.oauth2Client) driveState.oauth2Client.setCredentials(null);
  return true;
}

async function checkDriveStatus(): Promise<{ isAuthenticated: boolean; user?: string; unauthorizedVault?: boolean }> {
  if (!loadSavedTokens()) return { isAuthenticated: false };

  let userEmail = 'Utente (Drive)';
  try {
    const res = await driveState.drive.about.get({ fields: 'user' });
    userEmail = res.data.user.emailAddress;
  } catch (e: any) {
    console.warn("checkDriveStatus about.get fallita (scope drive.file):", e.message);
  }

  try {
    const settings = getAllSettings();
    if (settings.isSharedVault && settings.sharedVaultId) {
      try {
        await driveState.drive.files.get({ fileId: settings.sharedVaultId, fields: 'id', supportsAllDrives: true });
      } catch (err: any) {
        const errStatus = err.code || err.status || (err.response && err.response.status);
        const msg = (err.message || '').toLowerCase();
        if (errStatus === 403 || msg.includes('forbidden') || msg.includes('insufficientpermissions') || msg.includes('insufficientfilepermissions') || msg.includes('caller does not have permission')) {
          logAuthEvent(`ACCESSO_NEGATO_VAULT: account ${userEmail} non autorizzato per vault ${settings.sharedVaultId}`);
          return { isAuthenticated: true, user: userEmail, unauthorizedVault: true };
        }
      }
    }
  } catch (e) { /* getAllSettings fallisce se nessun workspace attivo */ }

  return { isAuthenticated: true, user: userEmail };
}

module.exports = {
  driveState,
  writeTokenFile, readTokenFile,
  getGlobalTokenPath, getLocalTokenPath,
  logAuthEvent,
  initGoogle, loadSavedTokens,
  authenticateDrive, logoutDrive, checkDriveStatus
};
export {};
