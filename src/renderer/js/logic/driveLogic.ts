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

window.toggleSyncProgress = function(show, titleKey = 'sync_in_progress') {
    const barContainer = document.getElementById('sync-progress-container');
    const textContainer = document.getElementById('sync-progress-text');
    const bar = document.getElementById('sync-progress-bar');
    const title = document.getElementById('sync-progress-title');
    
    if (barContainer) {
        if (show) {
            barContainer.classList.remove('hidden');
            barContainer.classList.add('flex');
            if(textContainer) textContainer.classList.remove('hidden');
            if (bar) bar.style.width = '0%';
            if (textContainer) textContainer.textContent = '...';
            if (title) title.textContent = window.t(titleKey);
        } else {
            barContainer.classList.add('hidden');
            barContainer.classList.remove('flex');
            if(textContainer) textContainer.classList.add('hidden');
            if (bar) bar.style.width = '0%';
        }
    }
};

window.updateSyncProgress = function(percent, text) {
    const bar = document.getElementById('sync-progress-bar');
    const textContainer = document.getElementById('sync-progress-text');
    if (bar) {
        bar.style.width = Math.min(100, Math.max(0, percent)) + '%';
    }
    if (textContainer && text) {
        textContainer.textContent = text;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza lo stato all'avvio
    aggiornaStatoDrive();
    
    // Ascolta eventi di progresso sincrono (se l'IPC lo espone)
    if (window.apiDrive && window.apiDrive.onSyncProgress) {
        window.apiDrive.onSyncProgress((data) => {
            if (data.percent !== undefined) {
                window.updateSyncProgress(data.percent, data.message);
            }
        });
    }
});

window.getApiCloud = async function() {
    if (!window.apiSettings) return window.apiDrive;
    const settings = await window.apiSettings.get();
    if (settings.cloudProvider === 'microsoft' && window.apiMicrosoft) {
        return window.apiMicrosoft;
    }
    return window.apiDrive;
};

