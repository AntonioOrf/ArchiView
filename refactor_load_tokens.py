import os

sync_path = "src/main/ipc/driveSync.ts"
with open(sync_path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = """function loadSavedTokens() {
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
        
        // Verifica che lo scope sia supportato"""

new_block = """function loadSavedTokens() {
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
        
        // Verifica che lo scope sia supportato"""

if old_block in content:
    content = content.replace(old_block, new_block)

old_catch = """        oauth2Client.setCredentials(tokens);
        return true;
    } catch(e) {
        return false;
    }
  }
  return false;
}"""

new_catch = """        oauth2Client.setCredentials(tokens);
        return true;
    } catch(e) {
        console.error("DEBUG AUTH: Errore in loadSavedTokens:", e);
        return false;
    }
  }
  return false;
}"""

if old_catch in content:
    content = content.replace(old_catch, new_catch)

with open(sync_path, "w", encoding="utf-8") as f:
    f.write(content)
print("loadSavedTokens patched successfully.")
