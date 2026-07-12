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

    // P3.6 — durante un'operazione cloud disabilita i bottoni Fetch/Pull/Push per evitare doppi-click
    document.querySelectorAll('#cloud-buttons-container button').forEach(b => {
        b.disabled = show;
        b.classList.toggle('opacity-50', show);
        b.classList.toggle('cursor-not-allowed', show);
    });
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
    }
    
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
    // Coesistenza: su un vault Hub i pulsanti header instradano alle funzioni Hub (percorso Drive intatto).
    if (window.hubConfig) { if (window.controllaModificheHub) await window.controllaModificheHub(manual); return; }
    const apiCloud = await window.getApiCloud();
    if (apiCloud && window.driveStatus && window.driveStatus.isAuthenticated) {
        if (manual) {
            window.toggleSyncProgress(true, 'Controllo Modifiche');
            window.updateSyncProgress(100, "Ricerca in corso...");
        }
        try {
            const remoteModifiedTime = await apiCloud.checkUpdates();
            if (remoteModifiedTime && remoteModifiedTime > (window.ultimoCaricamento || 0)) {
                // Ci sono aggiornamenti sul server più recenti dell'ultimo nostro pull
                window.impostaModificheInEntrata(true);
                if (manual && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_ci_sono_nuovi_aggiornamen", "Ci sono nuovi aggiornamenti da scaricare!"), "success");
                
                try {
                    const peekData = await apiCloud.peekDb();
                    if (peekData && peekData.database && peekData.database.manoscritti) {
                        const loadedAt = window.ultimoCaricamento || 0;
                        window.incomingChanges = peekData.database.manoscritti.filter(m => (m.lastModified || 0) > loadedAt);
                        
                        const structural = [];
                        
                        // Cartelle nuove o modificate
                        const remoteCartelle = peekData.database.cartelle || [];
                        const localCartelle = appData.cartelle || [];
                        const newFolders = remoteCartelle.filter(c => !localCartelle.includes(c));
                        if (newFolders.length > 0) {
                            structural.push({ icon: 'folder-plus', label: `+ ${newFolders.length} Cartell${newFolders.length > 1 ? 'e' : 'a'}` });
                        }
                        
                        const author = peekData.lastModifyingUser ? (peekData.lastModifyingUser.displayName || peekData.lastModifyingUser.emailAddress || 'Sconosciuto') : 'Collaboratore';
                        window.incomingAuthor = author;


                        
                        // Tipi Documento nuovi o modificati
                        const remoteTipi = peekData.database.tipiDocumento || [];
                        const localTipi = appData.tipiDocumento || [];
                        const localTipiMap = new Map(localTipi.map(t => [t.id, JSON.stringify(t)]));
                        const newTipi = remoteTipi.filter(rt => !localTipiMap.has(rt.id));
                        const modTipi = remoteTipi.filter(rt => localTipiMap.has(rt.id) && localTipiMap.get(rt.id) !== JSON.stringify(rt));
                        const totTipi = newTipi.length + modTipi.length;
                        if (totTipi > 0) {
                            structural.push({ icon: 'file-type-2', label: `${totTipi} Modell${totTipi > 1 ? 'i' : 'o'}` });
                        }
                        
                        // Cartelle Eliminate
                        const remoteDeletedFolders = peekData.database.deletedCartelle || [];
                        const localDeletedFolders = appData.deletedCartelle || [];
                        const newDeletedFolders = remoteDeletedFolders.filter(c => !localDeletedFolders.includes(c));
                        if (newDeletedFolders.length > 0) {
                            const MAX_DEL_FOLDERS = 10;
                            newDeletedFolders.slice(0, MAX_DEL_FOLDERS).forEach(f => {
                                const nomeFolder = f.split('/').pop() || f;
                                structural.push({ icon: 'folder-minus', label: `Cartella eliminata: ${nomeFolder} (da ${author})` });
                            });
                            if (newDeletedFolders.length > MAX_DEL_FOLDERS) {
                                structural.push({ icon: 'more-horizontal', label: `... e altre ${newDeletedFolders.length - MAX_DEL_FOLDERS} cartelle eliminate` });
                            }
                        }
                        
                        // Cancellazioni Remote
                        const remoteDeleted = peekData.database.deletedIds || [];
                        const localDeleted = appData.deletedIds || [];
                        const newDeleted = remoteDeleted.filter(id => !localDeleted.includes(id));
                        
                        if (newDeleted.length > 0) {
                            const MAX_DEL = 10;
                            newDeleted.slice(0, MAX_DEL).forEach(id => {
                                const m = (appData.manoscritti || []).find(x => x.id === id);
                                const nome = m ? (m.titolo || m.segnatura || 'Senza Titolo') : 'File eliminato';
                                const itemAuthor = (m && (m.modificatoDa || m.creatoDa)) ? (m.modificatoDa || m.creatoDa) : author;
                                structural.push({ icon: 'trash-2', label: `Eliminato: ${nome} (da ${itemAuthor})` });
                            });
                            if (newDeleted.length > MAX_DEL) {
                                structural.push({ icon: 'more-horizontal', label: `... e altre ${newDeleted.length - MAX_DEL} eliminazioni` });
                            }
                        }
                        
                        window.incomingStructuralChanges = structural;
                        if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
                    }
                } catch(e) { console.error("Errore peek", e); }
                
            } else {
                window.impostaModificheInEntrata(false);
                window.incomingChanges = [];
                window.incomingStructuralChanges = [];
                window.incomingAuthor = null;
                if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
                if (manual && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_nessun_nuovo_aggiornament", "Nessun nuovo aggiornamento trovato."), "success");
            }
            if (manual) window.hasFetchedBeforeDownload = true;
        } catch (e) {
            console.error("Errore controllo aggiornamenti in entrata", e);
            if (manual && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_il_fetch", "Errore durante il fetch: ") + e.message, "error");
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
                statusText.innerHTML = window.sanitizeHTML('<span class="text-green-600 flex items-center gap-2"><i data-lucide="check-circle" class="w-4 h-4"></i> Connesso al Cloud</span>');
                if(btnLogin) btnLogin.classList.add('hidden');
                if(btnLogout) btnLogout.classList.remove('hidden');
                if(btnSync) btnSync.classList.remove('hidden');
            } else {
                statusText.innerHTML = window.sanitizeHTML(`<span class="text-stone-500 flex items-center gap-2"><i data-lucide="cloud-off" class="w-4 h-4"></i> ${escapeHTML(window.t('settings_drive_not_connected', 'Non Connesso'))}</span>`);
                if(btnLogin) btnLogin.classList.remove('hidden');
                if(btnLogout) btnLogout.classList.add('hidden');
                if(btnSync) btnSync.classList.add('hidden');
            }
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            statusText.textContent = window.t('settings_drive_status_error', 'Errore di controllo stato');
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
            user: statusResult?.user || null,
            unauthorizedVault: statusResult?.unauthorizedVault || false
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
                statusText.innerHTML = window.sanitizeHTML(`<span class="text-green-600 font-semibold">Connesso come: ${window.driveStatus.user}</span>`);
                loginBtn.classList.add('hidden');
                logoutBtn.classList.remove('hidden');
                syncBtn.classList.remove('hidden');
            } else {
                statusText.innerHTML = window.sanitizeHTML(`<span class="text-stone-500">Non connesso</span>`);
                loginBtn.classList.remove('hidden');
                logoutBtn.classList.add('hidden');
                syncBtn.classList.add('hidden');
            }
        }
        window.aggiornaStatoDriveHub();
    }
}

