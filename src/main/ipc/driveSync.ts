const { ipcMain, app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { state, initWorkspace, getAllSettings, saveAllSettings } = require('../workspaceManager');

const REDIRECT_URI = 'http://localhost:3456/oauth2callback';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function getGlobalTokenPath() {
  return path.join(app.getPath('userData'), 'google-drive-tokens-global.json');
}

function getLocalTokenPath() {
  if (!state.workspacePath) return null;
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
  
  let tokenPath = getLocalTokenPath();
  if (!tokenPath || !fs.existsSync(tokenPath)) {
      tokenPath = getGlobalTokenPath();
  }
  
  if (tokenPath && fs.existsSync(tokenPath)) {
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

async function authenticateDrive(forceLocal = false) {
  return new Promise(async (resolve, reject) => {
    if (!forceLocal && loadSavedTokens()) {
      try {
        const res = await drive.about.get({ fields: 'user' });
        if (res.data.user) return resolve(true);
      } catch (e) {
        console.warn("Token caricato ma non valido. Procedo con nuova autenticazione.");
        const localPath = getLocalTokenPath();
        if (localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
        const globalPath = getGlobalTokenPath();
        if (globalPath && fs.existsSync(globalPath)) fs.unlinkSync(globalPath);
      }
    }

    if (!oauth2Client) {
      // Initialize oauth2client if it hasn't been initialized
      try { initGoogle(); } catch(e) { return reject(e); }
      if (!oauth2Client) {
        return reject(new Error("Credenziali Google Drive mancanti. Il file cloudCredentials.ts non è configurato."));
      }
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'select_account consent'
    });

    if (localServer) localServer.close();

    localServer = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url, `http://localhost:3456`);
        const code = urlObj.searchParams.get('code');
        
        if (code) {
          const successHtml = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autenticazione Completata - ArchiView</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafaf9; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #1c1917; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); padding: 40px; max-width: 400px; text-align: center; border: 1px solid #e7e5e4; }
    .icon { width: 64px; height: 64px; background-color: #dcfce7; color: #166534; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 24px; }
    .icon svg { width: 32px; height: 32px; }
    h1 { font-size: 1.5rem; margin: 0 0 12px; font-weight: 600; }
    p { color: #57534e; margin: 0 0 24px; line-height: 1.5; }
    .btn { display: inline-block; background-color: #1c1917; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; transition: background-color 0.2s; cursor: pointer; border: none; font-size: 1rem; }
    .btn:hover { background-color: #44403c; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1>Autenticazione Completata</h1>
    <p>Ti sei autenticato correttamente con Google Drive. Puoi chiudere questa scheda e tornare ad ArchiView.</p>
    <button class="btn" id="closeBtn" onclick="tryClose()">Chiudi Scheda</button>
    <p id="closeMsg" style="display:none; color: #dc2626; font-size: 0.9rem; margin-top: 16px;">Il tuo browser blocca la chiusura automatica. Puoi chiudere liberamente questa scheda dalla "X" in alto.</p>
  </div>
  <script>
    function tryClose() {
      window.close();
      setTimeout(() => {
        document.getElementById('closeMsg').style.display = 'block';
        document.getElementById('closeBtn').style.display = 'none';
      }, 300);
    }
    setTimeout(tryClose, 3000);
  </script>
</body>
</html>`;
          res.end(successHtml);
          localServer.close();
          localServer = null;
          
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          
          if (forceLocal && getLocalTokenPath()) {
              fs.writeFileSync(getLocalTokenPath(), JSON.stringify(tokens));
          } else {
              fs.writeFileSync(getGlobalTokenPath(), JSON.stringify(tokens));
          }
          
          resolve(true);
        } else {
          const waitHtml = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>In Attesa - ArchiView</title><style>body { margin: 0; font-family: sans-serif; background-color: #fafaf9; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #1c1917; } .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; border: 1px solid #e7e5e4; }</style></head><body><div class="card"><h2>In attesa di autenticazione...</h2><p>Completa il login su Google per continuare.</p></div></body></html>`;
          res.end(waitHtml);
        }
      } catch (e) {
        const errHtml = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Errore - ArchiView</title><style>body { margin: 0; font-family: sans-serif; background-color: #fafaf9; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #1c1917; } .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; border: 1px solid #e7e5e4; } h2 { color: #dc2626; margin-top:0; }</style></head><body><div class="card"><h2>Errore di Autenticazione</h2><p>Si è verificato un errore durante il login. Chiudi la scheda e riprova da ArchiView.</p></div></body></html>`;
        res.end(errHtml);
        reject(e);
      }
    }).on('error', (err) => {
      console.error("Errore server locale:", err);
      reject(new Error("Impossibile avviare il server locale per l'autenticazione. Riprova."));
    }).listen(3456, () => {
      shell.openExternal(authUrl);
    });
  });
}

async function logoutDrive() {
  const localTokenPath = getLocalTokenPath();
  const globalTokenPath = getGlobalTokenPath();
  
  if (localTokenPath && fs.existsSync(localTokenPath)) {
    fs.unlinkSync(localTokenPath);
  }
  if (globalTokenPath && fs.existsSync(globalTokenPath)) {
    fs.unlinkSync(globalTokenPath);
  }
  
  if (oauth2Client) oauth2Client.setCredentials(null);
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
const escapeDriveQuery = (str: string) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function getOrCreateFolder(folderName, parentId = null) {
  // Cerchiamo in tutti i file (My Drive + Shared with me)
  let q = `name='${escapeDriveQuery(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }

  // Eseguiamo la ricerca
  let res = await drive.files.list({ q, fields: 'files(id, name)' });
  
  // Se non la trova, riproviamo cercando esplicitamente nei file condivisi con l'utente (utile se un altro account ha condiviso la cartella)
  if (res.data.files.length === 0 && !parentId) {
      const qShared = `name='${escapeDriveQuery(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false and sharedWithMe=true`;
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
    requestBody: fileMetadata,
    fields: 'id'
  });
  return folder.data.id;
}

async function uploadFile(localPath, driveFileName, parentId, skipIfExist = false) {
  const mimeType = driveFileName.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  
  // Controlla se il file esiste
  const q = `name='${escapeDriveQuery(driveFileName)}' and '${parentId}' in parents and trashed=false`;
  const res = await drive.files.list({ q, fields: 'files(id)' });
  
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
      requestBody: {
        name: driveFileName,
        parents: [parentId]
      },
      media: media,
      fields: 'id'
    });
  }
}

