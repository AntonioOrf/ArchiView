import os

sync_path = "src/main/ipc/driveSync.ts"
with open(sync_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove unlinkSync from loadSavedTokens scope check
old_scope = """            if (!hasValidScope) {
                fs.unlinkSync(tokenPath);
                return false;
            }"""
new_scope = """            if (!hasValidScope) {
                console.warn("Scope non valido, ma evito di eliminare il token.");
                // Ritorniamo false per richiedere auth ma non cancelliamo
                return false;
            }"""
content = content.replace(old_scope, new_scope)

# 2. Remove unlinkSync from authenticateDrive (File not found catch)
old_not_found = """                if (err.message && err.message.includes("File not found")) {
                    const localPath = getLocalTokenPath();
                    if (isLocalContext && localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
                    if (oauth2Client) oauth2Client.setCredentials(null);
                    return reject(new Error("L'account salvato non è più presente tra i collaboratori. Effettua nuovamente l'accesso."));
                }"""
new_not_found = """                if (err.message && err.message.includes("File not found")) {
                    // NON cancelliamo il token, potremmo non avere i permessi a causa di drive.file
                    return reject(new Error("L'archivio condiviso non è accessibile. Se è stato creato da altri, richiedi di nuovo l'invito."));
                }"""
content = content.replace(old_not_found, new_not_found)

# 3. Remove unlinkSync from authenticateDrive (API list failed catch)
old_api_failed = """      } catch (e: any) {
        console.warn("Token caricato ma API list fallita (Token forse scaduto o revocato).", e.message);
        const localPath = getLocalTokenPath();
        if (isLocalContext && localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
        const globalPath = getGlobalTokenPath();
        if (!isLocalContext && globalPath && fs.existsSync(globalPath)) fs.unlinkSync(globalPath);
      }"""
new_api_failed = """      } catch (e: any) {
        console.warn("Token caricato ma API list fallita (Token forse scaduto o revocato).", e.message);
        // NON eliminiamo il token, lasciamo che il nuovo login lo sovrascriva
      }"""
content = content.replace(old_api_failed, new_api_failed)

with open(sync_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Aggressive unlinks removed.")
