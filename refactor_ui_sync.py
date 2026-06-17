import os

# 1. Update preload.ts
preload_path = "src/main/preload.ts"
with open(preload_path, "r", encoding="utf-8") as f:
    preload_content = f.read()

preload_search = "checkAuth: () => ipcRenderer.invoke('drive-check-auth'),"
preload_replace = """checkAuth: () => ipcRenderer.invoke('drive-check-auth'),
    onStatusUpdated: (callback) => ipcRenderer.on('drive-status-updated', (event, data) => callback(data)),"""

if preload_search in preload_content and "onStatusUpdated:" not in preload_content:
    preload_content = preload_content.replace(preload_search, preload_replace)
    with open(preload_path, "w", encoding="utf-8") as f:
        f.write(preload_content)

# 2. Update driveLogic.ts
logic_path = "src/renderer/js/logic/driveLogic.ts"
with open(logic_path, "r", encoding="utf-8") as f:
    logic_content = f.read()

dom_search = """document.addEventListener('DOMContentLoaded', () => {
    // Inizializza lo stato all'avvio
    window.driveAuthPromise = aggiornaStatoDrive();"""

dom_replace = """document.addEventListener('DOMContentLoaded', () => {
    // Inizializza lo stato all'avvio
    window.driveAuthPromise = aggiornaStatoDrive();
    
    // Check rapido all'avvio senza attendere la rete
    if (window.apiDrive && window.apiDrive.checkAuth) {
        window.apiDrive.checkAuth().then(isAuth => {
            if (isAuth) {
                console.log("Frontend detected existing valid tokens for this workspace!");
                window.driveStatus.isAuthenticated = true;
                // Aggiorna visivamente i tasti bypassando il lungo check di rete
                const statusText = document.getElementById('settings-drive-status');
                const loginBtn = document.getElementById('btn-drive-login');
                const logoutBtn = document.getElementById('btn-drive-logout');
                const syncBtn = document.getElementById('btn-drive-sync');
                
                if (statusText) statusText.innerHTML = window.sanitizeHTML('<span class="text-green-600 font-semibold">Connesso al Cloud</span>');
                if (loginBtn) loginBtn.classList.add('hidden');
                if (logoutBtn) logoutBtn.classList.remove('hidden');
                if (syncBtn) syncBtn.classList.remove('hidden');
                
                if (typeof checkDriveStatusVisual === 'function') checkDriveStatusVisual();
            }
        });
    }

    // Ascolta notifiche IPC dal Main Process
    if (window.apiDrive && window.apiDrive.onStatusUpdated) {
        window.apiDrive.onStatusUpdated((data) => {
            if (data.authenticated) {
                console.log("Notifica IPC ricevuta: Autenticazione completata con successo!");
                window.driveStatus.isAuthenticated = true;
                aggiornaStatoDrive();
                if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_autenticazione_completata", "Autenticazione completata!"), "success");
            }
        });
    }"""

if dom_search in logic_content and "onStatusUpdated" not in logic_content:
    logic_content = logic_content.replace(dom_search, dom_replace)
    with open(logic_path, "w", encoding="utf-8") as f:
        f.write(logic_content)

print("UI sync implemented successfully.")
