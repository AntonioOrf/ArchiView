import os

file_path = "src/main/ipc/driveSync.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = """        if (code) {
          codeExtracted = true;
          // Eseguiamo il fetch del token PRIMA di inviare l'HTML
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);"""

new_block = """        if (code) {
          codeExtracted = true;
          console.log("DEBUG AUTH: Workspace Path is currently:", state.workspacePath);
          
          let tokens;
          try {
              console.log("DEBUG AUTH: Attempting token exchange with code:", code.substring(0, 10) + "...");
              const response = await oauth2Client.getToken(code);
              tokens = response.tokens;
              console.log("DEBUG AUTH: Tokens received successfully! Scopes:", tokens.scope);
          } catch (tokenErr) {
              console.error("DEBUG AUTH ERROR - TOKEN EXCHANGE FAILED:", tokenErr);
              throw tokenErr; // Propaghiamo l'errore al blocco catch principale
          }
          
          oauth2Client.setCredentials(tokens);"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Debug logs injected successfully.")
else:
    print("Could not find the target block.")
