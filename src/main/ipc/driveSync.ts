const { ipcMain, app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { state, initWorkspace } = require('../workspaceManager');

const REDIRECT_URI = 'http://localhost:3456/oauth2callback';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function getTokenPath() {
  if (!state.workspacePath) {
    return path.join(app.getPath('userData'), 'google-drive-tokens-global.json');
  }
  return path.join(state.workspacePath, '.drive-tokens.json');
}

let localServer = null;
let googleInstance = null;
let oauth2Client = null;
let drive = null;

function initGoogle() {
  if (!googleInstance) {
    let clientId = 'YOUR_GOOGLE_DRIVE_CLIENT_ID';
    let clientSecret = 'YOUR_GOOGLE_DRIVE_CLIENT_SECRET';
    
    try {
      const creds = require('./cloudCredentials');
      clientId = creds.GOOGLE_CLIENT_ID;
      clientSecret = creds.GOOGLE_CLIENT_SECRET;
    } catch (e) {
      console.warn("File cloudCredentials.ts non trovato o non configurato.");
    }

    if (!clientId || !clientSecret || clientId === 'YOUR_GOOGLE_DRIVE_CLIENT_ID') {
      throw new Error("Credenziali Google Drive mancanti. Il file cloudCredentials.ts non è configurato.");
    }

    const { google } = require('googleapis');
    googleInstance = google;
    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
    drive = google.drive({ version: 'v3', auth: oauth2Client });
  }
}

function loadSavedTokens() {
  try {
    initGoogle();
  } catch (e) {
    console.warn("Google Drive disabilitato:", e.message);
    return false;
  }
  
  const tokenPath = getTokenPath();
  if (fs.existsSync(tokenPath)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      oauth2Client.setCredentials(tokens);
      return true;
    } catch (e) {
      console.error('Errore nel caricamento dei token di Drive:', e);
    }
  }
  return false;
}

async function authenticateDrive() {
  return new Promise((resolve, reject) => {
    if (loadSavedTokens()) {
      return resolve(true);
    }

    if (!oauth2Client) {
      return reject(new Error("Credenziali Google Drive mancanti. Il file cloudCredentials.ts non è configurato."));
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    if (localServer) localServer.close();

    localServer = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url, `http://localhost:3456`);
        const code = urlObj.searchParams.get('code');
        
        if (code) {
          res.end('<h1>Autenticazione completata!</h1><p>Puoi chiudere questa scheda e tornare ad ArchiView.</p><script>window.close()</script>');
          localServer.close();
          localServer = null;
          
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          fs.writeFileSync(getTokenPath(), JSON.stringify(tokens));
          resolve(true);
        } else {
          res.end('In attesa di autenticazione...');
        }
      } catch (e) {
        res.end('Errore durante l\'autenticazione.');
        reject(e);
      }
    }).listen(3456, () => {
      shell.openExternal(authUrl);
    });
  });
}

async function logoutDrive() {
  const tokenPath = getTokenPath();
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
  }
  oauth2Client.setCredentials(null);
  return true;
}

async function checkDriveStatus() {
  if (!loadSavedTokens()) return { isAuthenticated: false };
  try {
    const res = await drive.about.get({ fields: 'user' });
    return { 
      isAuthenticated: true, 
      user: res.data.user.emailAddress 
    };
  } catch (e) {
    return { isAuthenticated: false };
  }
}

// Funzioni Helper per Drive
async function getOrCreateFolder(folderName, parentId = null) {
  // Cerchiamo in tutti i file (My Drive + Shared with me)
  let q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }

  // Eseguiamo la ricerca
  let res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id, name)' });
  
  // Se non la trova, riproviamo cercando esplicitamente nei file condivisi con l'utente (utile se un altro account ha condiviso la cartella)
  if (res.data.files.length === 0 && !parentId) {
      const qShared = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and sharedWithMe=true`;
      const resShared = await drive.files.list({ q: qShared, spaces: 'drive', fields: 'files(id, name)' });
      if (resShared.data.files.length > 0) {
          return resShared.data.files[0].id;
      }
  }

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : undefined
  };

  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id'
  });
  return folder.data.id;
}

async function uploadFile(localPath, driveFileName, parentId, skipIfExist = false) {
  const mimeType = driveFileName.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  
  // Controlla se il file esiste
  const q = `name='${driveFileName}' and '${parentId}' in parents and trashed=false`;
  const res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id)' });
  
  if (res.data.files.length > 0) {
    if (skipIfExist) return; // Ottimizzazione: non ricaricare allegati già presenti
    const fileId = res.data.files[0].id;
    const media = { mimeType: mimeType, body: fs.createReadStream(localPath) };
    await drive.files.update({
      fileId: fileId,
      media: media
    });
  } else {
    const media = { mimeType: mimeType, body: fs.createReadStream(localPath) };
    await drive.files.create({
      resource: {
        name: driveFileName,
        parents: [parentId]
      },
      media: media,
      fields: 'id'
    });
  }
}

async function downloadFile(fileId, destPath) {
  return new Promise((resolve, reject) => {
    drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' })
      .then(res => {
        const dest = fs.createWriteStream(destPath);
        dest.on('finish', () => resolve(undefined));
        dest.on('error', (err: any) => reject(err));
        res.data.on('error', (err: any) => reject(err));
        res.data.pipe(dest);
      })
      .catch(reject);
  });
}

async function listVaultsFromDrive() {
  await authenticateDrive();
  const rootFolderId = await getOrCreateFolder('ArchiView');
  
  // Trova tutte le sottocartelle di ArchiView
  const q = `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id, name, modifiedTime)' });
  
  return res.data.files || [];
}

