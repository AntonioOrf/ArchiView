(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('welcome-modal')) {
            const html = `
    <div id="welcome-modal" class="modal-overlay hidden-tab z-modal-nested">
        <div class="modal-window max-w-xl relative benvenuto">
            <button id="welcome-close-btn" class="btn btn-ghost btn-icon absolute top-3 right-3 hidden" data-on-click="chiudiWelcomeModal" data-i18n-title="btn_close" data-i18n-aria-label="btn_close" title="Chiudi" aria-label="Chiudi">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
            <h2 class="modal-title" data-i18n="modal_folder_title">Gestione Archivi</h2>
            <p class="modal-sottotitolo mb-4">
                <span data-i18n="welcome_desc_gestione">Scegli una cartella di destinazione per creare un nuovo archivio indipendente, oppure seleziona un archivio già esistente per caricarne i dati.</span>
            </p>

            <div class="benvenuto-colonne" id="welcome-buttons">
                <section id="welcome-recenti" class="hidden" aria-labelledby="welcome-recenti-titolo">
                    <h3 id="welcome-recenti-titolo" class="condivisione-sez" data-i18n="welcome_recent">Recenti</h3>
                    <div id="welcome-recenti-lista"></div>
                </section>
                <div class="flex flex-col">
                <h3 class="condivisione-sez benvenuto-altro" data-i18n="welcome_other">Altro</h3>
                <button data-on-click="selezionaCartellaIniziale" class="scelta-archivio">
                    <i data-lucide="folder-open" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_open_local">Apri Archivio Locale</span>
                </button>
                <button data-on-click="mostraInputNuovaCartella" data-args-click="[&quot;locale&quot;]" class="scelta-archivio">
                    <i data-lucide="folder-plus" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_create_local">Crea Nuova Cartella Locale</span>
                </button>
                
                <button data-on-click="mostraInputNuovaCartella" data-args-click="[&quot;personale&quot;]" class="scelta-archivio">
                    <i data-lucide="cloud" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_create_cloud_private">Crea un Backup Personale</span>
                </button>
                <button data-on-click="mostraInputNuovaCartella" data-args-click="[&quot;hub&quot;]" class="scelta-archivio">
                    <i data-lucide="server" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_create_hub_shared">Crea un Hub Condiviso</span>
                </button>
                <button data-on-click="mostraJoinForm" class="scelta-archivio">
                    <i data-lucide="users" class="w-5 h-5 mr-2"></i>
                    <span data-i18n="btn_join_shared">Unisciti a un Archivio Condiviso</span>
                </button>
                <button data-on-click="mostraCloudExplorer" class="btn btn-ghost text-sm mt-2 self-start">
                    <span data-i18n="btn_restore_drive">Ripristina da Google Drive…</span>
                </button>
                </div>
            </div>

            <div id="welcome-create-form" class="hidden-tab mt-2 pt-4 border-t border-stone-200">
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm" data-i18n="label_archive_name">Nome dell\'archivio</label>
                    <input type="text" id="welcome-new-folder-name" class="form-input w-full text-sm" placeholder="Es. Archivio Manoscritti" data-i18n-placeholder="placeholder_archive_name" data-on-keydown="suInvio" data-args-keydown="[&quot;creaCartellaIniziale&quot;,false]">
                </div>
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm" data-i18n="label_position">Posizione</label>
                    <div class="flex gap-2">
                        <input type="text" id="welcome-new-folder-path" class="form-input flex-1 text-sm font-mono" readonly>
                        <button data-on-click="selezionaPercorsoBase" class="btn btn-secondary text-sm shrink-0" data-i18n="btn_browse">Sfoglia…</button>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-6 pt-4 border-t border-stone-200">
                    <button data-on-click="nascondiInputNuovaCartella" class="btn btn-ghost text-sm text-stone-500 flex items-center gap-1">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> <span data-i18n="btn_go_back">Torna Indietro</span>
                    </button>
                    <button data-on-click="creaCartellaIniziale" class="btn btn-primary text-sm px-6"><span data-i18n="btn_create_and_start">Crea e Avvia</span></button>
                </div>
            </div>

            <div id="welcome-join-form" class="hidden-tab mt-2 border-t border-stone-200">
                <div class="pt-4">
                    <h3 class="modal-title">
                        <span data-i18n="btn_join_shared">Unisciti a un Archivio Condiviso</span>
                    </h3>
                </div>

                <div class="flex flex-col">

                    <div class="flex flex-col min-w-0">

                        <div class="unisciti-passo">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span id="join-step1-badge" class="passo-numero">1</span>
                                <label class="form-label">
                                    <span data-i18n="label_invite_code_opt">Link d'Invito ArchiView</span>
                                </label>
                            </div>
                            <p class="modello-suggerimento mb-2 ml-8"><span data-i18n="join_step1_hint">Paste the archiview://join/... link received from the organizer.</span></p>
                            <input type="text" id="welcome-join-code"
                                class="form-input w-full text-sm font-mono"
                                placeholder="archiview://join/..."
                                data-on-input="seEsiste" data-args-input="[&quot;handleJoinCodeInput&quot;,{&quot;$&quot;:&quot;value&quot;}]">
                            <div id="join-code-ok" class="hidden-tab mt-1.5 text-xs testo-successo flex items-center gap-1.5">
                                <i data-lucide="check-circle" class="w-3.5 h-3.5 shrink-0"></i>
                                <span id="join-code-ok-text"></span>
                            </div>
                            <div id="join-code-err" class="hidden mt-1.5 campo-errore"></div>
                        </div>

                        <div id="join-step-drive" class="hidden-tab unisciti-passo">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span id="join-step2-badge" class="passo-numero">2</span>
                                <label class="form-label" data-i18n="label_authorize_folder">Autorizza accesso cartella Drive</label>
                            </div>
                            <div class="ml-8 mb-2 modello-suggerimento">
                                <span data-i18n="join_step2_hint">First <strong>accept the sharing email from Google Drive</strong>. The folder will appear in <em>"Shared with me"</em>.</span>
                            </div>
                            <button type="button" data-on-click="apriGooglePicker" id="btn-open-picker"
                                class="btn btn-secondary">
                                <i data-lucide="folder-search" class="w-4 h-4 mr-2" aria-hidden="true"></i>
                                <span data-i18n="btn_browse_drive">Sfoglia Google Drive…</span>
                            </button>
                            <div id="join-picker-ok" class="hidden-tab mt-2 text-sm testo-successo flex items-center gap-2">
                                <i data-lucide="folder-check" class="w-4 h-4 shrink-0" aria-hidden="true"></i>
                                <div>
                                    <span class="font-semibold" data-i18n="label_selected_archive">Selezionato:</span>
                                    <span id="join-picker-vault-name" class="font-mono ml-1 text-sm"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col min-w-0">

                        <div class="unisciti-passo">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span id="join-step3-badge" class="passo-numero">3</span>
                                <label class="form-label" data-i18n="label_local_archive_pos">Posizione archivio locale</label>
                            </div>
                            <p class="modello-suggerimento mb-2 ml-8"><span data-i18n="join_step3_hint">Choose where to save the local copy of the archive on your PC.</span></p>
                            <div class="flex gap-2">
                                <input type="text" id="welcome-join-folder-path" class="form-input flex-1 text-sm font-mono" readonly>
                                <button data-on-click="selezionaPercorsoBaseJoin" class="btn btn-secondary text-sm shrink-0" data-i18n="btn_browse">Sfoglia…</button>
                            </div>
                        </div>

                        <div class="pt-4 border-t border-stone-200 flex justify-between items-center">
                            <button data-on-click="nascondiJoinForm" class="btn btn-ghost text-sm text-stone-500 flex items-center gap-1">
                                <i data-lucide="arrow-left" class="w-4 h-4"></i> <span data-i18n="btn_go_back">Torna Indietro</span>
                            </button>
                            <button data-on-click="eseguiJoinVault" id="btn-join-connect" class="btn btn-primary text-sm px-6">
                                <span data-i18n="btn_connect">Connettiti</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="welcome-cloud-explorer" class="hidden-tab mt-2 pt-4 border-t border-stone-200">
                <h3 class="modal-title mb-3">
                    <i data-lucide="cloud" class="w-4 h-4" aria-hidden="true"></i> <span data-i18n="title_select_cloud_archive">Seleziona un Archivio dal Cloud</span>
                </h3>
                <div id="cloud-vaults-list" class="space-y-2 max-h-64 overflow-y-auto pr-2">
                </div>
                <div class="flex justify-between items-center mt-6 pt-4 border-t border-stone-200">
                    <button data-on-click="nascondiCloudExplorer" class="btn btn-ghost text-sm text-stone-500 flex items-center gap-1">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> <span data-i18n="btn_go_back">Torna Indietro</span>
                    </button>
                    <button data-on-click="eseguiRipristinoCloudGlobale" class="btn btn-secondary text-sm" data-i18n-title="title_search_everywhere" title="Se non vedi il tuo archivio, cerca in tutto il Drive"><span data-i18n="btn_search_everywhere">Cerca Ovunque</span></button>
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
        
        mostraMessaggio(window.t("msg_autenticazione_e_ricerca_", "Autenticazione e ricerca archivi in corso…"), "info");
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
                    const div = document.createElement('button');
                    div.type = 'button';
                    div.className = "scelta-archivio justify-between";
                    const dateStr = new Date(v.modifiedTime).toLocaleDateString();
                    
                    const escapedName = escapeHTML(v.name);

                    div.innerHTML = window.sanitizeHTML(`
                        <div class="flex items-center gap-3">
                            <i data-lucide="folder-cloud" class="w-4 h-4" aria-hidden="true"></i>
                            <div>
                                <div class="font-medium text-stone-800">${escapedName}</div>
                                <div class="text-xs text-stone-500"><span data-i18n="label_modified">Modificato:</span> ${dateStr}</div>
                            </div>
                        </div>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-stone-400"></i>
                    `);
                    div.onclick = () => window.eseguiRipristinoCloud(v.id, v.name);
                    listContainer.appendChild(div);
                });
                if (window.lucide) lucide.createIcons({ nodes: [listContainer] });
            }
        } catch(e) {
            mostraMessaggio(window.t("msg_errore_cloud", "Errore Cloud: ") + window.testoErroreDrive(e), "error");
        }
    };

    window.nascondiCloudExplorer = function() {
        document.getElementById('welcome-cloud-explorer').classList.add('hidden-tab');
        document.getElementById('welcome-buttons').classList.remove('hidden-tab');
    };

    function updateJoinStepBadge(step: number, stato: 'pending' | 'active' | 'done') {
        const badge = document.getElementById(`join-step${step}-badge`);
        if (!badge) return;
        badge.className = 'passo-numero' + (stato === 'done' ? ' fatto' : stato === 'active' ? ' attivo' : '');
        badge.textContent = stato === 'done' ? '✓' : String(step);
    }

    function setDriveStepVisible(visible: boolean) {
        document.getElementById('join-step-drive')?.classList.toggle('hidden-tab', !visible);
        const b3 = document.getElementById('join-step3-badge');
        if (b3 && b3.textContent !== '✓') b3.textContent = visible ? '3' : '2';
    }

    function resetJoinState() {
        window.welcomeJoinVaultId = null;
        window.welcomeJoinVaultName = null;
        window.welcomeDriveInvite = null;
        window.welcomeHubInvite = null;

        const codeInput = document.getElementById('welcome-join-code') as HTMLInputElement;
        if (codeInput) codeInput.value = '';

        document.getElementById('join-code-ok')?.classList.add('hidden-tab');
        document.getElementById('join-code-err')?.classList.add('hidden-tab');
        document.getElementById('join-picker-ok')?.classList.add('hidden-tab');

        document.getElementById('btn-open-picker')?.classList.remove('scelta-attiva');

        for (let i = 1; i <= 3; i++) updateJoinStepBadge(i, 'pending');
        setDriveStepVisible(false);
    }

    window.handleJoinCodeInput = function(rawCode: string) {
        const okDiv  = document.getElementById('join-code-ok');
        const errDiv = document.getElementById('join-code-err');
        const okText = document.getElementById('join-code-ok-text');

        okDiv?.classList.add('hidden-tab');
        errDiv?.classList.add('hidden-tab');
        window.welcomeDriveInvite = null;

        let code = rawCode.trim();
        if (code.startsWith('archiview://join/')) code = code.slice('archiview://join/'.length);
        if (!code) { updateJoinStepBadge(1, 'pending'); setDriveStepVisible(false); return; }

        const hubInvite = window.decodeHubInvite ? window.decodeHubInvite(rawCode) : null;
        if (hubInvite) {
            window.welcomeHubInvite = hubInvite;
            window.welcomeDriveInvite = null;
            const archiveLabel = hubInvite.name
                ? `"${hubInvite.name}"`
                : window.t("hub_fallback_name", "Questo archivio condiviso");
            if (okText) okText.textContent =
                `${archiveLabel} — ${window.t("hub_join_ok_suffix", "nessun accesso Google richiesto: scegli la cartella locale e connettiti.")}`;
            okDiv?.classList.remove('hidden-tab');
            if (window.lucide) lucide.createIcons({ nodes: [okDiv] });
            updateJoinStepBadge(1, 'done');
            updateJoinStepBadge(3, 'active');
            setDriveStepVisible(false);
            return;
        }
        window.welcomeHubInvite = null;

        try {
            let b64 = code;
            while (b64.length % 4 !== 0) b64 += '=';
            const decoded = atob(b64);
            const parts = decoded.split('|');
            if (parts.length < 5) throw new Error('formato non valido');

            const [, , , , pAuto, , vaultName] = parts;

            window.welcomeDriveInvite = { driveAutofetch: pAuto === '1' };

            const displayName = (vaultName || 'Archivio Condiviso').replace(/_ArchiView$/, '');
            if (okText) okText.textContent =
                `"${displayName}" ${window.t("join_code_ok_suffix", "— now click \"Browse Google Drive\" to authorize access.")}`;
            okDiv?.classList.remove('hidden-tab');
            if (window.lucide) lucide.createIcons({ nodes: [okDiv] });

            setDriveStepVisible(true);

            document.getElementById('btn-open-picker')?.classList.add('scelta-attiva');

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
        const modalWin = document.querySelector('#welcome-modal .modal-window') as HTMLElement;
        if (modalWin) { modalWin.classList.remove('max-w-lg', 'p-8'); modalWin.classList.add('max-w-3xl'); }
        if (window.lucide) lucide.createIcons({ nodes: [joinForm] });

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
                    await window.apiSettings.patch({ lastVaultBasePath: basePath });
                }
            }
        }
    };

    window.apriGooglePicker = async function() {
        if (!window.apiDrive) return;
        try {
            mostraMessaggio(
                window.t("msg_autenticazione_e_ricerca_", "Apertura di Google Picker nel browser… Attendi."),
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

                if (!window.welcomeDriveInvite) updateJoinStepBadge(1, 'done');
                updateJoinStepBadge(2, 'done');
                updateJoinStepBadge(3, 'active');
            } else {
                mostraMessaggio(window.t("msg_selezione_annullata", "Selezione annullata."), "warning");
            }
        } catch (e: any) {
            mostraMessaggio(window.t("msg_errore", "Errore: ") + window.testoErroreDrive(e), "error");
        }
    };

    window.eseguiJoinVault = async function() {
        const vaultId: string | null = window.welcomeJoinVaultId || null;
        const vaultName: string = window.welcomeJoinVaultName || "Vault_Condiviso";
        const basePath: string = (document.getElementById('welcome-join-folder-path') as HTMLInputElement)?.value.trim() || '';

        if (window.welcomeHubInvite) {
            if (!basePath) { mostraMessaggio(window.t("msg_seleziona_percorso", "Seleziona una posizione locale per l'archivio."), "warning"); return; }
            const btnH = document.getElementById('btn-join-connect') as HTMLButtonElement;
            if (btnH) { btnH.disabled = true; btnH.textContent = '...'; }
            try {
                mostraMessaggio(window.t("msg_connessione_all_archivio_", "Connessione all'Archivio in corso…"), "info");
                const ok = await window.eseguiJoinHub(window.welcomeHubInvite, basePath);
                if (!ok) throw new Error(window.t("msg_error_creating_files", "Error creating local files."));
                document.getElementById('welcome-modal')?.classList.add('hidden-tab');
                const archiveName = window.welcomeHubInvite.name;
                const successMsg = archiveName
                    ? window.t("msg_connesso_con_successo_nome", 'Connesso a "{var0}". Riavvio in corso…').replace('{var0}', archiveName)
                    : window.t("msg_connesso_con_successo_ria", 'Connesso. Riavvio in corso…');
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
            await window.apiDrive.joinByFolderId(vaultId, vaultName, basePath, window.welcomeDriveInvite || null);
            document.getElementById('welcome-modal')?.classList.add('hidden-tab');
            mostraMessaggio(window.t("msg_connesso_con_successo_ria", 'Connesso. Riavvio in corso…'), "success");
        } catch (e: any) {
            mostraMessaggio(e.message, "error");
            if (btn) { btn.disabled = false; btn.textContent = window.t("btn_connect", "Connettiti"); }
        }
    };



    window.eseguiRipristinoCloudGlobale = async function() {
        await window.eseguiRipristinoCloud(null, 'Vault_Recuperato');
    };

    window.eseguiRipristinoCloud = async function(vaultId, defaultName) {
        mostraMessaggio(window.t("msg_scaricamento_archivio", "Scaricamento archivio..."), "info");
        try {
            const driveData = await window.apiDrive.pull(vaultId);
            
            if (!driveData || !driveData.database) {
                mostraMessaggio(window.t("msg_nessun_database_trovato_n", "Nessun database trovato nell'Archivio selezionato."), "warning");
                return;
            }
            
            mostraMessaggio(window.t("msg_archivio_scaricato_selezi", 'Archivio scaricato. Scegli dove salvarlo sul PC.'), "info");
            
            if (window.apiBrowser && window.apiBrowser.selectBaseDirectory) {
                const basePath = await window.apiBrowser.selectBaseDirectory(window.t("dialog_select_folder", "Seleziona la posizione per la nuova cartella"));
                if (basePath) {
                    if (window.apiSettings) {
                        await window.apiSettings.patch({ lastVaultBasePath: basePath });
                    }
                    const driveConfig = vaultId ? { isSharedVault: true, sharedVaultId: vaultId } : null;
                    const success = await window.apiBrowser.cloneWorkspaceHub(basePath, defaultName, driveConfig, driveData.database);
                    if (success) {
                        document.getElementById('welcome-modal').classList.add('hidden-tab');
                        mostraMessaggio(window.t("msg_archivio_ripristinato_con", 'Archivio ripristinato. Riavvio in corso…'), "success");
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
                    await window.apiSettings.patch({ lastVaultBasePath: basePath });
                }
            }
        }
    };

    window.creaCartellaIniziale = async function() {
        const btn = (event?.target && (event.target as HTMLElement).tagName === 'BUTTON' ? event.target : document.querySelector('#welcome-create-form .btn-primary')) as HTMLButtonElement | null;
        const name = document.getElementById('welcome-new-folder-name').value.trim();
        const basePath = document.getElementById('welcome-new-folder-path').value.trim();
        if (!name || !basePath) return;
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = window.sanitizeHTML(`<i data-lucide="loader-2" class="w-4 h-4 mr-2 animate-spin"></i> ${window.t("btn_creating", "Creating…")}`);
            if (window.lucide) lucide.createIcons({ nodes: [btn] });
        }
        
        if (window.apiBrowser && window.apiBrowser.createWorkspaceInPath) {
            let config = null;
            if (window.creazioneVaultHub) config = { autoStartCreaHub: true };
            else if (window.creazioneVaultCondiviso) config = { autoStartTrasformaCondiviso: true };
            else if (window.creazioneVaultPersonale) config = { autoStartTrasformaPersonale: true };
            
            let success = false;
            let motivo = '';
            try {
                success = await window.apiBrowser.createWorkspaceInPath(basePath, name, config);
            } catch (e) {
                console.error('Creazione dell\'archivio non riuscita:', e);
                motivo = e && e.message ? e.message : String(e);
            }
            if (success) {
                document.getElementById('welcome-modal').classList.add('hidden-tab');
            } else {
                mostraMessaggio(window.t('msg_create_archive_failed', 'L\'archivio non è stato creato: ') + (motivo || name), 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = window.sanitizeHTML(`<span data-i18n="btn_create_and_start">${escapeHTML(window.t('btn_create_and_start', 'Crea e Avvia'))}</span>`);
                }
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
        
        const closeBtn = document.getElementById('welcome-close-btn');
        if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
            const currentPath = await window.apiBrowser.getWorkspacePath();
            if (currentPath) {
                closeBtn.classList.remove('hidden');
            } else {
                closeBtn.classList.add('hidden');
            }
        }

        await disegnaArchiviRecenti();
        modal.classList.remove('hidden-tab');
        modal.style.setProperty('display', 'flex', 'important');
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
    };

    async function disegnaArchiviRecenti() {
        const sezione = document.getElementById('welcome-recenti');
        const lista = document.getElementById('welcome-recenti-lista');
        if (!sezione || !lista || !window.apiBrowser?.getRecentWorkspaces) return;
        let recenti = [];
        let attuale = '';
        try {
            recenti = await window.apiBrowser.getRecentWorkspaces();
            attuale = await window.apiBrowser.getWorkspacePath();
        } catch (e) {
            console.error('Archivi recenti non letti, la gestione archivi resta senza elenco:', e);
        }
        lista.replaceChildren();
        for (const voce of recenti || []) {
            const percorso = voce.path || voce;
            const [tipo, chiave, testo] = voce.provider === 'hub' ? ['hub', 'vault_type_hub', 'Hub condiviso']
                : voce.isShared ? ['condiviso', 'vault_type_shared', 'Condiviso']
                : voce.isPersonal ? ['backup', 'vault_type_backup', 'Backup personale']
                : ['locale', 'vault_type_local', 'Locale'];
            const riga = document.createElement('button');
            riga.type = 'button';
            riga.className = 'archivio-recente';
            const nome = document.createElement('span');
            nome.className = 'archivio-recente-nome';
            nome.textContent = String(percorso).split(/[\\/]/).pop() || String(percorso);
            const stato = document.createElement('span');
            stato.className = 'archivio-recente-tipo';
            const pallino = document.createElement('span');
            pallino.className = 'pallino-stato tipo-' + tipo;
            pallino.setAttribute('aria-hidden', 'true');
            stato.append(pallino, percorso === attuale ? window.t('welcome_recent_open', 'aperto ora') : window.t(chiave, testo));
            const via = document.createElement('span');
            via.className = 'archivio-recente-percorso';
            via.textContent = percorso;
            riga.append(nome, stato, via);
            if (percorso === attuale) {
                riga.disabled = true;
                riga.setAttribute('aria-current', 'true');
            } else {
                riga.onclick = async () => {
                    try {
                        if (!(await window.apiBrowser.openRecentWorkspace(percorso))) window.archivioRecenteNonTrovato(percorso);
                    } catch (e) {
                        mostraMessaggio(window.t('msg_errore', 'Errore: ') + e.message, 'error');
                    }
                };
            }
            lista.appendChild(riga);
        }
        sezione.classList.toggle('hidden', !lista.childElementCount);
    }
})();