// Aggiorna il blocco "Google Drive personale (per gli allegati)" nella sezione Hub delle
// Impostazioni. Indipendente dal Drive del vault condiviso: serve solo per gli allegati.
window.aggiornaStatoDriveHub = function() {
    const statusText = document.getElementById('settings-hub-drive-status');
    const loginBtn = document.getElementById('btn-hub-drive-login');
    const logoutBtn = document.getElementById('btn-hub-drive-logout');
    if (!statusText) return;

    if (window.driveStatus && window.driveStatus.isAuthenticated) {
        statusText.innerHTML = window.sanitizeHTML(`<span class="text-green-600 font-semibold">Connesso come: ${escapeHTML(window.driveStatus.user || '')}</span>`);
        if (loginBtn) loginBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
    } else {
        statusText.innerHTML = window.sanitizeHTML(`<span class="text-stone-500">${escapeHTML(window.t('settings_drive_not_connected', 'Non Connesso'))}</span>`);
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }
};

window.loginCloud = async function(provider, forceLocal = false) {
    const api = provider === 'microsoft' ? window.apiMicrosoft : window.apiDrive;
    if (api) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_apri_il_browser_per_compl", "Apri il browser per completare l'accesso..."), "info");
        try {
            await api.auth(forceLocal);
            await aggiornaStatoDrive();
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_autenticazione_completata", "Autenticazione completata!"), "success");
        } catch (e) {
            console.error(e);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_l_autentic", "Errore durante l'autenticazione"), "error");
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
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_disconnesso_da_google_dri", "Disconnesso da Google Drive."), "info");
        } catch (e) {
            console.error(e);
        }
    }
};

