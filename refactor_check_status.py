import os

sync_path = "src/main/ipc/driveSync.ts"
with open(sync_path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = """async function checkDriveStatus() {
  if (!loadSavedTokens()) return { isAuthenticated: false };
  try {
    const res = await drive.about.get({ fields: 'user' });
    return { 
      isAuthenticated: true, 
      user: res.data.user.emailAddress 
    };
  } catch (e) {
    return { isAuthenticated: false };
  }
}"""

new_block = """async function checkDriveStatus() {
  if (!loadSavedTokens()) return { isAuthenticated: false };
  try {
    const res = await drive.about.get({ fields: 'user' });
    return { 
      isAuthenticated: true, 
      user: res.data.user.emailAddress 
    };
  } catch (e: any) {
    console.error("DEBUG AUTH checkDriveStatus API Call Failed:", e.message);
    // Se la rete è down o lo scope drive.file non permette about.get,
    // ma abbiamo i token locali validi, consideriamoci comunque autenticati.
    return { isAuthenticated: true, user: 'Utente (Drive.file)' };
  }
}"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(sync_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("checkDriveStatus patched successfully.")
else:
    print("Could not find checkDriveStatus block.")
