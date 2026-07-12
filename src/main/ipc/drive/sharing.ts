const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { shell } = require('electron');
const { state, initWorkspace, getActiveVaultFlags, saveAllSettings } = require('../../workspaceManager');
const { driveState, authenticateDrive } = require('./auth');
const { getOrCreateFolder } = require('./fileOps');
const { pullFromDrive } = require('./vaultOps');

async function generateInviteCode(): Promise<string> {
  try {
    await authenticateDrive();
    let settings: any = {};
    try { settings = getActiveVaultFlags(); } catch (e) { console.error("Errore lettura settings:", e); }

    let vaultFolderId = settings.sharedVaultId;
    const projectName = path.basename(state.workspacePath) + '_ArchiView';

    if (!vaultFolderId) {
      const rootFolderId = await getOrCreateFolder('ArchiView');
      vaultFolderId = await getOrCreateFolder(projectName, rootFolderId);
      settings.sharedVaultId = vaultFolderId;
      saveAllSettings(settings);
    }

    let creds: any = {};
    try { creds = require('../cloudCredentials'); } catch (e) { /* opzionale */ }

    const parts = [
      "",                                          // r: refresh_token (non condiviso per sicurezza)
      settings.pusherKey || creds.PUSHER_KEY || "",
      settings.pusherCluster || creds.PUSHER_CLUSTER || "",
      settings.pusherWebhook || creds.PUSHER_WEBHOOK || "",
      settings.driveAutofetch ? 1 : 0,
      vaultFolderId,
      projectName
    ];

    return Buffer.from(parts.join('|')).toString('base64').replace(/=/g, '');
  } catch (e: any) {
    throw new Error("Impossibile generare l'invito: " + e.message);
  }
}

function decodeInviteCode(inviteCode: string): { vaultName: string; vaultId: string } {
  let b64 = inviteCode;
  while (b64.length % 4 !== 0) b64 += '=';
  const parts = Buffer.from(b64, 'base64').toString('utf8').split('|');
  if (parts.length < 5) throw new Error("Codice incompleto");
  const [, , , , , vaultId, vaultName] = parts;
  return { vaultName: vaultName || "Vault_Condiviso", vaultId: vaultId || "" };
}

async function joinByInviteCode(inviteCode: string, basePath: string, name: string): Promise<boolean> {
  let b64 = inviteCode;
  while (b64.length % 4 !== 0) b64 += '=';
  const parts = Buffer.from(b64, 'base64').toString('utf8').split('|');
  if (parts.length < 5) throw new Error("Codice incompleto");
  const [refreshToken, pKey, pCluster, pWebhook, pAuto, vaultId] = parts;

  const newPath = path.join(basePath, name);
  if (fs.existsSync(newPath)) {
    throw new Error(`La cartella "${name}" esiste già nel percorso selezionato. Per favore rinominala, cancellala o scegli un'altra posizione.`);
  }
  fs.mkdirSync(newPath, { recursive: true });

  // Nota: l'invito NON trasporta refresh_token (parts[0] è sempre vuoto per sicurezza).
  // Il ricevente autentica il proprio account; con scope drive.file l'accesso al vault
  // condiviso passa dal Google Picker (vedi openExternalPicker). I token vivono in
  // userData/cloud-tokens/ (cloudTokenStore), mai dentro il workspace.

  const settingsToSave: any = { isSharedVault: true };
  if (pKey || pWebhook) {
    settingsToSave.pusherKey = pKey;
    settingsToSave.pusherCluster = pCluster;
    settingsToSave.pusherWebhook = pWebhook;
    settingsToSave.driveAutofetch = pAuto === "1";
  }
  if (vaultId) {
    settingsToSave.sharedVaultId = vaultId;
    settingsToSave.promptCloudAuth = true;
  }

  initWorkspace(newPath);
  saveAllSettings(settingsToSave);

  if (vaultId) {
    // Con scope drive.file, il ricevente non può accedere a cartelle create da altri
    // finché non le "apre" tramite il picker. Tentiamo il pull: se fallisce, l'utente
    // dovrà usare il picker (openExternalPicker) e poi joinByFolderId.
    try {
      await authenticateDrive();
      const driveData = await pullFromDrive(vaultId);
      if (driveData && driveData.database) {
        const dbContent = typeof driveData.database !== 'string' ? JSON.stringify(driveData.database, null, 2) : driveData.database;
        fs.writeFileSync(path.join(newPath, 'database_manoscritti.json'), dbContent, 'utf8');
      }
    } catch (syncErr: any) {
      console.warn("Auto-sync iniziale fallita (probabile scope drive.file su cartella altrui):", syncErr.message);
      // Il db verrà scaricato al primo sync manuale dopo che l'utente ha aperto il picker
    }
  }

  if (state.mainWindow) state.mainWindow.reload();
  return true;
}

