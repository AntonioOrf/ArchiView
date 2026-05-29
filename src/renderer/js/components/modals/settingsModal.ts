// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('settings-modal')) {
            const html = `
    <div id="settings-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg max-h-full">
            <div class="modal-header shrink-0">
                <h3 class="modal-title text-stone-800"><i data-lucide="settings" class="w-5 h-5 text-stone-600"></i> <span data-i18n="modal_settings">Impostazioni</span></h3>
                <button type="button" onclick="chiudiImpostazioni()" class="btn btn-ghost btn-icon"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body">
                <div class="space-y-6">
                    <div>
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="folder-tree" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_workspace">Cartella di Lavoro (Archivio)</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_workspace_desc">Questa cartella contiene il tuo database e tutti gli allegati copiati.</p>
                        <div class="flex items-center gap-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm font-mono text-stone-700 break-all" id="settings-workspace-path">
                            Caricamento...
                        </div>
                        <button onclick="cambiaCartellaLavoro()" class="btn btn-secondary mt-3">
                            <i data-lucide="folder-search" class="w-4 h-4 text-stone-500"></i> <span data-i18n="btn_change_folder">Cambia Cartella...</span></button>
                        <p class="text-xs text-amber-700 mt-2 font-medium flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> <span data-i18n="settings_workspace_restart">L'app verrà riavviata se cambi la cartella.</span></p>
                    </div>

                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="user" class="w-4 h-4 text-amber-700"></i> <span>Nome Collaboratore / Utente</span></h4>
                        <p class="text-sm text-stone-600 mb-3">Imposta il tuo nome per identificare chi inserisce o modifica le schede ed i testi.</p>
                        <input type="text" id="settings-username" placeholder="Es. Antonio" class="form-input w-full p-2 bg-stone-50 border border-stone-200 rounded-sm text-stone-800 focus:outline-none focus:border-amber-500">
                    </div>

                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="image" class="w-4 h-4 text-amber-700"></i> <span>Cartella Allegati Locale (Opzionale)</span></h4>
                        <p class="text-sm text-stone-600 mb-3">Consente di salvare le immagini localmente sul PC, escludendole dal cloud condiviso per risparmiare spazio.</p>
                        <div class="flex items-center gap-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm font-mono text-stone-700 break-all" id="settings-attachments-path">
                            Caricamento...
                        </div>
                        <div class="flex gap-2 mt-3">
                            <button onclick="cambiaCartellaAllegati()" class="btn btn-secondary">
                                <i data-lucide="folder-search" class="w-4 h-4 text-stone-500"></i> <span>Seleziona Cartella...</span>
                            </button>
                            <button onclick="ripristinaCartellaAllegatiPredefinita()" id="btn-restore-attachments" class="btn btn-ghost text-red-500 hover:bg-red-50 hover:text-red-700 flex items-center gap-1 hidden">
                                <i data-lucide="rotate-ccw" class="w-4 h-4"></i> <span>Ripristina di default</span>
                            </button>
                        </div>
                    </div>

                    <div class="border-t border-stone-200 pt-6 hidden" id="settings-hub-section">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="cloud" class="w-4 h-4 text-amber-700"></i> <span>Stato Collegamento Hub</span></h4>
                        <p class="text-sm text-stone-600 mb-3">Questo vault locale è collegato ad un repository condiviso online.</p>
                        <div class="space-y-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-xs font-mono text-stone-700 break-all mb-4">
                            <div><b>URL Server:</b> <span id="settings-hub-url">Non definito</span></div>
                            <div><b>ID Repository:</b> <span id="settings-hub-repoid">Non definito</span></div>
                            <div><b>Chiave di Scrittura:</b> <span id="settings-hub-key">Non definita</span></div>
                        </div>
                        <div class="space-y-3">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="settings-hub-autofetch" onchange="salvaImpostazioniHub()" class="form-checkbox text-amber-600 rounded border-stone-300 focus:ring-amber-500">
                                <span class="text-sm font-medium text-stone-800">Sincronizzazione Automatica (Autofetch)</span>
                            </label>
                            <div class="flex items-center gap-3">
                                <span class="text-sm text-stone-600">Intervallo di controllo:</span>
                                <select id="settings-hub-autofetch-interval" onchange="salvaImpostazioniHub()" class="form-input text-sm py-1">
                                    <option value="1">1 minuto</option>
                                    <option value="5">5 minuti</option>
                                    <option value="10">10 minuti</option>
                                    <option value="30">30 minuti</option>
                                </select>
                            </div>
                            <p class="text-xs text-stone-500">Se attivato, l'app controllerà in background se ci sono nuove modifiche dal server e le scaricherà automaticamente.</p>
                        </div>
                    </div>



                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="archive" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_backup">Backup Dati</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_backup_desc">Crea un file compresso contenente l'intero archivio e tutti gli allegati.</p>
                    <button onclick="esportaBackupZip()" class="btn w-full justify-center shadow-sm" style="background-color: var(--color-text-main); color: var(--color-bg-base);">
                            <i data-lucide="file-archive" class="w-4 h-4"></i> <span data-i18n="btn_export_zip">Esporta Backup in ZIP</span></button>
                    </div>

                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="moon" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_theme">Tema / Aspetto</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_theme_desc">Scegli il tema dell'applicazione.</p>
                        <select id="settings-theme" onchange="cambiaTemaSelezionato(this.value)" class="form-input">
                            <option value="system">Sistema (Predefinito)</option>
                            <option value="light">Chiaro</option>
                            <option value="dark">Scuro (Flat Obsidian)</option>
                        </select>
                    </div>

                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="globe" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_lang">Lingua / Language</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_lang_desc">Scegli la lingua dell'applicazione.</p>
                        <select id="settings-language" onchange="cambiaLingua(this.value)" class="form-input">
                            <option value="it">Italiano</option>
                            <option value="en">English</option>
                        </select>
                    </div>

                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="download-cloud" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_updates">Aggiornamenti</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_updates_desc">Controlla se è disponibile una nuova versione del programma su GitHub.</p>
                        <button onclick="controllaAggiornamenti(true)" class="btn btn-secondary">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i> <span data-i18n="btn_check_updates">Controlla Aggiornamenti</span></button>
                    </div>

                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="help-circle" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_support">Supporto</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_support_desc">Hai riscontrato dei problemi o hai dei suggerimenti? Segnalalo su GitHub.</p>
                        <button onclick="apriIssueModal(); chiudiImpostazioni();" class="btn btn-secondary">
                            <i data-lucide="alert-circle" class="w-4 h-4"></i> <span data-i18n="btn_report_issue">Segnala problema</span></button>
                    </div>
                </div>
            </div>
            <div class="modal-header shrink-0 justify-end" style="border-top: 1px solid var(--color-border-light); border-bottom: none;">
                <button onclick="chiudiImpostazioni()" class="btn" style="background-color: var(--color-text-main); color: var(--color-bg-base);">Chiudi</button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    });
})();
