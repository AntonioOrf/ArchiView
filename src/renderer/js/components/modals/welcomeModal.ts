// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('welcome-modal')) {
            const html = `
    <div id="welcome-modal" class="modal-overlay hidden-tab z-70 bg-stone-900/80 backdrop-blur-sm">
        <div class="modal-window max-w-lg p-8 text-center shadow-2xl border-2 border-stone-200 relative">
            <button id="welcome-close-btn" class="absolute top-4 right-4 text-stone-400 hover:text-stone-700 hidden transition-colors" onclick="chiudiWelcomeModal()" data-i18n-title="btn_close" data-i18n-aria-label="btn_close" title="Chiudi" aria-label="Chiudi">
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
                    <span data-i18n="btn_create_cloud_private">Crea un Backup Personale</span>
                </button>
                <button onclick="mostraInputNuovaCartella('hub')" class="btn w-full justify-center py-3 text-lg font-medium shadow-sm text-emerald-900 border border-emerald-300 hover:bg-emerald-50" style="background-color: #ecfdf5;">
                    <i data-lucide="server" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_create_hub_shared">Crea un Hub Condiviso</span>
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

            <!-- JOIN FORM — layout a 2 colonne -->
            <div id="welcome-join-form" class="hidden-tab mt-4 text-left border border-stone-200 rounded-lg overflow-hidden">
                <!-- HEADER -->
                <div class="px-5 py-3 bg-stone-50 border-b border-stone-200 flex items-center gap-2">
                    <i data-lucide="users" class="w-4 h-4 text-amber-600 shrink-0"></i>
                    <h3 class="font-semibold text-sm text-stone-800">
                        <span data-i18n="btn_join_shared">Unisciti a un Archivio Condiviso</span>
                    </h3>
                </div>

                <!-- BODY: 2 COLONNE -->
                <div class="flex divide-x divide-stone-200">

                    <!-- COLONNA SINISTRA: Step Cloud (1 + 2) -->
                    <div class="flex-1 p-4 flex flex-col gap-4 min-w-0 bg-white">

                        <!-- STEP 1: Link invito ArchiView -->
                        <div>
                            <div class="flex items-center gap-2 mb-1.5">
                                <span id="join-step1-badge" class="w-5 h-5 rounded-full bg-stone-300 text-white text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors">1</span>
                                <label class="form-label font-medium text-sm text-stone-700">
                                    <span data-i18n="label_invite_code_opt">Link d'Invito ArchiView</span>
                                </label>
                            </div>
                            <p class="text-[11px] text-stone-500 mb-2 ml-7 leading-snug"><span data-i18n="join_step1_hint">Paste the archiview://join/... link received from the organizer.</span></p>
                            <input type="text" id="welcome-join-code"
                                class="form-input w-full bg-white text-stone-600 text-sm border border-stone-300 font-mono"
                                placeholder="archiview://join/..."
                                oninput="if(window.handleJoinCodeInput) window.handleJoinCodeInput(this.value)">
                            <div id="join-code-ok" class="hidden-tab mt-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 flex items-center gap-1.5">
                                <i data-lucide="check-circle" class="w-3.5 h-3.5 shrink-0"></i>
                                <span id="join-code-ok-text"></span>
                            </div>
                            <div id="join-code-err" class="hidden mt-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5"></div>
                        </div>

                        <!-- STEP 2: Picker Google Drive (solo per inviti Drive legacy) -->
                        <div id="join-step-drive" class="hidden-tab">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span id="join-step2-badge" class="w-5 h-5 rounded-full bg-stone-300 text-white text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors">2</span>
                                <label class="form-label font-medium text-sm text-stone-700" data-i18n="label_authorize_folder">Autorizza accesso cartella Drive</label>
                            </div>
                            <div class="ml-7 mb-2 p-2 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-800 flex items-start gap-1.5">
                                <i data-lucide="info" class="w-3.5 h-3.5 shrink-0 mt-0.5"></i>
                                <span data-i18n="join_step2_hint">First <strong>accept the sharing email from Google Drive</strong>. The folder will appear in <em>"Shared with me"</em>.</span>
                            </div>
                            <button type="button" onclick="apriGooglePicker()" id="btn-open-picker"
                                class="btn btn-secondary w-full justify-center py-3 text-sm font-medium shadow-sm bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 transition-all">
                                <i data-lucide="folder-search" class="w-5 h-5 mr-2 text-blue-600"></i>
                                <span data-i18n="btn_browse_drive">Sfoglia Google Drive...</span>
                            </button>
                            <div id="join-picker-ok" class="hidden-tab mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700 flex items-center gap-2">
                                <i data-lucide="folder-check" class="w-4 h-4 text-emerald-600 shrink-0"></i>
                                <div>
                                    <span class="font-semibold" data-i18n="label_selected_archive">Selezionato:</span>
                                    <span id="join-picker-vault-name" class="font-mono ml-1 text-sm"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- COLONNA DESTRA: Step Locale (3) + Azioni -->
                    <div class="flex-1 p-4 flex flex-col gap-4 min-w-0 bg-stone-50">

                        <!-- STEP 3: Percorso locale -->
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span id="join-step3-badge" class="w-5 h-5 rounded-full bg-stone-300 text-white text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors">3</span>
                                <label class="form-label font-medium text-sm text-stone-700" data-i18n="label_local_archive_pos">Posizione archivio locale</label>
                            </div>
                            <p class="text-[11px] text-stone-500 mb-2 ml-7 leading-snug"><span data-i18n="join_step3_hint">Choose where to save the local copy of the archive on your PC.</span></p>
                            <div class="flex gap-2">
                                <input type="text" id="welcome-join-folder-path" class="form-input flex-1 bg-white text-stone-600 text-sm border border-stone-300" readonly>
                                <button onclick="selezionaPercorsoBaseJoin()" class="btn btn-secondary px-3 py-1 text-sm shrink-0" data-i18n="btn_browse">Sfoglia...</button>
                            </div>
                        </div>

                        <!-- AZIONI -->
                        <div class="mt-auto pt-4 border-t border-stone-200 flex justify-between items-center">
                            <button onclick="nascondiJoinForm()" class="btn btn-ghost text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1">
                                <i data-lucide="arrow-left" class="w-4 h-4"></i> <span data-i18n="btn_go_back">Torna Indietro</span>
                            </button>
                            <button onclick="eseguiJoinVault()" id="btn-join-connect" class="btn btn-primary text-sm shadow-sm px-6">
                                <span data-i18n="btn_connect">Connettiti</span>
                            </button>
                        </div>
                    </div>
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

        }
    });

    window.mostraInputNuovaCartella = async function(tipo = 'locale') {
        window.creazioneVaultCondiviso = (tipo === 'condiviso');
        window.creazioneVaultPersonale = (tipo === 'personale');
        window.creazioneVaultHub = (tipo === 'hub');
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

    // --- Helpers step badge ---

    function updateJoinStepBadge(step: number, stato: 'pending' | 'active' | 'done') {
        const badge = document.getElementById(`join-step${step}-badge`);
        if (!badge) return;
        const base = 'w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors ';
        if (stato === 'done') {
            badge.className = base + 'bg-emerald-500';
            badge.textContent = '✓';
        } else if (stato === 'active') {
            badge.className = base + 'bg-blue-500';
            badge.textContent = String(step);
        } else {
            badge.className = base + 'bg-stone-300';
            badge.textContent = String(step);
        }
    }

    // Mostra/nasconde lo step Picker Drive (necessario solo per gli inviti Drive legacy).
    // Quando è nascosto, lo step "cartella locale" diventa visivamente il passo 2.
    function setDriveStepVisible(visible: boolean) {
        document.getElementById('join-step-drive')?.classList.toggle('hidden-tab', !visible);
        const b3 = document.getElementById('join-step3-badge');
        if (b3 && b3.textContent !== '✓') b3.textContent = visible ? '3' : '2';
    }

    function resetJoinState() {
        window.welcomeJoinVaultId = null;
        window.welcomeJoinVaultName = null;
        window.welcomePusherCreds = null;
        window.welcomeHubInvite = null;

        const codeInput = document.getElementById('welcome-join-code') as HTMLInputElement;
        if (codeInput) codeInput.value = '';

        document.getElementById('join-code-ok')?.classList.add('hidden-tab');
        document.getElementById('join-code-err')?.classList.add('hidden-tab');
        document.getElementById('join-picker-ok')?.classList.add('hidden-tab');

        const pickerBtn = document.getElementById('btn-open-picker');
        if (pickerBtn) pickerBtn.className = pickerBtn.className
            .replace('border-blue-400 ring-2 ring-blue-200', 'border-stone-300');

        for (let i = 1; i <= 3; i++) updateJoinStepBadge(i, 'pending');
        setDriveStepVisible(false); // default: layout Hub a 2 passi
    }

    // --- Decodifica codice invito (frontend, nessuna chiamata IPC) ---
    // Il codice è puro base64: |pusherKey|pusherCluster|pusherWebhook|autoFetch|vaultId|vaultName

    window.handleJoinCodeInput = function(rawCode: string) {
        const okDiv  = document.getElementById('join-code-ok');
        const errDiv = document.getElementById('join-code-err');
        const okText = document.getElementById('join-code-ok-text');

        okDiv?.classList.add('hidden-tab');
        errDiv?.classList.add('hidden-tab');
        window.welcomePusherCreds = null;

        let code = rawCode.trim();
        if (code.startsWith('archiview://join/')) code = code.slice('archiview://join/'.length);
        if (!code) { updateJoinStepBadge(1, 'pending'); setDriveStepVisible(false); return; }

        // Invito ad archivio condiviso: nessun accesso Google né Picker, si salta direttamente
        // allo step "cartella locale". Mai il repoId: solo il nome scelto dal proprietario.
        const hubInvite = window.decodeHubInvite ? window.decodeHubInvite(rawCode) : null;
        if (hubInvite) {
            window.welcomeHubInvite = hubInvite;
            window.welcomePusherCreds = null;
            const archiveLabel = hubInvite.name
                ? `"${hubInvite.name}"`
                : window.t("hub_fallback_name", "Questo archivio condiviso");
            if (okText) okText.textContent =
                `${archiveLabel} — ${window.t("hub_join_ok_suffix", "nessun accesso Google richiesto: scegli la cartella locale e connettiti.")}`;
            okDiv?.classList.remove('hidden-tab');
            if (window.lucide) lucide.createIcons({ nodes: [okDiv] });
            updateJoinStepBadge(1, 'done');
            updateJoinStepBadge(3, 'active');
            setDriveStepVisible(false); // Hub: nessun Picker, layout a 2 passi (rinumera lo step 3 -> 2 una sola volta)
            return;
        }
        window.welcomeHubInvite = null;

        try {
            let b64 = code;
            while (b64.length % 4 !== 0) b64 += '=';
            const decoded = atob(b64);
            const parts = decoded.split('|');
            if (parts.length < 5) throw new Error('formato non valido');

            const [, pKey, pCluster, pWebhook, pAuto, , vaultName] = parts;

            window.welcomePusherCreds = {
                pusherKey: pKey || '',
                pusherCluster: pCluster || '',
                pusherWebhook: pWebhook || '',
                driveAutofetch: pAuto === '1'
            };

            const displayName = (vaultName || 'Archivio Condiviso').replace(/_ArchiView$/, '');
            if (okText) okText.textContent =
                `"${displayName}" ${window.t("join_code_ok_suffix", "— now click \"Browse Google Drive\" to authorize access.")}`;
            okDiv?.classList.remove('hidden-tab');
            if (window.lucide) lucide.createIcons({ nodes: [okDiv] });

            // Invito Drive legacy: rivela lo step Picker (layout a 3 passi).
            setDriveStepVisible(true);

            // Evidenzia il pulsante picker come prossimo step obbligatorio
            const pickerBtn = document.getElementById('btn-open-picker');
            if (pickerBtn && !pickerBtn.className.includes('ring-2')) {
                pickerBtn.className = pickerBtn.className
                    .replace('border-stone-300', 'border-blue-400 ring-2 ring-blue-200');
            }

            updateJoinStepBadge(1, 'done');
            updateJoinStepBadge(2, 'active');

        } catch (_) {
            if (errDiv) {
                errDiv.textContent = window.t("join_code_invalid", "Invalid code. Make sure you copied the complete text.");
                errDiv.classList.remove('hidden-tab');
            }
            updateJoinStepBadge(1, 'pending');
        }
    };

    window.mostraJoinForm = async function() {
        resetJoinState();
        document.getElementById('welcome-buttons')?.classList.add('hidden-tab');
        const joinForm = document.getElementById('welcome-join-form');
        joinForm?.classList.remove('hidden-tab');
        // Espandi il modal per il layout a due colonne
        const modalWin = document.querySelector('#welcome-modal .modal-window') as HTMLElement;
        if (modalWin) { modalWin.classList.remove('max-w-lg', 'p-8'); modalWin.classList.add('max-w-3xl'); }
        if (window.lucide) lucide.createIcons({ nodes: [joinForm] });

        // Precarica Google Picker API in background
        if (!document.getElementById('google-api-script')) {
            const script = document.createElement('script');
            script.id = 'google-api-script';
            script.src = 'https://apis.google.com/js/api.js';
            document.head.appendChild(script);
        }

        if (window.apiBrowser?.getDocumentsPath) {
            let initialPath = await window.apiBrowser.getDocumentsPath();
            if (window.apiSettings) {
                const settings = await window.apiSettings.get();
                if (settings.lastVaultBasePath) initialPath = settings.lastVaultBasePath;
            }
            const pathInput = document.getElementById('welcome-join-folder-path') as HTMLInputElement;
            if (pathInput && !pathInput.value) pathInput.value = initialPath;
        }
    };

    window.nascondiJoinForm = function() {
        document.getElementById('welcome-join-form')?.classList.add('hidden-tab');
        document.getElementById('welcome-buttons')?.classList.remove('hidden-tab');
        // Ripristina dimensione modal
        const modalWin = document.querySelector('#welcome-modal .modal-window') as HTMLElement;
        if (modalWin) { modalWin.classList.remove('max-w-3xl'); modalWin.classList.add('max-w-lg', 'p-8'); }
        resetJoinState();
    };

    window.selezionaPercorsoBaseJoin = async function() {
        if (window.apiBrowser?.selectBaseDirectory) {
            const basePath = await window.apiBrowser.selectBaseDirectory(
                window.t("dialog_select_folder", "Seleziona la posizione per la nuova cartella")
            );
            if (basePath) {
                (document.getElementById('welcome-join-folder-path') as HTMLInputElement).value = basePath;
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
            mostraMessaggio(
                window.t("msg_autenticazione_e_ricerca_", "Apertura di Google Picker nel browser... Attendi."),
                "info"
            );

            const data = await window.apiDrive.openExternalPicker();

            if (data && data.id) {
                window.welcomeJoinVaultId = data.id;
                let cleanName: string = data.name;
                if (cleanName.endsWith('_ArchiView')) cleanName = cleanName.slice(0, -10);
                window.welcomeJoinVaultName = cleanName;

                const pickerOk = document.getElementById('join-picker-ok');
                const pickerName = document.getElementById('join-picker-vault-name');
                if (pickerName) pickerName.textContent = cleanName;
                if (pickerOk) {
                    pickerOk.classList.remove('hidden-tab');
                    if (window.lucide) lucide.createIcons({ nodes: [pickerOk] });
                }

                // Se il codice invito non era stato inserito, marca step 1 come saltato
                if (!window.welcomePusherCreds) updateJoinStepBadge(1, 'done');
                updateJoinStepBadge(2, 'done');
                updateJoinStepBadge(3, 'active');

                if (window.nascondiMessaggi) window.nascondiMessaggi();
            } else {
                mostraMessaggio(window.t("msg_selezione_annullata", "Selezione annullata."), "warning");
            }
        } catch (e: any) {
            mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
        }
    };

    window.eseguiJoinVault = async function() {
        const vaultId: string | null = window.welcomeJoinVaultId || null;
        const vaultName: string = window.welcomeJoinVaultName || "Vault_Condiviso";
        const basePath: string = (document.getElementById('welcome-join-folder-path') as HTMLInputElement)?.value.trim() || '';

        // Percorso Hub: nessun vaultId Drive, si clona via invito.
        if (window.welcomeHubInvite) {
            if (!basePath) { mostraMessaggio(window.t("msg_seleziona_percorso", "Seleziona una posizione locale per l'archivio."), "warning"); return; }
            const btnH = document.getElementById('btn-join-connect') as HTMLButtonElement;
            if (btnH) { btnH.disabled = true; btnH.textContent = '...'; }
            try {
                mostraMessaggio(window.t("msg_connessione_all_archivio_", "Connessione all'Archivio in corso..."), "info");
                const ok = await window.eseguiJoinHub(window.welcomeHubInvite, basePath);
                if (!ok) throw new Error(window.t("msg_error_creating_files", "Error creating local files."));
                document.getElementById('welcome-modal')?.classList.add('hidden-tab');
                const archiveName = window.welcomeHubInvite.name;
                const successMsg = archiveName
                    ? window.t("msg_connesso_con_successo_nome", 'Connesso con successo a "{var0}"! Riavvio in corso...').replace('{var0}', archiveName)
                    : window.t("msg_connesso_con_successo_ria", "Connesso con successo! Riavvio in corso...");
                mostraMessaggio(successMsg, "success");
            } catch (e: any) {
                mostraMessaggio(e.message, "error");
                if (btnH) { btnH.disabled = false; btnH.textContent = window.t("btn_connect", "Connettiti"); }
            }
            return;
        }

        if (!vaultId) {
            mostraMessaggio(
                window.t("msg_picker_required", "Prima apri Google Drive con il pulsante 'Sfoglia' per autorizzare l'accesso alla cartella condivisa."),
                "warning"
            );
            return;
        }
        if (!basePath) {
            mostraMessaggio(
                window.t("msg_seleziona_percorso", "Seleziona una posizione locale per l'archivio."),
                "warning"
            );
            return;
        }

        const btn = document.getElementById('btn-join-connect') as HTMLButtonElement;
        if (btn) { btn.disabled = true; btn.textContent = '...'; }

        try {
            mostraMessaggio(window.t("msg_connessione_all_archivio_", "Connessione all'Archivio in corso..."), "info");
            await window.apiDrive.joinByFolderId(vaultId, vaultName, basePath, window.welcomePusherCreds || null);
            document.getElementById('welcome-modal')?.classList.add('hidden-tab');
            mostraMessaggio(window.t("msg_connesso_con_successo_ria", "Connesso con successo! Riavvio in corso..."), "success");
        } catch (e: any) {
            mostraMessaggio(e.message, "error");
            if (btn) { btn.disabled = false; btn.textContent = window.t("btn_connect", "Connettiti"); }
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
                        throw new Error(window.t("msg_error_creating_files", "Error creating local files."));
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
            btn.innerHTML = window.sanitizeHTML(`<i data-lucide="loader-2" class="w-4 h-4 mr-2 animate-spin"></i> ${window.t("btn_creating", "Creating...")}`);
            if (window.lucide) lucide.createIcons({ nodes: [btn] });
        }
        
        if (window.apiBrowser && window.apiBrowser.createWorkspaceInPath) {
            let config = null;
            if (window.creazioneVaultHub) config = { autoStartCreaHub: true };
            else if (window.creazioneVaultCondiviso) config = { autoStartTrasformaCondiviso: true };
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