// Nuovo metodo per scaricare i dati da Drive
async function checkUpdatesFromDrive(vaultFolderId = null) {
  if (!loadSavedTokens()) return null;
  let fileId = null;
  let driveModifiedTime = null;
  let actualVaultFolderId = vaultFolderId;

  if (!actualVaultFolderId && state.workspacePath) {
      try {
          const s = JSON.parse(fs.readFileSync(path.join(state.workspacePath, 'settings.json'), 'utf8'));
          if (s.isSharedVault && s.sharedVaultId) actualVaultFolderId = s.sharedVaultId;
      } catch(e) {}
  }

  if (actualVaultFolderId) {
      let q = `name='database_manoscritti.json' and '${actualVaultFolderId}' in parents and trashed=false`;
      let res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id, modifiedTime)' });
      if (res.data.files.length > 0) driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
  } else if (state.workspacePath) {
      const rootFolderId = await getOrCreateFolder('ArchiView');
      const projectName = path.basename(state.workspacePath);
      actualVaultFolderId = await getOrCreateFolder(projectName, rootFolderId);
      
      let q = `name='database_manoscritti.json' and '${actualVaultFolderId}' in parents and trashed=false`;
      let res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id, modifiedTime)' });
      if (res.data.files.length > 0) driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
  }

  if (!driveModifiedTime) {
      let q = `name='database_manoscritti.json' and trashed=false`;
      let res = await drive.files.list({ q, spaces: 'drive', orderBy: 'modifiedTime desc', fields: 'files(id, modifiedTime)' });
      if (res.data.files.length === 0) {
          const qShared = `name='database_manoscritti.json' and trashed=false and sharedWithMe=true`;
          res = await drive.files.list({ q: qShared, spaces: 'drive', orderBy: 'modifiedTime desc', fields: 'files(id, modifiedTime)' });
      }
      if (res.data.files.length > 0) driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
  }

  return driveModifiedTime;
}