const { pipeline } = require('stream/promises');

async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function downloadFile(fileId, destPath) {
  const res = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' });
  const dest = fs.createWriteStream(destPath);
  await pipeline(res.data, dest);
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
          const s = getAllSettings();
          if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) actualVaultFolderId = s.sharedVaultId;
      } catch(e) {}
  }

  if (actualVaultFolderId) {
      let q = `name='database_manoscritti.json' and '${actualVaultFolderId}' in parents and trashed=false`;
      const res = await drive.files.list({ q, fields: 'files(id, modifiedTime)' });
      if (res.data.files.length > 0) driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
  } else if (state.workspacePath) {
      // Se non abbiamo un actualVaultFolderId per questo workspace, significa che non è mai stato sincronizzato.
      // Non dobbiamo cercare cartelle per nome, altrimenti becchiamo i vecchi vault!
      return null;
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
async function pullFromDrive(vaultFolderId = null, skipAttachments = false) {
  if (!loadSavedTokens()) {
    throw new Error("Autenticazione Google Drive non effettuata. Apri il menu Cloud ed effettua l'accesso.");
  }
  let fileId = null;
  let driveModifiedTime = null;
  let actualVaultFolderId = vaultFolderId;

  // Se non è passato dalla UI, cerchiamo in settings
  if (!actualVaultFolderId && state.workspacePath) {
      try {
          const s = getAllSettings();
          if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) {
              actualVaultFolderId = s.sharedVaultId;
          }
      } catch(e) {}
  }

  let lastModifyingUser = null;

  // 1. Se è specificato un vaultFolderId (dal Cloud Explorer o Settings)
  if (actualVaultFolderId) {
      let q = `name='database_manoscritti.json' and '${actualVaultFolderId}' in parents and trashed=false`;
      let res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id, modifiedTime, parents, lastModifyingUser)' });
      if (res.data.files.length > 0) {
          fileId = res.data.files[0].id;
          driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
          lastModifyingUser = res.data.files[0].lastModifyingUser;
          if (!actualVaultFolderId && res.data.files[0].parents) actualVaultFolderId = res.data.files[0].parents[0];
      }
  } 
  // 2. Altrimenti, se siamo in un workspace senza ID salvato, NON dobbiamo tirare giù dati a caso.
  // Significa che questo vault non è mai stato sincronizzato o è stato appena scollegato.
  else if (state.workspacePath) {
      return null;
  }

  // 3. Ripristino Iniziale (quando non c'è workspacePath e stiamo sfogliando cloud in generale)
  if (!fileId && !state.workspacePath) {
      let q = `name='database_manoscritti.json' and trashed=false`;
      let res = await drive.files.list({ q, spaces: 'drive', orderBy: 'modifiedTime desc', fields: 'files(id, modifiedTime, parents, lastModifyingUser)' });
      
      if (res.data.files.length === 0) {
          const qShared = `name='database_manoscritti.json' and trashed=false and sharedWithMe=true`;
          res = await drive.files.list({ q: qShared, spaces: 'drive', orderBy: 'modifiedTime desc', fields: 'files(id, modifiedTime, parents, lastModifyingUser)' });
      }

      if (res.data.files.length > 0) {
          fileId = res.data.files[0].id;
          driveModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
          lastModifyingUser = res.data.files[0].lastModifyingUser;
          if (!actualVaultFolderId && res.data.files[0].parents) actualVaultFolderId = res.data.files[0].parents[0];
      }
  }

  if (fileId) {
    // Ritorna il file in memoria senza sovrascrivere direttamente,
    // così il frontend può fare il merge in modo sicuro.
    const driveRes = await drive.files.get({ fileId: fileId, alt: 'media' });
    
    // Controlla se dobbiamo sincronizzare anche gli allegati
    let syncAttachments = true; // Default true se non specificato diversamente

    if (state.workspacePath) {
        try {
            const s = getAllSettings();
            if (s.syncAttachments !== undefined) syncAttachments = !!s.syncAttachments;
        } catch(e) {}
    }
    
    if (skipAttachments) syncAttachments = false;
    
    // Scarica allegati (blocca il return del db così da mostrare la barra di progresso corretta)
    if (syncAttachments && state.workspacePath && actualVaultFolderId) {
        try {
            const usedAttachments = new Set();
            if (driveRes.data && driveRes.data.manoscritti) {
                for (const m of driveRes.data.manoscritti) {
                    if (m.allegati) {
                        for (const a of m.allegati) {
                            if (a.nome) usedAttachments.add(a.nome);
                        }
                    }
                }
            }

            const allegatiFolderId = await getOrCreateFolder('allegati_manoscritti', actualVaultFolderId);
            const qAll = `'${allegatiFolderId}' in parents and trashed=false`;
            
            const allDriveFiles: any[] = [];
            let pageToken = undefined;
            do {
                const resAll: any = await drive.files.list({ 
                    q: qAll, 
                    pageSize: 1000, 
                    fields: 'nextPageToken, files(id, name)',
                    pageToken: pageToken
                });
                if (resAll.data.files) {
                    allDriveFiles.push(...resAll.data.files);
                }
                pageToken = resAll.data.nextPageToken;
            } while (pageToken);

            const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
            if (!fs.existsSync(allegatiLocalDir)) fs.mkdirSync(allegatiLocalDir, { recursive: true });
            
            const filesToDownload = allDriveFiles.filter((f: any) => usedAttachments.has(f.name));
            
            let i = 0;
            const total = filesToDownload.length;
            const win = require('electron').BrowserWindow.getAllWindows()[0];
            
            await asyncPool(5, filesToDownload, async (f: any) => {
                i++;
                if (win) win.webContents.send('sync-progress', { percent: (i / total) * 100, message: `Scaricamento allegato ${i} di ${total}` });
                
                const localPath = path.join(allegatiLocalDir, f.name);
                if (!fs.existsSync(localPath)) {
                    await downloadFile(f.id, localPath);
                    if (win) win.webContents.send('allegato-scaricato', f.name);
                }
            });
        } catch (e) {
            console.error("Errore download allegati:", e);
        }
    }

    let parsedDb = driveRes.data;
    const logPath = require('path').join(__dirname, '../../../artifacts/superpowers/debug.log');
    let dbgMsg = `[DEBUG] typeof parsedDb: ${typeof parsedDb}\n`;
    if (parsedDb) {
        dbgMsg += `[DEBUG] isBuffer: ${Buffer.isBuffer(parsedDb)}\n`;
        dbgMsg += `[DEBUG] keys: ${Object.keys(parsedDb).join(', ')}\n`;
    }
    
    if (typeof parsedDb === 'string') {
        try {
            parsedDb = JSON.parse(parsedDb);
            dbgMsg += `[DEBUG] Successfully parsed string. typeof parsedDb is now: ${typeof parsedDb}\n`;
        } catch (e) {
            console.error("Errore parse JSON db da Drive:", e);
            dbgMsg += `[DEBUG] Error parsing string: ${e.message}\n`;
        }
    }
    
    dbgMsg += `[DEBUG] Final typeof parsedDb: ${typeof parsedDb}\n`;
    if (typeof parsedDb === 'object') {
        dbgMsg += `[DEBUG] Final parsedDb keys: ${Object.keys(parsedDb).join(', ')}\n`;
        if (parsedDb.manoscritti) {
            dbgMsg += `[DEBUG] manoscritti count: ${parsedDb.manoscritti.length}\n`;
        } else {
            dbgMsg += `[DEBUG] manoscritti missing!\n`;
        }
    }
    
    try {
        fs.appendFileSync(logPath, dbgMsg + '\n');
    } catch(err) {
        console.error("Could not write debug log", err);
    }

    return { database: parsedDb, driveModifiedTime, lastModifyingUser };
  }
  
  return null;
}

