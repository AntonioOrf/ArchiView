(function() {
    function impostaChiaveI18n(el, key, fallback) {
        if (!el) return;
        el.setAttribute('data-i18n', key);
        el.setAttribute('data-i18n-default', fallback);
        el.textContent = window.t(key, fallback);
    }

    function renderIntestazioneCloud(vaultType) {

        const riga = document.getElementById('cloud-active-account');
        if (!riga) return;
        const connesso = !!(window.driveStatus && window.driveStatus.isAuthenticated);
        const account = window.driveStatus && window.driveStatus.user;
        riga.textContent = connesso && account
            ? account
            : window.t('settings_drive_not_connected', 'Non Connesso');
        riga.title = riga.textContent;
    }

    const testiOriginali = new WeakMap();
    function impostaStatoCaricamento(btn, attivo, testo?) {
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

        const connesso = !!(window.driveStatus && window.driveStatus.isAuthenticated);

        const ultimo = settings && settings.lastSyncTime;
        if (ultimo) {
            const locale = window.localeAttuale();
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
    <div id="cloud-modal" class="modal-overlay hidden-tab z-modal-nested fixed inset-0 flex items-center justify-center">
        <div class="modal-window w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div class="modal-header shrink-0 border-b border-stone-200">
                <h3 class="modal-title"><span id="cloud-modal-title" data-i18n="modal_cloud_title">Backup su Google Drive</span>
                </h3>
                <button type="button" data-on-click="chiudiCloudModal" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5" aria-hidden="true"></i></button>
            </div>
            <div class="modal-body p-6 flex-1 overflow-y-auto custom-scroll min-h-0">

                <div id="cloud-local-section" class="text-center py-4">
                    <h3 class="condivisione-nome mb-2"><span data-i18n="modal_cloud_activate_title">Backup personale su Google Drive</span></h3>
                    <p class="text-sm text-stone-600 max-w-sm mx-auto">
                        <span data-i18n="modal_cloud_activate_desc_short">Una copia privata dell'archivio sul tuo Google Drive, accessibile solo a te.</span>
                    </p>
                    <div class="flex flex-col gap-3 max-w-xs mx-auto">
                        <button type="button" data-on-click="trasformaInPersonale" id="btn-trasforma-personale" class="btn btn-primary btn-block justify-center py-3 text-sm">
                                <span data-i18n="btn_backup_private">Backup Personale (Google Drive)</span>
                        </button>
                        <button type="button" data-on-click="inSequenza" data-args-click="[&quot;chiudiCloudModal&quot;,&quot;apriShareModal&quot;]" class="text-xs text-stone-400 hover:text-stone-600 mt-1">
                            <span data-i18n="cloud_local_share_link">Vuoi invece lavorarci insieme ai colleghi? Condividi l'archivio</span>
                        </button>
                    </div>
                    <div id="cloud-transform-status" class="testo-info mt-4 text-sm font-medium hidden-tab flex items-center justify-center gap-2">
                        <i data-lucide="loader-2" class="w-4 h-4 animate-spin shrink-0" aria-hidden="true"></i> <span data-i18n="msg_operation_progress">Operazione in corso</span>...
                    </div>
                </div>

                <div id="cloud-shared-section" class="hidden-tab flex flex-col gap-4">

                    <div class="cloud-stato">
                        <span class="pallino-stato" aria-hidden="true"></span>
                        <div class="flex-1 min-w-0 text-left">
                            <p class="font-medium text-stone-800" id="cloud-active-title" data-i18n="modal_cloud_active_title">Cloud Attivo</p>
                            <p class="text-xs text-stone-500 truncate" id="cloud-active-account"></p>
                        </div>
                        <button type="button" data-on-click="sincronizzaGoogleDrive" id="btn-cloud-drive-sync" class="btn btn-secondary shrink-0">
                                <span data-i18n="btn_sync_now">Sincronizza Ora</span>
                        </button>
                    </div>

                    <p class="text-sm text-stone-600" id="cloud-active-desc" data-i18n="modal_cloud_active_desc">Questo Archivio è sincronizzato.</p>

                    <div class="cloud-riepilogo">
                        <div id="cloud-status-summary" class="flex flex-col gap-2"></div>
                    </div>

                    <label for="cloud-sync-attachments" class="cloud-opzione">
                        <input type="checkbox" id="cloud-sync-attachments" data-on-change="toggleSyncAttachments" data-args-change="[{&quot;$&quot;:&quot;checked&quot;}]" class="w-4 h-4 shrink-0">
                        <span class="text-sm leading-snug text-stone-700" data-i18n="label_sync_attachments">Sincronizza allegati automaticamente (PDF/Immagini)</span>
                    </label>

                    <details class="group cloud-avanzate">
                        <summary class="text-stone-600 flex items-center gap-1.5 py-1.5 text-xs font-semibold cursor-pointer select-none">
                            <i data-lucide="chevron-right" class="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true"></i> <span data-i18n="label_advanced_options">Opzioni avanzate</span>
                        </summary>
                        <div class="flex flex-col gap-1.5 mt-1.5">
                            <button type="button" data-on-click="collegaArchivioEsistenteDrive" id="btn-cloud-relink" class="btn btn-ghost justify-start py-2 text-sm">
                                <span data-i18n="btn_relink_drive_vault">Collega a un archivio esistente su Drive</span>
                            </button>
                            <button type="button" data-on-click="cambiaAccountGoogleVault" id="btn-cloud-change-account" class="btn btn-ghost justify-start py-2 text-sm">
                                <span data-i18n="btn_use_another_account">Usa un altro account Google</span>
                            </button>
                            <button type="button" data-on-click="apriMigrazioneDaCloudModal" id="btn-migrate-hub" class="btn btn-ghost justify-start py-2 text-sm">
                                <span data-i18n="btn_migrate_hub">Passa all'archivio condiviso</span>
                            </button>
                            <button type="button" data-on-click="trasformaInPersonale" id="btn-switch-personal" class="btn btn-ghost justify-start py-2 text-sm">
                                <span data-i18n="btn_convert_backup_private">Converti in Backup Personale</span>
                            </button>

                            <hr class="my-1 border-stone-200" aria-hidden="true">
                            <button type="button" data-on-click="pulisciAllegatiOrfani" id="btn-cloud-clean-orphans" class="btn btn-danger-ghost justify-start py-2 text-sm">
                                <span data-i18n="btn_clean_ghosts">Pulisci file inutilizzati</span>
                            </button>
                            <button type="button" data-on-click="scollegaCloud" id="btn-disconnect-cloud" class="btn btn-danger-ghost justify-start py-2 text-sm">
                                <span data-i18n="btn_disconnect_cloud">Scollega dal Cloud</span>
                            </button>
                        </div>
                    </details>

                    <p class="modello-suggerimento pt-1"><span id="cloud-hint" data-i18n="cloud_backup_hint">Questo è un backup personale sul tuo Cloud privato. Per collaborare con altri, usa un archivio condiviso.</span></p>
                </div>

                <div id="cloud-relink-section" class="hidden-tab flex flex-col gap-4">
                    <div class="text-left">
                        <h3 class="condivisione-nome" data-i18n="modal_cloud_relink_title">Collega a un archivio esistente su Drive</h3>
                        <p class="text-sm text-stone-600 mt-1" data-i18n="modal_cloud_relink_desc">Scegli la cartella su Drive con cui questo archivio deve sincronizzarsi. Usalo se un altro PC lavora già su un archivio che qui non vedi.</p>
                    </div>
                    <div id="cloud-relink-list" class="flex flex-col gap-2 max-h-72 overflow-y-auto custom-scroll"></div>
                    <div class="flex justify-end">
                        <button type="button" data-on-click="chiudiCollegaArchivioDrive" class="btn btn-ghost py-2 text-sm" data-i18n="btn_cancel">Annulla</button>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <div id="cloud-progress-overlay" class="modal-overlay hidden-tab z-modal-alert">
        <div class="modal-window max-w-sm p-6 text-center">
            <svg class="animate-spin w-8 h-8 testo-primario mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <h3 class="modal-title justify-center mb-2" id="cloud-progress-title"><span data-i18n="msg_operation_progress">Operazione in corso</span></h3>
            <p class="text-sm text-stone-600" id="cloud-progress-message"><span data-i18n="msg_please_wait">Attendere prego…</span></p>
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
            mostraProgressoCloud(window.t("prog_auth_title", "Autenticazione in corso"), window.t("prog_auth_desc2", "Accedi con il nuovo account nel browser…"));
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
        if (window.hubConfig && typeof window.apriShareModal === 'function') {
            return window.apriShareModal();
        }

        if (window.apiSettings) {
            try {
                const [settings, vaultConfig] = await Promise.all([
                    window.apiSettings.get(),
                    window.apiBrowser.getVaultConfig ? window.apiBrowser.getVaultConfig() : Promise.resolve({ vaultType: 'local' })
                ]);
                aggiornaSezioniCloud(settings, vaultConfig);
            } catch (e) {
                console.error('Stato cloud non leggibile:', e);
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

        document.getElementById('cloud-relink-section')?.classList.add('hidden-tab');

        if (vaultConfig.vaultType === 'local') {
            if (localSection) localSection.classList.remove('hidden-tab');
            if (sharedSection) sharedSection.classList.add('hidden-tab');
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
            impostaChiaveI18n(titoloModal, 'modal_cloud_title_shared', 'Archivio condiviso su Google Drive');
            impostaChiaveI18n(title, 'modal_cloud_shared_active', 'Archivio Condiviso Attivo');
            impostaChiaveI18n(desc, 'modal_cloud_shared_legacy_desc', 'Archivio condiviso su Google Drive (legacy). Migra su Hub per inviti revocabili e sincronizzazione in tempo reale.');
            impostaChiaveI18n(hint, 'cloud_shared_hint', 'I permessi Drive non sono revocabili singolarmente: chi ha il link mantiene l\'accesso. Passa all\'archivio condiviso per inviti revocabili.');
            if (btnSwitchPersonal) btnSwitchPersonal.classList.remove('hidden-tab');
        }

        const cbAttachments = document.getElementById('cloud-sync-attachments');
        if (cbAttachments) cbAttachments.checked = settings.syncAttachments !== false;

        renderRiepilogoCloud(vaultConfig, settings);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
    }

    window.toggleSyncAttachments = async function(checked) {
        if (!window.apiSettings) return;
        const cb = document.getElementById('cloud-sync-attachments');
        try {
            await window.apiSettings.patch({ syncAttachments: checked });
            if (window.annunciaA11y) {
                window.annunciaA11y(checked
                    ? window.t('a11y_sync_attachments_on', 'Sincronizzazione allegati attivata')
                    : window.t('a11y_sync_attachments_off', 'Sincronizzazione allegati disattivata'));
            }
        } catch (e) {
            if (cb) cb.checked = !checked;
            mostraMessaggio(window.t("msg_errore", "Errore: ") + e.message, "error");
        }
    };

    window.chiudiCloudModal = function() {
        document.getElementById('cloud-modal').classList.add('hidden-tab');
    };

    window.apriMigrazioneDaCloudModal = async function() {
        window.chiudiCloudModal();
        const modal = document.getElementById('share-modal');
        if (!modal || typeof window.mostraStatoShare !== 'function') {
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
        impostaStatoCaricamento(btn, true, window.t("cloud_cleaning_in_progress", "Pulizia in corso…"));
        if (window.annunciaA11y) window.annunciaA11y(window.t("cloud_cleaning_in_progress", "Pulizia in corso…"));

        try {
            const apiCloud = window.getApiCloud ? await window.getApiCloud() : null;
            if (!apiCloud || !apiCloud.pulisciAllegatiOrfani) {
                throw new Error("Funzione non disponibile.");
            }
            if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
            const result = await apiCloud.pulisciAllegatiOrfani();
            mostraMessaggio(window.t("msg_pulizia_completata_file_r", 'Pulizia completata. File rimossi: {var0} in locale, {var1} su Drive.').replace("{var0}", String(result.deletedLocal)).replace("{var1}", String(result.deletedDrive)), "success");
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
        if (window.annunciaA11y) window.annunciaA11y([titolo, messaggio].filter(Boolean).join(' — '));
    };

    window.nascondiProgressoCloud = function() {
        const overlay = document.getElementById('cloud-progress-overlay');
        if (!overlay || overlay.classList.contains('hidden-tab')) return;
        overlay.classList.add('hidden-tab');
        if (window.annunciaA11y) window.annunciaA11y(window.t('a11y_operation_done', 'Operazione terminata'));
    };

    window.impostaStatoCaricamentoCloud = impostaStatoCaricamento;

})();
