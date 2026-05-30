// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('cloud-modal')) {
            const html = `
    <!-- Modal Cloud & Sincronizzazione -->
    <div id="cloud-modal" class="modal-overlay hidden-tab z-60">
        <div class="modal-window max-w-4xl max-h-[90vh] flex flex-col mx-auto my-auto">
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
                    <h3 class="text-xl font-semibold mb-2">Trasforma in Vault Condiviso</h3>
                    <p class="text-sm text-stone-600 dark:text-stone-400 mb-6 max-w-md">
                        Questo Vault è attualmente salvato solo sul tuo PC. Trasformalo in un Vault Condiviso per sincronizzarlo in sicurezza sul tuo Google Drive e ottenere un codice d'invito per i tuoi collaboratori.
                    </p>
                    <button onclick="trasformaInCondiviso()" id="btn-trasforma-condiviso" class="btn btn-primary py-3 px-6 text-lg shadow-md w-full max-w-sm">
                        <i data-lucide="zap" class="w-5 h-5 mr-2"></i> Trasforma in Vault Condiviso
                    </button>
                    <div id="cloud-transform-status" class="mt-4 text-sm font-medium text-blue-600 hidden">Operazione in corso...</div>
                </div>

                <!-- SEZIONE VAULT CONDIVISO -->
                <div id="cloud-shared-section" class="hidden flex flex-col items-center text-center p-6 border border-amber-200 dark:border-amber-700/50 rounded-md bg-amber-50/50 dark:bg-amber-900/20">
                    <div class="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                        <i data-lucide="users" class="w-8 h-8"></i>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">Vault Condiviso Attivo</h3>
                    <p class="text-sm text-amber-800 dark:text-amber-300 mb-6 max-w-md">
                        Questo Vault è sincronizzato sul Cloud. Condividi il codice sottostante con i tuoi collaboratori per farli accedere immediatamente.
                    </p>
                    
                    <div class="w-full max-w-md space-y-4">
                        <div class="flex gap-2 items-center">
                            <input type="text" id="cloud-invite-code" class="form-input flex-1 font-mono text-sm bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-md p-3 text-center" readonly onclick="this.select()">
                            <button onclick="copiaCodiceInvito()" id="btn-copy-invite" class="btn btn-secondary py-3 px-4 shrink-0">
                                <i data-lucide="copy" class="w-4 h-4"></i> Copia
                            </button>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="sincronizzaGoogleDrive()" id="btn-cloud-drive-sync" class="btn btn-primary flex-1 justify-center py-2">
                                <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Sincronizza Ora
                            </button>
                        </div>
                        
                        <div class="flex items-center gap-2 pt-2 justify-center border-t border-amber-200/50 dark:border-amber-700/30">
                            <input type="checkbox" id="cloud-sync-attachments" onchange="toggleSyncAttachments(this.checked)" class="w-4 h-4 text-amber-600 rounded border-stone-300">
                            <label for="cloud-sync-attachments" class="text-sm text-stone-700 dark:text-stone-300 cursor-pointer">Sincronizza automaticamente allegati (PDF/Immagini)</label>
                        </div>
                        <div class="flex items-center gap-2 pt-2 justify-center border-t border-amber-200/50 dark:border-amber-700/30">
                            <button onclick="pulisciAllegatiOrfani()" id="btn-cloud-clean-orphans" class="btn btn-outline flex-1 justify-center py-2 text-sm text-stone-600 dark:text-stone-300 hover:text-red-600 hover:border-red-600">
                                <i data-lucide="trash-2" class="w-4 h-4 mr-2"></i> Pulisci File Inutilizzati
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-header shrink-0 justify-end border-t border-stone-200 dark:border-stone-700">
                <button onclick="chiudiCloudModal()" class="btn btn-primary">Chiudi</button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    });

    window.apriCloudModal = function() {
        if (window.apiSettings) {
            window.apiSettings.get().then(settings => {
                const localSection = document.getElementById('cloud-local-section');
                const sharedSection = document.getElementById('cloud-shared-section');
                
                if (settings.isSharedVault) {
                    if (localSection) localSection.classList.add('hidden');
                    if (sharedSection) sharedSection.classList.remove('hidden');
                    // Genera subito il codice per mostrarlo
                    generaCodiceInvito();
                    
                    const cbAttachments = document.getElementById('cloud-sync-attachments');
                    if (cbAttachments) cbAttachments.checked = settings.syncAttachments !== false; // Default true
                } else {
                    if (localSection) localSection.classList.remove('hidden');
                    if (sharedSection) sharedSection.classList.add('hidden');
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
            input.value = code;
            input.classList.remove('hidden');
            btnCopy.classList.remove('hidden');
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

    window.pulisciAllegatiOrfani = async function() {
        if (!confirm("Questa operazione eliminerà definitivamente dal PC e da Google Drive tutti gli allegati che non sono più associati a nessuna scheda nel database corrente. Vuoi procedere?")) {
            return;
        }
        
        const btn = document.getElementById('btn-cloud-clean-orphans');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="w-4 h-4 mr-2">⏳</i> Pulizia in corso...';
        
        try {
            if (!window.apiDrive || !window.apiDrive.pulisciAllegatiOrfani) {
                throw new Error("Funzione non disponibile.");
            }
            const result = await window.apiDrive.pulisciAllegatiOrfani();
            mostraMessaggio(`Pulizia completata! File rimossi: ${result.deletedLocal} in locale, ${result.deletedDrive} su Drive.`, "success");
        } catch(e) {
            mostraMessaggio("Errore durante la pulizia: " + e.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            if (window.lucide) window.lucide.createIcons({ nodes: [btn] });
        }
    };

})();
