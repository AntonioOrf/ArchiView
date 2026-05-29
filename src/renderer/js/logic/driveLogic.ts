// @ts-nocheck
window.driveStatus = { isAuthenticated: false, user: null };
window.autofetchIntervalId = null;

window.impostaModificheInEntrata = function(stato) {
    const ind = document.getElementById('incoming-updates-indicator');
    if (ind) {
        if (stato) ind.classList.remove('hidden');
        else ind.classList.add('hidden');
        ind.classList.add('flex');
        if (!stato) ind.classList.remove('flex');
    }
};

window.controllaModificheInEntrata = async function() {
    if (window.apiDrive && window.driveStatus && window.driveStatus.isAuthenticated) {
        try {
            const remoteModifiedTime = await window.apiDrive.checkUpdates();
            if (remoteModifiedTime && remoteModifiedTime > (window.ultimoCaricamento || 0)) {
                // Ci sono aggiornamenti sul server più recenti dell'ultimo nostro pull
                window.impostaModificheInEntrata(true);
            } else {
                window.impostaModificheInEntrata(false);
            }
        } catch (e) {
            console.error("Errore controllo aggiornamenti in entrata", e);
        }
    }
};

window.avviaAutofetchDrive = async function() {
    if (window.autofetchIntervalId) clearInterval(window.autofetchIntervalId);
    
    // Esegue il controllo (solo notifica) ogni 5 minuti (300000 ms)
    window.autofetchIntervalId = setInterval(() => {
        window.controllaModificheInEntrata();
    }, 300000);
    
    // Fai un controllo iniziale dopo 5 secondi
    setTimeout(() => window.controllaModificheInEntrata(), 5000);
};

window.checkDriveStatusVisual = async function() {
    if (window.apiDrive) {
        // Usa i nuovi ID del Cloud Modal
        const statusText = document.getElementById('cloud-drive-status');
        const btnLogin = document.getElementById('btn-cloud-drive-login');
        const btnLogout = document.getElementById('btn-cloud-drive-logout');
        const btnSync = document.getElementById('btn-cloud-drive-sync');

        if (!statusText) return;

        try {
            const statusResult = await window.apiDrive.status();
            const isAuth = statusResult?.isAuthenticated || false;
            if (isAuth) {
                statusText.innerHTML = '<span class="text-green-600 flex items-center gap-2"><i data-lucide="check-circle" class="w-4 h-4"></i> Connesso al Cloud</span>';
                if(btnLogin) btnLogin.classList.add('hidden');
                if(btnLogout) btnLogout.classList.remove('hidden');
                if(btnSync) btnSync.classList.remove('hidden');
            } else {
                statusText.innerHTML = '<span class="text-stone-500 flex items-center gap-2"><i data-lucide="cloud-off" class="w-4 h-4"></i> Non Connesso</span>';
                if(btnLogin) btnLogin.classList.remove('hidden');
                if(btnLogout) btnLogout.classList.add('hidden');
                if(btnSync) btnSync.classList.add('hidden');
            }
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            statusText.textContent = "Errore di controllo stato";
        }
    }
};

async function aggiornaStatoDrive() {
    if (window.apiDrive) {
        const statusResult = await window.apiDrive.status();
        window.driveStatus = {
            isAuthenticated: statusResult?.isAuthenticated || false,
            user: statusResult?.user || null
        };
        if (typeof checkDriveStatusVisual === 'function') {
            checkDriveStatusVisual();
        }
        
        if (window.driveStatus.isAuthenticated) {
            if (typeof window.avviaAutofetchDrive === 'function') window.avviaAutofetchDrive();
        }

        const section = document.getElementById('settings-drive-section');
        const statusText = document.getElementById('settings-drive-status');
        const loginBtn = document.getElementById('btn-drive-login');
        const logoutBtn = document.getElementById('btn-drive-logout');
        const syncBtn = document.getElementById('btn-drive-sync');

        if (section) {
            if (window.driveStatus.isAuthenticated) {
                statusText.innerHTML = `<span class="text-green-600 font-semibold">Connesso come: ${window.driveStatus.user}</span>`;
                loginBtn.classList.add('hidden');
                logoutBtn.classList.remove('hidden');
                syncBtn.classList.remove('hidden');
            } else {
                statusText.innerHTML = `<span class="text-stone-500">Non connesso</span>`;
                loginBtn.classList.remove('hidden');
                logoutBtn.classList.add('hidden');
                syncBtn.classList.add('hidden');
            }
        }
    }
}

