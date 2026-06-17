import os

# 1. Update preload.ts
preload_path = "src/main/preload.ts"
with open(preload_path, "r", encoding="utf-8") as f:
    preload_content = f.read()

preload_search = "status: () => ipcRenderer.invoke('drive-status'),"
preload_replace = "status: () => ipcRenderer.invoke('drive-status'),\n    checkAuth: () => ipcRenderer.invoke('drive-check-auth'),"

if preload_search in preload_content and "checkAuth:" not in preload_content:
    preload_content = preload_content.replace(preload_search, preload_replace)
    with open(preload_path, "w", encoding="utf-8") as f:
        f.write(preload_content)

# 2. Update driveSync.ts
sync_path = "src/main/ipc/driveSync.ts"
with open(sync_path, "r", encoding="utf-8") as f:
    sync_content = f.read()

# Add console.log to loadSavedTokens
load_tokens_search = """  if (tokenPath && fs.existsSync(tokenPath)) {
    try {"""
load_tokens_replace = """  console.log("DEBUG AUTH: Loading tokens da:", tokenPath);
  if (tokenPath && fs.existsSync(tokenPath)) {
    try {"""

if load_tokens_search in sync_content and "DEBUG AUTH: Loading tokens da" not in sync_content:
    sync_content = sync_content.replace(load_tokens_search, load_tokens_replace)

# Add IPC push to authenticateDrive
auth_search = """          oauth2Client.setCredentials(tokens);
          
          if (shouldForceLocal && getLocalTokenPath()) {"""
auth_replace = """          oauth2Client.setCredentials(tokens);
          
          const win = require('electron').BrowserWindow.getAllWindows()[0];
          if (win) {
              win.webContents.send('drive-status-updated', { authenticated: true });
          }
          
          if (shouldForceLocal && getLocalTokenPath()) {"""

if auth_search in sync_content and "drive-status-updated" not in sync_content:
    sync_content = sync_content.replace(auth_search, auth_replace)

# Add drive-check-auth IPC handler
ipc_search = "  ipcMain.handle('drive-status', async () => {"
ipc_replace = """  ipcMain.handle('drive-check-auth', async () => {
    return loadSavedTokens();
  });
  ipcMain.handle('drive-status', async () => {"""

if ipc_search in sync_content and "drive-check-auth" not in sync_content:
    sync_content = sync_content.replace(ipc_search, ipc_replace)

with open(sync_path, "w", encoding="utf-8") as f:
    f.write(sync_content)

print("Auth bridge injected successfully.")
