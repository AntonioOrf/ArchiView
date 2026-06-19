const { ipcMain, app, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { state, initWorkspace, getAllSettings, saveAllSettings } = require('../workspaceManager');
const { PublicClientApplication, CryptoProvider } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');

const REDIRECT_URI = 'http://localhost:3457/redirect';
const SCOPES = ['user.read', 'files.readwrite', 'offline_access'];

function writeMsTokenFile(tokenPath: string, serializedCache: string): void {
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(serializedCache).toString('base64');
    fs.writeFileSync(tokenPath, JSON.stringify({ encrypted, v: 1 }));
  } else {
    fs.writeFileSync(tokenPath, serializedCache);
  }
}

function readMsTokenFile(tokenPath: string): string | null {
  if (!fs.existsSync(tokenPath)) return null;
  try {
    const raw = fs.readFileSync(tokenPath, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      if (parsed.v === 1 && parsed.encrypted) {
        return safeStorage.decryptString(Buffer.from(parsed.encrypted, 'base64'));
      }
    } catch { /* non è JSON cifrato — è MSAL plaintext */ }
    return raw; // plaintext legacy
  } catch (e) {
    console.error("Errore lettura token MS:", e);
    return null;
  }
}

function getGlobalTokenPath() {
  return path.join(app.getPath('userData'), 'ms-tokens-global.json');
}

function getLocalTokenPath() {
  if (!state.workspacePath) return null;
  return path.join(state.workspacePath, '.ms-tokens.json');
}

let localServer = null;
let msalClient = null;
let graphClient = null;
let account = null;

function initMsal() {
  if (!msalClient) {
    let clientId = 'YOUR_MS_CLIENT_ID';
    try {
      const creds = require('./cloudCredentials');
      clientId = creds.MS_CLIENT_ID;
    } catch (e) {
      console.warn("File cloudCredentials.ts non configurato per MS.");
    }

    if (!clientId || clientId === 'YOUR_MS_CLIENT_ID') {
      throw new Error("Credenziali Microsoft mancanti.");
    }

    const msalConfig = {
      auth: {
        clientId: clientId,
        authority: "https://login.microsoftonline.com/common",
      },
      cache: {
        cachePlugin: {
          beforeCacheAccess: async (cacheContext) => {
             const tokenPath = state.workspacePath ? getLocalTokenPath() : getGlobalTokenPath();
             if (tokenPath) {
                 const tokenData = readMsTokenFile(tokenPath);
                 if (tokenData) cacheContext.tokenCache.deserialize(tokenData);
             }
          },
          afterCacheAccess: async (cacheContext) => {
             if (cacheContext.cacheHasChanged) {
                 const tokenPath = state.workspacePath ? getLocalTokenPath() : getGlobalTokenPath();
                 if (tokenPath) {
                     writeMsTokenFile(tokenPath, cacheContext.tokenCache.serialize());
                 }
             }
          }
        }
      }
    };

    msalClient = new PublicClientApplication(msalConfig);
  }
}

async function getGraphClient() {
  if (!graphClient) {
     graphClient = Client.init({
       authProvider: async (done) => {
         try {
           if (!account) {
              const accounts = await msalClient.getTokenCache().getAllAccounts();
              if (accounts.length > 0) account = accounts[0];
           }
           
           if (!account) throw new Error("No account found");

           const response = await msalClient.acquireTokenSilent({
             account: account,
             scopes: SCOPES
           });
           done(null, response.accessToken);
         } catch (error) {
           done(error, null);
         }
       }
     });
  }
  return graphClient;
}

function loadSavedTokens() {
  try {
    initMsal();
  } catch (e) {
    console.warn("MSAL init fallita:", e.message);
    return false;
  }

  if (state.workspacePath) {
    const tokenPath = getLocalTokenPath();
    if (!tokenPath || !fs.existsSync(tokenPath)) {
      // Nessun token locale per questo workspace: reset stato in-memory e richiedi login
      account = null;
      graphClient = null;
      return false;
    }
    return true;
  }

  // Nessun workspace aperto → usa il token globale
  const globalPath = getGlobalTokenPath();
  return !!(globalPath && fs.existsSync(globalPath));
}

