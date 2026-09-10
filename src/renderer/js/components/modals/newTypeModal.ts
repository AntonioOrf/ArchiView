// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('new-type-modal')) {
            const html = `
    <div id="new-type-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="modal_create_type">Crea Tipo Documento</h3>
                <button type="button" onclick="chiudiNewTypeModal()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
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
                    <!-- Compare solo modificando un modello predefinito: senza, i campi
                         bloccati e il nome non scrivibile sembrerebbero un guasto. -->
                    <p id="type-locked-note" class="hidden text-xs text-stone-500 dark:text-stone-400 leading-relaxed" data-i18n="type_locked_note">Questo è un modello predefinito: nome e campi d'origine non si cambiano — tornerebbero da soli al prossimo avvio. Puoi però aggiungere campi tuoi, modificarli ed eliminarli.</p>
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

                    <!-- Fase 3.1 - Configurazione di un singolo campo. Inline sotto l'elenco
                         e non in un secondo modale: si apre e si chiude mentre si compone il
                         tipo, e un modale sopra un modale non ha una via d'uscita ovvia.
                         I colori sono VARIABILI di tema e non classi Tailwind fisse: con
                         "bg-amber-50/60" il pannello restava beige chiaro anche sui due temi
                         scuri (il markup vive in un template literal: niente backtick qui
                         dentro, chiuderebbero la stringa). -->
                    <div id="campo-editor" class="hidden campo-editor-box rounded-sm">
                        <div class="campo-editor-testa">
                            <span class="campo-editor-titolo">
                                <i data-lucide="settings-2" class="w-4 h-4"></i>
                                <span data-i18n="field_configure">Configura il campo</span>:
                                <code id="campo-editor-nome"></code>
                            </span>
                            <button type="button" onclick="chiudiEditorCampo()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-4 h-4"></i></button>
                        </div>
                        <div class="campo-editor-corpo">
                            <div>
                                <label class="form-label" for="campo-editor-tipo" data-i18n="label_field_type">Tipo di dato</label>
                                <select id="campo-editor-tipo" class="form-input" onchange="aggiornaEditorCampo()"></select>
                            </div>
                            <div id="campo-editor-vocabolario-riga" class="hidden">
                                <label class="form-label" for="campo-editor-vocabolario" data-i18n="label_field_vocab">Prendi i valori da un vocabolario d'archivio</label>
                                <div class="flex gap-2">
                                    <select id="campo-editor-vocabolario" class="form-input" onchange="aggiornaEditorCampo()"></select>
                                    <button type="button" onclick="apriVocabolari()" class="btn btn-secondary shrink-0" data-i18n-title="vocab_title" data-i18n-aria-label="vocab_title" title="Vocabolari controllati" aria-label="Vocabolari controllati">
                                        <i data-lucide="list-tree" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                            <div id="campo-editor-authority-riga" class="hidden">
                                <label class="form-label" for="campo-editor-authority" data-i18n="label_field_authority">Alimenta l'anagrafica di</label>
                                <select id="campo-editor-authority" class="form-input"></select>
                            </div>
                            <div id="campo-editor-opzioni-riga" class="hidden">
                                <label class="form-label" for="campo-editor-opzioni" data-i18n="label_field_options">Valori ammessi (uno per riga)</label>
                                <textarea id="campo-editor-opzioni" rows="4" class="form-input" data-i18n-placeholder="placeholder_field_options" placeholder="pergamena&#10;carta"></textarea>
                            </div>
                            <label class="campo-editor-scelta">
                                <input type="checkbox" id="campo-editor-obbligatorio">
                                <span data-i18n="label_field_required">Obbligatorio: la scheda non si salva se è vuoto</span>
                            </label>
                            <label id="campo-editor-unico-riga" class="campo-editor-scelta">
                                <input type="checkbox" id="campo-editor-unico">
                                <span data-i18n="label_field_unique">Valore unico: avvisa se un'altra scheda ha lo stesso valore</span>
                            </label>
                        </div>
                        <div class="campo-editor-azioni">
                            <button type="button" onclick="chiudiEditorCampo()" class="btn btn-secondary text-sm" data-i18n="btn_cancel">Annulla</button>
                            <button type="button" onclick="confermaEditorCampo()" class="btn btn-primary text-sm" id="btn-campo-editor-ok" data-i18n="btn_apply">Applica</button>
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
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