async function syncToDrive(parentModifiedTime = null) {
  if (!state.workspacePath) throw new Error("Nessun workspace aperto");
  if (!loadSavedTokens()) {
    throw new Error("Autenticazione Google Drive non effettuata. Apri il menu Cloud ed effettua l'accesso.");
  }
  
  let projectFolderId;
  try {
      const s = getAllSettings();
      if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) {
          projectFolderId = s.sharedVaultId;
      }
  } catch(e) {}
  
  if (!projectFolderId) {
      const rootFolderId = await getOrCreateFolder('ArchiView');
      const projectName = path.basename(state.workspacePath);
      
      // Creiamo una cartella nuova in modo incondizionato per evitare collisioni con vecchi vault aventi lo stesso nome
      const fileMetadata = {
          name: projectName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId]
      };
      const folder = await drive.files.create({
          requestBody: fileMetadata,
          fields: 'id'
      });
      projectFolderId = folder.data.id;
      
      try {
          const s = getAllSettings();
          if (s.isSharedVault || s.isPersonalCloud) {
              s.sharedVaultId = projectFolderId;
              saveAllSettings(s);
          }
      } catch(e) {}
  }
  
  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  if (fs.existsSync(dbPath)) {
      // Controllo conflitti Optimistic Concurrency
      if (parentModifiedTime) {
          const q = `name='database_manoscritti.json' and '${projectFolderId}' in parents and trashed=false`;
          const res = await drive.files.list({ q, fields: 'files(id, modifiedTime)' });
          if (res.data.files.length > 0) {
              const currentModifiedTime = new Date(res.data.files[0].modifiedTime).getTime();
              // Aggiungiamo 1 secondo di tolleranza per eventuali arrotondamenti di Google Drive API
              if (currentModifiedTime > parentModifiedTime + 1000) {
                  throw new Error("409_CONFLICT: Un altro utente ha salvato modifiche più recenti sul Cloud. E' necessario prima ricevere gli aggiornamenti.");
              }
          }
      }
      
    await uploadFile(dbPath, 'database_manoscritti.json', projectFolderId);
  }

  // Sincronizzazione allegati se abilitata
  try {
      let syncAttachments = true;

      try {
          const s = getAllSettings();
          if (s.syncAttachments !== undefined) syncAttachments = !!s.syncAttachments;
      } catch(e) {}
      
      if (syncAttachments) {
          const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
          if (fs.existsSync(allegatiLocalDir)) {
              const usedAttachments = new Set();
              try {
                  if (fs.existsSync(dbPath)) {
                      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                      if (db.manoscritti) {
                          for (const m of db.manoscritti) {
                              if (m.allegati) {
                                  for (const a of m.allegati) {
                                      if (a.nome) usedAttachments.add(a.nome);
                                  }
                              }
                          }
                      }
                  }
              } catch (e) {
                  console.error("Errore lettura db per filtro upload allegati:", e);
              }
              
              const allegatiFolderId = await getOrCreateFolder('allegati_manoscritti', projectFolderId);
              
              const qAll = `'${allegatiFolderId}' in parents and trashed=false`;
              const existingDriveFiles = new Set();
              let pageToken = undefined;
              do {
                  const resAll: any = await drive.files.list({ 
                      q: qAll, 
                      pageSize: 1000, 
                      fields: 'nextPageToken, files(name)',
                      pageToken: pageToken
                  });
                  if (resAll.data.files) {
                      resAll.data.files.forEach((f: any) => existingDriveFiles.add(f.name));
                  }
                  pageToken = resAll.data.nextPageToken;
              } while (pageToken);

              const allFiles = fs.readdirSync(allegatiLocalDir);
              const filesToUpload = allFiles.filter(f => usedAttachments.has(f) && !existingDriveFiles.has(f));

              let i = 0;
              const total = filesToUpload.length;
              const win = require('electron').BrowserWindow.getAllWindows()[0];
              
              await asyncPool(5, filesToUpload, async (file: string) => {
                  i++;
                  const filePath = path.join(allegatiLocalDir, file);
                  const stat = fs.statSync(filePath);
                  if (stat.isFile()) {
                      if (win) win.webContents.send('sync-progress', { percent: (i / total) * 100, message: `Caricamento allegato ${i} di ${total}` });
                      
                      // skipIfExist = true per non ricaricare immagini già presenti
                      await uploadFile(filePath, file, allegatiFolderId, true);
                  }
              });
          }
      }
  } catch(e) {
      console.error("Errore durante upload allegati:", e);
  }

  return true;
}

