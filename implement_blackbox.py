import os

sync_path = "src/main/ipc/driveSync.ts"
with open(sync_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Insert logAuthEvent function right after getGlobalTokenPath block
log_auth_code = """function logAuthEvent(message) {
    let logPath;
    if (state.workspacePath) {
        logPath = path.join(state.workspacePath, '.archiview-chunks', 'auth_debug.log');
        const dir = path.dirname(logPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } else {
        logPath = path.join(app.getPath('userData'), 'auth_debug.log');
    }
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}\\n`;
    try {
        fs.appendFileSync(logPath, formattedMessage);
    } catch(e) {}
}

let localServer = null;"""

if "let localServer = null;" in content and "function logAuthEvent" not in content:
    content = content.replace("let localServer = null;", log_auth_code)

# 2. Add Auto-migration and logging to loadSavedTokens
old_load = """function loadSavedTokens() {
  try {
    initGoogle();
  } catch (e) {
    console.warn("Google Drive disabilitato:", e.message);
    return false;
  }
  
  let tokenPath;
  console.log("DEBUG AUTH: state.workspacePath is currently:", state.workspacePath);
  if (state.workspacePath) {
      // Se c'è un workspace aperto, usa ESCLUSIVAMENTE il token locale di quell'archivio
      tokenPath = getLocalTokenPath();
  } else {
      // Se non c'è workspace, usa il token globale
      tokenPath = getGlobalTokenPath();
  }
  
  console.log("DEBUG AUTH: Loading tokens da:", tokenPath);
  if (tokenPath && fs.existsSync(tokenPath)) {"""

new_load = """function loadSavedTokens() {
  try {
    initGoogle();
  } catch (e) {
    console.warn("Google Drive disabilitato:", e.message);
    logAuthEvent("ERRORE: initGoogle fallito in loadSavedTokens - " + e.message);
    return false;
  }
  
  let tokenPath;
  if (state.workspacePath) {
      tokenPath = getLocalTokenPath();
      // AUTO-MIGRAZIONE: Se locale non esiste, pesca dal globale
      if (tokenPath && !fs.existsSync(tokenPath)) {
          const globalPath = getGlobalTokenPath();
          if (globalPath && fs.existsSync(globalPath)) {
              try {
                  const dir = path.dirname(tokenPath);
                  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                  fs.copyFileSync(globalPath, tokenPath);
                  logAuthEvent("AUTO-MIGRAZIONE SUCCESSO: Token globale copiato nel workspace corrente -> " + tokenPath);
              } catch(e) {
                  logAuthEvent("AUTO-MIGRAZIONE FALLITA: " + e.message);
              }
          } else {
              logAuthEvent("ATTENZIONE: Nessun token locale e nessun token globale disponibile.");
          }
      }
  } else {
      tokenPath = getGlobalTokenPath();
  }
  
  logAuthEvent("Tentativo lettura token da: " + tokenPath);
  if (tokenPath && fs.existsSync(tokenPath)) {"""

if old_load in content:
    content = content.replace(old_load, new_load)
else:
    print("WARNING: Could not find old_load")

# 3. Add logging inside loadSavedTokens try/catch
old_load_catch = """        oauth2Client.setCredentials(tokens);
        return true;
    } catch(e) {
        console.error("DEBUG AUTH: Errore in loadSavedTokens:", e);
        return false;
    }
  }
  return false;
}"""

new_load_catch = """        oauth2Client.setCredentials(tokens);
        logAuthEvent("Token letto e impostato con SUCCESSO. Scope: " + tokens.scope);
        return true;
    } catch(e) {
        logAuthEvent("ERRORE LETTURA: " + e.message);
        return false;
    }
  }
  logAuthEvent("FALLIMENTO: Il file " + tokenPath + " non esiste.");
  return false;
}"""

if old_load_catch in content:
    content = content.replace(old_load_catch, new_load_catch)
else:
    print("WARNING: Could not find old_load_catch")

# 4. Add logging to oauth2Client.on('tokens')
old_oauth_tokens = """            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(targetPath, JSON.stringify(mergedTokens, null, 2));
        }
    });"""

new_oauth_tokens = """            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(targetPath, JSON.stringify(mergedTokens, null, 2));
            logAuthEvent("REFRESH TOKEN RICEVUTO: Salvato in " + targetPath);
        }
    });"""

if old_oauth_tokens in content:
    content = content.replace(old_oauth_tokens, new_oauth_tokens)
else:
    print("WARNING: Could not find old_oauth_tokens")

# 5. Add logging to manual save block
old_auth_save = """          const currentLocalPath = getLocalTokenPath();
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

new_auth_save = """          const currentLocalPath = getLocalTokenPath();
          if (currentLocalPath) {
              const targetPath = currentLocalPath;
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(targetPath, JSON.stringify(tokens));
              logAuthEvent("LOGIN MANUALE: Token FORZATO su LOCAL PATH -> " + targetPath);
          } else {
              const globalPath = getGlobalTokenPath();
              if (globalPath) {
                  const dir = path.dirname(globalPath);
                  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                  fs.writeFileSync(globalPath, JSON.stringify(tokens));
                  logAuthEvent("LOGIN MANUALE: Nessun workspace, salvato su GLOBAL PATH -> " + globalPath);
              }
          }"""

if old_auth_save in content:
    content = content.replace(old_auth_save, new_auth_save)
else:
    print("WARNING: Could not find old_auth_save")

with open(sync_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Black Box e Auto-migrazione aggiunte con successo!")
