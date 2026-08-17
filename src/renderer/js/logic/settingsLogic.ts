// @ts-nocheck
window.apriImpostazioni = async function() {
    document.getElementById('settings-modal').classList.remove('hidden-tab');
    if (window.apiBrowser && window.apiBrowser.getWorkspacePath && window.apiSettings) {
        const p = await window.apiBrowser.getWorkspacePath();
        document.getElementById('settings-workspace-path').textContent = p || window.t('no_workspace_set');
        
        const settings = await window.apiSettings.get();
        const vaultConfig = window.apiBrowser.getVaultConfig ? await window.apiBrowser.getVaultConfig() : { vaultType: 'local' };

        // Popola Nome Collaboratore
        const usernameInput = document.getElementById('settings-username');
        if (usernameInput) {
            usernameInput.value = settings.username || '';
            if (!usernameInput.dataset.listenerSetup) {
                usernameInput.addEventListener('change', async (e) => {
                    if (window.apiSettings) {
                        const currentSettings = await window.apiSettings.get();
                        currentSettings.username = e.target.value.trim();
                        await window.apiSettings.save(currentSettings);
                        mostraMessaggio(window.t("msg_nome_collaboratore_salvat", "Nome collaboratore salvato."), "success");
                    }
                });
                usernameInput.dataset.listenerSetup = 'true';
            }
        }
        
        // Aggiorna percorso allegati
        const attachmentsPathDiv = document.getElementById('settings-attachments-path');
        const btnRestore = document.getElementById('btn-restore-attachments');
        if (attachmentsPathDiv) {
            if (settings.customAttachmentsPath) {
                attachmentsPathDiv.textContent = settings.customAttachmentsPath;
                if (btnRestore) btnRestore.classList.remove('hidden-tab');
            } else {
                attachmentsPathDiv.textContent = p ? (p + '\\allegati_manoscritti') : 'Non definita';
                if (btnRestore) btnRestore.classList.add('hidden-tab');
            }
        }
        
        // Aggiorna sezione Hub & Drive
        const hubSection = document.getElementById('settings-hub-section');
        const driveSection = document.getElementById('settings-drive-section');
        const disabledText = document.getElementById('settings-hub-disabled');

        let isAnySyncActive = false;

        if (hubSection) {
            if (window.hubConfig) {
                document.getElementById('settings-hub-url').textContent = window.hubConfig.hubUrl;
                document.getElementById('settings-hub-repoid').textContent = window.hubConfig.repoId;
                // La chiave non va mostrata in chiaro: mascherata, si condivide solo via invito.
                document.getElementById('settings-hub-key').textContent = '•••••••• (condividi tramite invito)';
                const cbAtt = document.getElementById('settings-hub-attachments');
                if (cbAtt) cbAtt.checked = window.hubConfig.attachmentsMode !== 'off';
                
                const cbAutofetch = document.getElementById('settings-hub-autofetch');
                const selInterval = document.getElementById('settings-hub-autofetch-interval');
                if (cbAutofetch) {
                    cbAutofetch.checked = settings.autofetchEnabled !== false; // Abilitato di default
                }
                if (selInterval) {
                    selInterval.value = settings.autofetchInterval || "5"; // 5 min default
                }

                // Google Drive personale per gli allegati: indipendente dal Drive del vault
                // condiviso (che per un vault Hub non esiste), serve solo a caricare/scaricare
                // i chunk cifrati degli allegati sul proprio Drive.
                if (typeof window.aggiornaStatoDriveHub === 'function') window.aggiornaStatoDriveHub();

                hubSection.classList.remove('hidden');
                isAnySyncActive = true;
            } else {
                hubSection.classList.add('hidden');
            }
        }
        
        if (driveSection) {
            // Un vault Hub ha vaultType='shared' ma NON è Drive: la sezione Drive non va mostrata.
            const isHubVault = !!window.hubConfig || vaultConfig.provider === 'hub';
            if (vaultConfig.vaultType !== 'local' && !isHubVault) {
                driveSection.classList.remove('hidden');
                isAnySyncActive = true;

                const driveTitle = document.getElementById('settings-drive-title');
                const driveDesc = document.getElementById('settings-drive-desc');

                if (vaultConfig.vaultType === 'backup') {
                    if (driveTitle) driveTitle.textContent = window.t("settings_personal_backup_title", "Personal Cloud Backup");
                    if (driveDesc) driveDesc.textContent = window.t("settings_personal_backup_desc", "This local archive is synced privately as a backup on your Google Drive.");
                } else {
                    if (driveTitle) driveTitle.textContent = window.t("settings_drive_title");
                    if (driveDesc) driveDesc.textContent = window.t("settings_drive_desc");
                }
            } else {
                driveSection.classList.add('hidden');
            }
        }

        if (disabledText) {
            if (isAnySyncActive) {
                disabledText.classList.add('hidden');
            } else {
                disabledText.classList.remove('hidden');
            }
        }
    }
}

