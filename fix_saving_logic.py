import os

sync_path = "src/main/ipc/driveSync.ts"
with open(sync_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix oauth2Client.on('tokens') event handler
old_tokens_event = """    oauth2Client.on('tokens', (tokens) => {
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
        }"""

new_tokens_event = """    oauth2Client.on('tokens', (tokens) => {
        let currentTokens = {};
        const localPath = getLocalTokenPath();
        const globalPath = getGlobalTokenPath();
        let targetPath = null;

        // Se siamo in un workspace, DEVE sempre salvare localmente!
        if (state.workspacePath && localPath) {
            targetPath = localPath;
            if (fs.existsSync(localPath)) {
                try { currentTokens = JSON.parse(fs.readFileSync(localPath, 'utf8')); } catch(e){}
            }
        } else {
            // Solo se NON c'è un workspace attivo, usiamo il path globale
            targetPath = globalPath;
            if (fs.existsSync(globalPath)) {
                try { currentTokens = JSON.parse(fs.readFileSync(globalPath, 'utf8')); } catch(e){}
            }
        }"""

if old_tokens_event in content:
    content = content.replace(old_tokens_event, new_tokens_event)
else:
    print("WARNING: Could not find old_tokens_event")


# 2. Fix authenticateDrive manual save block
old_auth_save = """          if (shouldForceLocal && getLocalTokenPath()) {
              const targetPath = getLocalTokenPath();
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(targetPath, JSON.stringify(tokens));
          } else {
              const globalPath = getGlobalTokenPath();
              if (globalPath) {
                  const dir = path.dirname(globalPath);
                  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                  fs.writeFileSync(globalPath, JSON.stringify(tokens));
              }
          }"""

new_auth_save = """          // Ricalcoliamo il path ORA, perché state.workspacePath potrebbe essersi aggiornato!
          const currentLocalPath = getLocalTokenPath();
          if (currentLocalPath) {
              const targetPath = currentLocalPath;
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(targetPath, JSON.stringify(tokens));
              console.log("DEBUG AUTH: Salvato token in modo FORZATO su LOCAL PATH:", targetPath);
          } else {
              const globalPath = getGlobalTokenPath();
              if (globalPath) {
                  const dir = path.dirname(globalPath);
                  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                  fs.writeFileSync(globalPath, JSON.stringify(tokens));
                  console.log("DEBUG AUTH: Nessun workspace, salvato token su GLOBAL PATH:", globalPath);
              }
          }"""

if old_auth_save in content:
    content = content.replace(old_auth_save, new_auth_save)
else:
    print("WARNING: Could not find old_auth_save")

# Also let's fix loadSavedTokens debug prints again just to be absolutely sure.
old_load = """function loadSavedTokens() {
  try {
    initGoogle();
  } catch (e) {
    console.warn("Google Drive disabilitato:", e.message);
    return false;
  }
  
  let tokenPath;"""

new_load = """function loadSavedTokens() {
  try {
    initGoogle();
  } catch (e) {
    console.warn("Google Drive disabilitato:", e.message);
    return false;
  }
  
  let tokenPath;
  console.log("DEBUG AUTH: state.workspacePath is currently:", state.workspacePath);"""

if old_load in content:
    content = content.replace(old_load, new_load)
else:
    print("WARNING: Could not find old_load")

with open(sync_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Token saving logic fixed!")