window.sincronizzaGoogleDrive = async function(silent = false) {
    if (window.hubConfig) { if (window.sincronizzaConHub) await window.sincronizzaConHub(); return; }
    if (window.driveStatus?.unauthorizedVault) {
        if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio('Accesso negato: questo account non è autorizzato per l\'Archivio Condiviso.', 'error');
        return;
    }
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
                window.lastDriveModifiedTime = driveData.driveModifiedTime;
            }

            // 2. Carica le modifiche locali unite (upload)
            const newSyncTime = await apiCloud.sync(window.lastDriveModifiedTime);
            
            try {
                if (apiCloud.syncAttachments) {
                    await apiCloud.syncAttachments();
                }
            } catch (attErr) {
                console.error("Errore sync allegati:", attErr);
                if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Sincronizzazione DB completata, ma errore negli allegati: " + attErr.message, "warning");
            }
            
            if (typeof newSyncTime === 'number') {
                window.ultimoCaricamento = newSyncTime;
            } else if (driveData && driveData.driveModifiedTime) {
                window.ultimoCaricamento = driveData.driveModifiedTime;
            } else {
                window.ultimoCaricamento = Date.now();
            }

            if (window.apiSettings) {
                const settings = await window.apiSettings.get();
                settings.lastSyncTime = window.ultimoCaricamento;
                await window.apiSettings.save(settings);
            }
            if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
            window.incomingChanges = [];
            window.incomingStructuralChanges = [];
            if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
            
            if (typeof window.impostaModifichePendenti === 'function') window.impostaModifichePendenti(false);
            
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_sincronizzazione_completa", "Sincronizzazione completata con successo!"), "success");

            // Dopo una sync riuscita, aggiorna lo stato auth (potrebbe essere rimasto false
            // se all'avvio il token era drive.file e il check scope l'aveva marcato non auth)
            if (window.driveStatus) window.driveStatus.isAuthenticated = true;

            // Invia Ping Realtime a Pusher tramite Vercel Serverless
            inviaPingPusher();
        } catch (e) {
            console.error(e);
            if (e.message && e.message.includes("409_CONFLICT")) {
                if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_conflitto_sul_cloud_un_al", "Conflitto sul Cloud: un altro utente ha salvato. Unione automatica in corso..."), "warning");
                console.warn("409_CONFLICT: auto-healing in progress...");
                try {
                    const retryData = await apiCloud.pull();
                    if (retryData && retryData.database) {
                        if (typeof window.sincronizzaEUnisciDati === 'function') {
                            await window.sincronizzaEUnisciDati(retryData.database);
                        }
                        window.lastDriveModifiedTime = retryData.driveModifiedTime;
                    }
                    const newRetryTime = await apiCloud.sync(window.lastDriveModifiedTime);
                    try {
                        if (apiCloud.syncAttachments) {
                            await apiCloud.syncAttachments();
                        }
                    } catch (attErr) {
                        console.error("Errore sync allegati:", attErr);
                    }
                    
                    if (typeof newRetryTime === 'number') {
                        window.ultimoCaricamento = newRetryTime;
                    } else if (retryData && retryData.driveModifiedTime) {
                        window.ultimoCaricamento = retryData.driveModifiedTime;
                    } else {
                        window.ultimoCaricamento = Date.now();
                    }

                    if (window.apiSettings) {
                        const settings = await window.apiSettings.get();
                        settings.lastSyncTime = window.ultimoCaricamento;
                        await window.apiSettings.save(settings);
                    }
                    if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
                    window.incomingChanges = [];
                    window.incomingStructuralChanges = [];
                    if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
                    if (typeof window.impostaModifichePendenti === 'function') window.impostaModifichePendenti(false);
                    if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_conflitto_risolto_sincron", "Conflitto risolto! Sincronizzazione completata in sicurezza."), "success");
                    inviaPingPusher();
                } catch(retryErr) {
                    if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_la_risoluz", "Errore durante la risoluzione del conflitto: ") + retryErr.message, "error");
                }
            } else if (e.message && e.message.includes('ACCESSO_NEGATO_VAULT')) {
                window.driveStatus.isAuthenticated = false;
                window.driveStatus.unauthorizedVault = true;
                if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio('Accesso negato: questo account non è autorizzato per l\'Archivio Condiviso. Accedi con l\'account corretto o richiedi un nuovo invito al proprietario.', 'error');
                if (typeof window.apriCloudModal === 'function') window.apriCloudModal();
            } else if (e.message && (e.message.includes('Autenticazione') || e.message.includes('non effettuata') || e.message.includes('effettua l\'accesso'))) {
                // Errore di autenticazione: apri il cloud modal per guidare l'utente al login
                // (es. primo avvio dopo upgrade scope drive.file → drive per vault condivisi)
                if (typeof window.apriCloudModal === 'function') {
                    window.apriCloudModal();
                } else if (!silent && typeof mostraMessaggio === 'function') {
                    mostraMessaggio("Accesso a Google Drive richiesto. Apri il menu Cloud per accedere.", "warning");
                }
            } else {
                if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_la_sincron", "Errore durante la sincronizzazione: ") + e.message, "error");
            }
        } finally {
            if (btn) btn.disabled = false;
            window.toggleSyncProgress(false);
        }
    }
};

