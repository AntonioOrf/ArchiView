window.testoErroreDrive = function(e) {
    const testo = e && e.message ? e.message : String(e);
    if (testo.includes('ACCESSO_SCADUTO')) return window.t('err_drive_accesso_scaduto', "L'accesso a Google non è stato completato nel browser entro 5 minuti. Riprova.");
    if (testo.includes('DRIVE_PIENO')) return window.t('err_drive_pieno', "Spazio Google Drive esaurito: libera spazio sul Drive e sincronizza di nuovo.");
    if (testo.includes('BACKUP_ALTRO_ACCOUNT')) return window.t('err_backup_altro_account', "La cartella di questo backup non è sul Drive dell'account Google collegato. Torna all'account di prima, oppure collega o crea un backup su questo account.");
    return testo;
};

window.driveStatus = { isAuthenticated: false, user: null };
window.autofetchIntervalId = null;

window.modificheInEntrata = false;

window.impostaModificheInEntrata = function(stato) {
    window.modificheInEntrata = !!stato;
    if (window.statoCloud) window.statoCloud.inEntrata = !!stato;
    if (typeof window.aggiornaCloudStatus === 'function') window.aggiornaCloudStatus();
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
            if (bar) bar.style.transform = 'scaleX(0)';
            if (textContainer) textContainer.textContent = '...';
            if (title) title.textContent = window.t(titleKey);
        } else {
            barContainer.classList.add('hidden');
            barContainer.classList.remove('flex');
            if(textContainer) textContainer.classList.add('hidden');
            if (bar) bar.style.transform = 'scaleX(0)';
        }
    }

    if (window.statoCloud) window.statoCloud.occupato = !!show;
    if (show && typeof window.chiudiMenuContestuale === 'function') window.chiudiMenuContestuale(false);
    if (typeof window.aggiornaCloudStatus === 'function') window.aggiornaCloudStatus();
};

window.updateSyncProgress = function(percent, text) {
    const bar = document.getElementById('sync-progress-bar');
    const textContainer = document.getElementById('sync-progress-text');
    if (bar) {
        bar.style.transform = `scaleX(${Math.min(100, Math.max(0, percent)) / 100})`;
    }
    if (textContainer && text) {
        textContainer.textContent = text;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.driveAuthPromise = aggiornaStatoDrive();
    
    if (window.apiDrive && window.apiDrive.checkAuth) {
        window.apiDrive.checkAuth().then(isAuth => {
            if (isAuth) {
                console.log("Frontend detected existing valid tokens for this workspace!");
                window.driveStatus.isAuthenticated = true;
                const statusText = document.getElementById('settings-drive-status');
                const loginBtn = document.getElementById('btn-drive-login');
                const logoutBtn = document.getElementById('btn-drive-logout');
                const syncBtn = document.getElementById('btn-drive-sync');
                
                if (statusText) statusText.innerHTML = window.sanitizeHTML('<span class="text-green-600 font-semibold">Connesso al Cloud</span>');
                if (loginBtn) loginBtn.classList.add('hidden');
                if (logoutBtn) logoutBtn.classList.remove('hidden');
                if (syncBtn) syncBtn.classList.remove('hidden');
            }
        });
    }

    if (window.apiDrive && window.apiDrive.onStatusUpdated) {
        window.apiDrive.onStatusUpdated((data) => {
            if (data.authenticated) {
                console.log("Notifica IPC ricevuta: Autenticazione completata con successo!");
                window.driveStatus.isAuthenticated = true;
                aggiornaStatoDrive();
                if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_autenticazione_completata", 'Accesso effettuato.'), "success");
            }
        });
    }
    
    if (window.apiDrive && window.apiDrive.onSyncProgress) {
        window.apiDrive.onSyncProgress((data) => {
            if (data.percent !== undefined) {
                window.updateSyncProgress(data.percent, data.message);
            }
        });
    }
});

window.getApiCloud = async function() {
    return window.apiDrive;
};

