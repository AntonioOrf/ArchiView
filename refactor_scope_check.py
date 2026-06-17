import os

sync_path = "src/main/ipc/driveSync.ts"
with open(sync_path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = """        // Verifica che lo scope sia aggiornato a 'drive' completo
        if (tokens.scope && typeof tokens.scope === 'string') {
            const scopesArray = tokens.scope.split(' ');
            if (!scopesArray.includes('https://www.googleapis.com/auth/drive')) {
                fs.unlinkSync(tokenPath);
                return false;
            }
        }"""

new_block = """        // Verifica che lo scope sia supportato
        if (tokens.scope && typeof tokens.scope === 'string') {
            const scopesArray = tokens.scope.split(' ');
            const hasValidScope = scopesArray.includes('https://www.googleapis.com/auth/drive') || 
                                  scopesArray.includes('https://www.googleapis.com/auth/drive.file') ||
                                  scopesArray.includes('https://www.googleapis.com/auth/drive.appdata');
            if (!hasValidScope) {
                fs.unlinkSync(tokenPath);
                return false;
            }
        }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(sync_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Scope check patched successfully.")
else:
    print("Could not find the scope check block.")
