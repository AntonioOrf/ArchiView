// @ts-nocheck
window.modalsHtml = `
    <!-- Modal Benvenuto / Selezione Workspace Iniziale -->
    <div id="welcome-modal" class="modal-overlay hidden-tab z-70 bg-stone-900/80 backdrop-blur-sm">
        <div class="modal-window max-w-lg p-8 text-center shadow-2xl border-2 border-stone-200">
            <div class="flex justify-center mb-6">
                <div class="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-stone-600 shadow-inner">
                    <i data-lucide="folder-open" class="w-8 h-8"></i>
                </div>
            </div>
            <h2 class="text-2xl font-serif text-stone-800 mb-4" data-i18n="welcome_title">Benvenuto in ArchiView</h2>
            <p class="text-stone-600 mb-6 leading-relaxed">
                <span data-i18n="welcome_desc">Per iniziare, è necessario creare o selezionare una <strong>Cartella di lavoro</strong>.<br><br>In questa cartella verranno salvati in automatico tutti i dati (il database) e gli allegati (come i PDF e le foto). Ti consigliamo di creare una cartella dedicata (ad esempio in "Documenti") per tenere tutto in ordine e al sicuro.</span>
            </p>
            <button onclick="selezionaCartellaIniziale()" class="btn btn-primary w-full justify-center py-3 text-lg font-medium shadow-md">
                <i data-lucide="folder" class="w-5 h-5 mr-2"></i>
                <span data-i18n="btn_choose_folder">Scegli o crea cartella</span>
            </button>
        </div>
    </div>

    <!-- Modal Immagini/PDF -->
    <div id="image-modal" class="modal-overlay z-60 hidden-tab" style="background-color: rgba(0,0,0,0.9);">
        <button onclick="chiudiModal()" class="btn btn-ghost btn-icon absolute top-6 right-6 z-10" style="background-color: rgba(0,0,0,0.5); color: #ccc;">
            <i data-lucide="x" class="w-8 h-8"></i>
        </button>
        <img id="modal-img" class="max-w-full max-h-[90vh] rounded-sm object-contain hidden" style="border: 1px solid #444;">
        <iframe id="modal-pdf" class="w-full h-[90vh] max-w-6xl bg-white rounded-sm shadow-xl hidden" src=""></iframe>
    </div>

    <!-- Modal Nuova Cartella -->
    <div id="folder-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="modal_new_folder">Nuova Cartella</h3>
            </div>
            <div class="modal-body">
                <label class="form-label" data-i18n="label_folder_name">Nome della cartella o percorso</label>
                <input type="text" id="folder-name-input" data-i18n-placeholder="label_folder_name" class="form-input">
                <p class="text-xs text-stone-500 mt-2 italic" data-i18n="hint_folder_name">Consiglio: usa la barra ( / ) per creare automaticamente sottocartelle.</p>
                <div class="modal-footer">
                    <button onclick="chiudiFolderModal()" class="btn btn-ghost" data-i18n="btn_cancel">Annulla</button>
                    <button onclick="confermaAggiungiCartella()" class="btn btn-primary" data-i18n="btn_create_folder">Crea Cartella</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Nuovo Tipo Documento -->
    <div id="new-type-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="modal_create_type">Crea Tipo Documento</h3>
                <button type="button" onclick="chiudiNewTypeModal()" class="btn btn-ghost btn-icon"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body">
                <label class="form-label" data-i18n="label_select_model">Seleziona modello o creane uno nuovo</label>
                <select id="new-type-select" onchange="applicaModello()" class="form-input mb-4">
                    <option value="custom" data-i18n="model_custom">Nuovo documento vuoto</option>
                    <option value="imbreviature" data-i18n="model_imbreviature">Modello: Imbreviature notarili</option>
                    <option value="atti" data-i18n="model_atti">Modello: Atti giudiziari</option>
                    <option value="fiscali" data-i18n="model_fiscali">Modello: Documenti fiscali</option>
                </select>

                <div id="custom-type-container" class="space-y-4">
                    <div>
                        <label class="form-label" data-i18n="label_type_name">Nome del nuovo tipo</label>
                        <input type="text" id="custom-type-name" data-i18n-placeholder="label_type_name" class="form-input">
                    </div>
                    <div>
                        <label class="form-label" data-i18n="label_base_fields">Campi di base</label>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            <label class="cursor-pointer">
                                <input type="checkbox" value="dataCronica" data-label="Data cronica" onchange="toggleCampoBase(this)" class="custom-type-field peer sr-only">
                                <div class="px-3 py-2 border border-stone-300 rounded-sm text-center transition-colors peer-checked:bg-amber-100 peer-checked:border-amber-400 peer-checked:text-amber-900 peer-checked:font-semibold text-stone-600 hover:bg-stone-100 select-none" data-i18n="field_data_cronica">Data cronica</div>
                            </label>
                            <label class="cursor-pointer">
                                <input type="checkbox" value="dataTopica" data-label="Data topica" onchange="toggleCampoBase(this)" class="custom-type-field peer sr-only">
                                <div class="px-3 py-2 border border-stone-300 rounded-sm text-center transition-colors peer-checked:bg-amber-100 peer-checked:border-amber-400 peer-checked:text-amber-900 peer-checked:font-semibold text-stone-600 hover:bg-stone-100 select-none" data-i18n="field_data_topica">Data topica</div>
                            </label>
                            <label class="cursor-pointer">
                                <input type="checkbox" value="autore" data-label="Autore/i" onchange="toggleCampoBase(this)" class="custom-type-field peer sr-only">
                                <div class="px-3 py-2 border border-stone-300 rounded-sm text-center transition-colors peer-checked:bg-amber-100 peer-checked:border-amber-400 peer-checked:text-amber-900 peer-checked:font-semibold text-stone-600 hover:bg-stone-100 select-none" data-i18n="field_autore">Autore/i</div>
                            </label>
                            <label class="cursor-pointer">
                                <input type="checkbox" value="titolo" data-label="Titolo / Cont." onchange="toggleCampoBase(this)" class="custom-type-field peer sr-only">
                                <div class="px-3 py-2 border border-stone-300 rounded-sm text-center transition-colors peer-checked:bg-amber-100 peer-checked:border-amber-400 peer-checked:text-amber-900 peer-checked:font-semibold text-stone-600 hover:bg-stone-100 select-none" data-i18n="field_titolo">Titolo / Cont.</div>
                            </label>
                            <label class="cursor-pointer">
                                <input type="checkbox" value="note" data-label="Note" onchange="toggleCampoBase(this)" class="custom-type-field peer sr-only">
                                <div class="px-3 py-2 border border-stone-300 rounded-sm text-center transition-colors peer-checked:bg-amber-100 peer-checked:border-amber-400 peer-checked:text-amber-900 peer-checked:font-semibold text-stone-600 hover:bg-stone-100 select-none" data-i18n="field_note">Note</div>
                            </label>
                            <label class="cursor-pointer">
                                <input type="checkbox" value="prezzo" data-label="Prezzo" onchange="toggleCampoBase(this)" class="custom-type-field peer sr-only">
                                <div class="px-3 py-2 border border-stone-300 rounded-sm text-center transition-colors peer-checked:bg-amber-100 peer-checked:border-amber-400 peer-checked:text-amber-900 peer-checked:font-semibold text-stone-600 hover:bg-stone-100 select-none" data-i18n="field_prezzo">Prezzo</div>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label class="form-label" data-i18n="label_custom_fields">Campi aggiuntivi personalizzati</label>
                        <div class="flex gap-2 mb-2">
                            <input type="text" id="custom-type-extra-input" data-i18n-placeholder="placeholder_custom_field" class="form-input flex-1" onkeydown="if(event.key === 'Enter') { event.preventDefault(); aggiungiCampoCustom(); }">
                            <button type="button" onclick="aggiungiCampoCustom()" class="btn btn-secondary btn-icon"><i data-lucide="plus" class="w-5 h-5"></i></button>
                        </div>
                    </div>
                    <div>
                        <label class="form-label" data-i18n="label_selected_fields">Campi selezionati (trascina per riordinare)</label>
                        <div id="custom-fields-list" class="flex flex-wrap gap-2 min-h-14 p-3 bg-stone-50 border border-stone-200 rounded-sm items-center shadow-inner">
                            <span class="text-xs text-stone-400 italic" id="empty-fields-placeholder" data-i18n="placeholder_empty_fields">Seleziona o aggiungi dei campi...</span>
                        </div>
                    </div>
                </div>

                <div class="modal-footer flex justify-between">
                    <button type="button" onclick="apriManageTypesModal()" class="btn btn-secondary text-sm" data-i18n="btn_manage_models">Gestisci Modelli</button>
                    <div class="flex gap-2">
                        <button type="button" onclick="chiudiNewTypeModal()" class="btn btn-ghost">Annulla</button>
                        <button type="button" onclick="confermaCreaTipo()" class="btn btn-primary" id="btn-salva-tipo" data-i18n="btn_create">Crea</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Gestione Modelli Esistenti -->
    <div id="manage-types-modal" class="modal-overlay hidden-tab z-60">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="modal_manage_models">Gestisci Modelli</h3>
                <button type="button" onclick="chiudiManageTypesModal()" class="btn btn-ghost btn-icon"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body">
                <div id="manage-types-list" class="space-y-2 max-h-64 overflow-y-auto">
                    <!-- Lista popolata da JS -->
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" onclick="chiudiManageTypesModal()" class="btn btn-primary" data-i18n="btn_close">Chiudi</button>
            </div>
        </div>
    </div>

    <!-- Modal Conferma Eliminazione -->
    <div id="delete-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header" style="background-color: var(--color-danger-light); border-color: #fca5a5;">
                <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600"></i>
                <h3 class="modal-title" style="color: var(--color-danger-hover); width: 100%;" data-i18n="modal_confirm_delete">Conferma Eliminazione</h3>
            </div>
            <div class="modal-body">
                <p class="font-medium mb-2" data-i18n="delete_item_prompt">Sei sicuro di voler eliminare questa scheda?</p>
                <p class="text-sm text-stone-500 mb-4" data-i18n="delete_item_hint">L'eventuale allegato (immagine o PDF) non verrà rimosso dall'archivio.</p>
                <input type="hidden" id="delete-item-id">
                <div class="modal-footer">
                    <button onclick="chiudiDeleteModal()" class="btn btn-ghost">Annulla</button>
                    <button onclick="confermaEliminazione()" class="btn btn-danger"><i data-lucide="trash-2" class="w-4 h-4"></i> <span data-i18n="btn_delete">Elimina</span></button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Modifiche non Salvate -->
    <div id="unsaved-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header" style="background-color: var(--color-danger-light); border-color: #fca5a5;">
                <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600"></i>
                <h3 class="modal-title" style="color: var(--color-danger-hover); width: 100%;" data-i18n="modal_unsaved_changes">Modifiche non salvate</h3>
            </div>
            <div class="modal-body">
                <p class="font-medium mb-2" data-i18n="unsaved_prompt">Ci sono modifiche non salvate in questa trascrizione.</p>
                <p class="text-sm text-stone-500 mb-4" data-i18n="unsaved_hint">Sei sicuro di voler uscire e perdere le modifiche?</p>
                <div class="modal-footer">
                    <button onclick="chiudiUnsavedModal()" class="btn btn-primary" data-i18n="btn_continue_writing">Continua a scrivere</button>
                    <button onclick="confermaUscitaTrascrizione()" class="btn btn-ghost text-red-600 hover:bg-red-50" data-i18n="btn_exit_without_saving">Esci senza salvare</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Rinomina -->
    <div id="rename-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-sm">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="modal_rename">Rinomina Allegato</h3>
            </div>
            <div class="modal-body">
                <label class="form-label" data-i18n="label_new_filename">Nuovo nome del file</label>
                <input type="text" id="rename-input" class="form-input" onkeydown="if(event.key === 'Enter') { event.preventDefault(); confermaRinomina(); }">
                <div class="modal-footer">
                    <button onclick="chiudiRenameModal()" class="btn btn-ghost">Annulla</button>
                    <button onclick="confermaRinomina()" class="btn btn-primary" data-i18n="btn_save">Salva</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Preview Documenti -->
    <div id="docs-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-4xl max-h-[90vh]">
            <div class="modal-header shrink-0">
                <h3 class="modal-title">
                    <i data-lucide="layers" class="w-5 h-5 text-amber-700"></i> Documenti: <span id="docs-modal-title"></span>
                </h3>
                <button type="button" onclick="chiudiModalDocumenti()" class="btn btn-ghost btn-icon"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div id="docs-modal-content" class="modal-body flex-1 bg-stone-50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <!-- Preview thumbs -->
            </div>
        </div>
    </div>

    <!-- Modal Impostazioni -->
    <div id="settings-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg max-h-full">
            <div class="modal-header shrink-0">
                <h3 class="modal-title text-stone-800"><i data-lucide="settings" class="w-5 h-5 text-stone-600"></i> <span data-i18n="modal_settings">Impostazioni</span></h3>
                <button type="button" onclick="chiudiImpostazioni()" class="btn btn-ghost btn-icon"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body">
                <div class="space-y-6">
                    <!-- Sezione Workspace -->
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

                    <!-- Sezione Backup -->
                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="archive" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_backup">Backup Dati</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_backup_desc">Crea un file compresso contenente l'intero archivio e tutti gli allegati.</p>
                    <button onclick="esportaBackupZip()" class="btn w-full justify-center shadow-sm" style="background-color: var(--color-text-main); color: var(--color-bg-base);">
                            <i data-lucide="file-archive" class="w-4 h-4"></i> <span data-i18n="btn_export_zip">Esporta Backup in ZIP</span></button>
                    </div>

                    <!-- Sezione Aspetto -->
                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="moon" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_theme">Tema / Aspetto</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_theme_desc">Scegli il tema dell'applicazione.</p>
                        <select id="settings-theme" onchange="cambiaTemaSelezionato(this.value)" class="form-input">
                            <option value="system">Sistema (Predefinito)</option>
                            <option value="light">Chiaro</option>
                            <option value="dark">Scuro (Flat Obsidian)</option>
                        </select>
                    </div>

                    <!-- Sezione Lingua -->
                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="globe" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_lang">Lingua / Language</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_lang_desc">Scegli la lingua dell'applicazione.</p>
                        <select id="settings-language" onchange="cambiaLingua(this.value)" class="form-input">
                            <option value="it">Italiano</option>
                            <option value="en">English</option>
                        </select>
                    </div>

                    <!-- Sezione Aggiornamenti -->
                    <div class="border-t border-stone-200 pt-6">
                        <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="download-cloud" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_updates">Aggiornamenti</span></h4>
                        <p class="text-sm text-stone-600 mb-3" data-i18n="settings_updates_desc">Controlla se è disponibile una nuova versione del programma su GitHub.</p>
                        <button onclick="controllaAggiornamenti(true)" class="btn btn-secondary">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i> <span data-i18n="btn_check_updates">Controlla Aggiornamenti</span></button>
                    </div>
                </div>
            </div>
            <div class="modal-header shrink-0 justify-end" style="border-top: 1px solid var(--color-border-light); border-bottom: none;">
                <button onclick="chiudiImpostazioni()" class="btn" style="background-color: var(--color-text-main); color: var(--color-bg-base);">Chiudi</button>
            </div>
        </div>
    </div>

    <!-- Banner Aggiornamenti -->
    <div id="update-banner" class="hidden-tab w-full bg-sky-600 text-white px-4 py-3 flex items-center justify-between shadow-md z-50 shrink-0 mb-6 rounded-sm border border-sky-700">
        <div class="flex items-center gap-2 text-sm font-medium">
            <i data-lucide="download-cloud" class="w-5 h-5"></i>
            <span id="update-banner-text" data-i18n="update_available">È disponibile un nuovo aggiornamento!</span>
        </div>
        <div class="flex gap-2 shrink-0">
            <button id="btn-scarica-aggiornamento" class="bg-white text-sky-700 hover:bg-sky-50 px-3 py-1.5 rounded-sm text-xs font-bold transition-colors shadow-sm" data-i18n="btn_download_github">Scarica da GitHub</button>
            <button onclick="nascondiBannerAggiornamento()" class="text-sky-100 hover:text-white px-2 py-1.5 transition-colors rounded-sm hover:bg-sky-700"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
    </div>

    <!-- Banner Conferma (Centrato) -->
    <div id="bottom-confirm-banner" class="modal-overlay hidden-tab z-110">
        <div class="modal-window max-w-sm">
            <div class="modal-header" style="background-color: var(--color-danger-light); border-color: #fca5a5;">
                <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600"></i>
                <h3 class="modal-title" style="color: var(--color-danger-hover); width: 100%;" data-i18n="modal_confirm_action">Conferma Azione</h3>
            </div>
            <div class="modal-body">
                <p id="bottom-confirm-text" class="font-medium mb-4 text-center" data-i18n="confirm_prompt_default">Sei sicuro?</p>
                <div id="bottom-confirm-checkbox-container" class="mb-4 flex items-center justify-center gap-2 hidden-tab">
                    <input type="checkbox" id="bottom-confirm-skip" class="w-4 h-4 text-amber-600 border-stone-300 rounded focus:ring-amber-500">
                    <label for="bottom-confirm-skip" class="text-sm text-stone-600 cursor-pointer select-none" data-i18n="dont_ask_again">Non chiederlo più</label>
                </div>
                <div class="modal-footer justify-center mt-2">
                    <button onclick="window.chiudiBottomConfirm()" class="btn btn-ghost text-sm" data-i18n="btn_cancel">Annulla</button>
                    <button id="btn-bottom-confirm-yes" class="btn btn-danger text-sm shadow-md" data-i18n="btn_yes_proceed">Sì, procedi</button>
                </div>
            </div>
        </div>
    </div>`;