window.controllaModificheInEntrata = async function(manual = false) {
    if (window.hubConfig) { if (window.controllaModificheHub) await window.controllaModificheHub(manual); return; }
    const apiCloud = await window.getApiCloud();
    if (apiCloud && window.driveStatus && window.driveStatus.isAuthenticated) {
        if (manual) {
            window.toggleSyncProgress(true, 'sync_checking');
            window.updateSyncProgress(100, window.t('sync_searching', 'Ricerca in corso…'));
        }
        try {
            const remoteModifiedTime = await apiCloud.checkUpdates();
            if (remoteModifiedTime && remoteModifiedTime > (window.ultimoCaricamento || 0)) {
                window.impostaModificheInEntrata(true);
                if (manual && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_ci_sono_nuovi_aggiornamen", 'Ci sono nuove modifiche da scaricare.'), "success");
                
                try {
                    const peekData = await apiCloud.pull();
                    if (peekData && peekData.database && peekData.database.manoscritti) {
                        const loadedAt = window.ultimoCaricamento || 0;
                        window.incomingChanges = peekData.database.manoscritti.filter(m => (m.lastModified || 0) > loadedAt);
                        
                        const utente = peekData.lastModifyingUser;
                        const author = utente
                            ? (utente.displayName || utente.emailAddress || window.t('incoming_author_unknown', 'Sconosciuto'))
                            : window.t('hub_generic_author', 'Collaboratore');
                        window.incomingAuthor = author;
                        window.incomingStructuralChanges = window.riepilogoInArrivo(appData, peekData.database, author);
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
            window.azzeraErroreCloud();
        } catch (e) {
            console.error("Errore controllo aggiornamenti in entrata", e);
            window.impostaErroreCloud(e.message);
            if (manual && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_il_fetch", "Errore durante il fetch: ") + e.message, "error");
        } finally {
            if (manual) window.toggleSyncProgress(false);
        }
    }
};

window.avviaAutofetchDrive = async function() {
    if (window.autofetchIntervalId) clearInterval(window.autofetchIntervalId);
    
    window.autofetchIntervalId = setInterval(() => {
        window.controllaModificheInEntrata();
    }, 300000);
    
    setTimeout(() => window.controllaModificheInEntrata(), 5000);
};

async function aggiornaStatoDrive() {
    window.aggiornaStatoDrive = aggiornaStatoDrive;
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        const statusResult = await apiCloud.status();
        window.driveStatus = {
            isAuthenticated: statusResult?.isAuthenticated || false,
            user: statusResult?.user || null,
            unauthorizedVault: statusResult?.unauthorizedVault || false,
            backupAltroAccount: statusResult?.backupAltroAccount || false
        };

        window.statoCloud.autenticato = window.driveStatus.isAuthenticated || !!window.hubConfig;
        if (typeof window.aggiornaCloudStatus === 'function') window.aggiornaCloudStatus();

        if (window.driveStatus.isAuthenticated) {
            if (typeof window.avviaAutofetchDrive === 'function') window.avviaAutofetchDrive();
        }

        const section = document.getElementById('settings-drive-section');
        const statusText = document.getElementById('settings-drive-status');
        const loginBtn = document.getElementById('btn-drive-login');
        const logoutBtn = document.getElementById('btn-drive-logout');
        const syncBtn = document.getElementById('btn-drive-sync');

        if (section && statusText && loginBtn && logoutBtn && syncBtn) {
            statusText.innerHTML = window.sanitizeHTML(_statoDriveHtml());
            const connesso = window.driveStatus.isAuthenticated;
            loginBtn.classList.toggle('hidden', connesso);
            document.getElementById('btn-drive-switch')?.classList.toggle('hidden', !connesso);
            logoutBtn.classList.toggle('hidden', !connesso);
            syncBtn.classList.toggle('hidden', !connesso);
        }
        window.aggiornaStatoDriveHub();
    }
}

function _statoDriveHtml() {
    if (window.driveStatus && window.driveStatus.isAuthenticated) {
        return `<span class="testo-successo font-semibold"><span data-i18n="settings_drive_connected_as">${escapeHTML(window.t('settings_drive_connected_as', 'Connesso come:'))}</span> ${escapeHTML(window.driveStatus.user || '')}</span>`;
    }
    return `<span class="text-stone-500" data-i18n="settings_drive_not_connected">${escapeHTML(window.t('settings_drive_not_connected', 'Non connesso'))}</span>`;
}

window.aggiornaStatoDriveHub = function() {
    const statusText = document.getElementById('settings-hub-drive-status');
    const loginBtn = document.getElementById('btn-hub-drive-login');
    const logoutBtn = document.getElementById('btn-hub-drive-logout');
    if (!statusText) return;

    statusText.innerHTML = window.sanitizeHTML(_statoDriveHtml());
    const connesso = !!window.driveStatus?.isAuthenticated;
    loginBtn?.classList.toggle('hidden', connesso);
    document.getElementById('btn-hub-drive-switch')?.classList.toggle('hidden', !connesso);
    logoutBtn?.classList.toggle('hidden', !connesso);
};

window.loginCloud = async function(provider, forceLocal = false) {
    const api = window.apiDrive;
    if (api) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_apri_il_browser_per_compl", "Apri il browser per completare l'accesso…"), "info");
        try {
            await api.auth(forceLocal);
            await aggiornaStatoDrive();
            if (window.driveStatus.backupAltroAccount) {
                if (typeof window.chiudiImpostazioni === 'function') window.chiudiImpostazioni();
                await proponiBackupSuQuestoAccount(window.t('err_backup_altro_account', "La cartella di questo backup non è sul Drive dell'account Google collegato. Torna all'account di prima, oppure collega o crea un backup su questo account."));
                return;
            }
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_autenticazione_completata", 'Accesso effettuato.'), "success");
        } catch (e) {
            console.error(e);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_l_autentic", "Errore durante l'autenticazione"), "error");
        }
    }
};

window.loginGoogleDrive = async function(forceLocal = false) {
    await window.loginCloud('google', forceLocal);
};

window.cambiaAccountDrive = async function() {
    const testo = window.t('drive_switch_body', "L'account attuale ({var0}) verrà scollegato da questo archivio e si aprirà il browser per sceglierne un altro.\n\nSe la cartella dell'archivio non è sul Drive del nuovo account, ti verrà proposto di collegare un archivio esistente o di creare un nuovo backup. I dati sul computer non vengono modificati.")
        .replace('{var0}', window.driveStatus?.user || '');
    const ok = await window.chiediConfermaBloccante(testo, window.t('btn_drive_switch', 'Cambia account'), window.t('drive_switch_title', 'Cambiare account Google?'), 'btn-primary');
    if (ok) await window.loginCloud('google', true);
};

window.connettiAccountCloud = async function() {
    await window.loginCloud('google', true);
    if (typeof window.aggiornaCloudStatus === 'function') window.aggiornaCloudStatus();

    const modal = document.getElementById('cloud-modal');
    if (modal && !modal.classList.contains('hidden-tab') && typeof window.apriCloudModal === 'function') {
        await window.apriCloudModal();
    }
};

window.logoutGoogleDrive = async function() {
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        try {
            await apiCloud.logout();

            window.driveStatus = { isAuthenticated: false, user: null, unauthorizedVault: false };
            if (window.autofetchIntervalId) {
                clearInterval(window.autofetchIntervalId);
                window.autofetchIntervalId = null;
            }
            window.driveAuthPromise = null;

            await aggiornaStatoDrive();
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_disconnesso_da_google_dri", "Disconnesso da Google Drive."), "info");
        } catch (e) {
            console.error(e);
        }
    }
};

window.collegaArchivioEsistenteDrive = async function() {
    if (!window.apiDrive || !window.apiBrowser) return;
    const section = document.getElementById('cloud-relink-section');
    const list = document.getElementById('cloud-relink-list');
    if (!section || !list) return;

    document.getElementById('cloud-local-section')?.classList.add('hidden-tab');
    document.getElementById('cloud-shared-section')?.classList.add('hidden-tab');
    section.classList.remove('hidden-tab');
    list.innerHTML = window.sanitizeHTML(`<p class="text-sm text-stone-500 p-4 text-center">${escapeHTML(window.t('msg_ricerca_archivi_drive', 'Ricerca degli archivi sul tuo Drive…'))}</p>`);

    try {
        await window.apiDrive.auth();
        const vaults = await window.apiDrive.listVaults();
        const cfg = await window.apiBrowser.getVaultConfig();
        const currentId = (cfg && cfg.sync && cfg.sync.sharedVaultId) || null;

        list.innerHTML = window.sanitizeHTML('');
        if (!vaults || vaults.length === 0) {
            list.innerHTML = window.sanitizeHTML(`<p class="text-sm text-stone-500 p-4 text-center">${escapeHTML(window.t('msg_no_archive_found_drive', 'Nessun Archivio trovato nella cartella ArchiView sul tuo Drive.'))}</p>`);
            return;
        }

        vaults.forEach(v => {
            const isCurrent = v.id === currentId;
            const div = document.createElement('div');
            div.className = "p-3 border rounded-lg flex justify-between items-center gap-3 " +
                (isCurrent
                    ? "border-emerald-300 dark:border-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-900/20"
                    : "border-stone-200 dark:border-stone-700 cursor-pointer hover:border-blue-400 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors");
            const dateStr = v.modifiedTime ? new Date(v.modifiedTime).toLocaleDateString() : '—';
            div.innerHTML = window.sanitizeHTML(`
                <div class="flex items-center gap-3 min-w-0">
                    <i data-lucide="folder-cloud" class="w-5 h-5 shrink-0 text-blue-600"></i>
                    <div class="min-w-0 text-left">
                        <div class="font-medium truncate">${escapeHTML(v.name || '')}</div>
                        <div class="text-xs text-stone-500">${escapeHTML(window.t('label_modified', 'Modificato:'))} ${escapeHTML(dateStr)}</div>
                    </div>
                </div>
                ${isCurrent
                    ? `<span class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">${escapeHTML(window.t('label_currently_linked', 'Collegato'))}</span>`
                    : `<i data-lucide="chevron-right" class="w-4 h-4 text-stone-400 shrink-0"></i>`}
            `);
            if (!isCurrent) div.onclick = () => confermaCollegamentoArchivio(v, cfg);
            list.appendChild(div);
        });
        if (window.lucide) lucide.createIcons({ nodes: [list] });
    } catch (e) {
        list.innerHTML = window.sanitizeHTML(`<p class="text-sm text-red-600 p-4 text-center">${escapeHTML(window.testoErroreDrive(e))}</p>`);
    }
};

async function proponiBackupSuQuestoAccount(messaggio) {
    if (typeof mostraMessaggio === 'function') mostraMessaggio(messaggio, 'warning');
    if (typeof window.apriCloudModal === 'function') await window.apriCloudModal();
    await window.collegaArchivioEsistenteDrive();
}

function confermaCollegamentoArchivio(vault, cfg) {
    const msg = window.t("msg_dlg_ricollega_archivio", "Collegare questo archivio alla cartella Drive \"") + (vault.name || '') +
        window.t("msg_dlg_ricollega_archivio2", "\"? Alla prossima sincronizzazione i dati verranno uniti a quelli di quella cartella.");
    const esegui = async () => {
        try {
            if (typeof mostraProgressoCloud === 'function') {
                mostraProgressoCloud(window.t("prog_conf_title", "Configurazione in corso"), window.t("prog_conf_relink", "Collegamento all'archivio su Drive…"));
            }
            const tipo = (cfg && cfg.vaultType && cfg.vaultType !== 'local') ? cfg.vaultType : 'backup';
            await window.apiBrowser.setVaultType({ vaultType: tipo, sharedVaultId: vault.id, driveAutofetch: true });
            if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
            window.chiudiCollegaArchivioDrive();
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_archivio_collegato", "Archivio collegato. Sincronizzazione in corso…"), "success");
            await window.sincronizzaGoogleDrive();
        } catch (e) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
        } finally {
            if (typeof nascondiProgressoCloud === 'function') nascondiProgressoCloud();
        }
    };
    if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, esegui);
    else if (confirm(msg)) esegui();
}

window.creaNuovoBackupDrive = function() {
    const msg = window.t("msg_dlg_nuovo_backup_account", "Creare un nuovo backup di questo archivio sul Drive dell'account Google collegato? Dati e allegati verranno caricati da questo PC.");
    const esegui = async () => {
        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_conf_title", "Configurazione in corso"), window.t("prog_conf_backup", "Impostazione Backup Personale…"));
        }
        try {
            await window.apiBrowser.setVaultType({ vaultType: 'backup', sharedVaultId: null, driveAutofetch: true });
            if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
            window.chiudiCollegaArchivioDrive();
            await window.sincronizzaGoogleDrive(true);
            if (!window.statoCloud?.errore && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_sincronizzazione_completa", 'Sincronizzazione completata.'), "success");
        } catch (e) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore", "Errore: ") + window.testoErroreDrive(e), "error");
        } finally {
            if (typeof nascondiProgressoCloud === 'function') nascondiProgressoCloud();
        }
    };
    if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, esegui);
    else if (confirm(msg)) esegui();
};

window.chiudiCollegaArchivioDrive = function() {
    document.getElementById('cloud-relink-section')?.classList.add('hidden-tab');
    if (typeof window.apriCloudModal === 'function') window.apriCloudModal();
};

const TESTI_SYNC_DRIVE = {
    sync: {
        progresso: 'sync_in_progress',
        ok: ["msg_sincronizzazione_completa", 'Sincronizzazione completata.'],
        okDopoConflitto: ["msg_conflitto_risolto_sincron", 'Conflitto risolto. Sincronizzazione completata.'],
        errore: ["msg_errore_durante_la_sincron", "Errore durante la sincronizzazione: "]
    },
    upload: {
        progresso: 'upload_in_progress',
        ok: ["msg_caricamento_completato_in", 'Caricamento completato.'],
        okDopoConflitto: ["msg_conflitto_risolto_caricam", 'Conflitto risolto. Caricamento completato.'],
        errore: ["msg_errore_durante_il_caricam", "Errore durante il caricamento: "]
    }
};

async function scaricaUnisciCarica(apiCloud, silent) {
    const driveData = await apiCloud.pull();
    if (driveData && driveData.database) {
        if (await window.sincronizzaEUnisciDati(driveData.database) === false) return false;
        window.lastDriveModifiedTime = driveData.driveModifiedTime;
    } else if (!silent && typeof mostraMessaggio === 'function') {
        mostraMessaggio(window.t("msg_nessun_db_sul_cloud", "Nessun database trovato sul Cloud: viene caricata la copia locale. Se questo archivio esiste già su un altro PC, verifica dal menu Cloud di essere collegato alla stessa cartella Drive."), "warning");
    }
    return caricaDopoMerge(apiCloud, driveData, silent);
}

async function caricaDopoMerge(apiCloud, driveData, silent) {
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
    const inviate = structuredClone(appData.manoscritti);
    const strutturaInviata = window.strutturaPerBase(appData);
    const newSyncTime = await apiCloud.sync(window.lastDriveModifiedTime);
    await window.registraBaseInviata(inviate, strutturaInviata);

    let erroreAllegati: string | null = null;
    try {
        if (apiCloud.syncAttachments) await apiCloud.syncAttachments();
    } catch (attErr) {
        console.error("Errore sync allegati:", attErr);
        erroreAllegati = window.t('msg_sync_ok_attachments_failed', 'Sincronizzazione DB completata, ma errore negli allegati: ') + window.testoErroreDrive(attErr);
        if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(erroreAllegati, "warning");
    }

    await registraSyncAvvenuta(typeof newSyncTime === 'number'
        ? newSyncTime
        : (driveData && driveData.driveModifiedTime) || Date.now());
    if (typeof window.impostaModifichePendenti === 'function') window.impostaModifichePendenti(false);
    if (erroreAllegati) window.impostaErroreCloud(erroreAllegati);
    else window.azzeraErroreCloud();
    if (window.driveStatus) window.driveStatus.isAuthenticated = true;
    return erroreAllegati ? 'allegati' : true;
}

async function registraSyncAvvenuta(ora) {
    window.ultimoCaricamento = ora;
    if (window.apiSettings) {
        await window.apiSettings.patch({ lastSyncTime: window.ultimoCaricamento });
    }
    if (typeof window.impostaModificheInEntrata === 'function') window.impostaModificheInEntrata(false);
    window.incomingChanges = [];
    window.incomingStructuralChanges = [];
    if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
}

function avvisaSyncDriveAnnullata(silent) {
    if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_sync_annullata_nulla_caricato", "Sincronizzazione annullata: sul Cloud non è stato caricato nulla."), "info");
}

async function sincronizzaDrive(silent, modo) {
    const testi = TESTI_SYNC_DRIVE[modo];
    if (window.driveStatus?.unauthorizedVault) {
        if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_vault_unauthorized', 'Accesso negato: questo account non è autorizzato per l\'Archivio Condiviso.'), 'error');
        return;
    }
    const apiCloud = await window.getApiCloud();
    if (!apiCloud) return;

    const btn = modo === 'sync' ? document.getElementById('btn-drive-sync') as HTMLButtonElement : null;
    const btnModal = modo === 'sync' ? document.getElementById('btn-cloud-drive-sync') : null;
    if (btn) btn.disabled = true;
    if (btnModal && window.impostaStatoCaricamentoCloud) {
        window.impostaStatoCaricamentoCloud(btnModal, true, window.t('btn_syncing', 'Sincronizzazione…'));
    }
    window.toggleSyncProgress(true, testi.progresso);

    try {
        const esito = await scaricaUnisciCarica(apiCloud, silent);
        if (!esito) return avvisaSyncDriveAnnullata(silent);
        if (esito === true && !silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t(testi.ok[0], testi.ok[1]), "success");
    } catch (e) {
        console.error(e);
        if (e.message && e.message.includes("409_CONFLICT")) {
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_conflitto_sul_cloud_un_al", "Conflitto sul Cloud: un altro utente ha salvato. Unione automatica in corso…"), "warning");
            console.warn("409_CONFLICT: auto-healing in progress…");
            try {
                const esito = await scaricaUnisciCarica(apiCloud, silent);
                if (!esito) return avvisaSyncDriveAnnullata(silent);
                if (esito === true && !silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t(testi.okDopoConflitto[0], testi.okDopoConflitto[1]), "success");
            } catch (retryErr) {
                window.impostaErroreCloud(retryErr.message);
                if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_la_risoluz", "Errore durante la risoluzione del conflitto: ") + retryErr.message, "error");
            }
        } else if (e.message && e.message.includes('ACCESSO_NEGATO_VAULT')) {
            window.driveStatus.isAuthenticated = false;
            window.driveStatus.unauthorizedVault = true;
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_vault_unauthorized_hint', 'Accesso negato: questo account non è autorizzato per l\'Archivio Condiviso. Accedi con l\'account corretto o richiedi un nuovo invito al proprietario.'), 'error');
            if (typeof window.apriCloudModal === 'function') window.apriCloudModal();
        } else if (e.message && e.message.includes('BACKUP_ALTRO_ACCOUNT')) {
            window.impostaErroreCloud(window.testoErroreDrive(e));
            if (!silent) await proponiBackupSuQuestoAccount(window.testoErroreDrive(e));
        } else if (e.message && (e.message.includes('Autenticazione') || e.message.includes('non effettuata') || e.message.includes('effettua l\'accesso'))) {
            if (typeof window.apriCloudModal === 'function') {
                window.apriCloudModal();
            } else if (!silent && typeof mostraMessaggio === 'function') {
                mostraMessaggio(window.t('msg_drive_login_required', 'Accesso a Google Drive richiesto. Apri il menu Cloud per accedere.'), "warning");
            }
        } else {
            window.impostaErroreCloud(window.testoErroreDrive(e));
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t(testi.errore[0], testi.errore[1]) + window.testoErroreDrive(e), "error");
        }
    } finally {
        if (btn) btn.disabled = false;
        if (btnModal && window.impostaStatoCaricamentoCloud) window.impostaStatoCaricamentoCloud(btnModal, false);
        window.toggleSyncProgress(false);
    }
}

window.sincronizzaGoogleDrive = async function(silent = false) {
    if (window.hubConfig) { if (window.sincronizzaConHub) await window.sincronizzaConHub(); return; }
    await sincronizzaDrive(silent, 'sync');
};

window.scaricaDalCloud = async function(silent = false) {
    if (window.hubConfig) { if (window.riceviModificheHub) await window.riceviModificheHub(silent); return; }
    if (!silent && !window.hasFetchedBeforeDownload && typeof window.mostraBottomConfirm === 'function') {
        window.mostraBottomConfirm(window.t("confirm_pull_no_fetch", "Attenzione: stai per scaricare le modifiche dal Cloud senza aver prima verificato di cosa si tratta (Fetch). Vuoi procedere comunque?"), () => {
            eseguiScaricamentoDalCloud(silent);
        });
        return;
    }
    await eseguiScaricamentoDalCloud(silent);
};

async function eseguiScaricamentoDalCloud(silent = false) {
    if (window.driveStatus?.unauthorizedVault) {
        if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_vault_unauthorized', 'Accesso negato: questo account non è autorizzato per l\'Archivio Condiviso.'), 'error');
        return;
    }
    const apiCloud = await window.getApiCloud();
    if (apiCloud) {
        window.toggleSyncProgress(true, 'download_in_progress');
        try {
            const driveData = await apiCloud.pull();
            if (driveData && driveData.database) {
                if (await window.sincronizzaEUnisciDati(driveData.database) === false) return avvisaSyncDriveAnnullata(silent);
                window.lastDriveModifiedTime = driveData.driveModifiedTime;
                await registraSyncAvvenuta(driveData.driveModifiedTime || Date.now());

                try {
                    if (apiCloud.syncAttachments) {
                        await apiCloud.syncAttachments();
                    }
                } catch (attErr) {
                    console.error("Errore sync allegati:", attErr);
                    const testo = window.t('msg_sync_ok_attachments_failed', 'Sincronizzazione DB completata, ma errore negli allegati: ') + window.testoErroreDrive(attErr);
                    window.impostaErroreCloud(testo);
                    if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(testo, "warning");
                    return;
                }
            }
            window.azzeraErroreCloud();
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_scaricamento_completato", 'Scaricamento completato.'), "success");
        } catch (e) {
            console.error(e);
            window.impostaErroreCloud(window.testoErroreDrive(e));
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_lo_scarica", "Errore durante lo scaricamento: ") + window.testoErroreDrive(e), "error");
        } finally {
            window.toggleSyncProgress(false);
            window.hasFetchedBeforeDownload = false;
        }
    }
};

window.caricaSulCloud = async function(silent = false) {
    if (window.hubConfig) { if (window.inviaModificheHub) await window.inviaModificheHub(); return; }
    await sincronizzaDrive(silent, 'upload');
};

window.trasformaInCondiviso = () => trasformaArchivio('shared', 'btn-trasforma-condiviso',
    window.t("prog_conf_shared", "Impostazione Archivio come condiviso…"));
window.trasformaInPersonale = () => trasformaArchivio('backup', 'btn-trasforma-personale',
    window.t("prog_conf_backup", "Impostazione Backup Personale…"));

async function trasformaArchivio(vaultType, idBottone, testoConfigurazione) {
    const btn = document.getElementById(idBottone) as HTMLButtonElement;
    if (window.impostaStatoCaricamentoCloud) window.impostaStatoCaricamentoCloud(btn, true, window.t('btn_activating', 'Attivazione in corso...'));
    else if (btn) btn.disabled = true;

    if (typeof mostraProgressoCloud === 'function') {
        mostraProgressoCloud(window.t("prog_prep_title", "Preparazione in corso"), window.t("prog_prep_auth", "Autenticazione con Google Drive in corso…"));
    }

    try {
        const apiCloud = await window.getApiCloud();
        if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
            await apiCloud.auth();
            await aggiornaStatoDrive();
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_conf_title", "Configurazione in corso"), testoConfigurazione);
        }

        if (window.apiBrowser && window.apiBrowser.setVaultType) {
            await window.apiBrowser.setVaultType({ vaultType, driveAutofetch: true });
            if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
        }

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_sync_title", "Sincronizzazione in corso"), window.t("prog_sync_merge", "Caricamento e unione dei dati sul Cloud (potrebbe volerci un po\')…"));
        }
        await window.sincronizzaGoogleDrive(true);

        if (typeof apriCloudModal === 'function') {
            await apriCloudModal();
        }
    } catch(e) {
        mostraMessaggio(window.t("msg_errore", "Errore: ") + window.testoErroreDrive(e), "error");
    } finally {
        if (window.impostaStatoCaricamentoCloud) window.impostaStatoCaricamentoCloud(btn, false);
        else if (btn) btn.disabled = false;
        if (typeof nascondiProgressoCloud === 'function') {
            nascondiProgressoCloud();
        }
    }
}

window.migraVaultSuHub = async function(skipConfirm = false) {
    if (window.hubConfig) { mostraMessaggio(window.t("msg_gia_su_hub", "Questo archivio è già collegato ad un Hub."), "info"); return; }
    if (typeof window.creaRepositoryHub !== 'function') return;

    const esegui = async () => {
        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_migrate_title", "Migrazione su Hub"), window.t("prog_migrate_pull", "Scarico le ultime modifiche da Google Drive…"));
        }
        try {
            const apiCloud = await window.getApiCloud();
            if (apiCloud && window.driveStatus?.isAuthenticated) {
                let annullato = false;
                try {
                    const driveData = await apiCloud.pull();
                    if (driveData?.database && typeof window.sincronizzaEUnisciDati === 'function') {
                        annullato = await window.sincronizzaEUnisciDati(driveData.database) === false;
                    }
                } catch (e) { console.warn("Pull Drive pre-migrazione fallito (procedo con i dati locali):", e); }
                if (annullato) {
                    if (typeof nascondiProgressoCloud === 'function') nascondiProgressoCloud();
                    mostraMessaggio(window.t("msg_migrazione_hub_annullata", "Migrazione annullata: l'archivio resta su Google Drive."), "info");
                    return;
                }
            }

            if (window.apiSettings) {
                try {
                    await window.apiSettings.patch({ hubJustMigrated: true });
                } catch (e) {}
            }

            const ok = await window.creaRepositoryHub(null);
            if (!ok && typeof nascondiProgressoCloud === 'function') nascondiProgressoCloud();
        } catch (e) {
            if (typeof nascondiProgressoCloud === 'function') nascondiProgressoCloud();
            mostraMessaggio(window.t("msg_errore_migrazione_hub", "Errore durante la migrazione su Hub: ") + (e.message || e), "error");
        }
    };

    if (skipConfirm) { await esegui(); return; }
    const msg = window.t("confirm_migrate_hub", "Vuoi passare questo archivio da Google Drive all'archivio condiviso di ArchiView? I dati e gli allegati verranno caricati online. La connessione a Google Drive resterà come backup, ma dovrai re-invitare i collaboratori con un nuovo link di invito. L'operazione non è reversibile automaticamente.");
    if (typeof mostraBottomConfirm === 'function') mostraBottomConfirm(msg, esegui);
    else if (confirm(msg)) await esegui();
};

window.scollegaCloud = async function(messaggio?) {
    const domanda = typeof messaggio === 'string' && messaggio ? messaggio : null;
    if (window.hubConfig) {
        const scollega = async () => {
            if (typeof mostraProgressoCloud === 'function') {
                mostraProgressoCloud(window.t("prog_disc_title", "Scollegamento"), window.t("prog_disc_desc", "Disattivazione della sincronizzazione Cloud…"));
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
        const msg = domanda || window.t("confirm_disc_cloud", "Vuoi davvero scollegare questo Archivio dal Cloud? I dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l'app tornerà in modalità solo locale per questo progetto.");
        if (typeof mostraBottomConfirm === 'function') mostraBottomConfirm(msg, scollega);
        else if (confirm(msg)) await scollega();
        return;
    }
    const scollegaLegacy = async () => {
        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_disc_title", "Scollegamento"), window.t("prog_disc_desc", "Disattivazione della sincronizzazione Cloud…"));
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
    const msgLegacy = domanda || window.t("confirm_disc_cloud","Vuoi davvero scollegare questo Archivio dal Cloud? I dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l'app tornerà in modalità solo locale per questo progetto.");
    if (typeof mostraBottomConfirm === 'function') mostraBottomConfirm(msgLegacy, scollegaLegacy);
    else if (confirm(window.t("confirm_disc_cloud_short", `Vuoi davvero scollegare questo Archivio dal Cloud?\nI dati rimarranno salvati sul tuo computer, ma non verranno più sincronizzati automaticamente online e l'app tornerà in modalità solo locale per questo progetto.`))) {
        await scollegaLegacy();
    }
}



window.elencaRevisioniCloud = async function() {
    if (!window.apiDrive) throw new Error("Non sei connesso al Cloud.");
    const fileId = await window.apiDrive.getDbFileId();
    const revisions = await window.apiDrive.listRevisions(fileId);
    return { fileId, revisions };
};

window.caricaRevisioneCloud = async function(fileId, revisionId) {
    if (!window.apiDrive) throw new Error("Non sei connesso al Cloud.");
    return await window.apiDrive.getRevision(fileId, revisionId);
};

window.ripristinaRevisioneCloud = async function(fileId, revisionId) {
    const apiCloud = await window.getApiCloud();
    if (!apiCloud) throw new Error("Non sei connesso al Cloud.");
    const revisione = await window.caricaRevisioneCloud(fileId, revisionId);
    if (!revisione || typeof revisione !== 'object' || !Array.isArray(revisione.manoscritti)) {
        throw new Error(window.t("msg_revisione_illeggibile", "La revisione scaricata non è un database leggibile."));
    }
    const driveData = await apiCloud.pull();
    if (driveData && driveData.database) {
        if (await window.sincronizzaEUnisciDati(driveData.database) === false) {
            avvisaSyncDriveAnnullata(false);
            return false;
        }
        window.lastDriveModifiedTime = driveData.driveModifiedTime;
    }
    await window.ripristinaDatabase(revisione);
    return caricaDopoMerge(apiCloud, driveData, true);
};
