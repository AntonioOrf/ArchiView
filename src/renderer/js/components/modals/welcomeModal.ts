// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('welcome-modal')) {
            const html = `
    <div id="welcome-modal" class="modal-overlay hidden-tab z-70 bg-stone-900/80 backdrop-blur-sm">
        <div class="modal-window max-w-lg p-8 text-center shadow-2xl border-2 border-stone-200 relative">
            <button id="welcome-close-btn" class="absolute top-4 right-4 text-stone-400 hover:text-stone-700 hidden transition-colors" onclick="chiudiWelcomeModal()" title="Chiudi">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
            <div class="flex justify-center mb-6">
                <div class="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-stone-600 shadow-inner">
                    <i data-lucide="library" class="w-8 h-8"></i>
                </div>
            </div>
            <h2 class="text-2xl font-serif text-stone-800 mb-4" data-i18n="modal_folder_title">Gestione Archivi</h2>
            <p class="text-stone-600 mb-8 leading-relaxed text-sm">
                <span data-i18n="welcome_desc_gestione">Scegli una cartella di destinazione per creare un nuovo archivio indipendente, oppure seleziona un archivio già esistente per caricarne i dati.</span>
            </p>

            <div class="flex flex-col gap-3" id="welcome-buttons">
                <button onclick="selezionaCartellaIniziale()" class="btn btn-primary w-full justify-center py-3 text-lg font-medium shadow-md">
                    <i data-lucide="folder-open" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_open_local">Apri Archivio Locale</span>
                </button>
                <button onclick="mostraInputNuovaCartella('locale')" class="btn btn-secondary w-full justify-center py-3 text-lg font-medium shadow-sm bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700">
                    <i data-lucide="folder-plus" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_create_local">Crea Nuova Cartella Locale</span>
                </button>
                <div class="h-px bg-stone-200 my-1 w-full"></div>
                <button onclick="mostraInputNuovaCartella('personale')" class="btn w-full justify-center py-3 text-lg font-medium shadow-sm text-sky-900 border border-sky-300 hover:bg-sky-50" style="background-color: #f0f9ff;">
                    <i data-lucide="cloud" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_create_cloud_private">Crea un Archivio Cloud Privato</span>
                </button>
                <button onclick="mostraInputNuovaCartella('condiviso')" class="btn w-full justify-center py-3 text-lg font-medium shadow-sm text-blue-900 border border-blue-300 hover:bg-blue-50" style="background-color: #eff6ff;">
                    <i data-lucide="cloud-upload" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_create_shared">Crea un Archivio Condiviso</span>
                </button>
                <button onclick="mostraJoinForm()" class="btn w-full justify-center py-3 text-lg font-medium shadow-sm text-amber-900 border border-amber-300 hover:bg-amber-50" style="background-color: #fffbeb;">
                    <i data-lucide="users" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_join_shared">Unisciti a un Archivio Condiviso</span>
                </button>
                <button onclick="mostraCloudExplorer()" class="btn btn-ghost text-sm text-stone-500 mt-1 hover:text-stone-700 w-full justify-center">
                    <span data-i18n="btn_restore_drive">Ripristina da Google Drive...</span>
                </button>
            </div>

            <!-- CREA NUOVA CARTELLA FORM -->
            <div id="welcome-create-form" class="hidden-tab mt-4 text-left border border-stone-200 p-4 rounded-md bg-stone-50">
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm" data-i18n="label_archive_name">Nome dell\'archivio</label>
                    <input type="text" id="welcome-new-folder-name" class="form-input w-full focus:ring-2 focus:ring-amber-500/20 transition-all text-sm" placeholder="Es. Archivio Manoscritti" data-i18n-placeholder="placeholder_archive_name" onkeydown="if(event.key === 'Enter') creaCartellaIniziale()">
                </div>
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm" data-i18n="label_position">Posizione</label>
                    <div class="flex gap-2">
                        <input type="text" id="welcome-new-folder-path" class="form-input flex-1 bg-white text-stone-600 text-sm border border-stone-300" readonly>
                        <button onclick="selezionaPercorsoBase()" class="btn btn-secondary px-3 py-1 text-sm shadow-sm bg-stone-100 border border-stone-300 hover:bg-stone-200" data-i18n="btn_browse">Sfoglia...</button>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-6 pt-4 border-t border-stone-200">
                    <button onclick="nascondiInputNuovaCartella()" class="btn btn-ghost text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> <span data-i18n="btn_go_back">Torna Indietro</span>
                    </button>
                    <button onclick="creaCartellaIniziale()" class="btn btn-primary text-sm shadow-sm px-6"><span data-i18n="btn_create_and_start">Crea e Avvia</span></button>
                </div>
            </div>

            <!-- JOIN FORM -->
            <div id="welcome-join-form" class="hidden-tab mt-4 text-left border border-stone-200 p-4 rounded-md bg-stone-50">
                <h3 class="font-medium mb-1 text-stone-800 flex items-center gap-2">
                    <i data-lucide="users" class="w-5 h-5 text-amber-600"></i> <span data-i18n="btn_join_shared">Unisciti a un Archivio Condiviso</span>
                </h3>
                <p class="text-xs text-stone-500 mb-4 leading-snug">
                    <span data-i18n="welcome_desc_join_picker">Seleziona la cartella condivisa dal tuo Google Drive per sincronizzarla sul tuo PC. L'app avrà accesso unicamente a quella cartella.</span>
                </p>
                <div class="mb-3 text-center">
                    <button type="button" onclick="apriGooglePicker()" class="btn btn-secondary w-full justify-center py-4 text-sm font-medium shadow-sm bg-white border border-stone-300 hover:bg-stone-50 text-stone-700">
                        <i data-lucide="folder-search" class="w-5 h-5 mr-2 text-blue-600"></i>
                        <span data-i18n="btn_browse_drive">Sfoglia Google Drive...</span>
                    </button>
                    <div class="mt-4 border-t border-stone-200 pt-3">
                        <label class="form-label font-medium mb-1 block text-sm text-left text-stone-600" data-i18n="label_invite_code_opt">Hai un Codice d'Invito? (Opzionale)</label>
                        <div class="flex gap-2">
                            <input type="text" id="welcome-join-code" class="form-input flex-1 bg-white text-stone-600 text-sm border border-stone-300" placeholder="Incolla il codice qui..." oninput="if(window.handleInviteCode) window.handleInviteCode(this.value, true)">
                        </div>
                    </div>
                    <input type="hidden" id="welcome-join-vault-id">
                </div>

                <div id="welcome-join-vault-info" class="hidden-tab mb-3 p-3 bg-stone-100 border border-stone-200 rounded text-sm text-stone-700 flex items-center gap-2">
                    <i data-lucide="folder-check" class="w-5 h-5 text-emerald-600"></i>
                    <div>
                        <span class="font-semibold" data-i18n="label_archive_name_colon">Nome Archivio:</span>
                        <span id="welcome-join-vault-name" class="font-mono text-emerald-700"></span>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm" data-i18n="label_local_archive_pos">Posizione archivio locale</label>
                    <div class="flex gap-2 mt-1">
                        <input type="text" id="welcome-join-folder-path" class="form-input flex-1 bg-white text-stone-600 text-sm border border-stone-300" readonly>
                        <button onclick="selezionaPercorsoBaseJoin()" class="btn btn-secondary px-3 py-1 text-sm" data-i18n="btn_browse">Sfoglia...</button>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-6 pt-4 border-t border-stone-200">
                    <button onclick="nascondiJoinForm()" class="btn btn-ghost text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> <span data-i18n="btn_go_back">Torna Indietro</span>
                    </button>
                    <button onclick="eseguiJoinVault()" class="btn btn-primary text-sm shadow-sm px-6"><span data-i18n="btn_connect">Connettiti</span></button>
                </div>
            </div>

            <!-- CLOUD EXPLORER -->
            <div id="welcome-cloud-explorer" class="hidden-tab mt-4 text-left border border-stone-200 p-4 rounded-md bg-stone-50">
                <h3 class="font-medium mb-3 text-stone-800 flex items-center gap-2">
                    <i data-lucide="cloud" class="w-5 h-5 text-blue-600"></i> <span data-i18n="title_select_cloud_archive">Seleziona un Archivio dal Cloud</span>
                </h3>
                <div id="cloud-vaults-list" class="space-y-2 max-h-64 overflow-y-auto pr-2">
                    <!-- Lista popolata via JS -->
                </div>
                <div class="flex justify-between items-center mt-6 pt-4 border-t border-stone-200">
                    <button onclick="nascondiCloudExplorer()" class="btn btn-ghost text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> <span data-i18n="btn_go_back">Torna Indietro</span>
                    </button>
                    <button onclick="eseguiRipristinoCloudGlobale()" class="btn btn-secondary text-sm shadow-sm" title="Se non vedi il tuo archivio, cerca in tutto il Drive" data-i18n-title="title_search_everywhere"><span data-i18n="btn_search_everywhere">Cerca Ovunque</span></button>
                </div>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();

            // Rimossi gli event listener per il codice invito
            const joinCodeTextarea = document.getElementById('welcome-join-code');
            if (joinCodeTextarea) {
                // ...
            }
        }
    });

    window.mostraInputNuovaCartella = async function(tipo = 'locale') {
        window.creazioneVaultCondiviso = (tipo === 'condiviso');
        window.creazioneVaultPersonale = (tipo === 'personale');
        document.getElementById('welcome-buttons').classList.add('hidden-tab');
        document.getElementById('welcome-create-form').classList.remove('hidden-tab');
        if (window.apiBrowser && window.apiBrowser.getDocumentsPath) {
            let initialPath = await window.apiBrowser.getDocumentsPath();
            if (window.apiSettings) {
                const settings = await window.apiSettings.get();
                if (settings.lastVaultBasePath) initialPath = settings.lastVaultBasePath;
            }
            const pathInput = document.getElementById('welcome-new-folder-path');
            if (pathInput && !pathInput.value) {
                pathInput.value = initialPath;
            }
        }
        setTimeout(() => document.getElementById('welcome-new-folder-name').focus(), 100);
    };

    window.nascondiInputNuovaCartella = function() {
        document.getElementById('welcome-create-form').classList.add('hidden-tab');
        document.getElementById('welcome-buttons').classList.remove('hidden-tab');
        document.getElementById('welcome-new-folder-name').value = '';
    };

    window.mostraCloudExplorer = async function() {
        if (!window.apiDrive) return;
        
        mostraMessaggio(window.t("msg_autenticazione_e_ricerca_", "Autenticazione e ricerca archivi in corso..."), "info");
        try {
            await window.apiDrive.auth();
            const vaults = await window.apiDrive.listVaults();
            
            document.getElementById('welcome-buttons').classList.add('hidden-tab');
            document.getElementById('welcome-cloud-explorer').classList.remove('hidden-tab');
            
            const listContainer = document.getElementById('cloud-vaults-list');
            listContainer.innerHTML = window.sanitizeHTML('');
            
            if (vaults.length === 0) {
                listContainer.innerHTML = window.sanitizeHTML(`<p class="text-sm text-stone-500 p-4 text-center"><span data-i18n="msg_no_archive_found_drive">Nessun Archivio trovato nella cartella ArchiView sul tuo Drive.</span></p>`);
            } else {
                vaults.forEach(v => {
                    const div = document.createElement('div');
                    div.className = "p-3 bg-white border border-stone-200 rounded cursor-pointer hover:border-amber-400 hover:shadow-md transition-all flex justify-between items-center";
                    const dateStr = new Date(v.modifiedTime).toLocaleDateString();
                    
                    const escapedName = v.name.replace(/[&<>'"]/g, tag => ({
                        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
                    }[tag] || tag));

                    div.innerHTML = window.sanitizeHTML(`
                        <div class="flex items-center gap-3">
                            <i data-lucide="folder-cloud" class="w-5 h-5 text-blue-600"></i>
                            <div>
                                <div class="font-medium text-stone-800">${escapedName}</div>
                                <div class="text-xs text-stone-500"><span data-i18n="label_modified">Modificato:</span> ${dateStr}</div>
                            </div>
                        </div>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-stone-400"></i>
                    `);
                    div.onclick = () => eseguiRipristinoCloud(v.id, v.name);
                    listContainer.appendChild(div);
                });
                if (window.lucide) lucide.createIcons({ nodes: [listContainer] });
            }
        } catch(e) {
            mostraMessaggio(window.t("msg_errore_cloud", "Errore Cloud: ") + e.message, "error");
        }
    };

    window.nascondiCloudExplorer = function() {
        document.getElementById('welcome-cloud-explorer').classList.add('hidden-tab');
        document.getElementById('welcome-buttons').classList.remove('hidden-tab');
    };

    window.mostraJoinForm = async function() {
        document.getElementById('welcome-buttons').classList.add('hidden-tab');
        document.getElementById('welcome-join-form').classList.remove('hidden-tab');

        if (!document.getElementById('google-api-script')) {
            const script = document.createElement('script');
            script.id = 'google-api-script';
            script.src = 'https://apis.google.com/js/api.js';
            document.head.appendChild(script);
        }

        if (window.apiBrowser && window.apiBrowser.getDocumentsPath) {
            let initialPath = await window.apiBrowser.getDocumentsPath();
            if (window.apiSettings) {
                const settings = await window.apiSettings.get();
                if (settings.lastVaultBasePath) initialPath = settings.lastVaultBasePath;
            }
            const pathInput = document.getElementById('welcome-join-folder-path');
            if (pathInput && !pathInput.value) {
                pathInput.value = initialPath;
            }
        }
    };

    window.nascondiJoinForm = function() {
        document.getElementById('welcome-join-form').classList.add('hidden-tab');
        document.getElementById('welcome-buttons').classList.remove('hidden-tab');
    };

    window.selezionaPercorsoBaseJoin = async function() {
        if (window.apiBrowser && window.apiBrowser.selectBaseDirectory) {
            const basePath = await window.apiBrowser.selectBaseDirectory(window.t("dialog_select_folder", "Seleziona la posizione per la nuova cartella"));
            if (basePath) {
                document.getElementById('welcome-join-folder-path').value = basePath;
                if (window.apiSettings) {
                    const settings = await window.apiSettings.get();
                    settings.lastVaultBasePath = basePath;
                    await window.apiSettings.save(settings);
                }
            }
        }
    };

    window.apriGooglePicker = async function() {
        if (!window.apiDrive) return;
        try {
            mostraMessaggio(window.t("msg_autenticazione_e_ricerca_", "Apertura di Google Picker nel tuo browser predefinito... Attendi..."), "info");
            
            // Chiama l'IPC che aprirà Chrome col picker. Questa funzione "resta in attesa" 
            // finché il server locale non riceve l'ID o l'utente non annulla.
            const data = await window.apiDrive.openExternalPicker();
            
            if (data && data.id) {
                // Usiamo una variabile globale invece dell'elemento DOM per massima sicurezza
                window.welcomeJoinVaultId = data.id;
                let cleanName = data.name;
                if (cleanName.endsWith('_ArchiView')) {
                    cleanName = cleanName.substring(0, cleanName.length - 10);
                }
                window.welcomeJoinVaultName = cleanName;
                
                const nameSpan = document.getElementById('welcome-join-vault-name');
                if (nameSpan) nameSpan.textContent = cleanName;
                
                const infoDiv = document.getElementById('welcome-join-vault-info');
                if (infoDiv) infoDiv.classList.remove('hidden-tab');
                
                if (window.nascondiMessaggi) window.nascondiMessaggi();
            } else {
                mostraMessaggio("Selezione annullata.", "warning");
            }
        } catch (e) {
            mostraMessaggio("Errore: " + e.message, "error");
        }
    };

    window.eseguiJoinVault = async function() {
        const vaultId = window.welcomeJoinVaultId || (document.getElementById('welcome-join-vault-id') ? document.getElementById('welcome-join-vault-id').value : null);
        const vaultName = window.welcomeJoinVaultName || "Vault_Condiviso";
        const pathInput = document.getElementById('welcome-join-folder-path');
        const basePath = pathInput ? pathInput.value.trim() : "";
        
        if(!vaultId || !basePath) {
            mostraMessaggio(window.t("msg_seleziona_cartella_e_percorso", "Seleziona una cartella dal Cloud e un percorso locale."), "warning");
            return;
        }

        try {
            mostraMessaggio(window.t("msg_connessione_all_archivio_", "Connessione all'Archivio in corso..."), "info");
            await window.apiDrive.joinByFolderId(vaultId, vaultName, basePath, window.welcomePusherCreds);
            
            const modal = document.getElementById('welcome-modal');
            if (modal) modal.classList.add('hidden-tab');
            
            mostraMessaggio(window.t("msg_connesso_con_successo_ria", "Connesso con successo! Riavvio in corso..."), "success");
        } catch(e) {
            mostraMessaggio(e.message, "error");
        }
    };



    window.eseguiRipristinoCloudGlobale = async function() {
        await eseguiRipristinoCloud(null, 'Vault_Recuperato');
    };

    window.eseguiRipristinoCloud = async function(vaultId, defaultName) {
        mostraMessaggio(window.t("msg_scaricamento_archivio", "Scaricamento archivio..."), "info");
        try {
            const driveData = await window.apiDrive.pull(vaultId);
            
            if (!driveData.files.some(f => f.name === 'database_manoscritti.json')) {
                mostraMessaggio(window.t("msg_nessun_database_trovato_n", "Nessun database trovato nell'Archivio selezionato."), "warning");
                return;
            }
            
            mostraMessaggio(window.t("msg_archivio_scaricato_selezi", "Archivio scaricato! Seleziona dove salvarlo sul tuo PC."), "info");
            
            if (window.apiBrowser && window.apiBrowser.selectBaseDirectory) {
                const basePath = await window.apiBrowser.selectBaseDirectory(window.t("dialog_select_folder", "Seleziona la posizione per la nuova cartella"));
                if (basePath) {
                    if (window.apiSettings) {
                        const settings = await window.apiSettings.get();
                        settings.lastVaultBasePath = basePath;
                        await window.apiSettings.save(settings);
                    }
                    const driveConfig = vaultId ? { isSharedVault: true, sharedVaultId: vaultId } : null;
                    const success = await window.apiBrowser.cloneWorkspaceHub(basePath, defaultName, driveConfig, driveData.database);
                    if (success) {
                        document.getElementById('welcome-modal').classList.add('hidden-tab');
                        mostraMessaggio(window.t("msg_archivio_ripristinato_con", "Archivio ripristinato con successo! Riavvio in corso..."), "success");
                    } else {
                        throw new Error("Errore durante la creazione dei file locali.");
                    }
                }
            }
        } catch (e) {
            console.error(e);
            mostraMessaggio(window.t("msg_errore", "Errore: ") + (e.message || "Impossibile ripristinare"), "error");
        }
    };

    window.selezionaPercorsoBase = async function() {
        if (window.apiBrowser && window.apiBrowser.selectBaseDirectory) {
            const basePath = await window.apiBrowser.selectBaseDirectory(window.t("dialog_select_folder", "Seleziona la posizione per la nuova cartella"));
            if (basePath) {
                document.getElementById('welcome-new-folder-path').value = basePath;
                if (window.apiSettings) {
                    const settings = await window.apiSettings.get();
                    settings.lastVaultBasePath = basePath;
                    await window.apiSettings.save(settings);
                }
            }
        }
    };

    window.creaCartellaIniziale = async function() {
        const btn = event?.target && event.target.tagName === 'BUTTON' ? event.target : document.querySelector('#welcome-create-form .btn-primary');
        const name = document.getElementById('welcome-new-folder-name').value.trim();
        const basePath = document.getElementById('welcome-new-folder-path').value.trim();
        if (!name || !basePath) return;
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = window.sanitizeHTML('<i data-lucide="loader-2" class="w-4 h-4 mr-2 animate-spin"></i> Creazione...');
            if (window.lucide) lucide.createIcons({ nodes: [btn] });
        }
        
        if (window.apiBrowser && window.apiBrowser.createWorkspaceInPath) {
            let config = null;
            if (window.creazioneVaultCondiviso) config = { autoStartTrasformaCondiviso: true };
            else if (window.creazioneVaultPersonale) config = { autoStartTrasformaPersonale: true };
            
            const success = await window.apiBrowser.createWorkspaceInPath(basePath, name, config);
            if (success) {
                document.getElementById('welcome-modal').classList.add('hidden-tab');
            } else if (btn) {
                btn.disabled = false;
                btn.innerHTML = window.sanitizeHTML('<span data-i18n=\"btn_create_and_start\">Crea e Avvia</span>');
            }
        }
    };

    window.chiudiWelcomeModal = function() {
        const modal = document.getElementById('welcome-modal');
        if (modal) {
            modal.classList.add('hidden-tab');
            modal.style.removeProperty('display');
        }
    };

    window.mostraWelcomeModal = async function() {
        const modal = document.getElementById('welcome-modal');
        if (!modal) return;
        
        // Show close button if a workspace is already loaded
        const closeBtn = document.getElementById('welcome-close-btn');
        if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
            const currentPath = await window.apiBrowser.getWorkspacePath();
            if (currentPath) {
                closeBtn.classList.remove('hidden');
            } else {
                closeBtn.classList.add('hidden');
            }
        }

        modal.classList.remove('hidden-tab');
        modal.style.setProperty('display', 'flex', 'important');
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
    };
})();