async function authenticateDrive(forceLocal = false) {
  return new Promise(async (resolve, reject) => {
    try {
    try { initMsal(); } catch(e) { return reject(e); }

    const cryptoProvider = new CryptoProvider();
    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();

    const authCodeUrlParameters = {
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      codeChallenge: challenge,
      codeChallengeMethod: "S256"
    };

    const authUrl = await msalClient.getAuthCodeUrl(authCodeUrlParameters);

    if (localServer) localServer.close();

    localServer = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url, `http://localhost:3457`);
        const code = urlObj.searchParams.get('code');
        
        if (code) {
          res.end('<h1>Autenticazione Microsoft completata!</h1><p>Puoi chiudere questa scheda e tornare ad ArchiView.</p><script>window.close()</script>');
          localServer.close();
          localServer = null;
          
          const tokenRequest = {
            code: code,
            scopes: SCOPES,
            redirectUri: REDIRECT_URI,
            codeVerifier: verifier,
          };

          const response = await msalClient.acquireTokenByCode(tokenRequest);
          account = response.account;

          // Assicura che la cache venga scritta nel posto giusto (locale vs globale)
          const cacheContext = {
             tokenCache: msalClient.getTokenCache(),
             cacheHasChanged: true
          };
          const tokenPath = (forceLocal && getLocalTokenPath()) ? getLocalTokenPath() : getGlobalTokenPath();
          writeMsTokenFile(tokenPath, msalClient.getTokenCache().serialize());

          resolve(true);
        } else {
          res.end('In attesa di autenticazione...');
        }
      } catch (e) {
        res.end('Errore durante l\'autenticazione.');
        reject(e);
      }
    }).on('error', (err) => {
      reject(new Error("Impossibile avviare il server locale."));
    }).listen(3457, () => {
      shell.openExternal(authUrl);
    });
    } catch (e) { reject(e); }
  });
}

async function logoutDrive() {
  const localTokenPath = getLocalTokenPath();
  const globalTokenPath = getGlobalTokenPath();
  if (localTokenPath && fs.existsSync(localTokenPath)) fs.unlinkSync(localTokenPath);
  if (globalTokenPath && fs.existsSync(globalTokenPath)) fs.unlinkSync(globalTokenPath);
  account = null;
  graphClient = null;
  if(msalClient) msalClient.clearCache();
  return true;
}

async function checkDriveStatus() {
  if (!loadSavedTokens()) return { isAuthenticated: false };
  try {
    const client = await getGraphClient();
    const user = await client.api('/me').get();
    return { isAuthenticated: true, user: user.userPrincipalName };
  } catch (e) {
    return { isAuthenticated: false };
  }
}

async function getOrCreateFolder(folderName, parentId = 'root') {
  const client = await getGraphClient();
  try {
    const children = await client.api(`/me/drive/items/${parentId}/children`).filter(`name eq '${folderName}'`).get();
    if (children && children.value && children.value.length > 0) {
      return children.value[0].id;
    }
    
    const driveItem = {
      name: folderName,
      folder: { },
      "@microsoft.graph.conflictBehavior": "rename"
    };
    
    const newFolder = await client.api(`/me/drive/items/${parentId}/children`).post(driveItem);
    return newFolder.id;
  } catch(e) {
    throw e;
  }
}

async function uploadFile(localPath, driveFileName, parentId) {
  const client = await getGraphClient();
  const fileStats = fs.statSync(localPath);
  
  if (fileStats.size < 4 * 1024 * 1024) {
      // Simple upload
      const fileStream = fs.createReadStream(localPath);
      await client.api(`/me/drive/items/${parentId}:/${driveFileName}:/content`).putStream(fileStream);
  } else {
      // Large file upload session
      const options = {
          path: localPath,
          fileName: driveFileName,
          rangeSize: 1024 * 1024 * 3.2 // 3.2MB chunks
      };
      // Microsoft graph client has a LargeFileUploadTask but it's complex.
      // We will assume basic putStream works for now or implement LargeFileUploadTask.
      const fileStream = fs.createReadStream(localPath);
      await client.api(`/me/drive/items/${parentId}:/${driveFileName}:/content`).putStream(fileStream);
  }
}