window.scaricaDalCloud = async function(silent = false) {
    if (window.hubConfig) { if (window.riceviModificheHub) await window.riceviModificheHub(silent); return; }
    if (!silent && !window.hasFetchedBeforeDownload && typeof window.mostraBottomConfirm === 'function') {
        window.mostraBottomConfirm(window.t("confirm_pull_no_fetch", "Attenzione: stai per scaricare le modifiche dal Cloud senza aver prima verificato di cosa si tratta (Fetch). Vuoi procedere comunque?"), () => {
            // Se accetta, procediamo forzando silent a true per bypassare questo stesso blocco, o mettiamo un flag
            eseguiScaricamentoDalCloud(silent);
        });
        return;
    }
    await eseguiScaricamentoDalCloud(silent);
};

async function eseguiScaricamentoDalCloud(silent = false) {
    if (window.driveStatus?.unauthorizedVault) {
        if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio('Accesso negato: questo account non è autorizzato per l\'Archivio Condiviso.', 'error');
        return;
    }
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        window.toggleSyncProgress(true, 'download_in_progress');
        try {
            const driveData = await apiCloud.pull();
            if (driveData && driveData.database) {
                if (typeof window.sincronizzaEUnisciDati === 'function') {
                    await window.sincronizzaEUnisciDati(driveData.database);
                }
                window.lastDriveModifiedTime = driveData.driveModifiedTime;
                window.ultimoCaricamento = driveData.driveModifiedTime || Date.now();
                if (window.apiSettings) {
                    const settings = await window.apiSettings.get();
                    settings.lastSyncTime = window.ultimoCaricamento;
                    await window.apiSettings.save(settings);
                }
                if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
                window.incomingChanges = [];
                window.incomingStructuralChanges = [];
                if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
                
                try {
                    if (apiCloud.syncAttachments) {
                        await apiCloud.syncAttachments();
                    }
                } catch (attErr) {
                    console.error("Errore sync allegati:", attErr);
                }
            }
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_scaricamento_completato", "Scaricamento completato!"), "success");
        } catch (e) {
            console.error(e);
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_lo_scarica", "Errore durante lo scaricamento: ") + e.message, "error");
        } finally {
            window.toggleSyncProgress(false);
            window.hasFetchedBeforeDownload = false;
        }
    }
};

