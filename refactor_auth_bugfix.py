import os

file_path = "src/main/ipc/driveSync.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_server_block = """    localServer = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url, `http://localhost:3456`);
        const code = urlObj.searchParams.get('code');
        
        if (code) {
          const successHtml = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autenticazione Completata - ArchiView</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafaf9; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #1c1917; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); padding: 40px; max-width: 400px; text-align: center; border: 1px solid #e7e5e4; }
    .icon { width: 64px; height: 64px; background-color: #dcfce7; color: #166534; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 24px; }
    .icon svg { width: 32px; height: 32px; }
    h1 { font-size: 1.5rem; margin: 0 0 12px; font-weight: 600; }
    p { color: #57534e; margin: 0 0 24px; line-height: 1.5; }
    .btn { display: inline-block; background-color: #1c1917; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; transition: background-color 0.2s; cursor: pointer; border: none; font-size: 1rem; }
    .btn:hover { background-color: #44403c; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1>Autenticazione Completata</h1>
    <p>Ti sei autenticato correttamente con Google Drive. Puoi chiudere questa scheda e tornare ad ArchiView.</p>
    <button class="btn" id="closeBtn" onclick="tryClose()">Chiudi Scheda</button>
    <p id="closeMsg" style="display:none; color: #dc2626; font-size: 0.9rem; margin-top: 16px;">Il tuo browser blocca la chiusura automatica. Puoi chiudere liberamente questa scheda dalla "X" in alto.</p>
  </div>
  <script>
    function tryClose() {
      window.close();
      setTimeout(() => {
        document.getElementById('closeMsg').style.display = 'block';
        document.getElementById('closeBtn').style.display = 'none';
      }, 300);
    }
    setTimeout(tryClose, 3000);
  </script>
</body>
</html>`;
          res.end(successHtml);
          localServer.close();
          localServer = null;
          
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          
          if (shouldForceLocal && getLocalTokenPath()) {
              const targetPath = getLocalTokenPath();
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(targetPath, JSON.stringify(tokens));
          } else {
              fs.writeFileSync(getGlobalTokenPath(), JSON.stringify(tokens));
          }
          
          // Verifica account rimossa: con il Google Picker l'autorizzazione al singolo file
          // avviene contestualmente alla selezione, quindi controllare il fileId al login
          // usando drive.files.get con scope drive.file fallirebbe sempre a priori.
          
          resolve(true);
        } else {
          const waitHtml = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>In Attesa - ArchiView</title><style>body { margin: 0; font-family: sans-serif; background-color: #fafaf9; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #1c1917; } .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; border: 1px solid #e7e5e4; }</style></head><body><div class="card"><h2>In attesa di autenticazione...</h2><p>Completa il login su Google per continuare.</p></div></body></html>`;
          res.end(waitHtml);
        }
      } catch (e) {
        const errHtml = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Errore - ArchiView</title><style>body { margin: 0; font-family: sans-serif; background-color: #fafaf9; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #1c1917; } .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; border: 1px solid #e7e5e4; } h2 { color: #dc2626; margin-top:0; }</style></head><body><div class="card"><h2>Errore di Autenticazione</h2><p>Si è verificato un errore durante il login. Chiudi la scheda e riprova da ArchiView.</p></div></body></html>`;
        res.end(errHtml);
        reject(e);
      }
    }).on('error', (err) => {"""

new_server_block = """    localServer = http.createServer(async (req, res) => {
      let codeExtracted = false;
      try {
        const urlObj = new URL(req.url, `http://localhost:3456`);
        const code = urlObj.searchParams.get('code');
        
        if (code) {
          codeExtracted = true;
          // Eseguiamo il fetch del token PRIMA di inviare l'HTML
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          
          if (shouldForceLocal && getLocalTokenPath()) {
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
          }
          
          const successHtml = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autenticazione Completata - ArchiView</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafaf9; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #1c1917; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); padding: 40px; max-width: 400px; text-align: center; border: 1px solid #e7e5e4; }
    .icon { width: 64px; height: 64px; background-color: #dcfce7; color: #166534; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 24px; }
    .icon svg { width: 32px; height: 32px; }
    h1 { font-size: 1.5rem; margin: 0 0 12px; font-weight: 600; }
    p { color: #57534e; margin: 0 0 24px; line-height: 1.5; }
    .btn { display: inline-block; background-color: #1c1917; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; transition: background-color 0.2s; cursor: pointer; border: none; font-size: 1rem; }
    .btn:hover { background-color: #44403c; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1>Autenticazione Completata</h1>
    <p>Ti sei autenticato correttamente con Google Drive. Puoi chiudere questa scheda e tornare ad ArchiView.</p>
    <button class="btn" id="closeBtn" onclick="tryClose()">Chiudi Scheda</button>
    <p id="closeMsg" style="display:none; color: #dc2626; font-size: 0.9rem; margin-top: 16px;">Il tuo browser blocca la chiusura automatica. Puoi chiudere liberamente questa scheda dalla "X" in alto.</p>
  </div>
  <script>
    function tryClose() {
      window.close();
      setTimeout(() => {
        document.getElementById('closeMsg').style.display = 'block';
        document.getElementById('closeBtn').style.display = 'none';
      }, 300);
    }
    setTimeout(tryClose, 3000);
  </script>
</body>
</html>`;
          
          if (!res.headersSent) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(successHtml);
          }
          
          resolve(true);
        } else {
          const waitHtml = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>In Attesa - ArchiView</title><style>body { margin: 0; font-family: sans-serif; background-color: #fafaf9; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #1c1917; } .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; border: 1px solid #e7e5e4; }</style></head><body><div class="card"><h2>In attesa di autenticazione...</h2><p>Completa il login su Google per continuare.</p></div></body></html>`;
          if (!res.headersSent) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(waitHtml);
          }
        }
      } catch (e) {
        console.error("Errore OAuth Server Locale:", e);
        const errHtml = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Errore - ArchiView</title><style>body { margin: 0; font-family: sans-serif; background-color: #fafaf9; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #1c1917; } .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; border: 1px solid #e7e5e4; } h2 { color: #dc2626; margin-top:0; }</style></head><body><div class="card"><h2>Errore di Autenticazione</h2><p>Si è verificato un errore durante il login. Chiudi la scheda e riprova da ArchiView.</p></div></body></html>`;
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(errHtml);
        }
        reject(e);
      } finally {
        if (codeExtracted) {
            if (localServer) {
                localServer.close();
                localServer = null;
            }
        }
      }
    }).on('error', (err) => {"""

if old_server_block in content:
    content = content.replace(old_server_block, new_server_block)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fix auth loop applied successfully.")
else:
    print("Could not find the target block.")