window.loginGoogleDrive = async function() {
    if (window.apiDrive) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio("Apri il browser per completare l'accesso...", "info");
        try {
            await window.apiDrive.auth();
            await aggiornaStatoDrive();
            if (typeof mostraMessaggio === 'function') mostraMessaggio("Autenticazione a Google Drive completata!", "success");
        } catch (e) {
            console.error(e);
            if (typeof mostraMessaggio === 'function') mostraMessaggio("Errore durante l'autenticazione", "error");
        }
    }
};

window.logoutGoogleDrive = async function() {
    if (window.apiDrive) {
        try {
            await window.apiDrive.logout();
            await aggiornaStatoDrive();
            if (typeof mostraMessaggio === 'function') mostraMessaggio("Disconnesso da Google Drive.", "info");
        } catch (e) {
            console.error(e);
        }
    }
};

window.sincronizzaGoogleDrive = async function(silent = false) {
    if (window.apiDrive) {
        const btn = document.getElementById('btn-drive-sync');
        if (btn) btn.disabled = true;
        if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Sincronizzazione su Google Drive in corso...", "info");
        
        try {
            // 1. Scarica da Drive (se esiste)
            const driveData = await window.apiDrive.pull();
            if (driveData && driveData.database) {
                if (typeof window.sincronizzaEUnisciDati === 'function') {
                    await window.sincronizzaEUnisciDati(driveData.database);
                }
                window.ultimoCaricamento = Date.now();
                if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
            }

            // 2. Carica le modifiche locali unite (upload)
            await window.apiDrive.sync();
            
            if (typeof window.impostaModifichePendenti === 'function') window.impostaModifichePendenti(false);
            
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Sincronizzazione completata con successo!", "success");
            
            // Invia Ping Realtime a Pusher tramite Vercel Serverless
            inviaPingPusher();
        } catch (e) {
            console.error(e);
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Errore durante la sincronizzazione: " + e.message, "error");
        } finally {
            if (btn) btn.disabled = false;
        }
    }
};

window.scaricaDalCloud = async function(silent = false) {
    if (window.apiDrive) {
        if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Scaricamento dal Cloud in corso...", "info");
        try {
            const driveData = await window.apiDrive.pull();
            if (driveData && driveData.database) {
                if (typeof window.sincronizzaEUnisciDati === 'function') {
                    await window.sincronizzaEUnisciDati(driveData.database);
                }
                window.ultimoCaricamento = Date.now();
                if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
            }
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Scaricamento completato!", "success");
        } catch (e) {
            console.error(e);
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Errore durante lo scaricamento: " + e.message, "error");
        }
    }
};

window.caricaSulCloud = async function(silent = false) {
    if (window.apiDrive) {
        if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Caricamento sul Cloud in corso...", "info");
        try {
            // Per evitare sovrascritture cieche, prima scarichiamo e uniamo eventuali modifiche remote!
            const driveData = await window.apiDrive.pull();
            if (driveData && driveData.database) {
                if (typeof window.sincronizzaEUnisciDati === 'function') {
                    await window.sincronizzaEUnisciDati(driveData.database);
                }
                window.ultimoCaricamento = Date.now();
                if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
            }

            // Ora carichiamo il risultato del merge
            await window.apiDrive.sync();
            
            if (typeof window.impostaModifichePendenti === 'function') window.impostaModifichePendenti(false);
            
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Caricamento completato in sicurezza!", "success");
            inviaPingPusher();
        } catch (e) {
            console.error(e);
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Errore durante il caricamento: " + e.message, "error");
        }
    }
};

window.sincronizzaGoogleDriveBackground = async function() {
    console.log("Sincronizzazione in background avviata da Pusher...");
    await window.sincronizzaGoogleDrive(true);
    // Dopo aver sincronizzato (scaricato le modifiche), forza il ricaricamento dell'interfaccia
    if (typeof apriDatabase === 'function') {
        const workspacePath = await window.apiBrowser.getWorkspacePath();
        if (workspacePath) {
            window.apriDatabase(workspacePath, true);
        }
    }
};

async function inviaPingPusher() {
    if (!window.apiSettings) return;
    const settings = await window.apiSettings.get();
    
    if (settings.pusherWebhook && window.currentPusherChannelName) {
        try {
            await fetch(settings.pusherWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: window.currentPusherChannelName,
                    event: 'drive-updated',
                    data: { senderId: window.myAppInstanceId }
                })
            });
            console.log("Ping Pusher inviato con successo.");
        } catch (err) {
            console.warn("Impossibile inviare ping Pusher:", err);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza lo stato all'avvio
    aggiornaStatoDrive();
});