window.caricaSulCloud = async function(silent = false) {
    if (window.hubConfig) { if (window.inviaModificheHub) await window.inviaModificheHub(); return; }
    if (window.driveStatus?.unauthorizedVault) {
        if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio('Accesso negato: questo account non è autorizzato per l\'Archivio Condiviso.', 'error');
        return;
    }
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
                window.lastDriveModifiedTime = driveData.driveModifiedTime;
            }

            // Ora carichiamo il risultato del merge
            const newSyncTime = await apiCloud.sync(window.lastDriveModifiedTime);
            
            try {
                if (apiCloud.syncAttachments) {
                    await apiCloud.syncAttachments();
                }
            } catch (attErr) {
                console.error("Errore sync allegati:", attErr);
                if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Sincronizzazione DB completata, ma errore negli allegati: " + attErr.message, "warning");
            }
            
            if (typeof newSyncTime === 'number') {
                window.ultimoCaricamento = newSyncTime;
            } else if (driveData && driveData.driveModifiedTime) {
                window.ultimoCaricamento = driveData.driveModifiedTime;
            } else {
                window.ultimoCaricamento = Date.now();
            }

            if (window.apiSettings) {
                const settings = await window.apiSettings.get();
                settings.lastSyncTime = window.ultimoCaricamento;
                await window.apiSettings.save(settings);
            }
            if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
            window.incomingChanges = [];
            window.incomingStructuralChanges = [];
            if (typeof window.renderSourceControl === 'function') window.renderSourceControl();

            if (typeof window.impostaModifichePendenti === 'function') window.impostaModifichePendenti(false);
            
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_caricamento_completato_in", "Caricamento completato in sicurezza!"), "success");
            inviaPingPusher();
        } catch (e) {
            console.error(e);
            if (e.message && e.message.includes("409_CONFLICT")) {
                if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_conflitto_sul_cloud_un_al", "Conflitto sul Cloud: un altro utente ha salvato. Unione automatica in corso..."), "warning");
                console.warn("409_CONFLICT in caricaSulCloud: auto-healing in progress...");
                try {
                    const retryData = await apiCloud.pull();
                    if (retryData && retryData.database) {
                        if (typeof window.sincronizzaEUnisciDati === 'function') {
                            await window.sincronizzaEUnisciDati(retryData.database);
                        }
                        window.lastDriveModifiedTime = retryData.driveModifiedTime;
                    }
                    const newRetryTime = await apiCloud.sync(window.lastDriveModifiedTime);
                    try {
                        if (apiCloud.syncAttachments) {
                            await apiCloud.syncAttachments();
                        }
                    } catch (attErr) {
                        console.error("Errore sync allegati:", attErr);
                    }
                    
                    if (typeof newRetryTime === 'number') {
                        window.ultimoCaricamento = newRetryTime;
                    } else if (retryData && retryData.driveModifiedTime) {
                        window.ultimoCaricamento = retryData.driveModifiedTime;
                    } else {
                        window.ultimoCaricamento = Date.now();
                    }

                    if (window.apiSettings) {
                        const settings = await window.apiSettings.get();
                        settings.lastSyncTime = window.ultimoCaricamento;
                        await window.apiSettings.save(settings);
                    }
                    if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
                    window.incomingChanges = [];
                    window.incomingStructuralChanges = [];
                    if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
                    if (typeof window.impostaModifichePendenti === 'function') window.impostaModifichePendenti(false);
                    if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_conflitto_risolto_caricam", "Conflitto risolto! Caricamento completato in sicurezza."), "success");
                    inviaPingPusher();
                } catch(retryErr) {
                    if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_la_risoluz", "Errore durante la risoluzione del conflitto: ") + retryErr.message, "error");
                }
            } else {
                if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_il_caricam", "Errore durante il caricamento: ") + e.message, "error");
            }
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
    if (!window.apiBrowser || !window.apiBrowser.getVaultConfig) return;
    const vc = await window.apiBrowser.getVaultConfig();
    const pusherWebhook = vc.realtime && vc.realtime.pusherWebhook;

    if (pusherWebhook && window.currentPusherChannelName) {
        try {
            await fetch(pusherWebhook, {
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
        mostraProgressoCloud(window.t("prog_prep_title", "Preparazione in corso"), window.t("prog_prep_auth", "Autenticazione con Google Drive in corso..."));
    }

    try {
        const apiCloud = await window.getApiCloud();
        if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
            await apiCloud.auth();
            await aggiornaStatoDrive();
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_conf_title", "Configurazione in corso"), window.t("prog_conf_shared", "Impostazione Archivio come condiviso..."));
        }
        
        if (window.apiBrowser && window.apiBrowser.setVaultType) {
            // Il main gestisce il reset dello sharedVaultId sulla transizione local→cloud
            // e la conservazione dell'id sullo switch shared<->backup.
            await window.apiBrowser.setVaultType({ vaultType: 'shared', driveAutofetch: true });
            if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_sync_title", "Sincronizzazione in corso"), window.t("prog_sync_merge", "Caricamento e unione dei dati sul Cloud (potrebbe volerci un po\')..."));
        }
        await window.sincronizzaGoogleDrive(true);
        
        if (typeof apriCloudModal === 'function') {
            apriCloudModal();
        }
    } catch(e) {
        mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
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
        mostraProgressoCloud(window.t("prog_prep_title", "Preparazione in corso"), window.t("prog_prep_auth", "Autenticazione con Google Drive in corso..."));
    }

    try {
        const apiCloud = await window.getApiCloud();
        if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
            await apiCloud.auth();
            await aggiornaStatoDrive();
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_conf_title", "Configurazione in corso"), window.t("prog_conf_backup", "Impostazione Backup Personale..."));
        }
        
        if (window.apiBrowser && window.apiBrowser.setVaultType) {
            await window.apiBrowser.setVaultType({ vaultType: 'backup', driveAutofetch: true });
            if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_sync_title", "Sincronizzazione in corso"), window.t("prog_sync_merge", "Caricamento e unione dei dati sul Cloud (potrebbe volerci un po\')..."));
        }
        await window.sincronizzaGoogleDrive(true);
        
        if (typeof apriCloudModal === 'function') {
            apriCloudModal();
        }
    } catch(e) {
        mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
        if(btn) btn.disabled = false;
    } finally {
        if (typeof nascondiProgressoCloud === 'function') {
            nascondiProgressoCloud();
        }
    }
}

// ─── MIGRAZIONE Drive → Hub (one-way) ─────────────────────────────────────────
// Pull finale da Drive (per non perdere modifiche remote) → crea repo Hub + push v1 +
// upload allegati (i chunk sono già locali) → riscrive il vault come provider 'hub'.
// La config Drive (.archiview-drive.json + sharedVaultId) resta come backup dormiente.
// I permessi Drive NON sono convertibili: l'owner dovrà re-invitare i collaboratori.
window.migraVaultSuHub = async function(skipConfirm = false) {
    if (window.hubConfig) { mostraMessaggio(window.t("msg_gia_su_hub", "Questo archivio è già collegato ad un Hub."), "info"); return; }
    if (typeof window.creaRepositoryHub !== 'function') return;

    const esegui = async () => {
        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_migrate_title", "Migrazione su Hub"), window.t("prog_migrate_pull", "Scarico le ultime modifiche da Google Drive..."));
        }
        try {
            // 1. Pull finale da Drive per fondere eventuali modifiche remote non ancora scaricate.
            const apiCloud = await window.getApiCloud();
            if (apiCloud && window.driveStatus?.isAuthenticated) {
                try {
                    const driveData = await apiCloud.pull();
                    if (driveData?.database && typeof window.sincronizzaEUnisciDati === 'function') {
                        await window.sincronizzaEUnisciDati(driveData.database);
                    }
                } catch (e) { console.warn("Pull Drive pre-migrazione fallito (procedo con i dati locali):", e); }
            }

            // Flag per mostrare il promemoria "re-invita i collaboratori" dopo il reload.
            if (window.apiSettings) {
                try {
                    const s = await window.apiSettings.get();
                    s.hubJustMigrated = true;
                    await window.apiSettings.save(s);
                } catch (e) { /* best-effort */ }
            }

            // 2. Crea repo + push v1 + salva config (provider→'hub') + upload allegati + reload.
            //    creaRepositoryHub gestisce i propri errori (toast, nessun throw), mostra il proprio
            //    overlay "preparazione" e ricarica da sola in caso di successo: nascondiamo il nostro
            //    overlay solo se fallisce, altrimenti resterebbe visibile fino al reload.
            // null → creaRepositoryHub usa il basename della cartella come nome vault.
            const ok = await window.creaRepositoryHub(null);
            if (!ok && typeof nascondiProgressoCloud === 'function') nascondiProgressoCloud();
        } catch (e) {
            if (typeof nascondiProgressoCloud === 'function') nascondiProgressoCloud();
            mostraMessaggio(window.t("msg_errore_migrazione_hub", "Errore durante la migrazione su Hub: ") + (e.message || e), "error");
        }
    };

    // Il pannello dedicato in shareModal (stato drive) spiega già le conseguenze prima di
    // chiamare questa funzione con skipConfirm=true; la conferma testuale resta come fallback
    // per eventuali altri chiamanti diretti (es. cloudModal "Avanzate").
    if (skipConfirm) { await esegui(); return; }
    const msg = window.t("confirm_migrate_hub", "Vuoi passare questo archivio da Google Drive all'archivio condiviso di ArchiView? I dati e gli allegati verranno caricati online. La connessione a Google Drive resterà come backup, ma dovrai re-invitare i collaboratori con un nuovo link di invito. L'operazione non è reversibile automaticamente.");
    if (typeof mostraBottomConfirm === 'function') mostraBottomConfirm(msg, esegui);
    else if (confirm(msg)) await esegui();
};

window.scollegaCloud = async function() {
    // Coesistenza: scollegare un vault Hub deve rimuovere .archiview-hub.json + i segreti,
    // altrimenti il modello unificato tornerebbe a derivare provider 'hub' dal file legacy.
    if (window.hubConfig) {
        const scollega = async () => {
            if (typeof mostraProgressoCloud === 'function') {
                mostraProgressoCloud(window.t("prog_disc_title", "Scollegamento"), window.t("prog_disc_desc", "Disattivazione della sincronizzazione Cloud..."));
            }
            try {
                if (window.hubAutofetchTimer) { clearInterval(window.hubAutofetchTimer); window.hubAutofetchTimer = null; }
                if (window.apiBrowser?.disconnectHub) await window.apiBrowser.disconnectHub();
                window.hubConfig = null;
                if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
                mostraMessaggio(window.t("msg_l_archivio_ora_scollegato", "L'Archivio è ora scollegato ed è solo locale."), "success");
                if (typeof apriCloudModal === 'function') apriCloudModal();
            } catch (e) {
                mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
            } finally {
                if (typeof nascondiProgressoCloud === 'function') nascondiProgressoCloud();
            }
        };
        const msg = window.t("confirm_disc_cloud", "Vuoi davvero scollegare questo Archivio dal Cloud? I dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l'app tornerà in modalità solo locale per questo progetto.");
        if (typeof mostraBottomConfirm === 'function') mostraBottomConfirm(msg, scollega);
        else if (confirm(msg)) await scollega();
        return;
    }
    const scollegaLegacy = async () => {
        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_disc_title", "Scollegamento"), window.t("prog_disc_desc", "Disattivazione della sincronizzazione Cloud..."));
        }
        try {
            if (window.apiBrowser && window.apiBrowser.setVaultType) {
                await window.apiBrowser.setVaultType({ vaultType: 'local' });
                if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
                mostraMessaggio(window.t("msg_l_archivio_ora_scollegato", "L'Archivio è ora scollegato ed è solo locale."), "success");
                if (typeof apriCloudModal === 'function') apriCloudModal();
            }
        } catch(e) {
            mostraMessaggio(window.t("msg_errore_durante_la_disconn", "Errore durante la disconnessione dal cloud: ") + e.message, "error");
        } finally {
            if (typeof nascondiProgressoCloud === 'function') nascondiProgressoCloud();
        }
    };
    const msgLegacy = window.t("confirm_disc_cloud", "Vuoi davvero scollegare questo Archivio dal Cloud? I dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l'app tornerà in modalità solo locale per questo progetto.");
    if (typeof mostraBottomConfirm === 'function') mostraBottomConfirm(msgLegacy, scollegaLegacy);
    else if (confirm(window.t("confirm_disc_cloud_short", `Vuoi davvero scollegare questo Archivio dal Cloud?\nI dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l'app tornerà in modalità solo locale per questo progetto.`))) {
        await scollegaLegacy();
    }
}



// ─── STORICO VERSIONI CLOUD ───────────────────────────────────────────────────

/**
 * Recupera il fileId del database su Drive e la lista delle revisioni.
 * Restituisce { fileId, revisions[] } oppure lancia un errore.
 */
window.elencaRevisioniCloud = async function() {
    if (!window.apiDrive) throw new Error("Non sei connesso al Cloud.");
    const fileId = await window.apiDrive.getDbFileId();
    const revisions = await window.apiDrive.listRevisions(fileId);
    return { fileId, revisions };
};

/**
 * Scarica il contenuto JSON di una revisione specifica.
 */
window.caricaRevisioneCloud = async function(fileId, revisionId) {
    if (!window.apiDrive) throw new Error("Non sei connesso al Cloud.");
    return await window.apiDrive.getRevision(fileId, revisionId);
};

/**
 * Ripristina il vault locale e cloud a una revisione specifica.
 * Dopo il ripristino, ricarica i dati locali.
 */
window.ripristinaRevisioneCloud = async function(fileId, revisionId) {
    if (!window.apiDrive) throw new Error("Non sei connesso al Cloud.");
    await window.apiDrive.restoreRevision(fileId, revisionId);
    // Ricarica i dati dal file locale aggiornato
    if (window.apiBrowser) {
        const nuoviDati = await window.apiBrowser.leggiDati();
        if (nuoviDati && typeof window.sincronizzaEUnisciDati === 'function') {
            await window.sincronizzaEUnisciDati(nuoviDati);
        }
    }
};