async function joinByFolderId(vaultId: string, vaultName: string, basePath: string, customPusher: any): Promise<boolean> {
  const name = vaultName || "Vault_Condiviso";
  const newPath = path.join(basePath, name);
  if (fs.existsSync(newPath)) {
    throw new Error(`La cartella "${name}" esiste già. Rinominala o scegli un'altra posizione.`);
  }
  fs.mkdirSync(newPath, { recursive: true });

  let creds: any = {};
  try { creds = require('../cloudCredentials'); } catch (e) { /* opzionale */ }

  const settingsToSave: any = {
    isSharedVault: true,
    sharedVaultId: vaultId,
    pusherKey: customPusher?.pusherKey || creds.PUSHER_KEY || "",
    pusherCluster: customPusher?.pusherCluster || creds.PUSHER_CLUSTER || "",
    pusherWebhook: customPusher?.pusherWebhook || creds.PUSHER_WEBHOOK || "",
    driveAutofetch: customPusher ? customPusher.driveAutofetch : true
  };
  initWorkspace(newPath);
  saveAllSettings(settingsToSave);

  if (vaultId) {
    try {
      const driveData = await pullFromDrive(vaultId);
      if (driveData && driveData.database) {
        const dbContent = typeof driveData.database !== 'string' ? JSON.stringify(driveData.database, null, 2) : driveData.database;
        fs.writeFileSync(path.join(newPath, 'database_manoscritti.json'), dbContent, 'utf8');
      }
    } catch (syncErr) { /* Sincronizzazione manuale richiesta dall'utente */ }
  }

  if (state.mainWindow) state.mainWindow.reload();
  return true;
}

async function shareVault(email: string): Promise<boolean> {
  await authenticateDrive();
  let settings: any = {};
  try { settings = getActiveVaultFlags(); } catch (e) { console.error("Errore lettura settings:", e); }

  const vaultFolderId = settings.sharedVaultId;
  if (!vaultFolderId) throw new Error("ID dell'Archivio non trovato. Assicurati che sia un Archivio Condiviso.");

  const inviteCode = await generateInviteCode();
  const inviteLink = `archiview://join/${inviteCode}`;
  const msg = `Sei stato invitato a collaborare a un Archivio Condiviso su ArchiView!\n\nClicca su questo link per aprirlo direttamente nell'app:\n${inviteLink}\n\nSe il link non funziona, apri ArchiView (Unisciti a un Archivio) e inserisci questo codice:\n${inviteCode}`;

  await driveState.drive.permissions.create({
    fileId: vaultFolderId,
    sendNotificationEmail: true,
    emailMessage: msg,
    requestBody: { role: 'writer', type: 'user', emailAddress: email }
  });
  return true;
}

async function listPermissions(): Promise<any[]> {
  await authenticateDrive();
  let settings: any = {};
  try { settings = getActiveVaultFlags(); } catch (e) { console.error("Errore lettura settings:", e); }

  const vaultFolderId = settings.sharedVaultId;
  if (!vaultFolderId) throw new Error("ID dell'Archivio non trovato.");

  const res = await driveState.drive.permissions.list({
    fileId: vaultFolderId,
    fields: 'permissions(id, emailAddress, role, type, displayName, photoLink)'
  });
  return res.data.permissions || [];
}

async function removePermission(permissionId: string): Promise<boolean> {
  await authenticateDrive();
  let settings: any = {};
  try { settings = getActiveVaultFlags(); } catch (e) { console.error("Errore lettura settings:", e); }

  const vaultFolderId = settings.sharedVaultId;
  if (!vaultFolderId) throw new Error("ID dell'Archivio non trovato.");

  await driveState.drive.permissions.delete({ fileId: vaultFolderId, permissionId });
  return true;
}

