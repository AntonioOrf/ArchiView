import os

sync_path = "src/main/ipc/driveSync.ts"
with open(sync_path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = """function loadSavedTokens() {
  if (!oauth2Client) {
      try {
          initGoogle();
      } catch (e) {
          console.error("DEBUG AUTH: initGoogle fallito in loadSavedTokens:", e);
      }
  }

  let tokenPath;
  if (state.workspacePath) {
    tokenPath = getLocalTokenPath();
  } else {
    tokenPath = getGlobalTokenPath();
  }
  console.log("DEBUG AUTH: Loading tokens da:", tokenPath);
  if (tokenPath && fs.existsSync(tokenPath)) {
    try {
        const tokenData = fs.readFileSync(tokenPath, 'utf8');
        const tokens = JSON.parse(tokenData);
        
        // Verifica che lo scope sia supportato
        if (tokens.scope && typeof tokens.scope === 'string') {
            const scopesArray = tokens.scope.split(' ');
            const hasValidScope = scopesArray.includes('https://www.googleapis.com/auth/drive') || 
                                  scopesArray.includes('https://www.googleapis.com/auth/drive.file') ||
                                  scopesArray.includes('https://www.googleapis.com/auth/drive.appdata');
            if (!hasValidScope) {
                console.warn("Scope non valido, ma evito di eliminare il token.");
                // Ritorniamo false per richiedere auth ma non cancelliamo
                return false;
            }
        }
        
        oauth2Client.setCredentials(tokens);
        return true;
    } catch(e) {
        console.error("DEBUG AUTH: Errore in loadSavedTokens:", e);
        return false;
    }
  }
  return false;
}"""

new_block = """function loadSavedTokens() {
  console.log("DEBUG AUTH: loadSavedTokens started. oauth2Client is initialized?", !!oauth2Client);
  if (!oauth2Client) {
      try {
          initGoogle();
          console.log("DEBUG AUTH: initGoogle() called. oauth2Client is now:", !!oauth2Client);
      } catch (e) {
          console.error("DEBUG AUTH: initGoogle fallito in loadSavedTokens:", e);
      }
  }

  let tokenPath;
  if (state.workspacePath) {
    tokenPath = getLocalTokenPath();
  } else {
    tokenPath = getGlobalTokenPath();
  }
  console.log("DEBUG AUTH: Loading tokens da:", tokenPath);
  if (!tokenPath) {
      console.log("DEBUG AUTH: tokenPath is null");
      return false;
  }
  if (!fs.existsSync(tokenPath)) {
      console.log("DEBUG AUTH: file does not exist at tokenPath");
      return false;
  }
  
  if (tokenPath && fs.existsSync(tokenPath)) {
    try {
        const tokenData = fs.readFileSync(tokenPath, 'utf8');
        const tokens = JSON.parse(tokenData);
        
        if (!tokens.refresh_token) {
            console.log("DEBUG AUTH: refresh_token is MISSING from saved tokens!");
            // Se manca il refresh_token offline, il token è inutile a lungo termine.
        }

        // Verifica che lo scope sia supportato
        if (tokens.scope && typeof tokens.scope === 'string') {
            const scopesArray = tokens.scope.split(' ');
            const hasValidScope = scopesArray.includes('https://www.googleapis.com/auth/drive') || 
                                  scopesArray.includes('https://www.googleapis.com/auth/drive.file') ||
                                  scopesArray.includes('https://www.googleapis.com/auth/drive.appdata');
            if (!hasValidScope) {
                console.warn("DEBUG AUTH: Scope non valido:", tokens.scope);
                return false;
            }
        }
        
        oauth2Client.setCredentials(tokens);
        console.log("DEBUG AUTH: setCredentials success! Returning true.");
        return true;
    } catch(e) {
        console.error("DEBUG AUTH: Errore in loadSavedTokens (JSON parse o setCredentials):", e);
        return false;
    }
  }
  console.log("DEBUG AUTH: loadSavedTokens returning false at the end.");
  return false;
}"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(sync_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("loadSavedTokens debug patched successfully.")
else:
    print("Could not find loadSavedTokens block.")
