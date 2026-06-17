import os

file_path = "src/main/ipc/driveSync.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. getLocalTokenPath
old_local = """function getLocalTokenPath() {
  if (!state.workspacePath) return null;
  return path.join(state.workspacePath, '.drive-tokens.json');
}"""

new_local = """function getLocalTokenPath() {
  if (!state.workspacePath) return null;
  return path.join(state.workspacePath, '.archiview-chunks', '.credentials.json');
}"""

content = content.replace(old_local, new_local)

# 2. initGoogle
old_init = """function initGoogle() {
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
}"""

new_init = """function initGoogle() {
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
    
    // Ascolta il refresh automatico dei token e salvali
    oauth2Client.on('tokens', (tokens) => {
        let currentTokens = {};
        const localPath = getLocalTokenPath();
        const globalPath = getGlobalTokenPath();
        let targetPath = null;

        if (localPath && fs.existsSync(localPath)) {
            try { currentTokens = JSON.parse(fs.readFileSync(localPath, 'utf8')); } catch(e){}
            targetPath = localPath;
        } else if (globalPath && fs.existsSync(globalPath)) {
            try { currentTokens = JSON.parse(fs.readFileSync(globalPath, 'utf8')); } catch(e){}
            targetPath = globalPath;
        }

        if (!targetPath && state.workspacePath) {
            targetPath = localPath;
            const chunksDir = path.dirname(targetPath);
            if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });
        } else if (!targetPath) {
            targetPath = globalPath;
        }

        if (targetPath) {
            const mergedTokens = { ...currentTokens, ...tokens };
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(targetPath, JSON.stringify(mergedTokens, null, 2));
        }
    });

    drive = google.drive({ version: 'v3', auth: oauth2Client });
  }
}"""

content = content.replace(old_init, new_init)

# 3. authenticateDrive creation of directory
old_auth_write = """          if (shouldForceLocal && getLocalTokenPath()) {
              fs.writeFileSync(getLocalTokenPath(), JSON.stringify(tokens));
          } else {"""

new_auth_write = """          if (shouldForceLocal && getLocalTokenPath()) {
              const targetPath = getLocalTokenPath();
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(targetPath, JSON.stringify(tokens));
          } else {"""

content = content.replace(old_auth_write, new_auth_write)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Auth logic refactored successfully.")
