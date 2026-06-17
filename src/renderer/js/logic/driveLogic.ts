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
                        const newTipi = remoteTipi.filter(rt => !localTipi.some(lt => lt.id === rt.id));
                        const modTipi = remoteTipi.filter(rt => localTipi.some(lt => lt.id === rt.id && JSON.stringify(lt) !== JSON.stringify(rt)));
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
                statusText.innerHTML = window.sanitizeHTML('<span class="text-stone-500 flex items-center gap-2"><i data-lucide="cloud-off" class="w-4 h-4"></i> Non Connesso</span>');
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
    }
}

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
        
        if (window.apiSettings) {
            const settings = await window.apiSettings.get();
            if (!settings.isSharedVault && !settings.isPersonalCloud) {
                settings.sharedVaultId = null;
            }
            settings.isSharedVault = true;
            settings.isPersonalCloud = false;
            settings.driveAutofetch = true;
            await window.apiSettings.save(settings);
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
        
        if (window.apiSettings) {
            const settings = await window.apiSettings.get();
            if (!settings.isSharedVault && !settings.isPersonalCloud) {
                settings.sharedVaultId = null;
            }
            settings.isPersonalCloud = true;
            settings.isSharedVault = false; // Ensures it's not both
            settings.driveAutofetch = true;
            await window.apiSettings.save(settings);
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

window.scollegaCloud = async function() {
    if (typeof mostraBottomConfirm === 'function') {
        mostraBottomConfirm(
            window.t("confirm_disc_cloud", "Vuoi davvero scollegare questo Archivio dal Cloud? I dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l\'app tornerà in modalità solo locale per questo progetto."),
            async () => {
                if (typeof mostraProgressoCloud === 'function') {
                    mostraProgressoCloud(window.t("prog_disc_title", "Scollegamento"), window.t("prog_disc_desc", "Disattivazione della sincronizzazione Cloud..."));
                }
                try {
                    if (window.apiSettings) {
                        const settings = await window.apiSettings.get();
                        settings.isSharedVault = false;
                        settings.isPersonalCloud = false;
                        settings.driveAutofetch = false;
                        settings.sharedVaultId = null;
                        await window.apiSettings.save(settings);
                        if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
                        
                        mostraMessaggio(window.t("msg_l_archivio_ora_scollegato", "L'Archivio è ora scollegato ed è solo locale."), "success");
                        
                        if (typeof apriCloudModal === 'function') {
                            apriCloudModal();
                        }
                    }
                } catch(e) {
                    mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
                } finally {
                    if (typeof nascondiProgressoCloud === 'function') {
                        nascondiProgressoCloud();
                    }
                }
            }
        );
    } else if (confirm(window.t("confirm_disc_cloud_short", `Vuoi davvero scollegare questo Archivio dal Cloud?\nI dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l'app tornerà in modalità solo locale per questo progetto.`))) {
        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_disc_title", "Scollegamento"), window.t("prog_disc_desc", "Disattivazione della sincronizzazione Cloud..."));
        }
        try {
            if (window.apiSettings) {
                const settings = await window.apiSettings.get();
                settings.isSharedVault = false;
                settings.isPersonalCloud = false;
                settings.driveAutofetch = false;
                await window.apiSettings.save(settings);
                if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
                
                mostraMessaggio(window.t("msg_l_archivio_ora_scollegato", "L'Archivio è ora scollegato ed è solo locale."), "success");
                
                if (typeof apriCloudModal === 'function') {
                    apriCloudModal();
                }
            }
        } catch(e) {
            mostraMessaggio(window.t("msg_errore_durante_la_disconn", "Errore durante la disconnessione dal cloud: ") + e.message, "error");
        } finally {
            if (typeof nascondiProgressoCloud === 'function') {
                nascondiProgressoCloud();
            }
        }
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
