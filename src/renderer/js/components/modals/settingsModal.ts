// @ts-nocheck

(function() {
    window.cambiaTabImpostazioni = function(targetId) {
        document.querySelectorAll('.settings-tab-content').forEach(el => {
            el.classList.add('hidden');
        });
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.remove('bg-stone-200', 'text-stone-900', 'dark:bg-stone-700', 'dark:text-stone-100');
            btn.classList.add('text-stone-600', 'dark:text-stone-400');
        });

        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.remove('hidden');

        const activeBtn = document.querySelector(`.settings-tab-btn[data-target="${targetId}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-stone-600', 'dark:text-stone-400');
            activeBtn.classList.add('bg-stone-200', 'text-stone-900', 'dark:bg-stone-700', 'dark:text-stone-100');
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('settings-modal')) {
            const html = `
    <div id="settings-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-3xl h-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <div class="modal-header shrink-0 p-4 px-6 border-b border-stone-200 flex justify-between items-center">
                <h3 class="modal-title text-stone-800 m-0 flex items-center gap-2"><i data-lucide="settings" class="w-5 h-5 text-stone-600"></i> <span data-i18n="modal_settings">Impostazioni</span></h3>
                <button type="button" onclick="chiudiImpostazioni()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            
            <div class="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
                <!-- Sidebar -->
                <div class="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 p-4 overflow-y-auto shrink-0">
                    <ul class="space-y-1">
                        <li><button class="settings-tab-btn w-full text-left px-3 py-2 rounded-sm font-medium bg-stone-200 text-stone-900 dark:bg-stone-700 dark:text-stone-100 transition-colors" data-target="tab-general" onclick="cambiaTabImpostazioni('tab-general')"><i data-lucide="sliders" class="w-4 h-4 inline-block mr-2 text-stone-500"></i> <span data-i18n="settings_tab_general">Generali</span></button></li>
                        <li><button class="settings-tab-btn w-full text-left px-3 py-2 rounded-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors" data-target="tab-data" onclick="cambiaTabImpostazioni('tab-data')"><i data-lucide="database" class="w-4 h-4 inline-block mr-2 text-stone-500"></i> <span data-i18n="settings_tab_data">Archivio Dati</span></button></li>
                        <li><button class="settings-tab-btn w-full text-left px-3 py-2 rounded-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors" data-target="tab-sync" onclick="cambiaTabImpostazioni('tab-sync')"><i data-lucide="cloud" class="w-4 h-4 inline-block mr-2 text-stone-500"></i> <span data-i18n="settings_tab_sync">Sincronizzazione</span></button></li>
                        <li><button class="settings-tab-btn w-full text-left px-3 py-2 rounded-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors" data-target="tab-system" onclick="cambiaTabImpostazioni('tab-system')"><i data-lucide="info" class="w-4 h-4 inline-block mr-2 text-stone-500"></i> <span data-i18n="settings_tab_system">Sistema & Info</span></button></li>
                    </ul>
                </div>
                
                <!-- Content Area -->
                <div class="w-full md:w-2/3 p-6 overflow-y-auto">
                    
                    <!-- TAB: GENERALI -->
                    <div id="tab-general" class="settings-tab-content space-y-8">
                        <div>
                            <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="user" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_username_title">Nome Collaboratore / Utente</span></h4>
                            <p class="text-sm text-stone-600 mb-3" data-i18n="settings_username_desc">Imposta il tuo nome per identificare chi inserisce o modifica le schede ed i testi.</p>
                            <input type="text" id="settings-username" data-i18n-placeholder="settings_username_placeholder" placeholder="Es. Antonio" class="form-input w-full p-2 bg-stone-50 border border-stone-200 rounded-sm text-stone-800 focus:outline-none focus:border-amber-500">
                        </div>

                        <div class="border-t border-stone-200 pt-6">
                            <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="moon" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_theme">Tema / Aspetto</span></h4>
                            <p class="text-sm text-stone-600 mb-3" data-i18n="settings_theme_desc">Scegli il tema dell'applicazione.</p>
                            <select id="settings-theme" onchange="cambiaTemaSelezionato(this.value)" class="form-input w-full p-2 bg-stone-50 border border-stone-200 rounded-sm text-stone-800">
                                <option value="system">Sistema (Predefinito)</option>
                                <optgroup label="Temi Chiari">
                                    <option value="light">Clear Blue</option>
                                    <option value="amber-light">Vanilla Amber</option>
                                </optgroup>
                                <optgroup label="Temi Scuri">
                                    <option value="dark">Obsidian Orange</option>
                                    <option value="blue-dark">Midnight Blue</option>
                                </optgroup>
                            </select>
                        </div>

                        <div class="border-t border-stone-200 pt-6">
                            <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="globe" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_lang">Lingua / Language</span></h4>
                            <p class="text-sm text-stone-600 mb-3" data-i18n="settings_lang_desc">Scegli la lingua dell'applicazione.</p>
                            <select id="settings-language" onchange="cambiaLingua(this.value)" class="form-input w-full p-2 bg-stone-50 border border-stone-200 rounded-sm text-stone-800">
                                <option value="it">Italiano</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                    </div>

                    <!-- TAB: ARCHIVIO DATI -->
                    <div id="tab-data" class="settings-tab-content space-y-8 hidden">
                        <div>
                            <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="folder-tree" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_workspace">Cartella di Lavoro (Archivio)</span></h4>
                            <p class="text-sm text-stone-600 mb-3" data-i18n="settings_workspace_desc">Questa cartella contiene il tuo database e tutti gli allegati copiati.</p>
                            <div class="flex items-center gap-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm font-mono text-stone-700 break-all" id="settings-workspace-path">
                                <span data-i18n="label_loading">Loading...</span>
                            </div>
                            <button onclick="cambiaCartellaLavoro()" class="btn btn-secondary mt-3">
                                <i data-lucide="folder-search" class="w-4 h-4 text-stone-500"></i> <span data-i18n="btn_change_folder">Cambia Cartella...</span></button>
                            <p class="text-xs text-amber-700 mt-2 font-medium flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> <span data-i18n="settings_workspace_restart">L'app verrà riavviata se cambi la cartella.</span></p>
                        </div>

                        <div class="border-t border-stone-200 pt-6">
                            <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="image" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_local_attachments_title">Cartella Allegati Locale (Opzionale)</span></h4>
                            <p class="text-sm text-stone-600 mb-3" data-i18n="settings_local_attachments_desc">Consente di salvare le immagini localmente sul PC, escludendole dal cloud condiviso per risparmiare spazio.</p>
                            <div class="flex items-center gap-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm font-mono text-stone-700 break-all" id="settings-attachments-path">
                                <span data-i18n="label_loading">Loading...</span>
                            </div>
                            <div class="flex gap-2 mt-3">
                                <button onclick="cambiaCartellaAllegati()" class="btn btn-secondary">
                                    <i data-lucide="folder-search" class="w-4 h-4 text-stone-500"></i> <span data-i18n="btn_select_folder">Seleziona Cartella...</span>
                                </button>
                                <button onclick="ripristinaCartellaAllegatiPredefinita()" id="btn-restore-attachments" class="btn btn-ghost text-red-500 hover:bg-red-50 hover:text-red-700 flex items-center gap-1 hidden-tab">
                                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i> <span data-i18n="btn_restore_default">Ripristina di default</span>
                                </button>
                            </div>
                        </div>

                        <div class="border-t border-stone-200 pt-6">
                            <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="archive" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_backup">Backup Dati</span></h4>
                            <p class="text-sm text-stone-600 mb-3" data-i18n="settings_backup_desc">Crea un file compresso contenente l'intero archivio e tutti gli allegati.</p>
                            <button onclick="esportaBackupZip()" class="btn w-full justify-center shadow-sm" style="background-color: var(--color-text-main); color: var(--color-bg-base);">
                                <i data-lucide="file-archive" class="w-4 h-4"></i> <span data-i18n="btn_export_zip">Esporta Backup in ZIP</span>
                            </button>
                        </div>
                    </div>

                    <!-- TAB: SINCRONIZZAZIONE -->
                    <div id="tab-sync" class="settings-tab-content space-y-8 hidden">
                        <div id="settings-hub-section" class="hidden">
                            <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="cloud" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_hub_title">Stato Collegamento Hub</span></h4>
                            <p class="text-sm text-stone-600 mb-3" data-i18n="settings_hub_desc">Questo archivio locale è collegato ad un repository condiviso online.</p>
                            <div class="space-y-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-xs font-mono text-stone-700 break-all mb-4">
                                <div><b data-i18n="settings_hub_url">URL Server:</b> <span id="settings-hub-url" data-i18n="settings_not_defined">Non definito</span></div>
                                <div><b data-i18n="settings_hub_repoid">ID Repository:</b> <span id="settings-hub-repoid" data-i18n="settings_not_defined">Non definito</span></div>
                                <div><b data-i18n="settings_hub_key">Chiave di Scrittura:</b> <span id="settings-hub-key" data-i18n="settings_not_defined">Non definita</span></div>
                            </div>
                            <div class="space-y-3">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="settings-hub-autofetch" onchange="salvaImpostazioniHub()" class="form-checkbox text-amber-600 rounded border-stone-300 focus:ring-amber-500">
                                    <span class="text-sm font-medium text-stone-800" data-i18n="settings_autofetch_title">Sincronizzazione Automatica (Autofetch)</span>
                                </label>
                                <div class="flex items-center gap-3">
                                    <span class="text-sm text-stone-600" data-i18n="settings_autofetch_interval">Intervallo di controllo:</span>
                                    <select id="settings-hub-autofetch-interval" onchange="salvaImpostazioniHub()" class="form-input text-sm py-1 p-2 bg-stone-50 border border-stone-200 rounded-sm">
                                        <option value="1" data-i18n="settings_autofetch_1m">1 minuto</option>
                                        <option value="5" data-i18n="settings_autofetch_5m">5 minuti</option>
                                        <option value="10" data-i18n="settings_autofetch_10m">10 minuti</option>
                                        <option value="30" data-i18n="settings_autofetch_30m">30 minuti</option>
                                    </select>
                                </div>
                                <p class="text-xs text-stone-500" data-i18n="settings_autofetch_desc">Se attivato, l'app controllerà in background se ci sono nuove modifiche dal server e le scaricherà automaticamente.</p>
                            </div>
                        </div>

                        <div id="settings-drive-section" class="hidden space-y-4">
                            <h4 class="font-semibold flex items-center gap-2"><i data-lucide="cloud-lightning" class="w-4 h-4 text-amber-700"></i> <span id="settings-drive-title" data-i18n="settings_drive_title">Sincronizzazione Google Drive</span></h4>
                            <p class="text-sm text-stone-600" id="settings-drive-desc" data-i18n="settings_drive_desc">Questo archivio locale è configurato come Archivio Condiviso tramite Google Drive.</p>
                            
                            <div class="space-y-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm text-stone-700">
                                <div><b data-i18n="settings_drive_status">Stato:</b> <span id="settings-drive-status">...</span></div>
                                <div class="flex gap-2 mt-2">
                                    <button id="btn-drive-login" class="btn btn-primary" onclick="loginGoogleDrive()" data-i18n="btn_drive_login">Accedi a Drive</button>
                                    <button id="btn-drive-logout" class="btn btn-danger hidden" onclick="logoutGoogleDrive()" data-i18n="btn_drive_logout">Disconnetti</button>
                                    <button id="btn-drive-sync" class="btn btn-secondary hidden" onclick="sincronizzaGoogleDrive()" data-i18n="btn_drive_sync">Sincronizza Ora</button>
                                </div>
                            </div>

                            <div class="p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-800">
                                <i data-lucide="info" class="w-4 h-4 inline-block mr-1"></i> <span data-i18n="settings_drive_hint">Per gestire la sincronizzazione, gli inviti o disconnetterti, utilizza il menu <b>Cloud</b> nella barra superiore dell'applicazione.</span>
                            </div>
                        </div>

                        <div id="settings-hub-disabled" class="text-sm text-stone-500 italic p-4 bg-stone-50 border border-stone-200 rounded-sm">
                            Nessuna sincronizzazione cloud (Hub o Google Drive) configurata per questa cartella di lavoro.
                        </div>
                    </div>

                    <!-- TAB: SISTEMA & INFO -->
                    <div id="tab-system" class="settings-tab-content space-y-8 hidden">
                        <div>
                            <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="download-cloud" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_updates">Aggiornamenti</span></h4>
                            <p class="text-sm text-stone-600 mb-3" data-i18n="settings_updates_desc">Controlla se è disponibile una nuova versione del programma su GitHub.</p>
                            <div class="flex gap-2">
                                <button onclick="controllaAggiornamenti(true)" class="btn btn-secondary">
                                    <i data-lucide="refresh-cw" class="w-4 h-4"></i> <span data-i18n="btn_check_updates">Controlla Aggiornamenti</span>
                                </button>
                                <button onclick="chiudiImpostazioni(); apriChangelogModal();" class="btn btn-ghost">
                                    <i data-lucide="sparkles" class="w-4 h-4 text-amber-500"></i> Scopri novità
                                </button>
                            </div>
                        </div>

                        <div class="border-t border-stone-200 pt-6">
                            <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="help-circle" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_support">Supporto</span></h4>
                            <p class="text-sm text-stone-600 mb-3" data-i18n="settings_support_desc">Hai riscontrato dei problemi o hai dei suggerimenti? Segnalalo su GitHub.</p>
                            <button onclick="apriIssueModal(); chiudiImpostazioni();" class="btn btn-secondary">
                                <i data-lucide="alert-circle" class="w-4 h-4"></i> <span data-i18n="btn_report_issue">Segnala problema</span></button>
                        </div>
                    </div>
                    
                </div>
            </div>
            
            <div class="modal-header shrink-0 p-4 px-6 justify-end border-t border-stone-200">
                <button onclick="chiudiImpostazioni()" class="btn" style="background-color: var(--color-text-main); color: var(--color-bg-base);">Chiudi</button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
