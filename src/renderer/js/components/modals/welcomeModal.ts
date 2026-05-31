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
            <h2 class="text-2xl font-serif text-stone-800 mb-4">Gestione Archivi</h2>
            <p class="text-stone-600 mb-8 leading-relaxed text-sm">
                Scegli una cartella vuota per creare un nuovo archivio indipendente, oppure seleziona una cartella già esistente per caricarne i dati.
            </p>

            <div class="flex flex-col gap-3" id="welcome-buttons">
                <button onclick="selezionaCartellaIniziale()" class="btn btn-primary w-full justify-center py-3 text-lg font-medium shadow-md">
                    <i data-lucide="folder-open" class="w-5 h-5 mr-2"></i>
                    Apri Cartella Locale
                </button>
                <button onclick="mostraInputNuovaCartella(false)" class="btn btn-secondary w-full justify-center py-3 text-lg font-medium shadow-sm bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700">
                    <i data-lucide="folder-plus" class="w-5 h-5 mr-2"></i>
                    Crea Nuova Cartella Locale
                </button>
                <div class="h-px bg-stone-200 my-1 w-full"></div>
                <button onclick="mostraInputNuovaCartella(true)" class="btn w-full justify-center py-3 text-lg font-medium shadow-sm text-blue-900 border border-blue-300 hover:bg-blue-50" style="background-color: #eff6ff;">
                    <i data-lucide="cloud-upload" class="w-5 h-5 mr-2"></i>
                    Crea un Vault Condiviso
                </button>
                <button onclick="mostraJoinForm()" class="btn w-full justify-center py-3 text-lg font-medium shadow-sm text-amber-900 border border-amber-300 hover:bg-amber-50" style="background-color: #fffbeb;">
                    <i data-lucide="users" class="w-5 h-5 mr-2"></i>
                    Unisciti a un Vault Condiviso
                </button>
                <button onclick="mostraCloudExplorer()" class="btn btn-ghost text-sm text-stone-500 mt-1 hover:text-stone-700 w-full justify-center">
                    Ripristina da Google Drive...
                </button>
            </div>

            <!-- CREA NUOVA CARTELLA FORM -->
            <div id="welcome-create-form" class="hidden-tab mt-4 text-left border border-stone-200 p-4 rounded-md bg-stone-50">
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm">Nome dell'archivio</label>
                    <input type="text" id="welcome-new-folder-name" class="form-input w-full focus:ring-2 focus:ring-amber-500/20 transition-all text-sm" placeholder="Es. Archivio Manoscritti" onkeydown="if(event.key === 'Enter') creaCartellaIniziale()">
                </div>
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm">Posizione</label>
                    <div class="flex gap-2">
                        <input type="text" id="welcome-new-folder-path" class="form-input flex-1 bg-white text-stone-600 text-sm border border-stone-300" readonly>
                        <button onclick="selezionaPercorsoBase()" class="btn btn-secondary px-3 py-1 text-sm shadow-sm bg-stone-100 border border-stone-300 hover:bg-stone-200">Sfoglia...</button>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-6 pt-4 border-t border-stone-200">
                    <button onclick="nascondiInputNuovaCartella()" class="btn btn-ghost text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> Torna Indietro
                    </button>
                    <button onclick="creaCartellaIniziale()" class="btn btn-primary text-sm shadow-sm px-6">Crea e Avvia</button>
                </div>
            </div>

            <!-- JOIN FORM -->
            <div id="welcome-join-form" class="hidden-tab mt-4 text-left border border-stone-200 p-4 rounded-md bg-stone-50">
                <h3 class="font-medium mb-1 text-stone-800 flex items-center gap-2">
                    <i data-lucide="users" class="w-5 h-5 text-amber-600"></i> Unisciti a un Vault Condiviso
                </h3>
                <p class="text-xs text-stone-500 mb-4 leading-snug">
                    Unendoti tramite codice accederai a un Cloud condiviso sul Google Drive del creatore originale.
                    Qualsiasi modifica locale si sincronizzerà direttamente con gli altri membri.
                </p>
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm">Codice di Invito</label>
                    <textarea id="welcome-join-code" class="form-input w-full focus:ring-2 focus:ring-amber-500/20 transition-all text-xs font-mono h-24" placeholder="Incolla qui il codice..."></textarea>
                </div>
                <div id="welcome-join-vault-info" class="hidden-tab mb-3 p-3 bg-stone-100 border border-stone-200 rounded text-sm text-stone-700 flex items-center gap-2">
                    <i data-lucide="folder-check" class="w-5 h-5 text-emerald-600"></i>
                    <div>
                        <span class="font-semibold">Nome Vault:</span>
                        <span id="welcome-join-vault-name" class="font-mono text-emerald-700"></span>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm">Posizione cartella locale</label>
                    <div class="flex gap-2 mt-1">
                        <input type="text" id="welcome-join-folder-path" class="form-input flex-1 bg-white text-stone-600 text-sm border border-stone-300" readonly>
                        <button onclick="selezionaPercorsoBaseJoin()" class="btn btn-secondary px-3 py-1 text-sm">Sfoglia...</button>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-6 pt-4 border-t border-stone-200">
                    <button onclick="nascondiJoinForm()" class="btn btn-ghost text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> Torna Indietro
                    </button>
                    <button onclick="eseguiJoinVault()" class="btn btn-primary text-sm shadow-sm px-6">Connettiti</button>
                </div>
            </div>

            <!-- CLOUD EXPLORER -->
            <div id="welcome-cloud-explorer" class="hidden-tab mt-4 text-left border border-stone-200 p-4 rounded-md bg-stone-50">
                <h3 class="font-medium mb-3 text-stone-800 flex items-center gap-2">
                    <i data-lucide="cloud" class="w-5 h-5 text-blue-600"></i> Seleziona un Vault dal Cloud
                </h3>
                <div id="cloud-vaults-list" class="space-y-2 max-h-64 overflow-y-auto pr-2">
                    <!-- Lista popolata via JS -->
                </div>
                <div class="flex justify-between items-center mt-6 pt-4 border-t border-stone-200">
                    <button onclick="nascondiCloudExplorer()" class="btn btn-ghost text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> Torna Indietro
                    </button>
                    <button onclick="eseguiRipristinoCloudGlobale()" class="btn btn-secondary text-sm shadow-sm" title="Se non vedi il tuo vault, cerca in tutto il Drive">Cerca Ovunque</button>
                </div>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);

            const joinCodeTextarea = document.getElementById('welcome-join-code');
            if (joinCodeTextarea) {
                joinCodeTextarea.addEventListener('input', async () => {
                    const code = joinCodeTextarea.value.trim();
                    const infoDiv = document.getElementById('welcome-join-vault-info');
                    const nameSpan = document.getElementById('welcome-join-vault-name');
                    if (!code) {
                        if (infoDiv) infoDiv.classList.add('hidden-tab');
                        return;
                    }
                    try {
                        if (window.apiDrive && window.apiDrive.decodeInvite) {
                            const result = await window.apiDrive.decodeInvite(code);
                            if (result && result.vaultName) {
                                if (nameSpan) nameSpan.textContent = result.vaultName;
                                if (infoDiv) infoDiv.classList.remove('hidden-tab');
                                return;
                            }
                        }
                    } catch (e) {}
                    if (infoDiv) infoDiv.classList.add('hidden-tab');
                });
            }
        }
    });

    window.mostraInputNuovaCartella = async function(isShared = false) {
        window.creazioneVaultCondiviso = isShared;
        document.getElementById('welcome-buttons').classList.add('hidden-tab');
        document.getElementById('welcome-create-form').classList.remove('hidden-tab');
        if (window.apiBrowser && window.apiBrowser.getDocumentsPath) {
            const docsPath = await window.apiBrowser.getDocumentsPath();
            const pathInput = document.getElementById('welcome-new-folder-path');
            if (pathInput && !pathInput.value) {
                pathInput.value = docsPath;
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
        
        mostraMessaggio("Autenticazione e ricerca vault in corso...", "info");
        try {
            await window.apiDrive.auth();
            const vaults = await window.apiDrive.listVaults();
            
            document.getElementById('welcome-buttons').classList.add('hidden-tab');
            document.getElementById('welcome-cloud-explorer').classList.remove('hidden-tab');
            
            const listContainer = document.getElementById('cloud-vaults-list');
            listContainer.innerHTML = '';
            
            if (vaults.length === 0) {
                listContainer.innerHTML = `<p class="text-sm text-stone-500 p-4 text-center">Nessun Vault trovato nella cartella ArchiView sul tuo Drive.</p>`;
            } else {
                vaults.forEach(v => {
                    const div = document.createElement('div');
                    div.className = "p-3 bg-white border border-stone-200 rounded cursor-pointer hover:border-amber-400 hover:shadow-md transition-all flex justify-between items-center";
                    const dateStr = new Date(v.modifiedTime).toLocaleDateString();
                    
                    const escapedName = v.name.replace(/[&<>'"]/g, tag => ({
                        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
                    }[tag] || tag));

                    div.innerHTML = `
                        <div class="flex items-center gap-3">
                            <i data-lucide="folder-cloud" class="w-5 h-5 text-blue-600"></i>
                            <div>
                                <div class="font-medium text-stone-800">${escapedName}</div>
                                <div class="text-xs text-stone-500">Modificato: ${dateStr}</div>
                            </div>
                        </div>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-stone-400"></i>
                    `;
                    div.onclick = () => eseguiRipristinoCloud(v.id, v.name);
                    listContainer.appendChild(div);
                });
                if (window.lucide) lucide.createIcons({ nodes: [listContainer] });
            }
        } catch(e) {
            mostraMessaggio("Errore Cloud: " + e.message, "error");
        }
    };

    window.nascondiCloudExplorer = function() {
        document.getElementById('welcome-cloud-explorer').classList.add('hidden-tab');
        document.getElementById('welcome-buttons').classList.remove('hidden-tab');
    };

    window.mostraJoinForm = async function() {
        document.getElementById('welcome-buttons').classList.add('hidden-tab');
        document.getElementById('welcome-join-form').classList.remove('hidden-tab');
        if (window.apiBrowser && window.apiBrowser.getDocumentsPath) {
            const docsPath = await window.apiBrowser.getDocumentsPath();
            const pathInput = document.getElementById('welcome-join-folder-path');
            if (pathInput && !pathInput.value) {
                pathInput.value = docsPath;
            }
        }
    };

    window.nascondiJoinForm = function() {
        document.getElementById('welcome-join-form').classList.add('hidden-tab');
        document.getElementById('welcome-buttons').classList.remove('hidden-tab');
    };

    window.selezionaPercorsoBaseJoin = async function() {
        if (window.apiBrowser && window.apiBrowser.selectBaseDirectory) {
            const basePath = await window.apiBrowser.selectBaseDirectory();
            if (basePath) {
                document.getElementById('welcome-join-folder-path').value = basePath;
            }
        }
    };

    window.eseguiJoinVault = async function() {
        const code = document.getElementById('welcome-join-code').value.trim();
        const basePath = document.getElementById('welcome-join-folder-path').value.trim();
        
        if(!code || !basePath) {
            mostraMessaggio("Compila tutti i campi.", "warning");
            return;
        }

        try {
            mostraMessaggio("Connessione al Vault in corso...", "info");
            const result = await window.apiDrive.decodeInvite(code);
            if (!result || !result.vaultName) {
                throw new Error("Codice invito non valido o impossibile recuperare il nome del Vault.");
            }
            
            await window.apiDrive.joinInvite(code, basePath, result.vaultName);
            document.getElementById('welcome-modal').classList.add('hidden-tab');
            mostraMessaggio("Connesso con successo! Riavvio in corso...", "success");
            if (typeof avviaApp === 'function') await avviaApp();
        } catch(e) {
            mostraMessaggio(e.message, "error");
        }
    };

    window.eseguiRipristinoCloudGlobale = async function() {
        await eseguiRipristinoCloud(null, 'Vault_Recuperato');
    };

    window.eseguiRipristinoCloud = async function(vaultId, defaultName) {
        mostraMessaggio("Scaricamento archivio...", "info");
        try {
            const driveData = await window.apiDrive.pull(vaultId);
            
            if (!driveData || !driveData.database) {
                mostraMessaggio("Nessun database trovato nel Vault selezionato.", "warning");
                return;
            }
            
            mostraMessaggio("Archivio scaricato! Seleziona dove salvarlo sul tuo PC.", "info");
            
            if (window.apiBrowser && window.apiBrowser.selectBaseDirectory) {
                const basePath = await window.apiBrowser.selectBaseDirectory();
                if (basePath) {
                    const driveConfig = vaultId ? { isSharedVault: true, sharedVaultId: vaultId } : null;
                    const success = await window.apiBrowser.cloneWorkspaceHub(basePath, defaultName, driveConfig, driveData.database);
                    if (success) {
                        document.getElementById('welcome-modal').classList.add('hidden-tab');
                        mostraMessaggio("Archivio ripristinato con successo! Riavvio in corso...", "success");
                        if (typeof avviaApp === 'function') await avviaApp();
                    } else {
                        throw new Error("Errore durante la creazione dei file locali.");
                    }
                }
            }
        } catch (e) {
            console.error(e);
            mostraMessaggio("Errore: " + (e.message || "Impossibile ripristinare"), "error");
        }
    };

    window.selezionaPercorsoBase = async function() {
        if (window.apiBrowser && window.apiBrowser.selectBaseDirectory) {
            const basePath = await window.apiBrowser.selectBaseDirectory();
            if (basePath) {
                document.getElementById('welcome-new-folder-path').value = basePath;
            }
        }
    };

    window.creaCartellaIniziale = async function() {
        const name = document.getElementById('welcome-new-folder-name').value.trim();
        const basePath = document.getElementById('welcome-new-folder-path').value.trim();
        if (!name || !basePath) return;
        
        if (window.apiBrowser && window.apiBrowser.createWorkspaceInPath) {
            const config = window.creazioneVaultCondiviso ? { autoStartTrasformaCondiviso: true } : null;
            const success = await window.apiBrowser.createWorkspaceInPath(basePath, name, config);
            if (success) {
                document.getElementById('welcome-modal').classList.add('hidden-tab');
                if (typeof avviaApp === 'function') await avviaApp();
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