async function openExternalPicker(): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      await authenticateDrive();
      if (!driveState.oauth2Client) return reject(new Error("OAuth client non inizializzato."));

      const { token } = await driveState.oauth2Client.getAccessToken();
      const creds = require('../cloudCredentials');
      const clientId = creds.GOOGLE_CLIENT_ID;
      const apiKey = creds.GOOGLE_API_KEY || '';
      const appId = clientId ? clientId.split('-')[0] : '';

      if (!token || !apiKey || !appId) {
        return reject(new Error("Configurazione API mancante in cloudCredentials.ts."));
      }

      const sessionSecret = crypto.randomBytes(16).toString('hex');
      const rootFolderId = await getOrCreateFolder('ArchiView');

      const pickerHtml = `<!DOCTYPE html>
<html lang="it"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ArchiView — Seleziona Cartella Drive</title>
<script src="https://apis.google.com/js/api.js"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    min-height:100vh;
    display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#f0f9ff 0%,#fafaf9 50%,#f0fdf4 100%);
    color:#1c1917;
  }
  .card{
    background:#fff;
    border-radius:20px;
    box-shadow:0 8px 32px rgba(0,0,0,.10),0 1px 4px rgba(0,0,0,.06);
    border:1px solid #e7e5e4;
    padding:48px 40px 40px;
    max-width:440px;width:90%;
    text-align:center;
  }
  .logo{
    display:inline-flex;align-items:center;justify-content:center;
    width:64px;height:64px;border-radius:16px;
    background:linear-gradient(135deg,#0ea5e9,#0284c7);
    box-shadow:0 4px 16px rgba(2,132,199,.30);
    margin-bottom:24px;
  }
  .logo svg{width:32px;height:32px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  h1{font-size:1.35rem;font-weight:700;color:#0c0a09;margin-bottom:8px;letter-spacing:-.02em}
  .subtitle{font-size:.9rem;color:#78716c;line-height:1.6;margin-bottom:28px}
  .badge{
    display:inline-flex;align-items:center;gap:6px;
    background:#f0f9ff;color:#0284c7;
    border:1px solid #bae6fd;
    border-radius:99px;padding:6px 14px;
    font-size:.8rem;font-weight:600;margin-bottom:24px;
  }
  .badge svg{width:14px;height:14px;fill:none;stroke:#0284c7;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .hint{font-size:.78rem;color:#a8a29e;margin-top:20px;line-height:1.5}

  /* Spinner */
  .spinner{
    display:inline-block;width:36px;height:36px;
    border:3px solid #e0f2fe;border-top-color:#0284c7;
    border-radius:50%;animation:spin .7s linear infinite;
    margin-bottom:20px;
  }
  @keyframes spin{to{transform:rotate(360deg)}}

  /* States */
  .state-success .logo{background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 4px 16px rgba(22,163,74,.30)}
  .state-cancel  .logo{background:linear-gradient(135deg,#94a3b8,#64748b);box-shadow:0 4px 16px rgba(100,116,139,.25)}
  .state-success h1{color:#15803d}
  .state-cancel  h1{color:#475569}

  .close-hint{margin-top:28px;font-size:.78rem;color:#a8a29e}
  .progress-bar{height:3px;border-radius:99px;background:#e0f2fe;overflow:hidden;margin-top:24px}
  .progress-fill{height:100%;width:0;background:#0284c7;border-radius:99px;animation:fill 1.8s ease forwards}
  @keyframes fill{to{width:100%}}
</style>
</head>
<body>
<div class="card" id="card">
  <div class="logo" id="logo">
    <!-- cloud icon -->
    <svg viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
  </div>
  <div class="badge" id="badge">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    Popup in apertura…
  </div>
  <h1 id="title">Seleziona la cartella</h1>
  <p class="subtitle" id="subtitle">Scegli la cartella <strong>_ArchiView</strong> dal popup di Google Drive che si è appena aperto.</p>
  <p class="hint" id="hint">Se il popup non appare, controlla che il browser non lo stia bloccando e riprova.</p>
</div>

<script>
  const clientId="${clientId}",appId="${appId}",apiKey="${apiKey}",token="${token}",rootFolderId="${rootFolderId}",sessionSecret="${sessionSecret}";

  function setState(type, title, subtitle, hint) {
    const card = document.getElementById('card');
    const badge = document.getElementById('badge');
    card.className = 'card state-' + type;
    document.getElementById('title').textContent = title;
    document.getElementById('subtitle').innerHTML = subtitle;
    if (hint !== undefined) document.getElementById('hint').textContent = hint;

    const logoSvgs = {
      success: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
      cancel:  '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    };
    if (logoSvgs[type]) document.getElementById('logo').innerHTML = logoSvgs[type];

    const badgeLabels = { success: 'Completato', cancel: 'Annullato' };
    if (badgeLabels[type]) {
      badge.style.background = type === 'success' ? '#f0fdf4' : '#f8fafc';
      badge.style.color = type === 'success' ? '#15803d' : '#64748b';
      badge.style.borderColor = type === 'success' ? '#bbf7d0' : '#cbd5e1';
      badge.innerHTML = badgeLabels[type];
    }

    if (type === 'success' || type === 'cancel') {
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      bar.innerHTML = '<div class="progress-fill"></div>';
      card.appendChild(bar);
      const ch = document.createElement('p');
      ch.className = 'close-hint';
      ch.textContent = 'Questa finestra si chiuderà automaticamente…';
      card.appendChild(ch);
    }
  }

  gapi.load('picker', { callback: () => {
    const sharedView  = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setMimeTypes('application/vnd.google-apps.folder')
      .setIncludeFolders(true).setSelectFolderEnabled(true)
      .setOwnedByMe(false).setQuery('_ArchiView');
    const myDriveView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setMimeTypes('application/vnd.google-apps.folder')
      .setIncludeFolders(true).setSelectFolderEnabled(true)
      .setQuery('_ArchiView');

    const picker = new google.picker.PickerBuilder()
      .addView(sharedView).addView(myDriveView)
      .setAppId(appId).setOAuthToken(token).setDeveloperKey(apiKey)
      .setTitle("Seleziona la cartella dell'Archivio Condiviso")
      .setCallback(async (data) => {
        if (data.action === google.picker.Action.PICKED) {
          const file = data.docs[0];
          try {
            await fetch('/picker-callback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: file.id, name: file.name, secret: sessionSecret }) });
            setState('success', 'Cartella selezionata!', 'Tutto pronto. Torna ad <strong>ArchiView</strong> per continuare.', '');
            setTimeout(() => window.close(), 2000);
          } catch(e) { alert('Errore: ' + e); }
        } else if (data.action === google.picker.Action.CANCEL) {
          await fetch('/picker-cancel', { method: 'POST' });
          setState('cancel', 'Selezione annullata', 'Puoi chiudere questa finestra e riprovare da ArchiView.', '');
          setTimeout(() => window.close(), 1500);
        }
      }).build();

    // Aggiorna badge prima di aprire il picker
    const badge = document.getElementById('badge');
    badge.style.background='#f0f9ff';badge.style.color='#0284c7';badge.style.borderColor='#bae6fd';
    badge.innerHTML='<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:#0284c7;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.82"/></svg> In attesa di selezione…';
    picker.setVisible(true);
  }});
</script>
</body></html>`;

      let pickerServer: any = http.createServer((req: any, res: any) => {
        if (req.url === '/' || req.url === '/picker') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(pickerHtml);
        } else if (req.url === '/picker-callback' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (!data.secret || data.secret !== sessionSecret) {
                res.writeHead(403); res.end('Forbidden');
                return;
              }
              res.writeHead(200); res.end('OK');
              resolve({ id: data.id, name: data.name });
            } catch (e) {
              res.writeHead(400); res.end('Bad Request');
              reject(new Error("Dati picker non validi."));
            }
            if (pickerServer) { pickerServer.close(); pickerServer = null; }
          });
        } else if (req.url === '/picker-cancel' && req.method === 'POST') {
          res.writeHead(200); res.end('OK');
          resolve(null);
          if (pickerServer) { pickerServer.close(); pickerServer = null; }
        } else {
          res.writeHead(404); res.end();
        }
      });

      pickerServer.on('error', (err: any) => {
        console.error("Errore server picker:", err);
        reject(new Error("Porta 3457 già in uso o errore server."));
      });
      pickerServer.listen(3457, '127.0.0.1', () => { shell.openExternal('http://localhost:3457/picker'); });
    } catch (e) { reject(e); }
  });
}

module.exports = {
  generateInviteCode, decodeInviteCode,
  joinByInviteCode, joinByFolderId,
  shareVault, listPermissions, removePermission,
  openExternalPicker
};
export {};