window.salvaImpostazioniHub = async function() {
    if (window.apiSettings) {
        const settings = await window.apiSettings.get();
        const cbAutofetch = document.getElementById('settings-hub-autofetch');
        const selInterval = document.getElementById('settings-hub-autofetch-interval');
        
        if (cbAutofetch) settings.autofetchEnabled = cbAutofetch.checked;
        if (selInterval) settings.autofetchInterval = parseInt(selInterval.value, 10);
        
        await window.apiSettings.save(settings);
        
        // Riavvia il timer di autofetch se la funzione esiste
        if (typeof window.avviaAutofetchHub === 'function') {
            window.avviaAutofetchHub();
        }
    }
}

window.salvaAllegatiModeHub = async function() {
    if (!window.hubConfig) return;
    const cb = document.getElementById('settings-hub-attachments');
    const checked = !!(cb && cb.checked);
    // Vedi shareModal.toggleAllegatiShare: senza Drive collegato l'upload non può funzionare.
    if (checked && !window.driveStatus?.isAuthenticated) {
        mostraMessaggio(window.t("msg_hub_attachments_need_drive", "Per condividere gli allegati devi prima collegare Google Drive dalle Impostazioni (sezione Sincronizzazione)."), "error");
        if (cb) cb.checked = false;
        return;
    }
    window.hubConfig.attachmentsMode = checked ? 'drive-links' : 'off';
    await window.apiBrowser.saveHubConfig(window.hubConfig);
    if (window.hubConfig.attachmentsMode === 'drive-links') window.sincronizzaAllegatiHub(false);
};

window.cambiaCartellaAllegati = async function() {
    if (window.apiBrowser && window.apiBrowser.selectBaseDirectory && window.apiSettings) {
        const path = await window.apiBrowser.selectBaseDirectory(window.t("dialog_select_folder", "Seleziona la posizione per la nuova cartella"));
        if (path) {
            const settings = await window.apiSettings.get();
            settings.customAttachmentsPath = path;
            await window.apiSettings.save(settings);
            
            // Aggiorna la visualizzazione
            const attachmentsPathDiv = document.getElementById('settings-attachments-path');
            const btnRestore = document.getElementById('btn-restore-attachments');
            if (attachmentsPathDiv) attachmentsPathDiv.textContent = path;
            if (btnRestore) btnRestore.classList.remove('hidden-tab');
            
            mostraMessaggio(window.t("msg_directory_allegati_locale", "Directory allegati locale configurata con successo."), "success");
        }
    }
};

window.ripristinaCartellaAllegatiPredefinita = async function() {
    if (window.apiSettings && window.apiBrowser) {
        const settings = await window.apiSettings.get();
        delete settings.customAttachmentsPath;
        await window.apiSettings.save(settings);
        
        const p = await window.apiBrowser.getWorkspacePath();
        const attachmentsPathDiv = document.getElementById('settings-attachments-path');
        const btnRestore = document.getElementById('btn-restore-attachments');
        if (attachmentsPathDiv) attachmentsPathDiv.textContent = p ? (p + '\\allegati_manoscritti') : 'Non definita';
        if (btnRestore) btnRestore.classList.add('hidden-tab');
        
        mostraMessaggio(window.t("msg_la_directory_degli_allega", "La directory degli allegati è stata ripristinata al percorso di default (interna all'archivio)."), "success");
    }
};