// Nuovo metodo per scaricare i dati da Drive
async function pullFromDrive(vaultFolderId = null) {
  if (!loadSavedTokens()) {
    throw new Error("Autenticazione Google Drive non effettuata. Apri il menu Cloud ed effettua l'accesso.");
  }
  let fileId = null;
  let driveModifiedTime = null;
  let actualVaultFolderId = vaultFolderId;

  // Se non è passato dalla UI, cerchiamo in settings
  if (!actualVaultFolderId && state.workspacePath) {
      try {
          const s = JSON.parse(fs.readFileSync(path.join(state.workspacePath, 'settings.json'), 'utf8'));
          if (s.isSharedVault && s.sharedVaultId) {
              actualVaultFolderId = s.sharedVaultId;
          }
      } catch(e) {}
  }

  // 1. Se è specificato un vaultFolderId (dal Cloud Explorer o Settings)
  if (actualVaultFolderId) {
      let q = `name='database_manoscritti.json' and '${actualVaultFolderId}' in parents and trashed=false`;
      let res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id, modifiedTime, parents)' });
      if (res.data.files.length > 0) {
          fileId = res.data.files[0].id;
          driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
          if (!actualVaultFolderId && res.data.files[0].parents) actualVaultFolderId = res.data.files[0].parents[0];
      }
  } 
  // 2. Altrimenti, se siamo in un workspace, cerchiamo nella sua cartella specifica
  else if (state.workspacePath) {
      const rootFolderId = await getOrCreateFolder('ArchiView');
      const projectName = path.basename(state.workspacePath);
      actualVaultFolderId = await getOrCreateFolder(projectName, rootFolderId);
      
      let q = `name='database_manoscritti.json' and '${actualVaultFolderId}' in parents and trashed=false`;
      let res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id, modifiedTime, parents)' });
      
      if (res.data.files.length > 0) {
          fileId = res.data.files[0].id;
          driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
          if (!actualVaultFolderId && res.data.files[0].parents) actualVaultFolderId = res.data.files[0].parents[0];
      }
  }

  // 3. Se non l'abbiamo trovato o se non c'è workspace (es. Ripristino Iniziale),
  // cerchiamo globalmente il database_manoscritti.json più recente
  if (!fileId) {
      let q = `name='database_manoscritti.json' and trashed=false`;
      let res = await drive.files.list({ q, spaces: 'drive', orderBy: 'modifiedTime desc', fields: 'files(id, modifiedTime, parents)' });
      
      if (res.data.files.length === 0) {
          const qShared = `name='database_manoscritti.json' and trashed=false and sharedWithMe=true`;
          res = await drive.files.list({ q: qShared, spaces: 'drive', orderBy: 'modifiedTime desc', fields: 'files(id, modifiedTime, parents)' });
      }

      if (res.data.files.length > 0) {
          fileId = res.data.files[0].id;
          driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
          if (!actualVaultFolderId && res.data.files[0].parents) actualVaultFolderId = res.data.files[0].parents[0];
      }
  }

  if (fileId) {
    // Ritorna il file in memoria senza sovrascrivere direttamente,
    // così il frontend può fare il merge in modo sicuro.
    const driveRes = await drive.files.get({ fileId: fileId, alt: 'media' });
    
    // Controlla se dobbiamo sincronizzare anche gli allegati
    let syncAttachments = false;
    if (state.workspacePath) {
        try {
            const s = JSON.parse(fs.readFileSync(path.join(state.workspacePath, 'settings.json'), 'utf8'));
            syncAttachments = !!s.syncAttachments;
        } catch(e) {}
    }
    
    // Scarica allegati in background (non blocca il return del db)
    if (syncAttachments && state.workspacePath && actualVaultFolderId) {
        // Recuperiamo l'id del vault
        (async () => {
            try {
                const allegatiFolderId = await getOrCreateFolder('allegati_manoscritti', actualVaultFolderId);
                const qAll = `'${allegatiFolderId}' in parents and trashed=false`;
                const resAll = await drive.files.list({ q: qAll, spaces: 'drive', fields: 'files(id, name)' });
                const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
                if (!fs.existsSync(allegatiLocalDir)) fs.mkdirSync(allegatiLocalDir, { recursive: true });
                
                for (const f of resAll.data.files) {
                    const localPath = path.join(allegatiLocalDir, f.name);
                    if (!fs.existsSync(localPath)) {
                        await downloadFile(f.id, localPath);
                    }
                }
            } catch (e) {
                console.error("Errore download allegati in background:", e);
            }
        })();
    }

    return { database: driveRes.data, driveModifiedTime };
  }
  
  return null;
}

async function syncToDrive() {
  if (!state.workspacePath) throw new Error("Nessun workspace aperto");
  if (!loadSavedTokens()) {
    throw new Error("Autenticazione Google Drive non effettuata. Apri il menu Cloud ed effettua l'accesso.");
  }
  
  let projectFolderId;
  try {
      const s = JSON.parse(fs.readFileSync(path.join(state.workspacePath, 'settings.json'), 'utf8'));
      if (s.isSharedVault && s.sharedVaultId) {
          projectFolderId = s.sharedVaultId;
      }
  } catch(e) {}
  
  if (!projectFolderId) {
      const rootFolderId = await getOrCreateFolder('ArchiView');
      const projectName = path.basename(state.workspacePath);
      projectFolderId = await getOrCreateFolder(projectName, rootFolderId);
  }
  
  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  if (fs.existsSync(dbPath)) {
    await uploadFile(dbPath, 'database_manoscritti.json', projectFolderId);
  }

  // Sincronizzazione allegati se abilitata
  try {
      const settingsPath = path.join(state.workspacePath, 'settings.json');
      if (fs.existsSync(settingsPath)) {
          const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          if (s.syncAttachments) {
              const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
              if (fs.existsSync(allegatiLocalDir)) {
                  const allegatiFolderId = await getOrCreateFolder('allegati_manoscritti', projectFolderId);
                  const files = fs.readdirSync(allegatiLocalDir);
                  for (const file of files) {
                      const filePath = path.join(allegatiLocalDir, file);
                      const stat = fs.statSync(filePath);
                      if (stat.isFile()) {
                          // skipIfExist = true per non ricaricare immagini già presenti
                          await uploadFile(filePath, file, allegatiFolderId, true);
                      }
                  }
              }
          }
      }
  } catch(e) {
      console.error("Errore durante upload allegati:", e);
  }

  return true;
}

