// @ts-nocheck

// Modal "Condivisione" — Hub-first. Consolida la gestione di inviti, membri e stato
// del repository (prima sparsa tra cloudModal, settingsModal e welcomeModal).
// Quattro stati mutuamente esclusivi: locale (crea Hub), Drive legacy (migra), membro, owner.
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('share-modal')) return;
        const html = `
    <div id="share-modal" class="modal-overlay hidden-tab z-60 fixed inset-0 flex items-center justify-center">
        <div class="modal-window w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div class="modal-header shrink-0 border-b border-stone-200 dark:border-stone-700">
                <h3 class="modal-title text-stone-800 dark:text-stone-100 flex items-center gap-2">
                    <i data-lucide="users-round" class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0"></i>
                    <span data-i18n="share_title">Condivisione</span>
                </h3>
                <button type="button" onclick="chiudiShareModal()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body p-6 flex-1 overflow-y-auto custom-scroll min-h-0">

                <!-- LOADING (probe ruolo) -->
                <div id="share-state-loading" class="hidden-tab text-center py-12 text-stone-400">
                    <i data-lucide="loader-2" class="w-7 h-7 animate-spin mx-auto"></i>
                </div>

                <!-- STATO: ARCHIVIO LOCALE -->
                <div id="share-state-local" class="hidden-tab text-center py-4">
                    <div class="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="server" class="w-7 h-7"></i>
                    </div>
                    <h3 class="text-xl font-serif font-semibold mb-2 text-stone-800 dark:text-stone-100"><span data-i18n="share_local_title">Condividi questo archivio</span></h3>
                    <p class="text-sm text-stone-600 dark:text-stone-400 max-w-sm mx-auto mb-6"><span data-i18n="share_local_desc">Crea un archivio condiviso gratuito per lavorare insieme ai tuoi colleghi, oppure unisciti a un archivio con un link di invito.</span></p>
                    <div class="flex flex-col gap-3 max-w-xs mx-auto">
                        <div class="text-left">
                            <label for="share-hub-name" class="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1"><span data-i18n="share_local_name_label">Nome dell'archivio (lo vedranno tutti i collaboratori)</span></label>
                            <input type="text" id="share-hub-name" class="form-input w-full text-sm" data-i18n-placeholder="share_local_name_ph" placeholder="Es. Manoscritti Datini">
                        </div>
                        <button onclick="creaHubDaShareModal()" class="btn btn-block justify-center py-3 text-sm text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700">
                            <i data-lucide="server" class="w-4 h-4 mr-2"></i> <span data-i18n="share_local_share_online">Condividi online</span>
                        </button>
                        <button onclick="uniscitiDaShareModal()" class="btn btn-secondary btn-block justify-center py-3 text-sm border-stone-300 dark:border-stone-600">
                            <i data-lucide="log-in" class="w-4 h-4 mr-2"></i> <span data-i18n="share_local_have_invite">Ho ricevuto un invito</span>
                        </button>
                        <button onclick="chiudiShareModal(); if(window.apriCloudModal) apriCloudModal();" class="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 mt-1">
                            <span data-i18n="share_local_backup_link">Vuoi solo una copia di sicurezza privata? Backup su Google Drive</span>
                        </button>
                    </div>
                </div>

                <!-- STATO: ARCHIVIO GOOGLE DRIVE LEGACY -->
                <div id="share-state-drive" class="hidden-tab flex flex-col gap-4">
                    <div class="flex items-center gap-3.5 p-4 rounded-lg border border-blue-200 dark:border-blue-700/50 bg-blue-50/60 dark:bg-blue-900/20">
                        <div class="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0"><i data-lucide="cloud" class="w-6 h-6"></i></div>
                        <div class="min-w-0">
                            <p class="font-serif text-base font-semibold text-stone-800 dark:text-stone-100"><span data-i18n="share_drive_title">Archivio su Google Drive</span></p>
                            <p class="text-xs text-stone-500 dark:text-stone-400"><span data-i18n="share_drive_sub">condivisione tramite permessi Drive</span></p>
                        </div>
                    </div>
                    <div class="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 text-sm text-stone-700 dark:text-stone-300">
                        <i data-lucide="info" class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"></i>
                        <span data-i18n="share_drive_note">La condivisione ora avviene tramite l'archivio condiviso di ArchiView: inviti con un semplice link, revoca immediata, aggiornamenti automatici.</span>
                    </div>
                    <button onclick="apriPannelloMigrazioneShare()" class="btn btn-block justify-center py-3 text-sm text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700">
                        <i data-lucide="server" class="w-4 h-4 mr-2"></i> <span data-i18n="share_drive_migrate">Passa all'archivio condiviso</span>
                    </button>
                    <button onclick="chiudiShareModal(); if(window.apriCloudModal) apriCloudModal();" class="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-center mx-auto">
                        <span data-i18n="share_drive_manage_backup_link">Gestisci il backup su Google Drive</span>
                    </button>
                </div>

                <!-- STATO: PANNELLO DI MIGRAZIONE (Drive legacy -> archivio condiviso) -->
                <div id="share-state-migrate" class="hidden-tab flex flex-col gap-4 text-center py-4">
                    <div class="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <i data-lucide="server" class="w-7 h-7"></i>
                    </div>
                    <h3 class="text-xl font-serif font-semibold text-stone-800 dark:text-stone-100"><span data-i18n="share_migrate_panel_title">Passare all'archivio condiviso?</span></h3>
                    <ul class="text-sm text-stone-600 dark:text-stone-400 max-w-sm mx-auto text-left list-disc list-inside space-y-1.5">
                        <li><span data-i18n="share_migrate_bullet1">L'archivio resta identico sul tuo PC.</span></li>
                        <li><span data-i18n="share_migrate_bullet2">Il backup su Google Drive resta come copia di sicurezza.</span></li>
                        <li><span data-i18n="share_migrate_bullet3">I collaboratori attuali dovranno ricevere un nuovo link di invito.</span></li>
                    </ul>
                    <div class="flex gap-2.5 justify-center max-w-xs mx-auto w-full pt-2">
                        <button onclick="mostraStatoShare('share-state-drive')" class="btn btn-secondary flex-1 justify-center py-2.5 text-sm border-stone-300 dark:border-stone-600"><span data-i18n="btn_cancel">Annulla</span></button>
                        <button onclick="confermaMigrazioneShare()" class="btn flex-1 justify-center py-2.5 text-sm text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700"><span data-i18n="btn_continue">Continua</span></button>
                    </div>
                </div>

                <!-- STATO: MEMBRO -->
                <div id="share-state-member" class="hidden-tab flex flex-col gap-4">
                    <div class="flex items-center gap-3.5 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-900/20">
                        <div class="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><i data-lucide="server" class="w-6 h-6"></i></div>
                        <div class="flex-1 min-w-0">
                            <p class="font-serif text-base font-semibold text-stone-800 dark:text-stone-100 flex items-center gap-2 flex-wrap">
                                <span id="share-member-reponame" class="truncate"></span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold uppercase tracking-wide shrink-0"><span data-i18n="share_badge_member">Collaboratore</span></span>
                            </p>
                            <p id="share-member-meta" class="text-xs text-stone-500 dark:text-stone-400"></p>
                        </div>
                    </div>
                    <div class="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 text-sm text-stone-700 dark:text-stone-300">
                        <i data-lucide="info" class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"></i>
                        <span data-i18n="share_member_note">Questo archivio è condiviso con te. Solo il proprietario può invitare o rimuovere collaboratori.</span>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold mb-1 text-stone-800 dark:text-stone-200"><span data-i18n="share_sync_title">Sincronizzazione</span></h4>
                        <p class="text-xs text-stone-500 dark:text-stone-400 mb-3"><span data-i18n="share_sync_desc">Scarica le modifiche dei colleghi o invia le tue all'archivio condiviso.</span></p>
                        <div class="flex gap-2.5">
                            <button onclick="riceviModificheHub()" class="btn btn-secondary flex-1 flex-col items-center justify-center py-2.5 text-sm border-stone-300 dark:border-stone-600"><span class="flex items-center"><i data-lucide="download-cloud" class="w-4 h-4 mr-2"></i> <span data-i18n="share_receive">Ricevi modifiche</span></span><span class="text-[11px] font-normal opacity-70 mt-0.5" data-i18n="share_sync_receive_desc">Scarica le novità dei colleghi</span></button>
                            <button onclick="inviaModificheHub()" class="btn flex-1 flex-col items-center justify-center py-2.5 text-sm text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700"><span class="flex items-center"><i data-lucide="upload-cloud" class="w-4 h-4 mr-2"></i> <span data-i18n="share_send">Invia modifiche</span></span><span class="text-[11px] font-normal opacity-80 mt-0.5" data-i18n="share_sync_send_desc">Pubblica le tue modifiche</span></button>
                        </div>
                    </div>
                    <div id="share-member-attachments-box"></div>
                    <div class="pt-4 border-t border-stone-200 dark:border-stone-700 flex flex-col gap-3">
                        <label class="flex items-center gap-2.5 cursor-pointer text-sm text-stone-700 dark:text-stone-300">
                            <input type="checkbox" id="share-member-autofetch" onchange="salvaAutofetchShare('share-member')" class="form-checkbox w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500">
                            <span data-i18n="settings_autofetch_title">Sincronizzazione automatica (Autofetch)</span>
                        </label>
                        <div class="flex items-center gap-2.5 pl-7 text-sm text-stone-600 dark:text-stone-400">
                            <span data-i18n="settings_autofetch_interval">Intervallo di controllo:</span>
                            <select id="share-member-autofetch-interval" onchange="salvaAutofetchShare('share-member')" class="form-input text-sm py-1 px-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm">
                                <option value="1" data-i18n="settings_autofetch_1m">1 minuto</option>
                                <option value="5" data-i18n="settings_autofetch_5m">5 minuti</option>
                                <option value="10" data-i18n="settings_autofetch_10m">10 minuti</option>
                                <option value="30" data-i18n="settings_autofetch_30m">30 minuti</option>
                            </select>
                        </div>
                        <button onclick="abbandonaArchivioShare()" class="text-sm text-stone-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1.5 self-start">
                            <i data-lucide="log-out" class="w-4 h-4"></i> <span data-i18n="share_member_leave">Abbandona questo archivio condiviso</span>
                        </button>
                    </div>
                </div>

                <!-- STATO: PROPRIETARIO -->
                <div id="share-state-owner" class="hidden-tab flex flex-col gap-5">
                    <div class="flex items-center gap-3.5 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-900/20">
                        <div class="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><i data-lucide="server" class="w-6 h-6"></i></div>
                        <div class="flex-1 min-w-0">
                            <p class="font-serif text-base font-semibold text-stone-800 dark:text-stone-100 flex items-center gap-2 flex-wrap">
                                <span id="share-owner-reponame" class="truncate"></span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold uppercase tracking-wide shrink-0"><span data-i18n="share_badge_owner">Proprietario</span></span>
                            </p>
                            <p id="share-owner-meta" class="text-xs text-stone-500 dark:text-stone-400"></p>
                        </div>
                    </div>

                    <!-- SINCRONIZZAZIONE -->
                    <div>
                        <h4 class="text-sm font-bold mb-1 text-stone-800 dark:text-stone-200"><span data-i18n="share_sync_title">Sincronizzazione</span></h4>
                        <p class="text-xs text-stone-500 dark:text-stone-400 mb-3"><span data-i18n="share_sync_desc">Scarica le modifiche dei colleghi o invia le tue all'archivio condiviso.</span></p>
                        <div class="flex gap-2.5">
                            <button onclick="riceviModificheHub()" class="btn btn-secondary flex-1 flex-col items-center justify-center py-2.5 text-sm border-stone-300 dark:border-stone-600"><span class="flex items-center"><i data-lucide="download-cloud" class="w-4 h-4 mr-2"></i> <span data-i18n="share_receive">Ricevi modifiche</span></span><span class="text-[11px] font-normal opacity-70 mt-0.5" data-i18n="share_sync_receive_desc">Scarica le novità dei colleghi</span></button>
                            <button onclick="inviaModificheHub()" class="btn flex-1 flex-col items-center justify-center py-2.5 text-sm text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700"><span class="flex items-center"><i data-lucide="upload-cloud" class="w-4 h-4 mr-2"></i> <span data-i18n="share_send">Invia modifiche</span></span><span class="text-[11px] font-normal opacity-80 mt-0.5" data-i18n="share_sync_send_desc">Pubblica le tue modifiche</span></button>
                        </div>
                    </div>

                    <!-- INVITA -->
                    <div>
                        <h4 class="text-sm font-bold mb-1 text-stone-800 dark:text-stone-200 flex items-center gap-2"><i data-lucide="user-plus" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i> <span data-i18n="share_invite_title">Invita un collaboratore</span></h4>
                        <p class="text-xs text-stone-500 dark:text-stone-400 mb-3"><span data-i18n="share_invite_desc">Crea un link d'invito personale. Ogni link crea un collaboratore che puoi revocare in qualsiasi momento.</span></p>
                        <div class="flex gap-2">
                            <input type="text" id="share-invite-label" class="form-input flex-1 text-sm" data-i18n-placeholder="share_invite_label_ph" placeholder="Nome del collaboratore (es. Maria)" onkeydown="if(event.key==='Enter') generaInvitoShare()">
                            <button onclick="generaInvitoShare()" class="btn justify-center px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 shrink-0"><span data-i18n="share_invite_generate">Crea link di invito</span></button>
                        </div>
                        <div id="share-invite-linkrow" class="hidden-tab mt-2.5 flex gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50">
                            <input type="text" id="share-invite-link" readonly class="flex-1 bg-transparent text-xs font-mono text-emerald-700 dark:text-emerald-300 px-1.5 outline-none">
                            <button onclick="copiaInvitoShare()" class="btn justify-center px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 border-none shrink-0"><i data-lucide="copy" class="w-3.5 h-3.5 mr-1"></i> <span data-i18n="btn_copy">Copia</span></button>
                        </div>
                        <p class="text-[11px] text-stone-400 dark:text-stone-500 mt-1.5"><span data-i18n="share_invite_hint">Chi riceve il link deve avere ArchiView installato: gli basterà cliccarlo.</span></p>
                    </div>

                    <!-- COLLABORATORI -->
                    <div>
                        <h4 class="text-sm font-bold mb-2 text-stone-800 dark:text-stone-200 flex items-center gap-2"><i data-lucide="users" class="w-4 h-4 text-stone-500 dark:text-stone-400"></i> <span data-i18n="share_members_title">Collaboratori</span></h4>
                        <div id="share-members-list" class="flex flex-col gap-1.5"></div>
                    </div>

                    <!-- ALLEGATI -->
                    <div id="share-owner-attachments-box"></div>

                    <!-- OPZIONI -->
                    <div class="pt-4 border-t border-stone-200 dark:border-stone-700 flex flex-col gap-3">
                        <label class="flex items-center gap-2.5 cursor-pointer text-sm text-stone-700 dark:text-stone-300">
                            <input type="checkbox" id="share-owner-autofetch" onchange="salvaAutofetchShare('share-owner')" class="form-checkbox w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500">
                            <span data-i18n="settings_autofetch_title">Sincronizzazione automatica (Autofetch)</span>
                        </label>
                        <div class="flex items-center gap-2.5 pl-7 text-sm text-stone-600 dark:text-stone-400">
                            <span data-i18n="settings_autofetch_interval">Intervallo di controllo:</span>
                            <select id="share-owner-autofetch-interval" onchange="salvaAutofetchShare('share-owner')" class="form-input text-sm py-1 px-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm">
                                <option value="1" data-i18n="settings_autofetch_1m">1 minuto</option>
                                <option value="5" data-i18n="settings_autofetch_5m">5 minuti</option>
                                <option value="10" data-i18n="settings_autofetch_10m">10 minuti</option>
                                <option value="30" data-i18n="settings_autofetch_30m">30 minuti</option>
                            </select>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
    });

    function mostraStatoShare(id) {
        ['share-state-loading', 'share-state-local', 'share-state-drive', 'share-state-migrate', 'share-state-member', 'share-state-owner']
            .forEach(s => document.getElementById(s)?.classList.toggle('hidden-tab', s !== id));
    }
    window.mostraStatoShare = mostraStatoShare;

    window.apriShareModal = async function() {
        const modal = document.getElementById('share-modal');
        if (!modal) return;
        modal.classList.remove('hidden-tab');
        if (window.lucide) lucide.createIcons({ nodes: [modal] });

        const vaultConfig = window.apiBrowser?.getVaultConfig ? await window.apiBrowser.getVaultConfig() : { vaultType: 'local' };
        const isHub = !!window.hubConfig || vaultConfig.provider === 'hub';

        if (isHub && window.hubConfig) {
            mostraStatoShare('share-state-loading');
            const role = await window.getHubRole();
            // Mai il repoId: nome scelto dall'owner e condiviso via invito.
            const repoName = window.hubConfig.name
                || (window.appData && window.appData.nomeArchivio)
                || window.t("hub_fallback_name", "Archivio condiviso");
            const meta = window.hubConfig.lastLoadedAt
                ? window.t("share_last_update", "Ultimo aggiornamento: {var0}").replace('{var0}', new Date(window.hubConfig.lastLoadedAt).toLocaleString(window.linguaAttuale === 'en' ? 'en-US' : 'it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))
                : window.t("share_last_update_unknown", "Ultimo aggiornamento: sconosciuto");
            const attachmentsOn = window.hubConfig.attachmentsMode !== 'off';
            const settings = window.apiSettings ? await window.apiSettings.get() : {};
            const autofetchOn = settings.autofetchEnabled !== false;
            const autofetchInterval = String(settings.autofetchInterval || 5);

            const applyAutofetch = (prefix) => {
                const cbA = document.getElementById(prefix + '-autofetch');
                const selA = document.getElementById(prefix + '-autofetch-interval');
                if (cbA) cbA.checked = autofetchOn;
                if (selA) selA.value = autofetchInterval;
            };

            if (role === 'owner') {
                const nameEl = document.getElementById('share-owner-reponame');
                nameEl.textContent = repoName;
                // Click sul nome (solo owner) → rinomina inline: propaga a locale + membri.
                nameEl.style.cursor = 'pointer';
                nameEl.title = window.t("share_owner_rename_hint", "Clicca per rinominare l'archivio");
                nameEl.onclick = () => window.avviaRinominaVaultHub(nameEl);
                document.getElementById('share-owner-meta').textContent = meta;
                window.renderAttachmentsBoxShare('share-owner', attachmentsOn, false);
                applyAutofetch('share-owner');
                mostraStatoShare('share-state-owner');
                await window.renderMembriShare();
            } else {
                // 'member' o 'unknown' (offline/errore): vista membro, nessun controllo inviti.
                document.getElementById('share-member-reponame').textContent = repoName;
                document.getElementById('share-member-meta').textContent = meta;
                window.renderAttachmentsBoxShare('share-member', attachmentsOn, true);
                applyAutofetch('share-member');
                mostraStatoShare('share-state-member');
            }
        } else if (vaultConfig.vaultType && vaultConfig.vaultType !== 'local') {
            mostraStatoShare('share-state-drive');
        } else {
            const nameInput = document.getElementById('share-hub-name');
            if (nameInput && !nameInput.value) nameInput.value = window.nomeVaultDefault ? await window.nomeVaultDefault() : '';
            mostraStatoShare('share-state-local');
        }

        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
    };

    window.chiudiShareModal = function() {
        document.getElementById('share-modal')?.classList.add('hidden-tab');
    };

    // Rinomina inline del nome archivio nella vista owner: sostituisce l'etichetta con un input,
    // commit su Enter/blur, annulla su Esc. Delega la persistenza+push a rinominaVaultHub.
    window.avviaRinominaVaultHub = function(labelEl) {
        if (!labelEl || labelEl.dataset.editing === '1') return;
        const current = labelEl.textContent || '';
        labelEl.dataset.editing = '1';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = current;
        input.maxLength = 80;
        input.className = 'bg-transparent border-b border-current outline-none w-full';
        let done = false;
        const restore = (text) => {
            if (done) return; done = true;
            labelEl.textContent = text;
            delete labelEl.dataset.editing;
        };
        const commit = async () => {
            if (done) return; // già annullato via Esc
            const next = input.value.trim();
            if (!next || next === current) { restore(current); return; }
            restore(next); // ottimistico
            const ok = await window.rinominaVaultHub(next);
            if (!ok) labelEl.textContent = current; // rollback visuale se fallisce
        };
        input.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            else if (e.key === 'Escape') { done = true; delete labelEl.dataset.editing; labelEl.textContent = current; }
        };
        input.onblur = commit;
        labelEl.textContent = '';
        labelEl.appendChild(input);
        input.focus();
        input.select();
    };

    window.creaHubDaShareModal = async function() {
        if (typeof window.creaRepositoryHub !== 'function') return;
        const nameInput = document.getElementById('share-hub-name');
        const chosen = nameInput && nameInput.value.trim();
        window.chiudiShareModal();
        // chosen o null → creaRepositoryHub usa il basename della cartella come default.
        await window.creaRepositoryHub(chosen || null);
    };

    // Salva le impostazioni autofetch dal modal Condivisione e riavvia il timer.
    window.salvaAutofetchShare = async function(prefix) {
        if (!window.apiSettings) return;
        const cb = document.getElementById(prefix + '-autofetch');
        const sel = document.getElementById(prefix + '-autofetch-interval');
        const settings = await window.apiSettings.get();
        if (cb) settings.autofetchEnabled = cb.checked;
        if (sel) settings.autofetchInterval = parseInt(sel.value, 10);
        await window.apiSettings.save(settings);
        if (typeof window.avviaAutofetchHub === 'function') window.avviaAutofetchHub();
    };

    window.uniscitiDaShareModal = async function() {
        window.chiudiShareModal();
        if (window.mostraWelcomeModal) await window.mostraWelcomeModal();
        if (window.mostraJoinForm) window.mostraJoinForm();
    };

    window.generaInvitoShare = async function() {
        if (typeof window.generaInvitoHub !== 'function') return;
        const labelInput = document.getElementById('share-invite-label');
        const label = labelInput ? labelInput.value.trim() : '';
        const code = await window.generaInvitoHub(label);
        if (!code) return;
        const link = `archiview://join/${code}`;
        const row = document.getElementById('share-invite-linkrow');
        const linkInput = document.getElementById('share-invite-link');
        if (linkInput) linkInput.value = link;
        if (row) { row.classList.remove('hidden-tab'); if (window.lucide) lucide.createIcons({ nodes: [row] }); }
        try {
            await navigator.clipboard.writeText(link);
            const copiedMsg = label
                ? window.t("share_invite_copied", "Link copiato. Invialo a {var0} per email o messaggio.").replace('{var0}', label)
                : window.t("share_invite_copied_generic", "Link copiato. Invialo al collaboratore per email o messaggio.");
            mostraMessaggio(copiedMsg, "success");
        }
        catch { mostraMessaggio(window.t("share_invite_generated", "Invito creato. Copia il link e condividilo."), "success"); }
        if (labelInput) labelInput.value = '';
        await window.renderMembriShare();
    };

    window.copiaInvitoShare = async function() {
        const linkInput = document.getElementById('share-invite-link');
        if (!linkInput || !linkInput.value) return;
        try { await navigator.clipboard.writeText(linkInput.value); mostraMessaggio(window.t("msg_codice_copiato_negli_appu", "Codice copiato negli appunti!"), "success"); }
        catch { linkInput.select(); }
    };

    window.renderMembriShare = async function() {
        const box = document.getElementById('share-members-list');
        if (!box || typeof window.listaMembriHub !== 'function') return;
        box.innerHTML = window.sanitizeHTML(`<div class="text-center p-3 text-stone-400"><i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto"></i></div>`);
        if (window.lucide) lucide.createIcons({ nodes: [box] });

        const membri = (await window.listaMembriHub()).filter(m => m.role !== 'owner');
        if (!membri.length) {
            box.innerHTML = window.sanitizeHTML(`<div class="text-center p-4 text-sm text-stone-400 border border-dashed border-stone-200 dark:border-stone-700 rounded-lg">${window.escapeHTML(window.t("share_members_empty", "Nessun collaboratore invitato."))}</div>`);
            return;
        }
        box.innerHTML = '';
        membri.forEach(m => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-3 p-2.5 border border-stone-200 dark:border-stone-700 rounded-lg bg-stone-50 dark:bg-stone-800/40';
            const rawLabel = m.label || m.memberId;
            const label = window.escapeHTML(rawLabel);
            const initial = window.escapeHTML((rawLabel.trim()[0] || '?').toUpperCase());
            const nameCls = m.revoked ? 'line-through text-stone-400' : 'text-stone-800 dark:text-stone-200';
            const chip = m.revoked
                ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-400 font-bold uppercase tracking-wide shrink-0">${window.escapeHTML(window.t("share_chip_revoked", "Revocato"))}</span>`
                : '';
            row.innerHTML = window.sanitizeHTML(`
                <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 font-bold text-sm">${initial}</div>
                <div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate ${nameCls}">${label}</div></div>
                ${chip}
            `);
            if (!m.revoked) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-ghost text-stone-400 hover:text-red-600 dark:hover:text-red-400 text-xs py-1 px-2.5 shrink-0';
                btn.textContent = window.t("btn_revoke", "Revoca");
                btn.onclick = () => window.revocaMembroShare(m.memberId, rawLabel);
                row.appendChild(btn);
            }
            box.appendChild(row);
        });
        if (window.lucide) lucide.createIcons({ nodes: [box] });
    };

    window.revocaMembroShare = function(memberId, label) {
        if (!memberId) return;
        const doRevoke = async () => {
            if (await window.revocaMembroHub(memberId)) {
                mostraMessaggio(window.t("msg_membro_revocato", "Accesso revocato."), "success");
                await window.renderMembriShare();
            } else {
                mostraMessaggio(window.t("msg_errore_revoca", "Errore durante la revoca."), "error");
            }
        };
        const msg = window.t("share_revoke_confirm", "Revocare l'accesso di questo collaboratore? Il suo link d'invito smetterà di funzionare.");
        if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, doRevoke);
        else doRevoke();
    };

    // Disegna la card Allegati nello stato owner/member: toggle diretto se Google Drive è già
    // collegato, altrimenti una card di collegamento guidata al posto dell'errore hard-fail
    // (senza Drive i chunk dell'uploader non possono essere caricati sull'Hub).
    window.renderAttachmentsBoxShare = function(prefix, attachmentsOn, isMember) {
        const box = document.getElementById(prefix + '-attachments-box');
        if (!box) return;
        const driveConnected = !!window.driveStatus?.isAuthenticated;

        if (!driveConnected) {
            box.innerHTML = window.sanitizeHTML(`
                <div class="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                    <i data-lucide="image-plus" class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"></i>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-stone-800 dark:text-stone-200">${window.escapeHTML(window.t("share_attachments_connect_title", "Per condividere immagini e PDF serve collegare Google Drive"))}</p>
                        <p class="text-xs text-stone-500 dark:text-stone-400 mt-0.5 mb-2">${window.escapeHTML(window.t("share_attachments_connect_desc", "Spazio gratuito del tuo account Google, usato solo per i tuoi allegati."))}</p>
                        <button id="${prefix}-attachments-connect-btn" class="btn btn-secondary text-xs py-1.5 px-3 border-amber-300 dark:border-amber-600">${window.escapeHTML(window.t("share_attachments_connect_btn", "Collega Google Drive"))}</button>
                        ${isMember ? `<p class="text-xs text-stone-400 dark:text-stone-500 mt-2">${window.escapeHTML(window.t("share_attachments_member_off_note", "Il proprietario non ha ancora attivato la condivisione degli allegati."))}</p>` : ''}
                    </div>
                </div>
            `);
            const btn = document.getElementById(prefix + '-attachments-connect-btn');
            if (btn) btn.onclick = () => window.collegaDriveDaShare(prefix, isMember);
        } else {
            box.innerHTML = window.sanitizeHTML(`
                <div class="flex flex-col gap-1.5">
                    <label class="flex items-center gap-2.5 cursor-pointer text-sm text-stone-700 dark:text-stone-300">
                        <input type="checkbox" id="${prefix}-attachments" class="form-checkbox w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500" ${attachmentsOn ? 'checked' : ''}>
                        <span>${window.escapeHTML(window.t("share_attachments_label", "Condividi anche gli allegati (immagini e PDF)"))}</span>
                    </label>
                    ${attachmentsOn ? `<p class="text-xs text-stone-400 dark:text-stone-500 pl-6.5">${window.escapeHTML(window.t("share_attachments_status_on", "Allegati condivisi tramite il tuo Google Drive."))}</p>` : ''}
                </div>
            `);
            const cb = document.getElementById(prefix + '-attachments');
            if (cb) cb.onchange = () => window.toggleAllegatiShare(cb.checked, prefix, isMember);
        }
        if (window.lucide) lucide.createIcons({ nodes: [box] });
    };

    // Avvia il login Google Drive esistente (Impostazioni) direttamente dalla card guidata;
    // al successo abilita subito il toggle allegati, senza passare da un errore.
    window.collegaDriveDaShare = async function(prefix, isMember) {
        if (typeof window.loginGoogleDrive !== 'function') return;
        await window.loginGoogleDrive();
        if (window.driveStatus?.isAuthenticated) {
            window.renderAttachmentsBoxShare(prefix, false, isMember);
        }
    };

    window.toggleAllegatiShare = async function(checked, prefix, isMember) {
        if (!window.hubConfig) return;
        window.hubConfig.attachmentsMode = checked ? 'drive-links' : 'off';
        if (window.apiBrowser?.saveHubConfig) await window.apiBrowser.saveHubConfig(window.hubConfig);
        // Mantieni allineata la checkbox gemella (owner/member) + quella in Impostazioni.
        ['share-owner', 'share-member'].forEach(p => {
            if (p !== prefix) window.renderAttachmentsBoxShare(p, checked, p === 'share-member');
        });
        const settingsCb = document.getElementById('settings-hub-attachments');
        if (settingsCb) settingsCb.checked = checked;
        if (prefix) window.renderAttachmentsBoxShare(prefix, checked, !!isMember);
        if (checked && typeof window.sincronizzaAllegatiHub === 'function') window.sincronizzaAllegatiHub(false);
    };

    // Pannello di migrazione Drive legacy -> archivio condiviso: spiega le conseguenze prima
    // di procedere, al posto della lunga stringa di confirm() precedente.
    window.apriPannelloMigrazioneShare = function() {
        mostraStatoShare('share-state-migrate');
    };

    window.confermaMigrazioneShare = async function() {
        window.chiudiShareModal();
        if (typeof window.migraVaultSuHub === 'function') await window.migraVaultSuHub(true);
    };

    // Abbandono da collaboratore: il PC conserva la copia locale, ma smette di sincronizzare.
    window.abbandonaArchivioShare = function() {
        const msg = window.t("share_member_leave_confirm", "Il tuo PC conserverà una copia locale, ma non riceverai più gli aggiornamenti dei colleghi.");
        if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, () => window.scollegaCloud());
        else if (typeof window.scollegaCloud === 'function') window.scollegaCloud();
    };
})();
