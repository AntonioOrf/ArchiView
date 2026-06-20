// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('cloud-modal')) {
            const html = `
    <!-- Modal Cloud & Sincronizzazione -->
    <div id="cloud-modal" class="modal-overlay hidden-tab z-60 fixed inset-0 flex items-center justify-center">
        <div class="modal-window w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div class="modal-header shrink-0 border-b border-stone-200 dark:border-stone-700">
                <h3 class="modal-title text-stone-800 dark:text-stone-100 flex items-center gap-2">
                    <i data-lucide="cloud" class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0"></i> <span data-i18n="modal_cloud_title">Cloud & Condivisione</span>
                </h3>
                <button type="button" onclick="chiudiCloudModal()" class="btn btn-ghost btn-icon"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body p-6 flex-1 overflow-y-auto custom-scroll min-h-0">
                
                <!-- SEZIONE VAULT LOCALE (Non Condiviso) -->
                <div id="cloud-local-section" class="flex flex-col items-center text-center p-6 border border-stone-200 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900/50">
                    <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <i data-lucide="cloud-upload" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-xl font-semibold mb-2"><span data-i18n="modal_cloud_activate_title">Attiva Sincronizzazione Cloud</span></h3>
                    <p class="text-sm text-stone-600 dark:text-stone-400 mb-4 max-w-xl">
                        <span data-i18n="modal_cloud_activate_desc">Scegli se caricare il tuo archivio online o se unirti a uno già esistente tramite codice invito.</span>
                    </p>
                    
                    <div class="flex flex-row gap-8 w-full max-w-2xl mt-4">
                        <!-- Colonna Sinistra: Crea/Carica -->
                        <div class="flex-1 flex flex-col gap-3">
                            <div class="p-5 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 text-left h-full flex flex-col shadow-sm">
                                <h4 class="text-base font-bold text-stone-800 dark:text-stone-200 mb-2 flex items-center gap-2"><i data-lucide="cloud-upload" class="w-5 h-5 text-blue-500"></i> <span data-i18n="modal_cloud_upload_title">Carica nel Cloud</span></h4>
                                <p class="text-sm leading-relaxed text-stone-500 dark:text-stone-400 mb-5"><span data-i18n="modal_cloud_upload_desc">Trasforma questo archivio locale in un archivio cloud per poterlo sincronizzare e condividere.</span></p>
                                
                                <div class="mt-auto flex flex-col gap-3">
                                    <button onclick="trasformaInPersonale()" id="btn-trasforma-personale" class="btn btn-secondary py-2.5 px-4 w-full justify-center text-sm shadow-sm border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700/50">
                                        <i data-lucide="shield-check" class="w-4 h-4 mr-2 text-stone-600 dark:text-stone-300"></i> <span data-i18n="btn_backup_private">Backup Privato</span>
                                    </button>
                                    <button onclick="trasformaInCondiviso()" id="btn-trasforma-condiviso" class="btn btn-primary py-2.5 px-4 w-full justify-center text-sm shadow-md">
                                        <i data-lucide="users" class="w-4 h-4 mr-2"></i> <span data-i18n="btn_shared_archive">Archivio Condiviso</span>
                                    </button>
                                    <button onclick="creaCondivisoAltroAccount()" class="text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-300 mt-1 flex items-center justify-center gap-1.5">
                                        <i data-lucide="user-circle" class="w-4 h-4"></i> <span data-i18n="btn_use_different_account">Usa un account diverso</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Colonna Destra: Unisciti -->
                        <div class="flex-1 flex flex-col gap-3">
                            <div class="p-5 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-700/50 text-left h-full flex flex-col shadow-sm">
                                <h4 class="text-base font-bold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2"><i data-lucide="user-plus" class="w-5 h-5 text-amber-600"></i> <span data-i18n="modal_cloud_join_title">Partecipa</span></h4>
                                <p class="text-sm leading-relaxed text-amber-800 dark:text-amber-200 mb-5"><span data-i18n="modal_cloud_join_desc">Hai ricevuto un invito? Abbandona l'archivio locale attuale per unirti a quello condiviso da un tuo collaboratore.</span></p>
                                <button onclick="uniscitiDaCloudModal()" class="btn w-full justify-center py-3 text-base font-medium shadow-sm text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-800/60 mt-auto">
                                    <span data-i18n="btn_join_archive">Unisciti a un Archivio</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="cloud-transform-status" class="mt-4 text-sm font-medium text-blue-600 hidden-tab"><span data-i18n="msg_operation_progress">Operazione in corso</span>...</div>
                </div>

                <!-- SEZIONE VAULT CONDIVISO/PERSONALE ATTIVO -->
                <div id="cloud-shared-section" class="hidden-tab flex flex-col gap-5 p-6 border rounded-md transition-colors duration-300">
                    
                    <!-- RIGA TOP: Icona + titolo + desc orizzontali -->
                    <div class="flex items-center gap-4">
                        <div id="cloud-active-icon-wrapper" class="w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300">
                            <i id="cloud-active-icon" data-lucide="cloud" class="w-7 h-7"></i>
                        </div>
                        <div class="flex-1 min-w-0 text-left">
                            <h3 class="text-lg font-bold" id="cloud-active-title"><span data-i18n="modal_cloud_active_title">Cloud Attivo</span></h3>
                            <p class="text-sm transition-colors duration-300" id="cloud-active-desc"><span data-i18n="modal_cloud_active_desc">Questo Archivio è sincronizzato.</span></p>
                        </div>
                        <button onclick="sincronizzaGoogleDrive()" id="btn-cloud-drive-sync" class="btn btn-primary px-5 py-2.5 font-medium shrink-0">
                            <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> <span data-i18n="btn_sync_now">Sincronizza Ora</span>
                        </button>
                    </div>

                    <!-- CORPO A DUE COLONNE -->
                    <div class="grid grid-cols-2 gap-5 items-start">

                        <!-- COLONNA SINISTRA: Impostazioni e azioni avanzate -->
                        <div class="flex flex-col gap-3">
                            <div class="flex items-center gap-2 p-3 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/40">
                                <input type="checkbox" id="cloud-sync-attachments" onchange="toggleSyncAttachments(this.checked)" class="w-4 h-4 text-blue-600 rounded border-stone-300 shrink-0">
                                <label for="cloud-sync-attachments" class="text-sm cursor-pointer leading-snug" style="color: var(--color-text-main);"><span data-i18n="label_sync_attachments">Sincronizza allegati automaticamente (PDF/Immagini)</span></label>
                            </div>

                            <div class="flex flex-col gap-1.5 pt-1">
                                <p class="text-[10px] font-semibold uppercase tracking-wider text-stone-400 px-1"><span data-i18n="label_advanced_options">Opzioni avanzate</span></p>
                                <button onclick="trasformaInPersonale()" id="btn-switch-personal" class="btn btn-ghost justify-start py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
                                    <i data-lucide="shield" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_convert_backup_private">Converti in Backup Privato</span>
                                </button>
                                <button onclick="trasformaInCondiviso()" id="btn-switch-shared" class="btn btn-ghost justify-start py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                                    <i data-lucide="users" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_convert_shared">Converti in Archivio Condiviso</span>
                                </button>
                                <button onclick="cambiaAccountGoogleVault()" id="btn-cloud-change-account" class="btn btn-ghost justify-start py-2 text-sm text-stone-500 hover:text-blue-600 dark:hover:text-blue-400">
                                    <i data-lucide="user-plus" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_use_another_account">Usa un altro account Google</span>
                                </button>
                                <button onclick="uniscitiDaCloudModal()" class="btn btn-ghost justify-start py-2 text-sm text-stone-500 hover:text-amber-600 dark:hover:text-amber-400">
                                    <i data-lucide="log-in" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_join_another">Unisciti a un altro Archivio</span>
                                </button>
                                <button onclick="pulisciAllegatiOrfani()" id="btn-cloud-clean-orphans" class="btn btn-ghost justify-start py-2 text-sm text-stone-500 hover:text-red-600 dark:hover:text-red-400">
                                    <i data-lucide="trash-2" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_clean_ghosts">Pulisci file inutilizzati</span>
                                </button>
                                <button onclick="scollegaCloud()" id="btn-disconnect-cloud" class="btn btn-ghost justify-start py-2 text-sm text-stone-400 hover:text-red-600 dark:hover:text-red-400">
                                    <i data-lucide="unlink" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_disconnect_cloud">Scollega dal Cloud</span>
                                </button>
                            </div>
                        </div>

                        <!-- COLONNA DESTRA: Stepper collaboratori -->
                        <!-- COLONNA DESTRA: Gestione collaboratori -->
                        <div id="cloud-invite-container" class="flex flex-col gap-0 rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden bg-white dark:bg-stone-900 shadow-sm">
                            <!-- TABS HEADER -->
                            <div class="flex border-b border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800/60">
                                <button onclick="mostraTabCloud('invite')" id="tab-cloud-invite" class="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 border-b-2 border-emerald-500 bg-white dark:bg-stone-900 transition-colors"><span data-i18n="tab_add">Aggiungi</span></button>
                                <button onclick="mostraTabCloud('members')" id="tab-cloud-members" class="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider text-stone-500 border-b-2 border-transparent hover:text-stone-700 dark:hover:text-stone-300 transition-colors"><span data-i18n="tab_members">Membri</span></button>
                            </div>

                            <!-- TAB INVITE CONTENT -->
                            <div id="cloud-tab-invite-content" class="flex flex-col bg-emerald-50/50 dark:bg-emerald-900/10">
                                <div class="flex flex-col gap-0">
                                    <!-- STEP 1: Email → autorizzazione Drive -->
                                    <div class="flex items-start gap-3 p-4 border-b border-emerald-100 dark:border-emerald-900/40">
                                        <div class="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                                        <div class="flex-1 flex flex-col gap-2">
                                            <p class="text-xs font-semibold text-stone-800 dark:text-stone-100"><span data-i18n="cloud_step1_title">Grant Access to Google Drive</span></p>
                                            <p class="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed"><span data-i18n="cloud_step1_desc">The collaborator will receive an email from Google authorizing access to the shared folder.</span></p>
                                            <button onclick="invitaTramiteEmail()" id="btn-cloud-share-email" class="btn btn-secondary py-2 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30 justify-center">
                                                <i data-lucide="mail-plus" class="w-3.5 h-3.5 mr-1.5"></i> <span data-i18n="btn_invite_email">Invite via Email</span>
                                            </button>
                                        </div>
                                    </div>
                                    <!-- STEP 2: Link archiview:// per config Pusher -->
                                    <div class="flex items-start gap-3 p-4">
                                        <div class="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                                        <div class="flex-1 flex flex-col gap-2">
                                            <p class="text-xs font-semibold text-stone-800 dark:text-stone-100"><span data-i18n="cloud_step2_title">Share the ArchiView Link</span></p>
                                            <p class="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed"><span data-i18n="cloud_step2_desc">The collaborator pastes this link in ArchiView to complete setup and enable real-time sync.</span></p>
                                            <div class="flex gap-1.5">
                                                <input type="text" id="cloud-invite-code" class="form-input flex-1 text-[11px] font-mono bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hidden-tab" readonly placeholder="Generazione link...">
                                                <button id="btn-copy-invite" onclick="copiaCodiceInvito()" class="btn btn-secondary px-2.5 shrink-0 border-stone-300 dark:border-stone-600 hidden-tab" title="Copia link">
                                                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                                                </button>
                                            </div>
                                            <p class="text-[10px] text-stone-400 dark:text-stone-500 leading-snug"><span data-i18n="cloud_step2_hint">The recipient goes to <em>Join an Archive</em> and pastes this link in the Step 1 field.</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- TAB MEMBERS CONTENT -->
                            <div id="cloud-tab-members-content" class="hidden flex-col h-full bg-stone-50/50 dark:bg-stone-900/20">
                                <div class="p-3 text-[11px] text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-700 bg-stone-100/50 dark:bg-stone-800/40">
                                    <span data-i18n="modal_cloud_members_desc">Elenco di chi ha accesso a questo Archivio.</span>
                                </div>
                                <div id="cloud-members-list" class="flex flex-col overflow-y-auto custom-scroll p-2 gap-1 max-h-[250px]">
                                    <!-- Lista popolata via JS -->
                                    <div class="text-center p-4 text-stone-400"><i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto"></i></div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                </div>
            </div>
        </div>
    </div>
    
    <!-- OVERLAY PROGRESSO CLOUD -->
    <div id="cloud-progress-overlay" class="modal-overlay hidden-tab z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-2xl p-6 text-center max-w-sm w-full">
            <svg class="animate-spin w-12 h-12 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <h3 class="text-lg font-bold mb-2 text-stone-800 dark:text-stone-100" id="cloud-progress-title"><span data-i18n="msg_operation_progress">Operazione in corso</span></h3>
            <p class="text-sm text-stone-600 dark:text-stone-400" id="cloud-progress-message"><span data-i18n="msg_please_wait">Attendere prego...</span></p>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });

    function chiediConfermaAccessoCloud() {
        return new Promise((resolve) => {
            const html = `
                <div id="cloud-auth-modal" class="modal-overlay z-150 flex" style="background: rgba(0,0,0,0.5); align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
                    <div class="modal-window p-6 text-center max-w-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-xl">
                        <i data-lucide="cloud" class="w-12 h-12 text-blue-500 mx-auto mb-4"></i>
                        <h3 class="text-xl font-bold mb-2 text-stone-800 dark:text-stone-100"><span data-i18n="modal_cloud_auth">Autenticazione Cloud</span></h3>
                        <p class="text-sm text-stone-600 dark:text-stone-400 mb-6">
                            <span data-i18n="modal_cloud_auth_desc">Accedi con il tuo account per sincronizzare questo Archivio.</span>
                        </p>
                        <div class="flex flex-col gap-3">
                            <button id="btn-cloud-auth-google" class="btn btn-secondary w-full justify-center text-lg flex items-center gap-2">
                                <i data-lucide="hard-drive" class="w-5 h-5"></i> <span data-i18n="btn_login_google">Accedi con Google</span>
                            </button>
                            <div class="mt-4 border-t border-stone-200 dark:border-stone-700 pt-4">
                                <button id="btn-cloud-auth-no" class="btn btn-ghost w-full justify-center"><span data-i18n="btn_cancel">Annulla</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
            if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('cloud-auth-modal')] });

            const modal = document.getElementById('cloud-auth-modal');
            document.getElementById('btn-cloud-auth-google').onclick = () => {
                modal.remove();
                resolve('google');
            };
            document.getElementById('btn-cloud-auth-no').onclick = () => {
                modal.remove();
                resolve(false);
            };
        });
    }

    function chiediConfermaAzione(titolo, messaggio, testoConferma = window.t("btn_procedi", "Procedi")) {
        return new Promise((resolve) => {
            const id = 'confirm-modal-' + Date.now();
            const html = `
                <div id="${id}" class="modal-overlay z-250 flex items-center justify-center bg-black/50 backdrop-blur-sm fixed inset-0">
                    <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-2xl p-6 w-full max-w-md">
                        <h3 class="text-lg font-bold mb-2 text-stone-800 dark:text-stone-100 flex items-center gap-2">
                            <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-500"></i> ${titolo}
                        </h3>
                        <p class="text-sm text-stone-600 dark:text-stone-400 mb-6">${messaggio}</p>
                        <div class="flex justify-end gap-3">
                            <button id="btn-cancel-${id}" class="btn btn-ghost text-sm"><span data-i18n="btn_cancel">Annulla</span></button>
                            <button id="btn-confirm-${id}" class="btn btn-primary text-sm">${testoConferma}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
            if (window.lucide) lucide.createIcons({ nodes: [document.getElementById(id)] });
            
            const modal = document.getElementById(id);
            document.getElementById(`btn-cancel-${id}`).onclick = () => {
                modal.remove();
                resolve(false);
            };
            document.getElementById(`btn-confirm-${id}`).onclick = () => {
                modal.remove();
                resolve(true);
            };
        });
    }

    window.creaCondivisoAltroAccount = async function() {
        if (!window.apiDrive) return;
        const confirm = await chiediConfermaAzione(window.t("btn_use_another_account", "Use another Google account"), window.t("confirm_use_another_account", "You will be redirected to the browser to sign in with another Google account. This account will be used ONLY for this shared Archive. Do you want to proceed?"));
        if (confirm) {
            mostraProgressoCloud(window.t("prog_auth_title", "Autenticazione in corso"), window.t("prog_auth_desc1", "Accedi con l\'account Google desiderato nel browser..."));
            try {
                await window.apiDrive.auth(true);
                await window.aggiornaStatoDrive();
                if (typeof window.trasformaInCondiviso === 'function') {
                    window.trasformaInCondiviso();
                }
            } catch (e) {
                mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
                nascondiProgressoCloud();
            }
        }
    };

    window.cambiaAccountGoogleVault = async function() {
        if (!window.apiDrive) return;
        const confirm = await chiediConfermaAzione(window.t("msg_dlg_cambia_account_google", "Cambia account Google"), window.t("msg_dlg_questo_forzer_l_uso_d", "Questo forzerà l'uso di un account Google specifico SOLO per questo Archivio. Vuoi procedere?"));
        if (confirm) {
            mostraProgressoCloud(window.t("prog_auth_title", "Autenticazione in corso"), window.t("prog_auth_desc2", "Accedi con il nuovo account nel browser..."));
            try {
                await window.apiDrive.auth(true);
                await window.aggiornaStatoDrive();
            } catch (e) {
                mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
            } finally {
                nascondiProgressoCloud();
            }
        }
    };

    window.apriCloudModal = async function() {
        if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
            const provider = await chiediConfermaAccessoCloud();
            if (provider === 'google' || provider === 'microsoft') {
                if (window.apiSettings) {
                    const settings = await window.apiSettings.get();
                    settings.cloudProvider = provider;
                    await window.apiSettings.save(settings);
                }
                await window.loginCloud(provider);
                if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
                    return; // L'utente non ha completato l'accesso
                }
            } else {
                return; // L'utente ha annullato
            }
        }

        if (window.apiSettings) {
            window.apiSettings.get().then(settings => {
                const localSection = document.getElementById('cloud-local-section');
                const sharedSection = document.getElementById('cloud-shared-section');
                
                if (settings.isSharedVault || settings.isPersonalCloud) {
                    if (localSection) localSection.classList.add('hidden-tab');
                    if (sharedSection) sharedSection.classList.remove('hidden-tab');
                    
                    const title = document.getElementById('cloud-active-title');
                    const desc = document.getElementById('cloud-active-desc');
                    const inviteContainer = document.getElementById('cloud-invite-container');
                    const btnSwitchPersonal = document.getElementById('btn-switch-personal');
                    const btnSwitchShared = document.getElementById('btn-switch-shared');
                    const btnShareEmail = document.getElementById('btn-cloud-share-email');
                    const section = document.getElementById('cloud-shared-section');
                    const iconWrapper = document.getElementById('cloud-active-icon-wrapper');
                    const icon = document.getElementById('cloud-active-icon');
                    
                    if (settings.isPersonalCloud) {
                        if (title) title.innerHTML = "<span data-i18n='modal_cloud_backup_active'>Backup Personale Attivo</span>";
                        if (desc) {
                            desc.innerHTML = "<span data-i18n='modal_cloud_backup_desc'>Questo Archivio è sincronizzato nel tuo Cloud privato. Nessun altro ha accesso.</span>";
                            desc.className = "text-sm mb-6 max-w-md transition-colors duration-300 text-blue-800 dark:text-blue-300";
                        }
                        if (inviteContainer) inviteContainer.style.display = 'none';
                        if (btnSwitchPersonal) btnSwitchPersonal.style.display = 'none';
                        if (btnSwitchShared) btnSwitchShared.style.display = '';
                        if (btnShareEmail) btnShareEmail.style.display = 'none';
                        
                        if (section) section.className = "flex flex-col items-center text-center p-6 border rounded-md transition-colors duration-300 border-blue-200 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-900/20";
                        if (iconWrapper) iconWrapper.className = "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors duration-300 bg-blue-100 text-blue-600";
                        if (icon) icon.setAttribute('data-lucide', 'shield-check');
                        
                    } else {
                        if (title) title.innerHTML = "<span data-i18n='modal_cloud_shared_active'>Archivio Condiviso Attivo</span>";
                        if (desc) {
                            desc.innerHTML = "<span data-i18n='modal_cloud_shared_desc'>Questo Archivio è sincronizzato sul Cloud. Usa \"Invita tramite Email\" per autorizzare i collaboratori, poi condividi questo codice per configurarli.</span>";
                            desc.className = "text-sm mb-6 max-w-md transition-colors duration-300 text-stone-700 dark:text-amber-300";
                        }
                        if (inviteContainer) inviteContainer.style.display = 'flex';
                        if (btnSwitchShared) btnSwitchShared.style.display = 'none';
                        if (btnSwitchPersonal) btnSwitchPersonal.style.display = '';
                        if (btnShareEmail) btnShareEmail.style.display = '';
                        
                        if (section) section.className = "flex flex-col items-center text-center p-6 border rounded-md transition-colors duration-300 border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/20";
                        if (iconWrapper) iconWrapper.className = "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors duration-300 bg-amber-100 text-amber-600";
                        if (icon) icon.setAttribute('data-lucide', 'users');
                        
                        // Genera subito il codice per mostrarlo solo se è condiviso
                        generaCodiceInvito();
                    }
                    
                    const cbAttachments = document.getElementById('cloud-sync-attachments');
                    if (cbAttachments) cbAttachments.checked = settings.syncAttachments !== false; // Default true
                } else {
                    if (localSection) localSection.classList.remove('hidden-tab');
                    if (sharedSection) sharedSection.classList.add('hidden-tab');
                }
                if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
            });
        }
        
        const modal = document.getElementById('cloud-modal');
        modal.classList.remove('hidden-tab');
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
    };

    window.toggleSyncAttachments = async function(checked) {
        if (window.apiSettings) {
            const settings = await window.apiSettings.get();
            settings.syncAttachments = checked;
            await window.apiSettings.save(settings);
        }
    };

    window.chiudiCloudModal = function() {
        document.getElementById('cloud-modal').classList.add('hidden-tab');
    };

    window.uniscitiDaCloudModal = async function() {
        if (window.chiudiCloudModal) window.chiudiCloudModal();
        if (window.mostraWelcomeModal) await window.mostraWelcomeModal();
        if (window.mostraJoinForm) window.mostraJoinForm();
    };

    window.generaCodiceInvito = async function() {
        try {
            if(!window.apiDrive) return;
            const code = await window.apiDrive.generateInvite();
            const input = document.getElementById('cloud-invite-code');
            const btnCopy = document.getElementById('btn-copy-invite');
            if (input && btnCopy) {
                input.value = `archiview://join/${code}`;
                input.classList.remove('hidden-tab');
                btnCopy.classList.remove('hidden-tab');
            }
        } catch(e) {
            mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
        }
    };

    window.toggleManualInvite = function() {
        const sec = document.getElementById('manual-invite-section');
        if (sec) {
            sec.classList.toggle('hidden');
        }
    };

    window.mostraTabCloud = function(tab) {
        const btnInvite = document.getElementById('tab-cloud-invite');
        const btnMembers = document.getElementById('tab-cloud-members');
        const contInvite = document.getElementById('cloud-tab-invite-content');
        const contMembers = document.getElementById('cloud-tab-members-content');
        
        if (!btnInvite || !btnMembers || !contInvite || !contMembers) return;
        
        if (tab === 'invite') {
            btnInvite.className = "flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 border-b-2 border-emerald-500 bg-white dark:bg-stone-900 transition-colors";
            btnMembers.className = "flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider text-stone-500 border-b-2 border-transparent hover:text-stone-700 dark:hover:text-stone-300 transition-colors";
            contInvite.classList.remove('hidden');
            contInvite.classList.add('flex');
            contMembers.classList.add('hidden');
            contMembers.classList.remove('flex');
        } else {
            btnMembers.className = "flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 border-b-2 border-blue-500 bg-white dark:bg-stone-900 transition-colors";
            btnInvite.className = "flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider text-stone-500 border-b-2 border-transparent hover:text-stone-700 dark:hover:text-stone-300 transition-colors";
            contMembers.classList.remove('hidden');
            contMembers.classList.add('flex');
            contInvite.classList.add('hidden');
            contInvite.classList.remove('flex');
            
            caricaMembriCloud();
        }
    };

    window.caricaMembriCloud = async function() {
        const list = document.getElementById('cloud-members-list');
        if (!list) return;
        list.innerHTML = window.sanitizeHTML('<div class="text-center p-4 text-stone-400"><i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto"></i></div>');
        if (window.lucide) lucide.createIcons({ nodes: [list] });
        
        try {
            if (!window.apiDrive || !window.apiDrive.listPermissions) throw new Error("API non disponibile");
            const members = await window.apiDrive.listPermissions();
            list.innerHTML = window.sanitizeHTML('');
            
            // Assicuriamoci che la funzione di fallback sia globale
            if (!window.fallbackCloudAvatar) {
                window.fallbackCloudAvatar = function(img) {
                    img.outerHTML = '<div class="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center shrink-0"><i data-lucide="user" class="w-4 h-4 text-stone-500"></i></div>';
                    if (window.lucide) lucide.createIcons();
                };
            }
            
            if (!members || members.length === 0) {
                list.innerHTML = window.sanitizeHTML(`<div class="text-center p-4 text-xs text-stone-500">${window.t("cloud_no_members", "No members found.")}</div>`);
                return;
            }

            members.forEach(m => {
                const isOwner = m.role === 'owner';
                const photoUrl = m.photoLink && m.photoLink.startsWith('//') ? 'https:' + m.photoLink : m.photoLink;
                const fallbackAvatar = `<div class="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center shrink-0"><i data-lucide="user" class="w-4 h-4 text-stone-500"></i></div>`;
                const avatar = photoUrl
                    ? `<img src="${photoUrl}" onerror="window.fallbackCloudAvatar(this)" class="w-8 h-8 rounded-full border border-stone-200 dark:border-stone-700 shrink-0 object-cover">`
                    : fallbackAvatar;

                const roleBadge = isOwner
                    ? `<span class="text-[9px] px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold uppercase tracking-wide">${window.t("cloud_role_owner", "Owner")}</span>`
                    : `<span class="text-[9px] px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold uppercase tracking-wide">${window.t("cloud_role_collaborator", "Collaborator")}</span>`;

                const actionBtn = isOwner ? '' : `
                    <button onclick="rimuoviMembroCloud('${m.id}', '${(m.displayName || m.emailAddress || '').replace(/'/g, "\\'")}')" class="btn btn-ghost text-stone-400 hover:text-red-600 dark:hover:text-red-400 p-1.5" title="${window.t("btn_remove_access", "Remove Access")}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                `;

                const html = `
                    <div class="flex items-center gap-3 p-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md">
                        ${avatar}
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">${m.displayName || window.t("cloud_user_fallback", "User")}</span>
                                ${roleBadge}
                            </div>
                            <div class="text-[10px] text-stone-500 dark:text-stone-400 truncate">${m.emailAddress || ''}</div>
                        </div>
                        ${actionBtn}
                    </div>
                `;
                list.insertAdjacentHTML('beforeend', html);
            });
            if (window.lucide) lucide.createIcons({ nodes: [list] });
        } catch(e) {
            list.innerHTML = window.sanitizeHTML(`<div class="text-center p-4 text-xs text-red-500">${window.t("msg_errore", "Error: ")}${e.message}</div>`);
        }
    };

    window.rimuoviMembroCloud = async function(permissionId, nome) {
        const confirmResult = await chiediConfermaAzione(
            window.t("modal_confirm_action", "Confirm Action"),
            window.t("confirm_remove_access", "Are you sure you want to remove access for {var0}?").replace("{var0}", String(nome)),
            window.t("btn_delete", "Delete")
        );
        if (!confirmResult) return;
        
        mostraMessaggio(window.t("msg_rimozione_di_var_in_corso", "Rimozione di {var0} in corso...").replace("{var0}", String(nome)), "info");
        try {
            await window.apiDrive.removePermission(permissionId);
            mostraMessaggio(window.t("msg_var_stato_rimosso_con_suc", "{var0} è stato rimosso con successo.").replace("{var0}", String(nome)), "success");
            caricaMembriCloud(); // ricarica la lista
        } catch(e) {
            mostraMessaggio(window.t("msg_errore_durante_la_rimozio", "Errore durante la rimozione: {var0}").replace("{var0}", String(e.message)), "error");
        }
    };

    window.copiaCodiceInvito = function() {
        const input = document.getElementById('cloud-invite-code');
        input.select();
        document.execCommand("copy");
        mostraMessaggio(window.t("msg_codice_copiato_negli_appu", "Codice copiato negli appunti!"), "success");
    };

    window.invitaTramiteEmail = async function() {
        const email = await new Promise((resolve) => {
            const html = `
                <div id="email-prompt-modal" class="modal-overlay z-250 flex items-center justify-center bg-black/50 backdrop-blur-sm fixed inset-0">
                    <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-2xl p-6 w-full max-w-md">
                        <h3 class="text-lg font-bold mb-2 text-stone-800 dark:text-stone-100 flex items-center gap-2">
                            <i data-lucide="mail" class="w-5 h-5 text-blue-500"></i> ${window.t("label_email", "Email Address")}
                        </h3>
                        <p class="text-sm text-stone-600 dark:text-stone-400 mb-4">${window.t("cloud_invite_email_desc", "Enter the Google email address of the person to invite to the Archive:")}</p>
                        <input type="email" id="email-prompt-input" class="form-input w-full mb-6" placeholder="email@gmail.com">
                        <div class="flex justify-end gap-3">
                            <button id="email-prompt-cancel" class="btn btn-ghost text-sm"><span data-i18n="btn_cancel">Annulla</span></button>
                            <button id="email-prompt-confirm" class="btn btn-primary text-sm"><span data-i18n="btn_send_invite">Invia Invito</span></button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
            if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('email-prompt-modal')] });
            
            const modal = document.getElementById('email-prompt-modal');
            const input = document.getElementById('email-prompt-input');
            const btnCancel = document.getElementById('email-prompt-cancel');
            const btnConfirm = document.getElementById('email-prompt-confirm');
            
            // Focus input after rendering
            setTimeout(() => input.focus(), 50);
            
            const close = (val) => {
                modal.remove();
                resolve(val);
            };
            
            btnCancel.onclick = () => close(null);
            btnConfirm.onclick = () => close(input.value);
            input.onkeydown = (e) => { if(e.key === 'Enter') close(input.value); if(e.key === 'Escape') close(null); };
        });

        if (!email || !email.includes('@')) return;
        
        mostraProgressoCloud(window.t("prog_invite_title", "Invio invito in corso"), window.t("prog_invite_desc", "Assegnazione dei permessi su Google Drive..."));
        try {
            await window.apiDrive.shareVault(email.trim());
            mostraMessaggio(window.t("msg_invito_inviato_con_succes", "Invito inviato con successo a {var0}!").replace("{var0}", String(email)), "success");
        } catch(e) {
            mostraMessaggio(e.message, "error");
        } finally {
            nascondiProgressoCloud();
        }
    };

    window.pulisciAllegatiOrfani = async function() {
        const confirm = await chiediConfermaAzione(window.t("btn_clean_ghosts", "Clean Ghost Files"), window.t("confirm_clean_orphans_desc", "This operation will permanently delete from your PC and Google Drive all attachments no longer associated with any record in the current database. Do you want to proceed?"), window.t("btn_delete_orphans", "Delete orphan files"));
        if (!confirm) {
            return;
        }
        
        const btn = document.getElementById('btn-cloud-clean-orphans');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = window.sanitizeHTML(`<i class="w-4 h-4 mr-2">⏳</i> ${window.t("cloud_cleaning_in_progress", "Cleaning in progress...")}`);
        
        try {
            if (!window.getApiCloud || !window.getApiCloud().pulisciAllegatiOrfani) {
                throw new Error("Funzione non disponibile.");
            }
            const result = await window.getApiCloud().pulisciAllegatiOrfani();
            mostraMessaggio(window.t("msg_pulizia_completata_file_r", "Pulizia completata! File rimossi: {var0} in locale, {var1} su Drive.").replace("{var0}", String(result.deletedLocal)).replace("{var1}", String(result.deletedDrive)), "success");
        } catch(e) {
            mostraMessaggio(window.t("msg_errore_durante_la_pulizia", "Errore durante la pulizia: ") + e.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = window.sanitizeHTML(originalText);
            if (window.lucide) window.lucide.createIcons({ nodes: [btn] });
        }
    };

    window.mostraProgressoCloud = function(titolo, messaggio) {
        const overlay = document.getElementById('cloud-progress-overlay');
        const titleEl = document.getElementById('cloud-progress-title');
        const msgEl = document.getElementById('cloud-progress-message');
        
        if (titleEl && titolo) titleEl.textContent = titolo;
        if (msgEl && messaggio) msgEl.textContent = messaggio;
        if (overlay) overlay.classList.remove('hidden-tab');
    };

    window.nascondiProgressoCloud = function() {
        const overlay = document.getElementById('cloud-progress-overlay');
        if (overlay) overlay.classList.add('hidden-tab');
    };

})();