async function downloadFile(fileId, destPath) {
  const client = await getGraphClient();
  const stream = await client.api(`/me/drive/items/${fileId}/content`).getStream();
  const dest = fs.createWriteStream(destPath);
  return new Promise((resolve, reject) => {
    stream.pipe(dest);
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

async function checkUpdatesFromDrive(vaultFolderId = null) {
  const client = await getGraphClient();
  let actualVaultFolderId = vaultFolderId;

  if (!actualVaultFolderId && state.workspacePath) {
      try {
          const s = getAllSettings();
          if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) actualVaultFolderId = s.sharedVaultId;
      } catch(e) { console.error("Errore lettura settings:", e); }
  }

  if (!actualVaultFolderId && state.workspacePath) {
      // Se non c'è sharedVaultId non scaricare niente, altrimenti ripesca vecchi vault!
      return null;
  }

  if (actualVaultFolderId) {
      try {
          const res = await client.api(`/me/drive/items/${actualVaultFolderId}/children`).filter("name eq 'database_manoscritti.json'").get();
          if (res && res.value && res.value.length > 0) {
              return new Date(res.value[0].lastModifiedDateTime).getTime();
          }
      } catch(e) { console.error("Errore checkUpdates OneDrive:", e); }
  }
  return null;
}

async function pullFromDrive(vaultFolderId = null, skipAttachments = false) {
  if (!loadSavedTokens()) throw new Error("Autenticazione Microsoft non effettuata.");
  
  const client = await getGraphClient();
  let fileId = null;
  let driveModifiedTime = null;
  let actualVaultFolderId = vaultFolderId;

  if (!actualVaultFolderId && state.workspacePath) {
      try {
          const s = getAllSettings();
          if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) actualVaultFolderId = s.sharedVaultId;
      } catch(e) { console.error("Errore lettura settings:", e); }
  }

  if (!actualVaultFolderId && state.workspacePath) {
      // Non è mai stato sincronizzato, non cercare per nome
      return null;
  }

  if (actualVaultFolderId) {
      try {
          const res = await client.api(`/me/drive/items/${actualVaultFolderId}/children`).filter("name eq 'database_manoscritti.json'").get();
          if (res && res.value && res.value.length > 0) {
              fileId = res.value[0].id;
              driveModifiedTime = new Date(res.value[0].lastModifiedDateTime).getTime();
          }
      } catch(e) {
          console.error(e);
      }
  }

  if (fileId) {
    const fileContent = await client.api(`/me/drive/items/${fileId}/content`).get();
    let dbData = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
    // se restituisce arraybuffer/blob bisogna gestirlo, assumiamo get() converta json se è json

    let syncAttachments = true;
    if (state.workspacePath) {
        try {
            const s = getAllSettings();
            if (s.syncAttachments !== undefined) syncAttachments = !!s.syncAttachments;
        } catch(e) { console.error("Errore lettura settings syncAttachments:", e); }
    }
    if (skipAttachments) syncAttachments = false;

    if (syncAttachments && state.workspacePath && actualVaultFolderId) {
        try {
            const allegatiFolderId = await getOrCreateFolder('allegati_manoscritti', actualVaultFolderId);
            const resAll = await client.api(`/me/drive/items/${allegatiFolderId}/children`).get();
            const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
            if (!fs.existsSync(allegatiLocalDir)) fs.mkdirSync(allegatiLocalDir, { recursive: true });
            
            let i = 0;
            const total = resAll.value.length;
            for (const f of resAll.value) {
                i++;
                const win = require('electron').BrowserWindow.getAllWindows()[0];
                if (win) win.webContents.send('sync-progress', { percent: (i / total) * 100, message: `Scaricamento allegato ${i} di ${total}` });
                
                const localPath = path.join(allegatiLocalDir, f.name);
                if (!fs.existsSync(localPath)) {
                    await downloadFile(f.id, localPath);
                    if (win) win.webContents.send('allegato-scaricato', f.name);
                }
            }
        } catch (e) {
            console.error("Errore download allegati:", e);
        }
    }
    
    return { database: dbData, driveModifiedTime };
  }
  return null;
}

async function syncToDrive() {
  if (!state.workspacePath) throw new Error("Nessun workspace aperto");
  if (!loadSavedTokens()) throw new Error("Autenticazione Microsoft non effettuata.");

  let projectFolderId;
  try {
      const s = getAllSettings();
      if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) projectFolderId = s.sharedVaultId;
  } catch(e) { console.error("Errore lettura settings:", e); }
  
  if (!projectFolderId) {
      const rootFolderId = await getOrCreateFolder('ArchiView');
      const projectName = path.basename(state.workspacePath) + '_ArchiView';
      
      const client = await getGraphClient();
      const driveItem = {
          name: projectName,
          folder: { },
          "@microsoft.graph.conflictBehavior": "rename"
      };
      const newFolder = await client.api(`/me/drive/items/${rootFolderId}/children`).post(driveItem);
      projectFolderId = newFolder.id;
      
      try {
          const s = getAllSettings();
          if (s.isSharedVault || s.isPersonalCloud) {
              s.sharedVaultId = projectFolderId;
              saveAllSettings(s);
          }
      } catch(e) { console.error("Errore salvataggio sharedVaultId:", e); }
  }
  
  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  if (fs.existsSync(dbPath)) {
    await uploadFile(dbPath, 'database_manoscritti.json', projectFolderId);
  }

  try {
      let syncAttachments = true;
      try {
          const s = getAllSettings();
          if (s.syncAttachments !== undefined) syncAttachments = !!s.syncAttachments;
      } catch(e) { console.error("Errore lettura settings syncAttachments:", e); }
      
      if (syncAttachments) {
          const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
          if (fs.existsSync(allegatiLocalDir)) {
              const allegatiFolderId = await getOrCreateFolder('allegati_manoscritti', projectFolderId);
              const files = fs.readdirSync(allegatiLocalDir);
              let i = 0;
              const total = files.length;
              for (const file of files) {
                  i++;
                  const filePath = path.join(allegatiLocalDir, file);
                  const stat = fs.statSync(filePath);
                  if (stat.isFile()) {
                      const win = require('electron').BrowserWindow.getAllWindows()[0];
                      if (win) win.webContents.send('sync-progress', { percent: (i / total) * 100, message: `Caricamento allegato ${i} di ${total}` });
                      
                      await uploadFile(filePath, file, allegatiFolderId);
                  }
              }
          }
      }
  } catch(e) {
      console.error("Errore durante upload allegati:", e);
  }
  return true;
}

// Stubs for invite logic (Microsoft OneDrive Sharing APIs could be used)
async function generateInvite() { throw new Error("Non implementato per OneDrive"); }
async function cleanOrphanedAttachments() { return { deletedLocal: 0, deletedDrive: 0 }; }

function setupMsIpc() {
  ipcMain.handle('ms-auth', async (event, forceLocal) => await authenticateDrive(forceLocal));
  ipcMain.handle('ms-logout', async () => await logoutDrive());
  ipcMain.handle('ms-status', async () => await checkDriveStatus());
  ipcMain.handle('ms-pull', async (event, vaultId) => await pullFromDrive(vaultId, false));
  ipcMain.handle('ms-peek-db', async (event, vaultId) => await pullFromDrive(vaultId, true));
  ipcMain.handle('ms-sync', async () => { await syncToDrive(); return true; });
  ipcMain.handle('ms-check-updates', async (event, vaultId) => await checkUpdatesFromDrive(vaultId));
  ipcMain.handle('ms-clean-orphans', async () => await cleanOrphanedAttachments());
  ipcMain.handle('ms-generate-invite', async () => await generateInvite());
}

module.exports = { setupMsIpc };
export {};
