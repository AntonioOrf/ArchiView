// @ts-nocheck

(function() {
    // Cambia la chiave i18n di un elemento già tradotto. Serve resettare anche data-i18n-default,
    // altrimenti applicaTraduzioniHtml continuerebbe a usare come fallback il testo della chiave
    // precedente (catturato alla prima traduzione).
    function impostaChiaveI18n(el, key, fallback) {
        if (!el) return;
        el.setAttribute('data-i18n', key);
        el.setAttribute('data-i18n-default', fallback);
        el.textContent = window.t(key, fallback);
    }

    // Intestazione della sezione attiva: icona coerente col tipo di archivio e, sotto il titolo,
    // l'account Google collegato. checkDriveStatus ripiega sulla stringa 'Utente (Drive)' quando
    // about.get fallisce sotto scope drive.file: la mostriamo così com'è, senza fingere un'email.
    function renderIntestazioneCloud(vaultType) {
        const icon = document.getElementById('cloud-active-icon');
        if (icon) icon.setAttribute('data-lucide', vaultType === 'backup' ? 'shield-check' : 'users');

        const riga = document.getElementById('cloud-active-account');
        if (!riga) return;
        const connesso = !!(window.driveStatus && window.driveStatus.isAuthenticated);
        const account = window.driveStatus && window.driveStatus.user;
        riga.textContent = connesso && account
            ? account
            : window.t('settings_drive_not_connected', 'Non Connesso');
        riga.title = riga.textContent;
    }

    // Stato di caricamento uniforme per i bottoni async: disabled + aria-busy + spinner.
    // Senza aria-busy uno screen reader non ha modo di sapere che l'operazione è in corso.
    const testiOriginali = new WeakMap();
    function impostaStatoCaricamento(btn, attivo, testo) {
        if (!btn) return;
        if (attivo) {
            if (!testiOriginali.has(btn)) testiOriginali.set(btn, btn.innerHTML);
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.innerHTML = window.sanitizeHTML(
                `<i data-lucide="loader-2" class="w-4 h-4 mr-2 animate-spin shrink-0" aria-hidden="true"></i> <span>${window.escapeHTML(testo || '')}</span>`
            );
        } else {
            const originale = testiOriginali.get(btn);
            if (originale !== undefined) btn.innerHTML = window.sanitizeHTML(originale);
            testiOriginali.delete(btn);
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
        }
        if (window.lucide) window.lucide.createIcons({ nodes: [btn] });
    }

    // Riepilogo di stato: sostituisce l'hint statico con i dati reali già disponibili.
    // Le righe prive di dato vengono omesse invece di mostrare un placeholder vuoto.
    function renderRiepilogoCloud(vaultConfig, settings) {
        const box = document.getElementById('cloud-status-summary');
        if (!box) return;
        box.textContent = '';

        const righe = [];
        righe.push([
            'database',
            window.t('cloud_status_type', 'Tipo'),
            vaultConfig.vaultType === 'backup'
                ? window.t('cloud_status_type_backup', 'Backup personale')
                : window.t('cloud_status_type_shared', 'Archivio condiviso (legacy)')
        ]);

        // L'account non si ripete qui: vive nell'intestazione della sezione (vedi
        // renderIntestazioneCloud), dove è in evidenza invece che in fondo a un elenco.
        const connesso = !!(window.driveStatus && window.driveStatus.isAuthenticated);

        const ultimo = settings && settings.lastSyncTime;
        if (ultimo) {
            const locale = window.linguaAttuale === 'en' ? 'en-US' : 'it-IT';
            righe.push(['clock', window.t('cloud_status_last_sync', 'Ultima sincronizzazione'),
                new Date(ultimo).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })]);
        }

        for (const [icona, etichetta, valore] of righe) {
            const riga = document.createElement('p');
            riga.className = 'flex items-start gap-2';
            const i = document.createElement('i');
            i.setAttribute('data-lucide', icona);
            i.setAttribute('aria-hidden', 'true');
            i.className = 'w-4 h-4 shrink-0 mt-0.5 text-stone-400';
            const testo = document.createElement('span');
            testo.className = 'min-w-0 break-words';
            const forte = document.createElement('strong');
            forte.className = 'font-medium';
            forte.textContent = etichetta + ': ';
            testo.appendChild(forte);
            testo.appendChild(document.createTextNode(valore));
            riga.appendChild(i);
            riga.appendChild(testo);
            box.appendChild(riga);
        }

        // Senza sessione valida il modal deve offrire l'accesso, altrimenti resta un vicolo cieco:
        // le azioni di sync qui sopra falliscono tutte finché non si è autenticati.
        if (!connesso) {
            const azione = document.createElement('button');
            azione.type = 'button';
            azione.id = 'btn-cloud-login';
            azione.className = 'btn btn-primary w-full justify-center py-2 text-sm mt-1';
            azione.onclick = () => window.connettiAccountCloud && window.connettiAccountCloud();
            const ico = document.createElement('i');
            ico.setAttribute('data-lucide', 'log-in');
            ico.setAttribute('aria-hidden', 'true');
            ico.className = 'w-4 h-4 mr-2 shrink-0';
            azione.appendChild(ico);
            azione.appendChild(document.createTextNode(window.t('btn_cloud_login', 'Accedi a Google Drive')));
            box.appendChild(azione);
        }

        if (window.lucide) window.lucide.createIcons({ nodes: [box] });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('cloud-modal')) {
            const html = `
    <!-- Modal Cloud & Sincronizzazione -->
    <div id="cloud-modal" class="modal-overlay hidden-tab z-modal-nested fixed inset-0 flex items-center justify-center">
        <div class="modal-window w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div class="modal-header shrink-0 border-b border-stone-200 dark:border-stone-700">
                <h3 class="modal-title text-stone-800 dark:text-stone-100 flex items-center gap-2">
                    <i data-lucide="shield-check" class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true"></i> <span id="cloud-modal-title" data-i18n="modal_cloud_title">Backup su Google Drive</span>
                </h3>
                <button type="button" onclick="chiudiCloudModal()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5" aria-hidden="true"></i></button>
            </div>
            <div class="modal-body p-6 flex-1 overflow-y-auto custom-scroll min-h-0">

                <!-- SEZIONE VAULT LOCALE (Non Condiviso) -->
                <div id="cloud-local-section" class="text-center py-4">
                    <div class="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="shield-check" class="w-7 h-7" aria-hidden="true"></i>
                    </div>
                    <h3 class="text-xl font-serif font-semibold mb-2 text-stone-800 dark:text-stone-100"><span data-i18n="modal_cloud_activate_title">Backup personale su Google Drive</span></h3>
                    <p class="text-sm text-stone-600 dark:text-stone-400 max-w-sm mx-auto mb-6">
                        <span data-i18n="modal_cloud_activate_desc_short">Una copia privata dell'archivio sul tuo Google Drive, accessibile solo a te.</span>
                    </p>
                    <div class="flex flex-col gap-3 max-w-xs mx-auto">
                        <button type="button" onclick="trasformaInPersonale()" id="btn-trasforma-personale" class="btn btn-block justify-center py-3 text-sm text-white bg-blue-600 hover:bg-blue-700 border border-blue-700">
                            <i data-lucide="shield-check" class="w-4 h-4 mr-2" aria-hidden="true"></i> <span data-i18n="btn_backup_private">Backup Personale (Google Drive)</span>
                        </button>
                        <button type="button" onclick="chiudiCloudModal(); if(window.apriShareModal) apriShareModal();" class="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 mt-1">
                            <span data-i18n="cloud_local_share_link">Vuoi invece lavorarci insieme ai colleghi? Condividi l'archivio</span>
                        </button>
                    </div>
                    <div id="cloud-transform-status" class="text-blue-600 dark:text-blue-400 mt-4 text-sm font-medium hidden-tab flex items-center justify-center gap-2">
                        <i data-lucide="loader-2" class="w-4 h-4 animate-spin shrink-0" aria-hidden="true"></i> <span data-i18n="msg_operation_progress">Operazione in corso</span>...
                    </div>
                </div>

                <!-- SEZIONE VAULT CONDIVISO/PERSONALE ATTIVO -->
                <div id="cloud-shared-section" class="hidden-tab flex flex-col gap-4">

                    <!-- INTESTAZIONE: identità dell'archivio + account Google collegato.
                         L'email sta qui e non solo nel riepilogo: è il dato che dice QUALE Drive
                         si sta usando, la prima cosa da controllare quando due PC divergono. -->
                    <div class="flex items-center gap-3.5 p-4 rounded-lg border border-blue-200 dark:border-blue-700/50 bg-blue-50/60 dark:bg-blue-900/20">
                        <div class="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                            <i id="cloud-active-icon" data-lucide="cloud" class="w-6 h-6" aria-hidden="true"></i>
                        </div>
                        <div class="flex-1 min-w-0 text-left">
                            <p class="font-serif text-base font-semibold text-stone-800 dark:text-stone-100" id="cloud-active-title" data-i18n="modal_cloud_active_title">Cloud Attivo</p>
                            <p class="text-xs text-stone-500 dark:text-stone-400 truncate" id="cloud-active-account"></p>
                        </div>
                        <button type="button" onclick="sincronizzaGoogleDrive()" id="btn-cloud-drive-sync" class="btn btn-primary px-4 py-2.5 font-medium shrink-0">
                            <i data-lucide="refresh-cw" class="w-4 h-4 mr-2" aria-hidden="true"></i> <span data-i18n="btn_sync_now">Sincronizza Ora</span>
                        </button>
                    </div>

                    <p class="text-sm text-stone-600 dark:text-stone-400" id="cloud-active-desc" data-i18n="modal_cloud_active_desc">Questo Archivio è sincronizzato.</p>

                    <!-- STATO: riepilogo + (se disconnesso) bottone di accesso -->
                    <div class="flex flex-col gap-2 p-4 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 text-sm text-stone-600 dark:text-stone-400">
                        <div id="cloud-status-summary" class="flex flex-col gap-2"></div>
                    </div>

                    <label for="cloud-sync-attachments" class="flex items-center gap-2.5 p-3 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/40">
                        <input type="checkbox" id="cloud-sync-attachments" onchange="toggleSyncAttachments(this.checked)" class="w-4 h-4 text-blue-600 rounded border-stone-300 shrink-0">
                        <span class="text-sm leading-snug text-stone-700 dark:text-stone-300" data-i18n="label_sync_attachments">Sincronizza allegati automaticamente (PDF/Immagini)</span>
                    </label>

                    <details class="group">
                        <summary class="text-stone-500 dark:text-stone-400 flex items-center gap-1.5 py-1.5 px-1 rounded text-xs font-semibold uppercase tracking-wider cursor-pointer select-none">
                            <i data-lucide="chevron-right" class="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true"></i> <span data-i18n="label_advanced_options">Opzioni avanzate</span>
                        </summary>
                        <div class="flex flex-col gap-1.5 mt-1.5">
                            <button type="button" onclick="collegaArchivioEsistenteDrive()" id="btn-cloud-relink" class="btn btn-ghost justify-start py-2 text-sm">
                                <i data-lucide="link" class="w-4 h-4 mr-2 shrink-0" aria-hidden="true"></i> <span data-i18n="btn_relink_drive_vault">Collega a un archivio esistente su Drive</span>
                            </button>
                            <button type="button" onclick="cambiaAccountGoogleVault()" id="btn-cloud-change-account" class="btn btn-ghost justify-start py-2 text-sm">
                                <i data-lucide="user-plus" class="w-4 h-4 mr-2 shrink-0" aria-hidden="true"></i> <span data-i18n="btn_use_another_account">Usa un altro account Google</span>
                            </button>
                            <button type="button" onclick="apriMigrazioneDaCloudModal()" id="btn-migrate-hub" class="btn btn-ghost justify-start py-2 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                                <i data-lucide="server" class="w-4 h-4 mr-2 shrink-0" aria-hidden="true"></i> <span data-i18n="btn_migrate_hub">Passa all'archivio condiviso</span>
                            </button>
                            <button type="button" onclick="trasformaInPersonale()" id="btn-switch-personal" class="btn btn-ghost justify-start py-2 text-sm">
                                <i data-lucide="shield" class="w-4 h-4 mr-2 shrink-0" aria-hidden="true"></i> <span data-i18n="btn_convert_backup_private">Converti in Backup Personale</span>
                            </button>

                            <!-- Azioni irreversibili: separate e già rosse a riposo, non solo in hover -->
                            <hr class="my-1 border-stone-200">
                            <button type="button" onclick="pulisciAllegatiOrfani()" id="btn-cloud-clean-orphans" class="btn btn-ghost cloud-danger justify-start py-2 text-sm">
                                <i data-lucide="trash-2" class="w-4 h-4 mr-2 shrink-0" aria-hidden="true"></i> <span data-i18n="btn_clean_ghosts">Pulisci file inutilizzati</span>
                            </button>
                            <button type="button" onclick="scollegaCloud()" id="btn-disconnect-cloud" class="btn btn-ghost cloud-danger justify-start py-2 text-sm">
                                <i data-lucide="unlink" class="w-4 h-4 mr-2 shrink-0" aria-hidden="true"></i> <span data-i18n="btn_disconnect_cloud">Scollega dal Cloud</span>
                            </button>
                        </div>
                    </details>

                    <p class="flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400 pt-1"><i data-lucide="info" class="w-4 h-4 shrink-0 mt-0.5 text-stone-400" aria-hidden="true"></i> <span id="cloud-hint" data-i18n="cloud_backup_hint">Questo è un backup personale sul tuo Cloud privato. Per collaborare con altri, usa un archivio condiviso.</span></p>
                </div>

                <!-- SEZIONE RICOLLEGA A UN ARCHIVIO DRIVE ESISTENTE -->
                <!-- Serve quando due PC dello stesso utente sono finiti su cartelle Drive diverse:
                     elenca gli archivi già presenti sull'account e riscrive il solo sharedVaultId. -->
                <div id="cloud-relink-section" class="hidden-tab flex flex-col gap-4">
                    <div class="text-left">
                        <h3 class="text-lg font-serif font-semibold text-stone-800 dark:text-stone-100" data-i18n="modal_cloud_relink_title">Collega a un archivio esistente su Drive</h3>
                        <p class="text-sm text-stone-600 dark:text-stone-400 mt-1" data-i18n="modal_cloud_relink_desc">Scegli la cartella su Drive con cui questo archivio deve sincronizzarsi. Usalo se un altro PC lavora già su un archivio che qui non vedi.</p>
                    </div>
                    <div id="cloud-relink-list" class="flex flex-col gap-2 max-h-72 overflow-y-auto custom-scroll"></div>
                    <div class="flex justify-end">
                        <button type="button" onclick="chiudiCollegaArchivioDrive()" class="btn btn-ghost py-2 text-sm" data-i18n="btn_cancel">Annulla</button>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <!-- OVERLAY PROGRESSO CLOUD -->
    <!-- Nessun aria-live qui: l'annuncio passa da window.annunciaA11y, due region concorrenti
         produrrebbero annunci doppi e sovrapposti. -->
    <div id="cloud-progress-overlay" class="modal-overlay hidden-tab z-modal-alert flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-2xl p-6 text-center max-w-sm w-full">
            <svg class="animate-spin w-12 h-12 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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

        // Lo stato va risolto PRIMA di rendere visibile il modal: il focus-trap sposta il fuoco
        // sul primo elemento focusabile subito dopo la comparsa, e lucide.createIcons deve girare
        // dopo lo swap di data-lucide. Rivelando prima e popolando poi si otteneva il fuoco su un
        // bottone in procinto di sparire e l'icona di stato mai renderizzata.
        if (window.apiSettings) {
            try {
                const [settings, vaultConfig] = await Promise.all([
                    window.apiSettings.get(),
                    window.apiBrowser.getVaultConfig ? window.apiBrowser.getVaultConfig() : Promise.resolve({ vaultType: 'local' })
                ]);
                aggiornaSezioniCloud(settings, vaultConfig);
            } catch (e) {
                console.error('Stato cloud non leggibile:', e);
                // Fallback allo stato locale: meglio un modal coerente che uno a metà.
                aggiornaSezioniCloud({}, { vaultType: 'local' });
                mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
            }
        }

        const modal = document.getElementById('cloud-modal');
        modal.classList.remove('hidden-tab');
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
    };

    function aggiornaSezioniCloud(settings, vaultConfig) {
        const localSection = document.getElementById('cloud-local-section');
        const sharedSection = document.getElementById('cloud-shared-section');
        const titoloModal = document.getElementById('cloud-modal-title');

        // La sezione di ricollegamento è transitoria: riaprire il modal deve tornare alla vista base.
        document.getElementById('cloud-relink-section')?.classList.add('hidden-tab');

        if (vaultConfig.vaultType === 'local') {
            if (localSection) localSection.classList.remove('hidden-tab');
            if (sharedSection) sharedSection.classList.add('hidden-tab');
            // Il ramo locale offre solo il backup personale: la chiave storica
            // modal_cloud_title è tradotta "Gestione Condivisione (Cloud)" e prometteva
            // una condivisione che questo modal non fa più.
            impostaChiaveI18n(titoloModal, 'modal_cloud_title_backup', 'Backup personale su Google Drive');
            return;
        }

        if (localSection) localSection.classList.add('hidden-tab');
        if (sharedSection) sharedSection.classList.remove('hidden-tab');

        const title = document.getElementById('cloud-active-title');
        const desc = document.getElementById('cloud-active-desc');
        const hint = document.getElementById('cloud-hint');
        const btnSwitchPersonal = document.getElementById('btn-switch-personal');

        renderIntestazioneCloud(vaultConfig.vaultType);

        if (vaultConfig.vaultType === 'backup') {
            impostaChiaveI18n(titoloModal, 'modal_cloud_title_backup', 'Backup personale su Google Drive');
            impostaChiaveI18n(title, 'modal_cloud_backup_active', 'Backup Personale Attivo');
            impostaChiaveI18n(desc, 'modal_cloud_backup_desc', 'Questo Archivio è sincronizzato nel tuo Cloud privato. Nessun altro ha accesso.');
            impostaChiaveI18n(hint, 'cloud_backup_hint', 'Questo è un backup personale sul tuo Cloud privato. Per collaborare con altri, usa un archivio condiviso.');
            if (btnSwitchPersonal) btnSwitchPersonal.classList.add('hidden-tab');
        } else {
            // Vault Drive condiviso legacy: la collaborazione è passata all'Hub, si punta alla migrazione.
            impostaChiaveI18n(titoloModal, 'modal_cloud_title_shared', 'Archivio condiviso su Google Drive');
            impostaChiaveI18n(title, 'modal_cloud_shared_active', 'Archivio Condiviso Attivo');
            impostaChiaveI18n(desc, 'modal_cloud_shared_legacy_desc', 'Archivio condiviso su Google Drive (legacy). Migra su Hub per inviti revocabili e sincronizzazione in tempo reale.');
            impostaChiaveI18n(hint, 'cloud_shared_hint', 'I permessi Drive non sono revocabili singolarmente: chi ha il link mantiene l\'accesso. Passa all\'archivio condiviso per inviti revocabili.');
            if (btnSwitchPersonal) btnSwitchPersonal.classList.remove('hidden-tab');
        }

        const cbAttachments = document.getElementById('cloud-sync-attachments');
        if (cbAttachments) cbAttachments.checked = settings.syncAttachments !== false; // Default true

        renderRiepilogoCloud(vaultConfig, settings);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
    }

    window.toggleSyncAttachments = async function(checked) {
        if (!window.apiSettings) return;
        const cb = document.getElementById('cloud-sync-attachments');
        try {
            const settings = await window.apiSettings.get();
            settings.syncAttachments = checked;
            await window.apiSettings.save(settings);
            if (window.annunciaA11y) {
                window.annunciaA11y(checked
                    ? window.t('a11y_sync_attachments_on', 'Sincronizzazione allegati attivata')
                    : window.t('a11y_sync_attachments_off', 'Sincronizzazione allegati disattivata'));
            }
        } catch (e) {
            // Senza ripristino la checkbox mostrerebbe uno stato mai salvato.
            if (cb) cb.checked = !checked;
            mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
        }
    };

    window.chiudiCloudModal = function() {
        document.getElementById('cloud-modal').classList.add('hidden-tab');
    };

    // La migrazione è a senso unico: passa dal pannello di conferma del modal Condivisione,
    // che ne elenca le conseguenze. Prima il bottone chiamava migraVaultSuHub() a nudo.
    window.apriMigrazioneDaCloudModal = async function() {
        window.chiudiCloudModal();
        const modal = document.getElementById('share-modal');
        if (!modal || typeof window.mostraStatoShare !== 'function') {
            // Senza il modal Condivisione la conferma la chiede migraVaultSuHub stesso.
            if (typeof window.migraVaultSuHub === 'function') await window.migraVaultSuHub();
            return;
        }
        modal.classList.remove('hidden-tab');
        window.mostraStatoShare('share-state-migrate');
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
    };

    window.pulisciAllegatiOrfani = async function() {
        const confirmed = await new Promise((resolve) => {
            const msg = window.t("confirm_clean_orphans_desc", "Questa operazione eliminerà definitivamente dal PC e da Google Drive tutti gli allegati che non sono più associati a nessuna scheda nel database corrente. L'operazione è irreversibile. Vuoi procedere?");
            if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, () => resolve(true), null, () => resolve(false));
            else resolve(confirm(msg));
        });
        if (!confirmed) return;

        const btn = document.getElementById('btn-cloud-clean-orphans');
        impostaStatoCaricamento(btn, true, window.t("cloud_cleaning_in_progress", "Pulizia in corso..."));
        if (window.annunciaA11y) window.annunciaA11y(window.t("cloud_cleaning_in_progress", "Pulizia in corso..."));

        try {
            // getApiCloud è async: senza await si testava .pulisciAllegatiOrfani su una Promise,
            // sempre undefined, e la pulizia falliva sistematicamente con "Funzione non disponibile".
            const apiCloud = window.getApiCloud ? await window.getApiCloud() : null;
            if (!apiCloud || !apiCloud.pulisciAllegatiOrfani) {
                throw new Error("Funzione non disponibile.");
            }
            const result = await apiCloud.pulisciAllegatiOrfani();
            mostraMessaggio(window.t("msg_pulizia_completata_file_r", "Pulizia completata! File rimossi: {var0} in locale, {var1} su Drive.").replace("{var0}", String(result.deletedLocal)).replace("{var1}", String(result.deletedDrive)), "success");
        } catch(e) {
            mostraMessaggio(window.t("msg_errore_durante_la_pulizia", "Errore durante la pulizia: ") + e.message, "error");
        } finally {
            impostaStatoCaricamento(btn, false);
        }
    };

    window.mostraProgressoCloud = function(titolo, messaggio) {
        const overlay = document.getElementById('cloud-progress-overlay');
        const titleEl = document.getElementById('cloud-progress-title');
        const msgEl = document.getElementById('cloud-progress-message');

        if (titleEl && titolo) titleEl.textContent = titolo;
        if (msgEl && messaggio) msgEl.textContent = messaggio;
        if (overlay) overlay.classList.remove('hidden-tab');
        // L'overlay è escluso dal focus-trap (a11yModal SKIP_IDS): senza annuncio esplicito
        // l'operazione partirebbe in totale silenzio per chi usa uno screen reader.
        if (window.annunciaA11y) window.annunciaA11y([titolo, messaggio].filter(Boolean).join(' — '));
    };

    window.nascondiProgressoCloud = function() {
        const overlay = document.getElementById('cloud-progress-overlay');
        if (!overlay || overlay.classList.contains('hidden-tab')) return;
        overlay.classList.add('hidden-tab');
        if (window.annunciaA11y) window.annunciaA11y(window.t('a11y_operation_done', 'Operazione terminata'));
    };

    // Esposte per i bottoni con azione lunga gestiti da altri moduli (driveLogic).
    window.impostaStatoCaricamentoCloud = impostaStatoCaricamento;

})();