window.controllaModificheInEntrata = async function(manual = false) {
    const apiCloud = await window.getApiCloud();
    if (apiCloud && window.driveStatus && window.driveStatus.isAuthenticated) {
        if (manual && typeof mostraMessaggio === 'function') {
            mostraMessaggio("Controllo aggiornamenti dal Cloud...", "info");
            window.toggleSyncProgress(true);
        }
        try {
            const remoteModifiedTime = await apiCloud.checkUpdates();
            if (remoteModifiedTime && remoteModifiedTime > (window.ultimoCaricamento || 0)) {
                // Ci sono aggiornamenti sul server più recenti dell'ultimo nostro pull
                window.impostaModificheInEntrata(true);
                if (manual && typeof mostraMessaggio === 'function') mostraMessaggio("Ci sono nuovi aggiornamenti da scaricare!", "success");
                
                try {
                    const peekData = await apiCloud.peekDb();
                    if (peekData && peekData.database && peekData.database.manoscritti) {
                        const loadedAt = window.ultimoCaricamento || 0;
                        window.incomingChanges = peekData.database.manoscritti.filter(m => (m.lastModified || 0) > loadedAt);
                        if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
                    }
                } catch(e) { console.error("Errore peek", e); }
                
            } else {
                window.impostaModificheInEntrata(false);
                window.incomingChanges = [];
                if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
                if (manual && typeof mostraMessaggio === 'function') mostraMessaggio("Nessun nuovo aggiornamento trovato.", "info");
            }
        } catch (e) {
            console.error("Errore controllo aggiornamenti in entrata", e);
            if (manual && typeof mostraMessaggio === 'function') mostraMessaggio("Errore durante il fetch: " + e.message, "error");
        } finally {
            if (manual) window.toggleSyncProgress(false);
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
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        // Usa i nuovi ID del Cloud Modal
        const statusText = document.getElementById('cloud-drive-status');
        const btnLogin = document.getElementById('btn-cloud-drive-login');
        const btnLogout = document.getElementById('btn-cloud-drive-logout');
        const btnSync = document.getElementById('btn-cloud-drive-sync');

        if (!statusText) return;

        try {
            const statusResult = await apiCloud.status();
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
    window.aggiornaStatoDrive = aggiornaStatoDrive;
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        const statusResult = await apiCloud.status();
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

window.loginCloud = async function(provider, forceLocal = false) {
    const api = provider === 'microsoft' ? window.apiMicrosoft : window.apiDrive;
    if (api) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio("Apri il browser per completare l'accesso...", "info");
        try {
            await api.auth(forceLocal);
            await aggiornaStatoDrive();
            if (typeof mostraMessaggio === 'function') mostraMessaggio("Autenticazione completata!", "success");
        } catch (e) {
            console.error(e);
            if (typeof mostraMessaggio === 'function') mostraMessaggio("Errore durante l'autenticazione", "error");
        }
    }
};

window.loginGoogleDrive = async function(forceLocal = false) {
    await window.loginCloud('google', forceLocal);
};

window.logoutGoogleDrive = async function() {
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        try {
            await apiCloud.logout();
            await aggiornaStatoDrive();
            if (typeof mostraMessaggio === 'function') mostraMessaggio("Disconnesso da Google Drive.", "info");
        } catch (e) {
            console.error(e);
        }
    }
};

window.sincronizzaGoogleDrive = async function(silent = false) {
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        const btn = document.getElementById('btn-drive-sync');
        if (btn) btn.disabled = true;
        window.toggleSyncProgress(true, 'sync_in_progress');
        
        try {
            // 1. Scarica da Drive (se esiste)
            const driveData = await apiCloud.pull();
            if (driveData && driveData.database) {
                if (typeof window.sincronizzaEUnisciDati === 'function') {
                    await window.sincronizzaEUnisciDati(driveData.database);
                }
            }

            // 2. Carica le modifiche locali unite (upload)
            await apiCloud.sync();
            
            window.ultimoCaricamento = Date.now();
            if (window.apiSettings) {
                const settings = await window.apiSettings.get();
                settings.lastSyncTime = window.ultimoCaricamento;
                await window.apiSettings.save(settings);
            }
            if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
            window.incomingChanges = [];
            if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
            
            if (typeof window.impostaModifichePendenti === 'function') window.impostaModifichePendenti(false);
            
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Sincronizzazione completata con successo!", "success");
            
            // Invia Ping Realtime a Pusher tramite Vercel Serverless
            inviaPingPusher();
        } catch (e) {
            console.error(e);
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Errore durante la sincronizzazione: " + e.message, "error");
        } finally {
            if (btn) btn.disabled = false;
            window.toggleSyncProgress(false);
        }
    }
};

window.scaricaDalCloud = async function(silent = false) {
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        window.toggleSyncProgress(true, 'download_in_progress');
        try {
            const driveData = await apiCloud.pull();
            if (driveData && driveData.database) {
                if (typeof window.sincronizzaEUnisciDati === 'function') {
                    await window.sincronizzaEUnisciDati(driveData.database);
                }
                window.ultimoCaricamento = Date.now();
                if (window.apiSettings) {
                    const settings = await window.apiSettings.get();
                    settings.lastSyncTime = window.ultimoCaricamento;
                    await window.apiSettings.save(settings);
                }
                if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
                window.incomingChanges = [];
                if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
            }
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Scaricamento completato!", "success");
        } catch (e) {
            console.error(e);
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Errore durante lo scaricamento: " + e.message, "error");
        } finally {
            window.toggleSyncProgress(false);
        }
    }
};

