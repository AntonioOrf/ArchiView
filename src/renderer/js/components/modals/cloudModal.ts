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
                    <i data-lucide="cloud" class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0"></i> Cloud & Condivisione
                </h3>
                <button type="button" onclick="chiudiCloudModal()" class="btn btn-ghost btn-icon"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body p-6 flex-1 overflow-y-auto custom-scroll min-h-0">
                
                <!-- SEZIONE VAULT LOCALE (Non Condiviso) -->
                <div id="cloud-local-section" class="flex flex-col items-center text-center p-6 border border-stone-200 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900/50">
                    <div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                        <i data-lucide="cloud-upload" class="w-8 h-8"></i>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">Attiva Sincronizzazione Cloud</h3>
                    <p class="text-sm text-stone-600 dark:text-stone-400 mb-6 max-w-md">
                        Questo Archivio è salvato solo sul tuo PC. Puoi caricarlo sul tuo Cloud per avere un backup personale, oppure trasformarlo in un Archivio Condiviso per ottenere un codice d'invito per i tuoi collaboratori.
                    </p>
                    <div class="flex flex-col gap-3 w-full max-w-sm">
                        <button onclick="trasformaInPersonale()" id="btn-trasforma-personale" class="btn btn-secondary py-3 px-6 text-lg shadow-sm w-full">
                            <i data-lucide="cloud" class="w-5 h-5 mr-2"></i> Carica nel mio Cloud (Privato)
                        </button>
                        <button onclick="trasformaInCondiviso()" id="btn-trasforma-condiviso" class="btn btn-primary py-3 px-6 text-lg shadow-md w-full">
                            <i data-lucide="users" class="w-5 h-5 mr-2"></i> Trasforma in Archivio Condiviso
                        </button>
                        <button onclick="creaCondivisoAltroAccount()" class="btn btn-ghost w-full justify-center text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 flex items-center gap-2">
                            <i data-lucide="user-circle" class="w-4 h-4"></i> Usa un account Google diverso
                        </button>
                    </div>
                    <div id="cloud-transform-status" class="mt-4 text-sm font-medium text-blue-600 hidden-tab">Operazione in corso...</div>
                </div>

                <!-- SEZIONE VAULT CONDIVISO/PERSONALE ATTIVO -->
                <div id="cloud-shared-section" class="hidden-tab flex flex-col gap-5 p-6 border rounded-md transition-colors duration-300">
                    
                    <!-- RIGA TOP: Icona + titolo + desc orizzontali -->
                    <div class="flex items-center gap-4">
                        <div id="cloud-active-icon-wrapper" class="w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300">
                            <i id="cloud-active-icon" data-lucide="cloud" class="w-7 h-7"></i>
                        </div>
                        <div class="flex-1 min-w-0 text-left">
                            <h3 class="text-lg font-bold" id="cloud-active-title">Cloud Attivo</h3>
                            <p class="text-sm transition-colors duration-300" id="cloud-active-desc">Questo Archivio è sincronizzato.</p>
                        </div>
                        <button onclick="sincronizzaGoogleDrive()" id="btn-cloud-drive-sync" class="btn btn-primary px-5 py-2.5 font-medium shrink-0">
                            <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Sincronizza Ora
                        </button>
                    </div>

                    <!-- CORPO A DUE COLONNE -->
                    <div class="grid grid-cols-2 gap-5 items-start">

                        <!-- COLONNA SINISTRA: Impostazioni e azioni avanzate -->
                        <div class="flex flex-col gap-3">
                            <div class="flex items-center gap-2 p-3 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/40">
                                <input type="checkbox" id="cloud-sync-attachments" onchange="toggleSyncAttachments(this.checked)" class="w-4 h-4 text-blue-600 rounded border-stone-300 shrink-0">
                                <label for="cloud-sync-attachments" class="text-sm cursor-pointer leading-snug" style="color: var(--color-text-main);">Sincronizza allegati automaticamente (PDF/Immagini)</label>
                            </div>

                            <div class="flex flex-col gap-1.5 pt-1">
                                <p class="text-[10px] font-semibold uppercase tracking-wider text-stone-400 px-1">Opzioni avanzate</p>
                                <button onclick="trasformaInPersonale()" id="btn-switch-personal" class="btn btn-ghost justify-start py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
                                    <i data-lucide="shield" class="w-4 h-4 mr-2 shrink-0"></i> Converti in Backup Privato
                                </button>
                                <button onclick="trasformaInCondiviso()" id="btn-switch-shared" class="btn btn-ghost justify-start py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                                    <i data-lucide="users" class="w-4 h-4 mr-2 shrink-0"></i> Converti in Archivio Condiviso
                                </button>
                                <button onclick="cambiaAccountGoogleVault()" id="btn-cloud-change-account" class="btn btn-ghost justify-start py-2 text-sm text-stone-500 hover:text-blue-600 dark:hover:text-blue-400">
                                    <i data-lucide="user-plus" class="w-4 h-4 mr-2 shrink-0"></i> Usa un altro account Google
                                </button>
                                <button onclick="pulisciAllegatiOrfani()" id="btn-cloud-clean-orphans" class="btn btn-ghost justify-start py-2 text-sm text-stone-500 hover:text-red-600 dark:hover:text-red-400">
                                    <i data-lucide="trash-2" class="w-4 h-4 mr-2 shrink-0"></i> Pulisci file inutilizzati
                                </button>
                                <button onclick="scollegaCloud()" id="btn-disconnect-cloud" class="btn btn-ghost justify-start py-2 text-sm text-stone-400 hover:text-red-600 dark:hover:text-red-400">
                                    <i data-lucide="unlink" class="w-4 h-4 mr-2 shrink-0"></i> Scollega dal Cloud
                                </button>
                            </div>
                        </div>

                        <!-- COLONNA DESTRA: Stepper collaboratori -->
                        <div id="cloud-invite-container" class="flex flex-col gap-0 rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden">
                            <div class="px-4 py-2.5 bg-stone-100 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-700">
                                <p class="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Aggiungi un collaboratore</p>
                            </div>
                            <!-- I due passi affiancati -->
                            <div class="grid grid-cols-2 divide-x divide-stone-200 dark:divide-stone-700">
                                <!-- PASSO 1 -->
                                <div class="flex flex-col p-4 gap-3 bg-emerald-50/50 dark:bg-emerald-900/10">
                                    <div class="flex items-center gap-2">
                                        <span class="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                                        <p class="text-sm font-semibold text-stone-800 dark:text-stone-100">Autorizza su Drive</p>
                                    </div>
                                    <p class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">Inserisci l'email Google del collaboratore. Google Drive gli darà il permesso di accedere al file.</p>
                                    <button onclick="invitaTramiteEmail()" id="btn-cloud-share-email" class="btn btn-secondary py-2 text-sm border-emerald-500 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30 justify-center mt-auto">
                                        <i data-lucide="mail-plus" class="w-4 h-4 mr-1.5"></i> Invita via Email
                                    </button>
                                </div>
                                <!-- PASSO 2 -->
                                <div class="flex flex-col p-4 gap-3 bg-amber-50/50 dark:bg-amber-900/10">
                                    <div class="flex items-center gap-2">
                                        <span class="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                                        <p class="text-sm font-semibold text-stone-800 dark:text-stone-100">Condividi il Codice</p>
                                    </div>
                                    <p class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">Il collaboratore incolla questo codice in ArchiView → "Unisciti a un Archivio".</p>
                                    <div class="flex flex-col gap-2 mt-auto">
                                        <input type="text" id="cloud-invite-code" class="form-input w-full font-mono text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-md p-2 text-center" readonly onclick="this.select()">
                                        <button onclick="copiaCodiceInvito()" id="btn-copy-invite" class="btn btn-secondary py-2 text-sm justify-center">
                                            <i data-lucide="copy" class="w-4 h-4 mr-1.5"></i> Copia Codice
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <!-- Footer nota -->
                            <div class="px-4 py-2 bg-stone-50 dark:bg-stone-800/40 border-t border-stone-200 dark:border-stone-700 flex items-center gap-1.5">
                                <i data-lucide="info" class="w-3 h-3 text-stone-400 shrink-0"></i>
                                <p class="text-[10px] text-stone-400">Fai sempre il passo ① prima del ② per ogni nuovo collaboratore.</p>
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
            <h3 class="text-lg font-bold mb-2 text-stone-800 dark:text-stone-100" id="cloud-progress-title">Operazione in corso</h3>
            <p class="text-sm text-stone-600 dark:text-stone-400" id="cloud-progress-message">Attendere prego...</p>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    });

    function chiediConfermaAccessoCloud() {
        return new Promise((resolve) => {
            const html = `
                <div id="cloud-auth-modal" class="modal-overlay z-150 flex" style="background: rgba(0,0,0,0.5); align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
                    <div class="modal-window p-6 text-center max-w-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-xl">
                        <i data-lucide="cloud" class="w-12 h-12 text-blue-500 mx-auto mb-4"></i>
                        <h3 class="text-xl font-bold mb-2 text-stone-800 dark:text-stone-100">Autenticazione Cloud</h3>
                        <p class="text-sm text-stone-600 dark:text-stone-400 mb-6">
                            Accedi con il tuo account per sincronizzare questo Archivio.
                        </p>
                        <div class="flex flex-col gap-3">
                            <button id="btn-cloud-auth-google" class="btn btn-secondary w-full justify-center text-lg flex items-center gap-2">
                                <i data-lucide="hard-drive" class="w-5 h-5"></i> Accedi con Google
                            </button>
                            <div class="mt-4 border-t border-stone-200 dark:border-stone-700 pt-4">
                                <button id="btn-cloud-auth-no" class="btn btn-ghost w-full justify-center">Annulla</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
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

    function chiediConfermaAzione(titolo, messaggio, testoConferma = "Procedi") {
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
                            <button id="btn-cancel-${id}" class="btn btn-ghost text-sm">Annulla</button>
                            <button id="btn-confirm-${id}" class="btn btn-primary text-sm">${testoConferma}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
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
        const confirm = await chiediConfermaAzione("Usa un altro account Google", "Verrai reindirizzato al browser per accedere con un altro account Google. Questo account verrà usato SOLO per questo Archivio condiviso. Vuoi procedere?");
        if (confirm) {
            mostraProgressoCloud("Autenticazione in corso", "Accedi con l'account Google desiderato nel browser...");
            try {
                await window.apiDrive.auth(true);
                await window.aggiornaStatoDrive();
                if (typeof window.trasformaInCondiviso === 'function') {
                    window.trasformaInCondiviso();
                }
            } catch (e) {
                mostraMessaggio("Errore: " + e.message, "error");
                nascondiProgressoCloud();
            }
        }
    };

    window.cambiaAccountGoogleVault = async function() {
        if (!window.apiDrive) return;
        const confirm = await chiediConfermaAzione("Cambia account Google", "Questo forzerà l'uso di un account Google specifico SOLO per questo Archivio. Vuoi procedere?");
        if (confirm) {
            mostraProgressoCloud("Autenticazione in corso", "Accedi con il nuovo account nel browser...");
            try {
                await window.apiDrive.auth(true);
                await window.aggiornaStatoDrive();
            } catch (e) {
                mostraMessaggio("Errore: " + e.message, "error");
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
                        if (title) title.textContent = "Backup Cloud Personale Attivo";
                        if (desc) {
                            desc.textContent = "Questo Archivio è sincronizzato privatamente sul tuo Google Drive. Solo tu puoi accedervi.";
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
                        if (title) title.textContent = "Archivio Condiviso Attivo";
                        if (desc) {
                            desc.textContent = "Questo Archivio è sincronizzato sul Cloud. Usa \"Invita tramite Email\" per autorizzare i collaboratori, poi condividi questo codice per configurarli.";
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
            });
        }
        
        const modal = document.getElementById('cloud-modal');
        modal.classList.remove('hidden-tab');
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
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

    window.generaCodiceInvito = async function() {
        try {
            if(!window.apiDrive) return;
            const code = await window.apiDrive.generateInvite();
            const input = document.getElementById('cloud-invite-code');
            const btnCopy = document.getElementById('btn-copy-invite');
            input.value = `archiview://join/${code}`;
            input.classList.remove('hidden-tab');
            btnCopy.classList.remove('hidden-tab');
        } catch(e) {
            mostraMessaggio("Errore: " + e.message, "error");
        }
    };

    window.copiaCodiceInvito = function() {
        const input = document.getElementById('cloud-invite-code');
        input.select();
        document.execCommand("copy");
        mostraMessaggio("Codice copiato negli appunti!", "success");
    };

    window.invitaTramiteEmail = async function() {
        const email = await new Promise((resolve) => {
            const html = `
                <div id="email-prompt-modal" class="modal-overlay z-250 flex items-center justify-center bg-black/50 backdrop-blur-sm fixed inset-0">
                    <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-2xl p-6 w-full max-w-md">
                        <h3 class="text-lg font-bold mb-2 text-stone-800 dark:text-stone-100 flex items-center gap-2">
                            <i data-lucide="mail" class="w-5 h-5 text-blue-500"></i> Indirizzo Email
                        </h3>
                        <p class="text-sm text-stone-600 dark:text-stone-400 mb-4">Inserisci l'indirizzo email (Google) della persona da invitare all'Archivio:</p>
                        <input type="email" id="email-prompt-input" class="form-input w-full mb-6" placeholder="email@gmail.com">
                        <div class="flex justify-end gap-3">
                            <button id="email-prompt-cancel" class="btn btn-ghost text-sm">Annulla</button>
                            <button id="email-prompt-confirm" class="btn btn-primary text-sm">Invia Invito</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
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
        
        mostraProgressoCloud("Invio invito in corso", "Assegnazione dei permessi su Google Drive...");
        try {
            await window.apiDrive.shareVault(email.trim());
            mostraMessaggio(`Invito inviato con successo a ${email}!`, "success");
        } catch(e) {
            mostraMessaggio(e.message, "error");
        } finally {
            nascondiProgressoCloud();
        }
    };

    window.pulisciAllegatiOrfani = async function() {
        const confirm = await chiediConfermaAzione("Pulisci file inutilizzati", "Questa operazione eliminerà definitivamente dal PC e da Google Drive tutti gli allegati che non sono più associati a nessuna scheda nel database corrente. Vuoi procedere?", "Elimina file orfani");
        if (!confirm) {
            return;
        }
        
        const btn = document.getElementById('btn-cloud-clean-orphans');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="w-4 h-4 mr-2">⏳</i> Pulizia in corso...';
        
        try {
            if (!window.getApiCloud || !window.getApiCloud().pulisciAllegatiOrfani) {
                throw new Error("Funzione non disponibile.");
            }
            const result = await window.getApiCloud().pulisciAllegatiOrfani();
            mostraMessaggio(`Pulizia completata! File rimossi: ${result.deletedLocal} in locale, ${result.deletedDrive} su Drive.`, "success");
        } catch(e) {
            mostraMessaggio("Errore durante la pulizia: " + e.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
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
