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
                
                <!-- BANNER MULTI-DRIVE -->
                <div class="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
                    <i data-lucide="info" class="w-5 h-5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400"></i>
                    <p>Ogni Vault ha il proprio Cloud indipendente. L'account Google Drive collegato qui vale <strong>solo per questo Vault</strong>.</p>
                </div>

                <!-- AVVISO VAULT CONDIVISO (Nascosto di default) -->
                <div id="cloud-shared-warning" class="hidden mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <i data-lucide="users" class="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"></i>
                    <div>
                        <p class="font-semibold mb-1">Stai partecipando a un Vault Condiviso</p>
                        <p>Stai sincronizzando i dati sul Google Drive del proprietario originale. Le opzioni di Login sono state disabilitate per non scollegarti dalla sessione condivisa.</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    <!-- Sezione Google Drive (Manuale) -->
                    <div class="panel-glass p-4 flex flex-col border border-stone-200 dark:border-stone-700">
                        <div class="flex items-center gap-2 mb-4">
                            <i data-lucide="hard-drive" class="w-5 h-5 text-blue-500"></i>
                            <h3 class="font-bold text-lg">Google Drive</h3>
                        </div>
                        <p class="text-sm text-stone-600 dark:text-stone-400 mb-4 flex-1">
                            Sincronizza l'intero database sul tuo Google Drive personale in modo sicuro e privato.
                        </p>
                        
                        <div id="cloud-drive-status" class="mb-4 text-sm font-medium p-2 bg-stone-100 dark:bg-stone-900 rounded border border-stone-200 dark:border-stone-700">
                            <span class="text-stone-500 dark:text-stone-400">Controllo stato...</span>
                        </div>
                        
                        <!-- Toggle Allegati -->
                        <label class="flex items-start gap-2 cursor-pointer mb-4 p-2 bg-stone-50 dark:bg-stone-900/50 rounded border border-stone-200 dark:border-stone-700">
                            <input type="checkbox" id="cloud-drive-sync-attachments" onchange="salvaImpostazioniDrive()" class="form-checkbox mt-1 text-blue-600 rounded border-stone-300 dark:border-stone-600 dark:bg-stone-900 focus:ring-blue-500">
                            <div>
                                <span class="text-sm font-medium text-stone-800 dark:text-stone-200 block">Sincronizza anche le immagini</span>
                                <span class="text-xs text-stone-500 dark:text-stone-400">Attenzione: consumerà più spazio su Drive</span>
                            </div>
                        </label>

                        <div id="cloud-drive-buttons" class="flex flex-wrap gap-2 mt-auto">
                            <button onclick="loginGoogleDrive()" id="btn-cloud-drive-login" class="btn btn-secondary flex-1 justify-center py-2 min-w-[100px]">
                                <i data-lucide="log-in" class="w-4 h-4 shrink-0"></i> Accedi
                            </button>
                            <button onclick="logoutGoogleDrive()" id="btn-cloud-drive-logout" class="btn btn-ghost text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 hidden shrink-0">
                                <i data-lucide="log-out" class="w-4 h-4 shrink-0"></i> Esci
                            </button>
                            <button onclick="sincronizzaGoogleDrive()" id="btn-cloud-drive-sync" class="btn btn-primary flex-1 justify-center hidden min-w-[120px]">
                                <i data-lucide="refresh-cw" class="w-4 h-4 shrink-0"></i> Sincronizza
                            </button>
                        </div>
                    </div>

                    <!-- Sezione Realtime (Pusher) -->
                    <div class="panel-glass p-4 flex flex-col border border-stone-200 dark:border-stone-700">
                        <div class="flex items-center gap-2 mb-4">
                            <i data-lucide="zap" class="w-5 h-5 text-amber-500"></i>
                            <h3 class="font-bold text-lg">Auto-Sync (Realtime)</h3>
                        </div>
                        <p class="text-sm text-stone-600 dark:text-stone-400 mb-4">
                            Scarica automaticamente le modifiche quando gli altri collaboratori salvano. Richiede configurazione Pusher.
                        </p>
                        
                        <label class="flex items-center gap-2 cursor-pointer mb-3">
                            <input type="checkbox" id="cloud-drive-autofetch" onchange="salvaImpostazioniDrive()" class="form-checkbox text-amber-600 rounded border-stone-300 dark:border-stone-600 dark:bg-stone-900 focus:ring-amber-500">
                            <span class="text-sm font-medium text-stone-800 dark:text-stone-200">Abilita Auto-Sync</span>
                        </label>
                        
                        <div class="space-y-2 mt-auto">
                            <div>
                                <label class="block text-[10px] uppercase text-stone-500 dark:text-stone-400 mb-1 font-bold">Pusher App Key</label>
                                <input type="text" id="cloud-pusher-key" onchange="salvaImpostazioniDrive()" placeholder="es. abc123def456" class="form-input w-full p-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md text-xs dark:text-stone-200">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-[10px] uppercase text-stone-500 dark:text-stone-400 mb-1 font-bold">Cluster</label>
                                    <input type="text" id="cloud-pusher-cluster" onchange="salvaImpostazioniDrive()" placeholder="es. eu" class="form-input w-full p-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md text-xs dark:text-stone-200">
                                </div>
                                <div>
                                    <label class="block text-[10px] uppercase text-stone-500 dark:text-stone-400 mb-1 font-bold">Webhook</label>
                                    <input type="text" id="cloud-pusher-webhook" onchange="salvaImpostazioniDrive()" placeholder="https://..." class="form-input w-full p-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md text-xs dark:text-stone-200">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sezione P2P / Condivisione Vault -->
                <div class="mt-6 border border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/20 p-4 rounded-md">
                    <h4 class="font-semibold text-amber-900 dark:text-amber-400 mb-2 flex items-center gap-2">
                        <i data-lucide="users" class="w-5 h-5 shrink-0"></i> Condivisione Vault Rapida
                    </h4>
                    <p class="text-sm text-amber-800 dark:text-amber-300 mb-4">Genera un codice per permettere ai tuoi collaboratori di connettersi istantaneamente a questo Vault e a Google Drive senza dover configurare nulla manualmente.</p>
                    <div class="flex gap-2 items-center flex-wrap">
                        <button onclick="generaCodiceInvito()" class="btn btn-primary text-sm shadow-sm px-4 py-2 shrink-0 whitespace-nowrap">
                            <i data-lucide="key" class="w-4 h-4 mr-2 shrink-0"></i> Genera Codice Invito
                        </button>
                        <input type="text" id="cloud-invite-code" class="form-input flex-1 min-w-[150px] font-mono text-xs bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hidden border border-stone-200 dark:border-stone-700 rounded-md p-2" readonly onclick="this.select()">
                        <button onclick="copiaCodiceInvito()" id="btn-copy-invite" class="btn btn-secondary text-sm hidden shrink-0">Copia</button>
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
        // Popola i campi
        if (window.apiSettings) {
            window.apiSettings.get().then(settings => {
                const autofetch = document.getElementById('cloud-drive-autofetch');
                const syncAttachments = document.getElementById('cloud-drive-sync-attachments');
                const pKey = document.getElementById('cloud-pusher-key');
                const pCluster = document.getElementById('cloud-pusher-cluster');
                const pWebhook = document.getElementById('cloud-pusher-webhook');
                const sharedWarning = document.getElementById('cloud-shared-warning');
                const driveButtons = document.getElementById('cloud-drive-buttons');
                const btnSync = document.getElementById('btn-cloud-drive-sync');
                
                if(autofetch) autofetch.checked = !!settings.driveAutofetch;
                if(syncAttachments) syncAttachments.checked = !!settings.syncAttachments;
                if(pKey) pKey.value = settings.pusherKey || "";
                if(pCluster) pCluster.value = settings.pusherCluster || "";
                if(pWebhook) pWebhook.value = settings.pusherWebhook || "";
                
                // Gestione UI per Vault Condiviso
                if (settings.isSharedVault) {
                    if (sharedWarning) sharedWarning.classList.remove('hidden');
                    
                    // Nascondi Login/Logout per non far sovrascrivere il token
                    const btnLogin = document.getElementById('btn-cloud-drive-login');
                    const btnLogout = document.getElementById('btn-cloud-drive-logout');
                    if (btnLogin) btnLogin.style.display = 'none';
                    if (btnLogout) btnLogout.style.display = 'none';
                    
                    // Mostra sempre il tasto Sincronizza per i condivisi
                    if (btnSync) btnSync.classList.remove('hidden');
                    
                    // Mostra uno stato fake di "Connesso come Collaboratore" in driveLogic se non c'è user
                } else {
                    if (sharedWarning) sharedWarning.classList.add('hidden');
                    const btnLogin = document.getElementById('btn-cloud-drive-login');
                    const btnLogout = document.getElementById('btn-cloud-drive-logout');
                    if (btnLogin) btnLogin.style.display = '';
                    if (btnLogout) btnLogout.style.display = '';
                }
            });
        }
        
        // Controlla stato drive per l'UI
        if (typeof checkDriveStatusVisual === 'function') {
            checkDriveStatusVisual();
        }

        const modal = document.getElementById('cloud-modal');
        modal.classList.remove('hidden-tab');
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
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

})();