async function cleanOrphanedAttachments() {
  if (!state.workspacePath) throw new Error("Nessun workspace aperto");
  if (!loadSavedTokens()) {
    throw new Error("Autenticazione Google Drive non effettuata.");
  }
  
  let projectFolderId;
  try {
      const s = getAllSettings();
      if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) {
          projectFolderId = s.sharedVaultId;
      }
  } catch(e) {}
  
  if (!projectFolderId) {
      const rootFolderId = await getOrCreateFolder('ArchiView');
      const projectName = path.basename(state.workspacePath);
      projectFolderId = await getOrCreateFolder(projectName, rootFolderId);
  }

  // Leggi DB locale per trovare tutti gli allegati usati
  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  if (!fs.existsSync(dbPath)) return { deletedLocal: 0, deletedDrive: 0 };
  
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const usedAttachments = new Set();
  
  if (db.manoscritti) {
      for (const m of db.manoscritti) {
          if (m.allegati) {
              for (const a of m.allegati) {
                  if (a.nome) usedAttachments.add(a.nome);
              }
          }
      }
  }
  
  let deletedLocal = 0;
  let deletedDrive = 0;
  
  // 1. Pulizia Locale
  const allegatiLocalDir = path.join(state.workspacePath, 'allegati_manoscritti');
  if (fs.existsSync(allegatiLocalDir)) {
      const files = fs.readdirSync(allegatiLocalDir);
      for (const file of files) {
          if (!usedAttachments.has(file)) {
              try {
                  fs.unlinkSync(path.join(allegatiLocalDir, file));
                  deletedLocal++;
              } catch(e) { console.error("Errore eliminazione locale:", e); }
          }
      }
  }
  
  // 2. Pulizia Drive
  try {
      const allegatiFolderId = await getOrCreateFolder('allegati_manoscritti', projectFolderId);
      const qAll = `'${allegatiFolderId}' in parents and trashed=false`;
      const resAll = await drive.files.list({ q: qAll, fields: 'files(id, name)' });
      
      for (const f of resAll.data.files) {
          if (!usedAttachments.has(f.name)) {
              try {
                  await drive.files.update({ fileId: f.id, requestBody: { trashed: true } });
                  deletedDrive++;
              } catch(e) { console.error("Errore spostamento nel cestino Drive:", e); }
          }
      }
  } catch(e) {
      console.error("Errore durante pulizia Drive:", e);
  }
  
  return { deletedLocal, deletedDrive };
}

