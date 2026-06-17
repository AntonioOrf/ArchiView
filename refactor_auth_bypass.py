import os

sync_path = "src/main/ipc/driveSync.ts"
with open(sync_path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = """    if (!skipCheck && loadSavedTokens()) {
      try {
        const res = await drive.about.get({ fields: 'user' });
        if (res.data.user) {
            // Verifica permessi sull'archivio specifico
            let settings: any = {};
            try { settings = getAllSettings(); } catch(e) {}
            if (state.workspacePath && settings.sharedVaultId) {
                try {
                    await drive.files.get({ fileId: settings.sharedVaultId, fields: 'id' });
                } catch (err: any) {
                    if (err.message && err.message.includes("File not found")) {
                        const localPath = getLocalTokenPath();
                        if (isLocalContext && localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
                        if (oauth2Client) oauth2Client.setCredentials(null);
                        return reject(new Error("L'account salvato non è più presente tra i collaboratori. Effettua nuovamente l'accesso."));
                    }
                }
            }
            return resolve(true);
        }
      } catch (e) {
        console.warn("Token caricato ma non valido. Procedo con nuova autenticazione.");
        const localPath = getLocalTokenPath();
        if (isLocalContext && localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
        const globalPath = getGlobalTokenPath();
        if (!isLocalContext && globalPath && fs.existsSync(globalPath)) fs.unlinkSync(globalPath);
      }
    }"""

new_block = """    if (!skipCheck && loadSavedTokens()) {
      try {
        // Con scope drive.file, about.get fallisce con 403. 
        // Proviamo una chiamata innocua come files.list per validare il token.
        await drive.files.list({ pageSize: 1, spaces: 'drive' });
        
        // Verifica permessi sull'archivio specifico
        let settings: any = {};
        try { settings = getAllSettings(); } catch(e) {}
        if (state.workspacePath && settings.sharedVaultId) {
            try {
                await drive.files.get({ fileId: settings.sharedVaultId, fields: 'id', supportsAllDrives: true });
            } catch (err: any) {
                if (err.message && err.message.includes("File not found")) {
                    const localPath = getLocalTokenPath();
                    if (isLocalContext && localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
                    if (oauth2Client) oauth2Client.setCredentials(null);
                    return reject(new Error("L'account salvato non è più presente tra i collaboratori. Effettua nuovamente l'accesso."));
                }
            }
        }
        return resolve(true);
        
      } catch (e: any) {
        console.warn("Token caricato ma API list fallita (Token forse scaduto o revocato).", e.message);
        const localPath = getLocalTokenPath();
        if (isLocalContext && localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
        const globalPath = getGlobalTokenPath();
        if (!isLocalContext && globalPath && fs.existsSync(globalPath)) fs.unlinkSync(globalPath);
      }
    }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(sync_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("authenticateDrive patched successfully.")
else:
    print("Could not find authenticateDrive block.")