window.esportaBackupZip = async function() {
    if (window.apiBrowser && window.apiBrowser.exportWorkspaceZip) {
        mostraMessaggio(window.t("msg_backup_init"), "info");
        
        const progDiv = document.createElement('div');
        progDiv.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-4 rounded-sm shadow-2xl z-toast min-w-[300px] border border-stone-700 text-center flex flex-col gap-2';
        progDiv.innerHTML = window.sanitizeHTML(`
            <div class="font-bold text-sm">Esportazione in corso...</div>
            <div class="w-full bg-stone-700 h-2 rounded-full overflow-hidden">
                <div id="export-progress-bar" class="bg-amber-500 h-full w-0 transition-all duration-300"></div>
            </div>
            <div id="export-progress-text" class="text-xs text-stone-300">Calcolo...</div>
        `);
        document.body.appendChild(progDiv);

        if (!window._exportProgressListener && window.apiBrowser.onExportProgress) {
            window.apiBrowser.onExportProgress((progress) => {
                const bar = document.getElementById('export-progress-bar');
                const text = document.getElementById('export-progress-text');
                if (bar && text && progress.entries) {
                    const proc = progress.entries.processed;
                    const total = progress.entries.total;
                    const perc = total > 0 ? Math.round((proc / total) * 100) : 0;
                    bar.style.width = perc + '%';
                    text.textContent = `${proc} di ${total} file elaborati (${perc}%)`;
                }
            });
            window._exportProgressListener = true;
        }

        try {
            const result = await window.apiBrowser.invoke('export-workspace-zip', window.t('btn_export_zip'));
            progDiv.remove();

            if (result.success) {
                mostraMessaggio(window.t("msg_backup_success"), "success");
            } else if (!result.canceled) {
                mostraMessaggio(window.t("msg_backup_error") + result.error, "error");
            }
        } catch (e) {
            progDiv.remove();
            mostraMessaggio(window.t("msg_backup_error") + e.message, "error");
        }
    }
}

window.chiudiImpostazioni = function() {
    document.getElementById('settings-modal').classList.add('hidden-tab');
}

window.cambiaCartellaLavoro = async function() {
    if (typeof mostraWelcomeModal === 'function') {
        window.chiudiImpostazioni();
        await mostraWelcomeModal();
    } else if (window.apiBrowser && window.apiBrowser.changeWorkspace) {
        await window.apiBrowser.changeWorkspace(window.t('modal_new_folder'));
    }
}

// Macchina a stati esplicita per il banner aggiornamenti: idle -> available -> downloading -> downloaded -> installing,
// con 'error' raggiungibile da qualunque stato attivo. Un solo punto di rendering (renderUpdateBanner) evita che gli
// handler asincroni (progress/downloaded/error) lascino il bottone in uno stato incoerente tra loro.
window._updateState = window._updateState || { status: 'idle' };

function mapErrorCodeToMessage(errorCode, rawError) {
    switch (errorCode) {
        case 'offline': return window.t("msg_update_offline");
        case 'no-release': return window.t("msg_update_no_release");
        case 'rate-limited': return window.t("msg_update_rate_limited");
        default: return window.t("msg_update_generic") + (rawError || '');
    }
}

function renderUpdateBanner() {
    const banner = document.getElementById('update-banner');
    const text = document.getElementById('update-banner-text');
    const btn = document.getElementById('btn-scarica-aggiornamento');
    const notesBtn = document.getElementById('btn-note-rilascio');
    if (!banner || !text || !btn) return;

    const s = window._updateState;
    btn.classList.remove('bg-green-600', 'hover:bg-green-700', 'text-white', 'border-transparent');
    btn.disabled = false;
    banner.classList.remove('bg-sky-600', 'border-sky-700', 'bg-red-600', 'border-red-700');

    if (notesBtn) {
        notesBtn.classList.toggle('hidden-tab', !s.releaseNotes);
    }

    switch (s.status) {
        case 'available':
            banner.classList.add('bg-sky-600', 'border-sky-700');
            text.textContent = `${window.t("msg_new_version_avail")} ${s.latestVersion} (${window.t("msg_current_version")} ${s.currentVersion})`;
            btn.textContent = window.t("btn_download_update");
            btn.onclick = avviaDownloadAggiornamento;
            banner.classList.remove('hidden-tab');
            break;
        case 'downloading':
            banner.classList.add('bg-sky-600', 'border-sky-700');
            btn.disabled = true;
            btn.textContent = s.percent != null ? `${window.t("msg_downloading")} ${s.percent}%` : window.t("btn_download_starting");
            banner.classList.remove('hidden-tab');
            break;
        case 'downloaded':
            banner.classList.add('bg-sky-600', 'border-sky-700');
            btn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white', 'border-transparent');
            btn.textContent = window.t("btn_restart_install");
            btn.onclick = avviaInstallazioneAggiornamento;
            banner.classList.remove('hidden-tab');
            break;
        case 'installing':
            banner.classList.add('bg-sky-600', 'border-sky-700');
            btn.disabled = true;
            btn.textContent = window.t("btn_installing");
            banner.classList.remove('hidden-tab');
            break;
        case 'error':
            banner.classList.add('bg-red-600', 'border-red-700');
            text.textContent = mapErrorCodeToMessage(s.errorCode, s.errorMessage);
            btn.textContent = window.t("btn_download_update");
            btn.onclick = avviaDownloadAggiornamento;
            banner.classList.remove('hidden-tab');
            break;
        default: // idle
            banner.classList.add('hidden-tab');
    }
}