window.caricaSulCloud = async function(silent = false) {
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        window.toggleSyncProgress(true, 'upload_in_progress');
        try {
            // Per evitare sovrascritture cieche, prima scarichiamo e uniamo eventuali modifiche remote!
            const driveData = await apiCloud.pull();
            if (driveData && driveData.database) {
                if (typeof window.sincronizzaEUnisciDati === 'function') {
                    await window.sincronizzaEUnisciDati(driveData.database);
                }
            }

            // Ora carichiamo il risultato del merge
            await apiCloud.sync();
            
            window.ultimoCaricamento = Date.now();
            if (window.apiSettings) {
                const settings = await window.apiSettings.get();
                settings.lastSyncTime = window.ultimoCaricamento;
                await window.apiSettings.save(settings);
            }
            if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
            window.incomingChanges = [];
            if (typeof window.renderSourceControl === 'function') window.renderSourceControl();

            if (typeof window.impostaModifichePendenti === 'function') window.impostaModifichePendenti(false);
            
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Caricamento completato in sicurezza!", "success");
            inviaPingPusher();
        } catch (e) {
            console.error(e);
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Errore durante il caricamento: " + e.message, "error");
        } finally {
            window.toggleSyncProgress(false);
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

window.trasformaInCondiviso = async function() {
    const btn = document.getElementById('btn-trasforma-condiviso');
    if(btn) btn.disabled = true;
    
    if (typeof mostraProgressoCloud === 'function') {
        mostraProgressoCloud("Preparazione in corso", "Autenticazione con Google Drive in corso...");
    }

    try {
        const apiCloud = await window.getApiCloud();
        if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
            await apiCloud.auth();
            await aggiornaStatoDrive();
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud("Configurazione in corso", "Impostazione Vault come condiviso...");
        }
        
        if (window.apiSettings) {
            const settings = await window.apiSettings.get();
            if (!settings.isSharedVault && !settings.isPersonalCloud) {
                settings.sharedVaultId = null;
            }
            settings.isSharedVault = true;
            settings.isPersonalCloud = false;
            settings.driveAutofetch = true;
            await window.apiSettings.save(settings);
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud("Sincronizzazione in corso", "Caricamento e unione dei dati sul Cloud (potrebbe volerci un po')...");
        }
        await window.sincronizzaGoogleDrive(true);
        
        if (typeof apriCloudModal === 'function') {
            apriCloudModal();
        }
    } catch(e) {
        mostraMessaggio("Errore: " + e.message, "error");
        if(btn) btn.disabled = false;
    } finally {
        if (typeof nascondiProgressoCloud === 'function') {
            nascondiProgressoCloud();
        }
    }
}
window.trasformaInPersonale = async function() {
    const btn = document.getElementById('btn-trasforma-personale');
    if(btn) btn.disabled = true;
    
    if (typeof mostraProgressoCloud === 'function') {
        mostraProgressoCloud("Preparazione in corso", "Autenticazione con Google Drive in corso...");
    }

    try {
        const apiCloud = await window.getApiCloud();
        if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
            await apiCloud.auth();
            await aggiornaStatoDrive();
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud("Configurazione in corso", "Impostazione Backup Personale...");
        }
        
        if (window.apiSettings) {
            const settings = await window.apiSettings.get();
            if (!settings.isSharedVault && !settings.isPersonalCloud) {
                settings.sharedVaultId = null;
            }
            settings.isPersonalCloud = true;
            settings.isSharedVault = false; // Ensures it's not both
            settings.driveAutofetch = true;
            await window.apiSettings.save(settings);
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud("Sincronizzazione in corso", "Caricamento e unione dei dati sul Cloud (potrebbe volerci un po')...");
        }
        await window.sincronizzaGoogleDrive(true);
        
        if (typeof apriCloudModal === 'function') {
            apriCloudModal();
        }
    } catch(e) {
        mostraMessaggio("Errore: " + e.message, "error");
        if(btn) btn.disabled = false;
    } finally {
        if (typeof nascondiProgressoCloud === 'function') {
            nascondiProgressoCloud();
        }
    }
}

window.scollegaCloud = async function() {
    if (typeof mostraBottomConfirm === 'function') {
        mostraBottomConfirm(
            "Vuoi davvero scollegare questo Vault dal Cloud? I dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l'app tornerà in modalità solo locale per questo progetto.",
            async () => {
                if (typeof mostraProgressoCloud === 'function') {
                    mostraProgressoCloud("Scollegamento", "Disattivazione della sincronizzazione Cloud...");
                }
                try {
                    if (window.apiSettings) {
                        const settings = await window.apiSettings.get();
                        settings.isSharedVault = false;
                        settings.isPersonalCloud = false;
                        settings.driveAutofetch = false;
                        settings.sharedVaultId = null;
                        await window.apiSettings.save(settings);
                        
                        mostraMessaggio("Il Vault è ora scollegato ed è solo locale.", "success");
                        
                        if (typeof apriCloudModal === 'function') {
                            apriCloudModal();
                        }
                    }
                } catch(e) {
                    mostraMessaggio("Errore: " + e.message, "error");
                } finally {
                    if (typeof nascondiProgressoCloud === 'function') {
                        nascondiProgressoCloud();
                    }
                }
            }
        );
    } else if (confirm("Vuoi davvero scollegare questo Vault dal Cloud?\nI dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l'app tornerà in modalità solo locale per questo progetto.")) {
        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud("Scollegamento", "Disattivazione della sincronizzazione Cloud...");
        }
        try {
            if (window.apiSettings) {
                const settings = await window.apiSettings.get();
                settings.isSharedVault = false;
                settings.isPersonalCloud = false;
                settings.driveAutofetch = false;
                await window.apiSettings.save(settings);
                
                mostraMessaggio("Il Vault è ora scollegato ed è solo locale.", "success");
                
                if (typeof apriCloudModal === 'function') {
                    apriCloudModal();
                }
            }
        } catch(e) {
            mostraMessaggio("Errore durante la disconnessione dal cloud: " + e.message, "error");
        } finally {
            if (typeof nascondiProgressoCloud === 'function') {
                nascondiProgressoCloud();
            }
        }
    }
}