/**
 * Recupera la lista delle revisioni del file database_manoscritti.json su Google Drive.
 * Richiede il fileId del file (non della cartella).
 */
async function listDriveRevisions(fileId: string) {
    if (!loadSavedTokens()) {
        throw new Error("Autenticazione Google Drive non effettuata.");
    }
    try {
        const res = await drive.revisions.list({
            fileId,
            fields: 'revisions(id, modifiedTime, lastModifyingUser, size, keepForever)',
            pageSize: 1000
        });
        return (res.data.revisions || []).reverse(); // La più recente prima
    } catch (e: any) {
        throw new Error("Impossibile recuperare lo storico: " + e.message);
    }
}

/**
 * Scarica il contenuto JSON di una revisione specifica.
 */
async function getDriveRevision(fileId: string, revisionId: string) {
    if (!loadSavedTokens()) {
        throw new Error("Autenticazione Google Drive non effettuata.");
    }
    try {
        const res = await drive.revisions.get({
            fileId,
            revisionId,
            alt: 'media'
        });
        let data = res.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch(e) {}
        }
        return data;
    } catch (e: any) {
        throw new Error("Impossibile scaricare la revisione: " + e.message);
    }
}

/**
 * Recupera il fileId del database_manoscritti.json dal vault corrente.
 */
