// @ts-nocheck

(function() {
    // Varianti della sezione "cloud attivo": cambia SOLO una classe, i colori stanno in
    // style.css e passano dai token del tema. Due motivi, entrambi appresi sul campo:
    // riscrivere className azzerava shrink-0 sull'icona e trasformava il contenitore a due
    // colonne in una colonna centrata; e le utility con accento fisso (bg-blue-50/50)
    // restano chiare in tutti e tre i temi scuri.
    const VARIANTI = {
        backup: { classe: 'cloud-variant-backup', icona: 'shield-check' },
        legacy: { classe: 'cloud-variant-legacy', icona: 'users' }
    };

    // Cambia la chiave i18n di un elemento già tradotto. Serve resettare anche data-i18n-default,
    // altrimenti applicaTraduzioniHtml continuerebbe a usare come fallback il testo della chiave
    // precedente (catturato alla prima traduzione).
    function impostaChiaveI18n(el, key, fallback) {
        if (!el) return;
        el.setAttribute('data-i18n', key);
        el.setAttribute('data-i18n-default', fallback);
        el.textContent = window.t(key, fallback);
    }

    function applicaVariante(nome) {
        const altro = nome === 'backup' ? VARIANTI.legacy : VARIANTI.backup;
        const v = VARIANTI[nome];
        const section = document.getElementById('cloud-shared-section');
        const icon = document.getElementById('cloud-active-icon');

        if (section) { section.classList.remove(altro.classe); section.classList.add(v.classe); }
        if (icon) icon.setAttribute('data-lucide', v.icona);
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

        const account = window.driveStatus && window.driveStatus.user;
        if (account) righe.push(['user', window.t('cloud_status_account', 'Account'), account]);

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
                <div id="cloud-local-section" class="cloud-panel flex flex-col items-center text-center p-6 rounded-md">
                    <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <i data-lucide="shield-check" class="w-6 h-6" aria-hidden="true"></i>
                    </div>
                    <h4 class="text-xl font-semibold mb-2"><span data-i18n="modal_cloud_activate_title">Backup personale su Google Drive</span></h4>
                    <p class="text-sm cloud-strong mb-4 max-w-xl">
                        <span data-i18n="modal_cloud_activate_desc">Copia privata dell'archivio sul tuo Google Drive. Per lavorare insieme ai colleghi usa invece "Condividi questo archivio" dalla barra laterale.</span>
                    </p>
                    <div class="w-full max-w-md">
                        <button type="button" onclick="trasformaInPersonale()" id="btn-trasforma-personale" class="btn py-2.5 px-4 w-full justify-center text-sm shadow-sm text-white bg-blue-600 hover:bg-blue-700 border border-blue-700">
                            <i data-lucide="shield-check" class="w-4 h-4 mr-2" aria-hidden="true"></i> <span data-i18n="btn_backup_private">Backup Personale (Google Drive)</span>
                        </button>
                    </div>
                    <div id="cloud-transform-status" class="cloud-accent mt-4 text-sm font-medium hidden-tab flex items-center justify-center gap-2">
                        <i data-lucide="loader-2" class="w-4 h-4 animate-spin shrink-0" aria-hidden="true"></i> <span data-i18n="msg_operation_progress">Operazione in corso</span>...
                    </div>
                </div>

                <!-- SEZIONE VAULT CONDIVISO/PERSONALE ATTIVO -->
                <div id="cloud-shared-section" class="hidden-tab flex flex-col gap-5 p-6 border rounded-md transition-colors duration-300">

                    <!-- RIGA TOP: Icona + titolo + desc orizzontali -->
                    <div class="flex items-center gap-4">
                        <div id="cloud-active-icon-wrapper" class="cloud-icon-wrap w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300">
                            <i id="cloud-active-icon" data-lucide="cloud" class="w-7 h-7" aria-hidden="true"></i>
                        </div>
                        <div class="flex-1 min-w-0 text-left">
                            <h4 class="text-lg font-bold" id="cloud-active-title" data-i18n="modal_cloud_active_title">Cloud Attivo</h4>
                            <p class="text-sm cloud-strong" id="cloud-active-desc" data-i18n="modal_cloud_active_desc">Questo Archivio è sincronizzato.</p>
                        </div>
                        <button type="button" onclick="sincronizzaGoogleDrive()" id="btn-cloud-drive-sync" class="btn btn-primary px-5 py-2.5 font-medium shrink-0">
                            <i data-lucide="refresh-cw" class="w-4 h-4 mr-2" aria-hidden="true"></i> <span data-i18n="btn_sync_now">Sincronizza Ora</span>
                        </button>
                    </div>

                    <!-- CORPO A DUE COLONNE (impilate sotto md) -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">

                        <!-- COLONNA SINISTRA: Impostazioni e azioni avanzate -->
                        <div class="flex flex-col gap-3">
                            <label for="cloud-sync-attachments" class="cloud-panel flex items-center gap-2 p-3 rounded-md cursor-pointer">
                                <input type="checkbox" id="cloud-sync-attachments" onchange="toggleSyncAttachments(this.checked)" class="w-4 h-4 text-blue-600 rounded border-stone-300 shrink-0">
                                <span class="text-sm leading-snug" style="color: var(--color-text-main);" data-i18n="label_sync_attachments">Sincronizza allegati automaticamente (PDF/Immagini)</span>
                            </label>

                            <details class="group pt-1">
                                <summary class="cloud-strong flex items-center gap-1.5 py-1.5 px-1 rounded text-xs font-semibold uppercase tracking-wider cursor-pointer select-none">
                                    <i data-lucide="chevron-right" class="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true"></i> <span data-i18n="label_advanced_options">Opzioni avanzate</span>
                                </summary>
                                <div class="flex flex-col gap-1.5 mt-1.5">
                                    <button type="button" onclick="trasformaInPersonale()" id="btn-switch-personal" class="btn btn-ghost justify-start py-2 text-sm">
                                        <i data-lucide="shield" class="w-4 h-4 mr-2 shrink-0" aria-hidden="true"></i> <span data-i18n="btn_convert_backup_private">Converti in Backup Personale</span>
                                    </button>
                                    <button type="button" onclick="migraVaultSuHub()" id="btn-migrate-hub" class="btn btn-ghost justify-start py-2 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                                        <i data-lucide="server" class="w-4 h-4 mr-2 shrink-0" aria-hidden="true"></i> <span data-i18n="btn_migrate_hub">Passa all'archivio condiviso</span>
                                    </button>
                                    <button type="button" onclick="cambiaAccountGoogleVault()" id="btn-cloud-change-account" class="btn btn-ghost justify-start py-2 text-sm">
                                        <i data-lucide="user-plus" class="w-4 h-4 mr-2 shrink-0" aria-hidden="true"></i> <span data-i18n="btn_use_another_account">Usa un altro account Google</span>
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
                        </div>

                        <!-- COLONNA DESTRA: stato/riepilogo -->
                        <div class="cloud-panel cloud-strong flex flex-col gap-3 p-4 rounded-lg text-sm">
                            <div id="cloud-status-summary" class="flex flex-col gap-2"></div>
                            <p class="flex items-start gap-2 pt-1 border-t border-stone-200"><i data-lucide="info" class="w-4 h-4 shrink-0 mt-0.5 text-stone-400" aria-hidden="true"></i> <span id="cloud-hint" data-i18n="cloud_backup_hint">Questo è un backup personale sul tuo Cloud privato. Per collaborare con altri, usa un archivio condiviso.</span></p>
                        </div>

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

        if (vaultConfig.vaultType === 'backup') {
            applicaVariante('backup');
            impostaChiaveI18n(titoloModal, 'modal_cloud_title_backup', 'Backup personale su Google Drive');
            impostaChiaveI18n(title, 'modal_cloud_backup_active', 'Backup Personale Attivo');
            impostaChiaveI18n(desc, 'modal_cloud_backup_desc', 'Questo Archivio è sincronizzato nel tuo Cloud privato. Nessun altro ha accesso.');
            impostaChiaveI18n(hint, 'cloud_backup_hint', 'Questo è un backup personale sul tuo Cloud privato. Per collaborare con altri, usa un archivio condiviso.');
            if (btnSwitchPersonal) btnSwitchPersonal.classList.add('hidden-tab');
        } else {
            // Vault Drive condiviso legacy: la collaborazione è passata all'Hub, si punta alla migrazione.
            applicaVariante('legacy');
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
