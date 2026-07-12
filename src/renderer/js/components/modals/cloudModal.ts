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
                    <i data-lucide="shield-check" class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0"></i> <span data-i18n="modal_cloud_title">Backup su Google Drive</span>
                </h3>
                <button type="button" onclick="chiudiCloudModal()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body p-6 flex-1 overflow-y-auto custom-scroll min-h-0">

                <!-- SEZIONE VAULT LOCALE (Non Condiviso) -->
                <div id="cloud-local-section" class="flex flex-col items-center text-center p-6 border border-stone-200 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900/50">
                    <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <i data-lucide="shield-check" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-xl font-semibold mb-2"><span data-i18n="modal_cloud_activate_title">Backup personale su Google Drive</span></h3>
                    <p class="text-sm text-stone-600 dark:text-stone-400 mb-4 max-w-xl">
                        <span data-i18n="modal_cloud_activate_desc">Copia privata dell'archivio sul tuo Google Drive. Per lavorare insieme ai colleghi usa invece "Condividi questo archivio" dalla barra laterale.</span>
                    </p>
                    <div class="w-full max-w-md">
                        <button onclick="trasformaInPersonale()" id="btn-trasforma-personale" class="btn py-2.5 px-4 w-full justify-center text-sm shadow-sm text-white bg-blue-600 hover:bg-blue-700 border border-blue-700">
                            <i data-lucide="shield-check" class="w-4 h-4 mr-2"></i> <span data-i18n="btn_backup_private">Backup Personale (Google Drive)</span>
                        </button>
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

                            <details class="pt-1">
                                <summary class="text-[10px] font-semibold uppercase tracking-wider text-stone-400 px-1 cursor-pointer select-none"><span data-i18n="label_advanced_options">Opzioni avanzate</span></summary>
                                <div class="flex flex-col gap-1.5 mt-1.5">
                                    <button onclick="trasformaInPersonale()" id="btn-switch-personal" class="btn btn-ghost justify-start py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
                                        <i data-lucide="shield" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_convert_backup_private">Converti in Backup Personale</span>
                                    </button>
                                    <button onclick="migraVaultSuHub()" id="btn-migrate-hub" class="btn btn-ghost justify-start py-2 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                                        <i data-lucide="server" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_migrate_hub">Passa all'archivio condiviso</span>
                                    </button>
                                    <button onclick="cambiaAccountGoogleVault()" id="btn-cloud-change-account" class="btn btn-ghost justify-start py-2 text-sm text-stone-500 hover:text-blue-600 dark:hover:text-blue-400">
                                        <i data-lucide="user-plus" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_use_another_account">Usa un altro account Google</span>
                                    </button>
                                    <button onclick="pulisciAllegatiOrfani()" id="btn-cloud-clean-orphans" class="btn btn-ghost justify-start py-2 text-sm text-stone-500 hover:text-red-600 dark:hover:text-red-400">
                                        <i data-lucide="trash-2" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_clean_ghosts">Pulisci file inutilizzati</span>
                                    </button>
                                    <button onclick="scollegaCloud()" id="btn-disconnect-cloud" class="btn btn-ghost justify-start py-2 text-sm text-stone-400 hover:text-red-600 dark:hover:text-red-400">
                                        <i data-lucide="unlink" class="w-4 h-4 mr-2 shrink-0"></i> <span data-i18n="btn_disconnect_cloud">Scollega dal Cloud</span>
                                    </button>
                                </div>
                            </details>
                        </div>

                        <!-- COLONNA DESTRA: stato/riepilogo -->
                        <div class="flex flex-col gap-3 p-4 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/20 text-sm text-stone-600 dark:text-stone-400">
                            <p class="flex items-start gap-2"><i data-lucide="info" class="w-4 h-4 shrink-0 mt-0.5 text-stone-400"></i> <span data-i18n="cloud_backup_hint">Questo è un backup personale sul tuo Cloud privato. Per collaborare con altri, usa un archivio condiviso.</span></p>
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

    window.cambiaAccountGoogleVault = async function() {
        if (!window.apiDrive) return;
        const esegui = async () => {
            mostraProgressoCloud(window.t("prog_auth_title", "Autenticazione in corso"), window.t("prog_auth_desc2", "Accedi con il nuovo account nel browser..."));
            try {
                await window.apiDrive.auth(true);
                await window.aggiornaStatoDrive();
            } catch (e) {
                mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
            } finally {
                nascondiProgressoCloud();
            }
        };
        const msg = window.t("msg_dlg_questo_forzer_l_uso_d", "Questo forzerà l'uso di un account Google specifico SOLO per questo Archivio. Vuoi procedere?");
        if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, esegui);
        else if (confirm(msg)) await esegui();
    };

    window.apriCloudModal = async function() {
        // Questo modal gestisce solo il backup personale su Google Drive e i vault Drive
        // condivisi legacy: i vault Hub vivono esclusivamente nel modal Condivisione.
        if (window.hubConfig && typeof window.apriShareModal === 'function') {
            return window.apriShareModal();
        }
        // Google serve solo per il backup personale: l'accesso viene richiesto
        // on-demand da trasformaInPersonale(), non all'apertura del modal.

        if (window.apiSettings) {
            Promise.all([
                window.apiSettings.get(),
                window.apiBrowser.getVaultConfig ? window.apiBrowser.getVaultConfig() : Promise.resolve({ vaultType: 'local' })
            ]).then(([settings, vaultConfig]) => {
                const localSection = document.getElementById('cloud-local-section');
                const sharedSection = document.getElementById('cloud-shared-section');

                if (vaultConfig.vaultType !== 'local') {
                    if (localSection) localSection.classList.add('hidden-tab');
                    if (sharedSection) sharedSection.classList.remove('hidden-tab');

                    const title = document.getElementById('cloud-active-title');
                    const desc = document.getElementById('cloud-active-desc');
                    const btnSwitchPersonal = document.getElementById('btn-switch-personal');
                    const section = document.getElementById('cloud-shared-section');
                    const iconWrapper = document.getElementById('cloud-active-icon-wrapper');
                    const icon = document.getElementById('cloud-active-icon');

                    if (vaultConfig.vaultType === 'backup') {
                        if (title) title.innerHTML = "<span data-i18n='modal_cloud_backup_active'>Backup Personale Attivo</span>";
                        if (desc) {
                            desc.innerHTML = "<span data-i18n='modal_cloud_backup_desc'>Questo Archivio è sincronizzato nel tuo Cloud privato. Nessun altro ha accesso.</span>";
                            desc.className = "text-sm mb-6 max-w-md transition-colors duration-300 text-blue-800 dark:text-blue-300";
                        }
                        if (btnSwitchPersonal) btnSwitchPersonal.style.display = 'none';

                        if (section) section.className = "flex flex-col items-center text-center p-6 border rounded-md transition-colors duration-300 border-blue-200 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-900/20";
                        if (iconWrapper) iconWrapper.className = "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors duration-300 bg-blue-100 text-blue-600";
                        if (icon) icon.setAttribute('data-lucide', 'shield-check');

                    } else {
                        // Vault Drive condiviso legacy: la collaborazione è passata all'Hub, si punta alla migrazione.
                        if (title) title.innerHTML = "<span data-i18n='modal_cloud_shared_active'>Archivio Condiviso Attivo</span>";
                        if (desc) {
                            desc.innerHTML = "<span data-i18n='modal_cloud_shared_legacy_desc'>Archivio condiviso su Google Drive (legacy). Migra su Hub per inviti revocabili e sincronizzazione in tempo reale.</span>";
                            desc.className = "text-sm mb-6 max-w-md transition-colors duration-300 text-stone-700 dark:text-amber-300";
                        }
                        if (btnSwitchPersonal) btnSwitchPersonal.style.display = '';

                        if (section) section.className = "flex flex-col items-center text-center p-6 border rounded-md transition-colors duration-300 border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/20";
                        if (iconWrapper) iconWrapper.className = "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors duration-300 bg-amber-100 text-amber-600";
                        if (icon) icon.setAttribute('data-lucide', 'users');
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

    window.pulisciAllegatiOrfani = async function() {
        const confirmed = await new Promise((resolve) => {
            const msg = window.t("confirm_clean_orphans_desc", "Questa operazione eliminerà definitivamente dal PC e da Google Drive tutti gli allegati che non sono più associati a nessuna scheda nel database corrente. Vuoi procedere?");
            if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, () => resolve(true), null, () => resolve(false));
            else resolve(confirm(msg));
        });
        if (!confirmed) return;

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