async function avviaDownloadAggiornamento() {
    window._updateState = { ...window._updateState, status: 'downloading', percent: null };
    renderUpdateBanner();
    const res = await window.apiBrowser.downloadUpdate();
    if (res && !res.success) {
        window._updateState = { ...window._updateState, status: 'error', errorCode: res.errorCode, errorMessage: res.error };
        renderUpdateBanner();
    }
}

function avviaInstallazioneAggiornamento() {
    window._updateState = { ...window._updateState, status: 'installing' };
    renderUpdateBanner();
    window.apiBrowser.installUpdate();
}

function setupUpdateEventListeners() {
    if (window._updateListenersSetup || !window.apiBrowser || !window.apiBrowser.onUpdateProgress) return;

    window.apiBrowser.onUpdateProgress((progressObj) => {
        if (window._updateState.status !== 'downloading') return; // Evita di sovrascrivere uno stato più recente
        window._updateState = { ...window._updateState, percent: Math.round(progressObj.percent) };
        renderUpdateBanner();
    });

    window.apiBrowser.onUpdateDownloaded(() => {
        window._updateState = { ...window._updateState, status: 'downloaded' };
        renderUpdateBanner();
    });

    if (window.apiBrowser.onUpdateError) {
        window.apiBrowser.onUpdateError((payload) => {
            // Errore asincrono (rete caduta a metà download, checksum non valido, ecc.)
            window._updateState = { ...window._updateState, status: 'error', errorCode: payload && payload.errorCode, errorMessage: payload && payload.error };
            renderUpdateBanner();
        });
    }

    window._updateListenersSetup = true;
}

window.controllaAggiornamenti = async function(mostraAvvisi = true) {
    if (!window.apiBrowser || !window.apiBrowser.checkForUpdates) return;

    setupUpdateEventListeners();

    // Un download/installazione in corso non deve essere interrotto da un ri-check silenzioso periodico
    if (window._updateState.status === 'downloading' || window._updateState.status === 'installing') return;

    if (mostraAvvisi) mostraMessaggio(window.t("msg_check_updates"), "info");

    const result = await window.apiBrowser.checkForUpdates();

    if (result.devMode) {
        return; // Build non pacchettizzata: nessun canale di update disponibile
    } else if (result.error) {
        window._updateState = { status: 'error', errorCode: result.errorCode, errorMessage: result.error };
        renderUpdateBanner();
        if (mostraAvvisi) mostraMessaggio(mapErrorCodeToMessage(result.errorCode, result.error), "error");
    } else if (result.updateAvailable) {
        window._updateState = {
            status: 'available',
            latestVersion: result.latestVersion,
            currentVersion: result.currentVersion,
            releaseNotes: result.releaseNotes || null
        };
        renderUpdateBanner();
    } else {
        window._updateState = { status: 'idle' };
        renderUpdateBanner();
        if (mostraAvvisi) mostraMessaggio(`${window.t("msg_up_to_date")} (${result.currentVersion}).`, "success");
    }
}

window.nascondiBannerAggiornamento = function() {
    document.getElementById('update-banner').classList.add('hidden-tab');
}

window.mostraNoteRilascio = function() {
    const notes = window._updateState && window._updateState.releaseNotes;
    const modal = document.getElementById('release-notes-modal');
    const body = document.getElementById('release-notes-body');
    if (!modal || !body) return;
    // releaseNotes arriva dal body della GitHub Release (contenuto remoto non fidato): sanitizzato prima dell'inserimento nel DOM.
    body.innerHTML = notes ? window.sanitizeHTML(notes) : window.escapeHTML(window.t("msg_no_release_notes"));
    modal.classList.remove('hidden-tab');
    if (window.lucide) lucide.createIcons({ nodes: [modal] });
}

window.chiudiNoteRilascio = function() {
    const modal = document.getElementById('release-notes-modal');
    if (modal) modal.classList.add('hidden-tab');
}


