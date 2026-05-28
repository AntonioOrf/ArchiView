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
                    Seleziona Cartella Locale
                </button>
                <button onclick="mostraInputNuovaCartella()" class="btn btn-secondary w-full justify-center py-3 text-lg font-medium shadow-sm bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700">
                    <i data-lucide="folder-plus" class="w-5 h-5 mr-2"></i>
                    Crea Nuova Cartella
                </button>
                <button onclick="mostraHubConnessioneForm()" class="btn w-full justify-center py-3 text-lg font-medium shadow-sm text-amber-900 border border-amber-300 hover:bg-amber-50" style="background-color: #fef3c7;">
                    <i data-lucide="cloud-download" class="w-5 h-5 mr-2"></i>
                    Connetti a Hub (Cloud)
                </button>
            </div>

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
                <div class="flex justify-end gap-2 mt-4">
                    <button onclick="nascondiInputNuovaCartella()" class="btn btn-ghost text-sm">Annulla</button>
                    <button onclick="creaCartellaIniziale()" class="btn btn-primary text-sm shadow-sm">Crea e Avvia</button>
                </div>
            </div>

            <div id="welcome-hub-form" class="hidden-tab mt-4 text-left border border-stone-200 p-4 rounded-md bg-stone-50">
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm">URL del Server Hub</label>
                    <input type="text" id="welcome-hub-url" class="form-input w-full focus:ring-2 focus:ring-amber-500/20 text-sm" placeholder="Es. http://localhost:3000">
                </div>
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm">ID Repository (Stanza)</label>
                    <input type="text" id="welcome-hub-repoid" class="form-input w-full focus:ring-2 focus:ring-amber-500/20 text-sm" placeholder="Es. repo_xyz">
                </div>
                <div class="mb-3">
                    <label class="form-label font-medium mb-1 block text-sm">Chiave Segreta di Accesso (Key)</label>
                    <input type="password" id="welcome-hub-key" class="form-input w-full focus:ring-2 focus:ring-amber-500/20 text-sm" placeholder="Es. tk_abc...">
                </div>
                <div class="flex justify-end gap-2 mt-4">
                    <button onclick="nascondiHubConnessioneForm()" class="btn btn-ghost text-sm">Annulla</button>
                    <button onclick="connettiEClonaHub()" class="btn btn-primary text-sm shadow-sm">Connetti e Clona</button>
                </div>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    });

    window.mostraInputNuovaCartella = async function() {
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

    window.mostraHubConnessioneForm = function() {
        document.getElementById('welcome-buttons').classList.add('hidden-tab');
        document.getElementById('welcome-hub-form').classList.remove('hidden-tab');
        const urlInput = document.getElementById('welcome-hub-url');
        if (urlInput && !urlInput.value) {
            urlInput.value = "http://localhost:3000";
        }
    };

    window.nascondiHubConnessioneForm = function() {
        document.getElementById('welcome-hub-form').classList.add('hidden-tab');
        document.getElementById('welcome-buttons').classList.remove('hidden-tab');
        document.getElementById('welcome-hub-repoid').value = '';
        document.getElementById('welcome-hub-key').value = '';
    };

    window.connettiEClonaHub = async function() {
        const url = document.getElementById('welcome-hub-url').value.trim();
        const repoId = document.getElementById('welcome-hub-repoid').value.trim();
        const key = document.getElementById('welcome-hub-key').value.trim();
        
        if (!url || !repoId || !key) {
            mostraMessaggio("Compila tutti i campi per connetterti all'Hub.", "error");
            return;
        }

        if (typeof window.clonaRepositoryHub === 'function') {
            await window.clonaRepositoryHub(url, repoId, key);
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
            const success = await window.apiBrowser.createWorkspaceInPath(basePath, name);
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