async function getDbFileId() {
    let projectFolderId: string | null = null;
    try {
        const s = getAllSettings();
        if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) {
            projectFolderId = s.sharedVaultId;
        }
    } catch(e) {}

    if (!projectFolderId) {
        throw new Error("Vault non collegato al Cloud. Sincronizza almeno una volta prima di vedere lo storico.");
    }

    const q = `name='database_manoscritti.json' and '${projectFolderId}' in parents and trashed=false`;
    const res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id)' });
    if (!res.data.files || res.data.files.length === 0) {
        throw new Error("File database non trovato su Google Drive. Carica almeno una volta.");
    }
    return res.data.files[0].id;
}

function setupDriveIpc() {
  // --- Storico Versioni Cloud (Drive Revisions) ---
  ipcMain.handle('drive-get-db-file-id', async () => {
    initGoogle();
    return await getDbFileId();
  });

  ipcMain.handle('drive-list-revisions', async (event, fileId) => {
    initGoogle();
    return await listDriveRevisions(fileId);
  });

  ipcMain.handle('drive-get-revision', async (event, fileId, revisionId) => {
    initGoogle();
    return await getDriveRevision(fileId, revisionId);
  });

  ipcMain.handle('drive-restore-revision', async (event, fileId, revisionId) => {
    initGoogle();
    // 1. Scarica il contenuto della revisione
    const revData = await getDriveRevision(fileId, revisionId);
    if (!revData) throw new Error("Revisione non trovata.");

    // 2. Sovrascrivi il file locale
    if (!state.workspacePath) throw new Error("Nessun workspace aperto.");
    const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
    const content = typeof revData === 'string' ? revData : JSON.stringify(revData, null, 2);
    fs.writeFileSync(dbPath, content, 'utf8');

    // 3. Carica la versione ripristinata sul cloud (crea una nuova revisione)
    let projectFolderId: string | null = null;
    try {
        const s = getAllSettings();
        if ((s.isSharedVault || s.isPersonalCloud) && s.sharedVaultId) {
            projectFolderId = s.sharedVaultId;
        }
    } catch(e) {}
    if (projectFolderId) {
        await uploadFile(dbPath, 'database_manoscritti.json', projectFolderId);
    }
    return true;
  });

  ipcMain.handle('drive-auth', async (event, forceLocal) => {
    return await authenticateDrive(forceLocal);
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
    return await pullFromDrive(vaultId, false);
  });
  ipcMain.handle('drive-peek-db', async (event, vaultId) => {
    return await pullFromDrive(vaultId, true);
  });
  ipcMain.handle('drive-sync', async (event, parentModifiedTime) => {
    await syncToDrive(parentModifiedTime);
    return true;
  });
  ipcMain.handle('drive-check-updates', async (event, vaultId) => {
    return await checkUpdatesFromDrive(vaultId);
  });
  ipcMain.handle('drive-clean-orphans', async () => {
    return await cleanOrphanedAttachments();
  });
  ipcMain.handle('drive-generate-invite', async () => {
    try {
        await authenticateDrive(); // Necessario per ottenere l'ID della cartella
        let tokenPath = getLocalTokenPath();
        if (!tokenPath || !fs.existsSync(tokenPath)) {
            tokenPath = getGlobalTokenPath();
        }
        let refreshToken = "";
        if (fs.existsSync(tokenPath)) {
            const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            refreshToken = tokens.refresh_token || "";
        }
        
        let settings: any = {};
        try {
            settings = getAllSettings();
        } catch(e) {}
        
        // Recupera l'ID univoco della cartella di questo Vault su Google Drive
        let vaultFolderId = settings.sharedVaultId;
        const projectName = path.basename(state.workspacePath);
        
        if (!vaultFolderId) {
            const rootFolderId = await getOrCreateFolder('ArchiView');
            vaultFolderId = await getOrCreateFolder(projectName, rootFolderId);
            settings.sharedVaultId = vaultFolderId;
            saveAllSettings(settings);
        }
        
        // I permessi per la cartella condivisa NON vengono più impostati su "anyone" qui.
        // L'utente deve invitare esplicitamente i collaboratori tramite email usando "drive-share-vault".
        
        let creds: any = {};
        try {
            creds = require('./cloudCredentials');
        } catch(e) {}
        
        // Formato ultra-ridotto: r|k|c|w|a|v|n
        // r = refresh_token, k = pusherKey, c = cluster, w = webhook, a = autofetch (1/0), v = vaultFolderId, n = projectName
        const inviteObj = {
            r: "", // CRITICO: Il refresh token non viene più condiviso nel codice di invito per sicurezza
            k: settings.pusherKey || creds.PUSHER_KEY || "",
            c: settings.pusherCluster || creds.PUSHER_CLUSTER || "",
            w: settings.pusherWebhook || creds.PUSHER_WEBHOOK || "",
            a: settings.driveAutofetch ? 1 : 1,
            v: vaultFolderId,
            n: projectName
        };
        
        const parts = [
            inviteObj.r,
            inviteObj.k,
            inviteObj.c,
            inviteObj.w,
            inviteObj.a,
            inviteObj.v,
            inviteObj.n
        ];
        
        // Comprime in base64 e sostituisce caratteri ambigui
        const rawStr = parts.join('|');
        return Buffer.from(rawStr).toString('base64').replace(/=/g, '');
    } catch(e) {
        throw new Error("Impossibile generare l'invito: " + e.message);
    }
  });
  
  ipcMain.handle('drive-decode-invite', async (event, inviteCode) => {
    try {
        let b64 = inviteCode;
        while (b64.length % 4 !== 0) b64 += '=';
        
        const rawStr = Buffer.from(b64, 'base64').toString('utf8');
        const parts = rawStr.split('|');
        if (parts.length < 5) throw new Error("Codice incompleto");
        
        const [refreshToken, pKey, pCluster, pWebhook, pAuto, vaultId, vaultName] = parts;
        return {
            vaultName: vaultName || "Vault_Condiviso",
            vaultId: vaultId || ""
        };
    } catch(e) {
        throw new Error("Codice invito non valido: " + e.message);
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
        if (fs.existsSync(newPath)) {
            throw new Error(`La cartella "${name}" esiste già nel percorso selezionato. Per favore rinominala, cancellala o scegli un'altra posizione.`);
        }
        fs.mkdirSync(newPath, { recursive: true });
        
        // 2. Salva il token Google Drive (solo refresh_token)
        if(refreshToken) {
            const tokenPath = path.join(path.join(basePath, name), '.drive-tokens.json');
            const mockTokens = { refresh_token: refreshToken };
            fs.writeFileSync(tokenPath, JSON.stringify(mockTokens, null, 2));
        }
        
        // 3. Salva le impostazioni Pusher e il flag Condiviso globalmente
        let settingsToSave: any = { isSharedVault: true };
        
        if(pKey || pWebhook) {
            settingsToSave.pusherKey = pKey;
            settingsToSave.pusherCluster = pCluster;
            settingsToSave.pusherWebhook = pWebhook;
            settingsToSave.driveAutofetch = pAuto === "1";
        }
        
        if (vaultId) {
            settingsToSave.sharedVaultId = vaultId;
            settingsToSave.promptCloudAuth = true;
        }
        
        initWorkspace(newPath); // Imposta questo workspace come attivo
        saveAllSettings(settingsToSave); // Salva le impostazioni globalmente

        
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
        if (state.mainWindow) {
            state.mainWindow.reload();
        }
        
        return true;
    } catch(e) {
        throw new Error("Codice invito non valido o errore nella creazione: " + e.message);
    }
  });
  
  ipcMain.handle('drive-share-vault', async (event, email) => {
    try {
        await authenticateDrive();
        let settings: any = {};
        try { settings = getAllSettings(); } catch(e) {}
        
        let vaultFolderId = settings.sharedVaultId;
        if (!vaultFolderId) throw new Error("ID dell'Archivio non trovato. Assicurati che sia un Archivio Condiviso.");
        
        await drive.permissions.create({
            fileId: vaultFolderId,
            sendNotificationEmail: true,
            requestBody: { role: 'writer', type: 'user', emailAddress: email },
        });
        return true;
    } catch(e) {
        throw new Error("Errore durante la condivisione: " + e.message);
    }
  });

  ipcMain.handle('drive-get-token', async () => {
    if (!oauth2Client) return null;
    try {
        const { token } = await oauth2Client.getAccessToken();
        return token;
    } catch(e) {
        return null;
    }
  });

  ipcMain.handle('drive-get-client-id', async () => {
    try {
        const creds = require('./cloudCredentials');
        const clientId = creds.GOOGLE_CLIENT_ID;
        const appId = clientId ? clientId.split('-')[0] : '';
        return { clientId, appId };
    } catch(e) {
        return { clientId: '', appId: '' };
    }
  });

  ipcMain.handle('drive-join-folder-id', async (event, vaultId, vaultName, basePath) => {
    try {
        const name = vaultName || "Vault_Condiviso";
        const newPath = path.join(basePath, name);
        if (fs.existsSync(newPath)) {
            throw new Error(`La cartella "${name}" esiste già. Rinominala o scegli un'altra posizione.`);
        }
        fs.mkdirSync(newPath, { recursive: true });
        
        let settingsToSave: any = { isSharedVault: true, sharedVaultId: vaultId };
        initWorkspace(newPath);
        saveAllSettings(settingsToSave);
        
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
            } catch (syncErr) {}
        }
        if (state.mainWindow) state.mainWindow.reload();
        return true;
    } catch (e: any) {
        throw new Error("Errore connessione archivio: " + e.message);
    }
  });
}

module.exports = { setupDriveIpc };
export {};