function setupDriveIpc() {
  ipcMain.handle('drive-auth', async () => {
    return await authenticateDrive();
  });
  ipcMain.handle('drive-logout', async () => {
    return await logoutDrive();
  });
  ipcMain.handle('drive-status', async () => {
    return await checkDriveStatus();
  });
  ipcMain.handle('drive-list-vaults', async () => {
    return await listVaultsFromDrive();
  });
  ipcMain.handle('drive-pull', async (event, vaultId) => {
    return await pullFromDrive(vaultId);
  });
  ipcMain.handle('drive-sync', async () => {
    await syncToDrive();
    return true;
  });
  ipcMain.handle('drive-check-updates', async (event, vaultId) => {
    return await checkUpdatesFromDrive(vaultId);
  });
  ipcMain.handle('drive-generate-invite', async () => {
    try {
        await authenticateDrive(); // Necessario per ottenere l'ID della cartella
        const tokenPath = getTokenPath();
        let refreshToken = "";
        if (fs.existsSync(tokenPath)) {
            const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            refreshToken = tokens.refresh_token || "";
        }
        
        const settingsPath = path.join(state.workspacePath, 'settings.json');
        let settings: any = {};
        if (fs.existsSync(settingsPath)) {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
        
        // Recupera l'ID univoco della cartella di questo Vault su Google Drive
        const rootFolderId = await getOrCreateFolder('ArchiView');
        const projectName = path.basename(state.workspacePath);
        const vaultFolderId = await getOrCreateFolder(projectName, rootFolderId);
        
        // Formato ultra-ridotto: r|k|c|w|a|v
        // r = refresh_token, k = pusherKey, c = cluster, w = webhook, a = autofetch (1/0), v = vaultFolderId
        const parts = [
            refreshToken,
            settings.pusherKey || "",
            settings.pusherCluster || "",
            settings.pusherWebhook || "",
            settings.driveAutofetch ? "1" : "0",
            vaultFolderId || ""
        ];
        
        // Comprime in base64 e sostituisce caratteri ambigui
        const rawStr = parts.join('|');
        return Buffer.from(rawStr).toString('base64').replace(/=/g, '');
    } catch(e) {
        throw new Error("Impossibile generare l'invito: " + e.message);
    }
  });
  
  ipcMain.handle('drive-join-invite', async (event, inviteCode, basePath, name) => {
    try {
        // Aggiungi il padding se rimosso
        let b64 = inviteCode;
        while (b64.length % 4 !== 0) b64 += '=';
        
        const rawStr = Buffer.from(b64, 'base64').toString('utf8');
        const parts = rawStr.split('|');
        if (parts.length < 5) throw new Error("Codice incompleto");
        
        const [refreshToken, pKey, pCluster, pWebhook, pAuto, vaultId] = parts;
        
        // 1. Crea il workspace
        const newPath = path.join(basePath, name);
        if (!fs.existsSync(newPath)) {
            fs.mkdirSync(newPath, { recursive: true });
        }
        
        // 2. Salva il token Google Drive (solo refresh_token)
        if(refreshToken) {
            const tokenPath = path.join(path.join(basePath, name), '.drive-tokens.json');
            const mockTokens = { refresh_token: refreshToken };
            fs.writeFileSync(tokenPath, JSON.stringify(mockTokens, null, 2));
        }
        
        // 3. Salva le impostazioni Pusher e il flag Condiviso
        const settingsPath = path.join(path.join(basePath, name), 'settings.json');
        let settings: any = {};
        if(fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        
        if(pKey || pWebhook) {
            settings.pusherKey = pKey;
            settings.pusherCluster = pCluster;
            settings.pusherWebhook = pWebhook;
            settings.driveAutofetch = pAuto === "1";
        }
        
        // Contrassegna questo vault come condiviso
        settings.isSharedVault = true;
        
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        
        initWorkspace(newPath);
        
        // 4. Auto-sincronizzazione dei file cloud se abbiamo il vaultId
        if (vaultId) {
            try {
                const driveData = await pullFromDrive(vaultId);
                if (driveData && driveData.database) {
                    const dbPath = path.join(newPath, 'database_manoscritti.json');
                    let dbContent = driveData.database;
                    if (typeof dbContent !== 'string') {
                        dbContent = JSON.stringify(dbContent, null, 2);
                    }
                    fs.writeFileSync(dbPath, dbContent, 'utf8');
                }
            } catch (syncErr) {
                console.error("Errore durante l'auto-sincronizzazione iniziale:", syncErr);
                // Non lanciamo l'errore per non bloccare l'unione, ma l'utente dovrà sincronizzare manualmente.
            }
        }
        
        app.relaunch();
        app.quit();
        
        return true;
    } catch(e) {
        throw new Error("Codice invito non valido o errore nella creazione: " + e.message);
    }
  });
}

module.exports = { setupDriveIpc };
export {};
