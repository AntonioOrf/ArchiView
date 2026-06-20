// @ts-nocheck
window.apriImpostazioni = async function() {
    document.getElementById('settings-modal').classList.remove('hidden-tab');
    if (window.apiBrowser && window.apiBrowser.getWorkspacePath && window.apiSettings) {
        const p = await window.apiBrowser.getWorkspacePath();
        document.getElementById('settings-workspace-path').textContent = p || window.t('no_workspace_set');
        
        const settings = await window.apiSettings.get();
        
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
                document.getElementById('settings-hub-key').textContent = window.hubConfig.repoKey;
                
                const cbAutofetch = document.getElementById('settings-hub-autofetch');
                const selInterval = document.getElementById('settings-hub-autofetch-interval');
                if (cbAutofetch) {
                    cbAutofetch.checked = settings.autofetchEnabled !== false; // Abilitato di default
                }
                if (selInterval) {
                    selInterval.value = settings.autofetchInterval || "5"; // 5 min default
                }
                
                hubSection.classList.remove('hidden');
                isAnySyncActive = true;
            } else {
                hubSection.classList.add('hidden');
            }
        }
        
        if (driveSection) {
            if (settings.isSharedVault || settings.isPersonalCloud) {
                driveSection.classList.remove('hidden');
                isAnySyncActive = true;
                
                const driveTitle = document.getElementById('settings-drive-title');
                const driveDesc = document.getElementById('settings-drive-desc');
                
                if (settings.isPersonalCloud) {
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
        progDiv.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-4 rounded-sm shadow-2xl z-50 min-w-[300px] border border-stone-700 text-center flex flex-col gap-2';
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

window.controllaAggiornamenti = async function(mostraAvvisi = true) {
    if (window.apiBrowser && window.apiBrowser.checkForUpdates) {
        if (mostraAvvisi) mostraMessaggio(window.t("msg_check_updates"), "info");
        
        const result = await window.apiBrowser.checkForUpdates();

        if (result.error) {
            if (mostraAvvisi) mostraMessaggio(window.t("msg_update_error") + result.error, "error");
        } else if (result.updateAvailable) {
            // Mostra il banner non-intrusivo
            const banner = document.getElementById('update-banner');
            banner.classList.remove('hidden-tab');
            document.getElementById('update-banner-text').textContent = `${window.t("msg_new_version_avail")} ${result.latestVersion} (${window.t("msg_current_version")} ${result.currentVersion})`;
            
            const btn = document.getElementById('btn-scarica-aggiornamento');
            btn.textContent = window.t("btn_download_update");
            btn.disabled = false;
            
            btn.onclick = async () => {
                btn.disabled = true;
                btn.textContent = window.t("btn_download_starting");
                const res = await window.apiBrowser.downloadUpdate();
                if (res && !res.success) {
                    btn.textContent = window.t("btn_download_error");
                    mostraMessaggio(window.t("msg_update_error") + res.error, "error");
                }
            };
            
            if (!window._updateListenersSetup && window.apiBrowser.onUpdateProgress) {
                window.apiBrowser.onUpdateProgress((progressObj) => {
                    const perc = Math.round(progressObj.percent);
                    btn.textContent = `${window.t("msg_downloading")} ${perc}%`;
                });
                
                window.apiBrowser.onUpdateDownloaded(() => {
                    btn.disabled = false;
                    btn.textContent = window.t("btn_restart_install");
                    btn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white', 'border-transparent');
                    btn.onclick = () => {
                        btn.textContent = window.t("btn_installing");
                        btn.disabled = true;
                        window.apiBrowser.installUpdate();
                    };
                });
                window._updateListenersSetup = true;
            }
            
            banner.classList.remove('hidden-tab');
        } else {
            if (mostraAvvisi) mostraMessaggio(`${window.t("msg_up_to_date")} (${result.currentVersion}).`, "success");
        }
    }
}

window.nascondiBannerAggiornamento = function() {
    document.getElementById('update-banner').classList.add('hidden-tab');
}


