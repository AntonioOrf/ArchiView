// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const mainElement = document.querySelector('main');
        if (mainElement && !document.getElementById('view-add')) {
            const html = `
            <div id="view-add" class="hidden-tab fade-in max-w-2xl mx-auto pb-10">
                <div class="flex items-center gap-3 mb-4">
                    <button id="btn-back-to-list" onclick="if(typeof switchTab === 'function') switchTab('list');" class="text-stone-500 hover:text-amber-700 p-1.5 bg-stone-100 hover:bg-amber-100 rounded-sm transition-colors" data-i18n-title="tooltip_back_to_list" data-i18n-aria-label="tooltip_back_to_list" title="Torna alla lista" aria-label="Torna alla lista">
                        <i data-lucide="arrow-left" class="w-5 h-5"></i>
                    </button>
                    <h2 id="form-title" class="text-2xl font-semibold text-amber-800" data-i18n="title_new_record">Compila Nuova Scheda</h2>
                </div>
                
                <div class="sticky top-2 z-sticky flex justify-end gap-3 mb-4 pointer-events-none" style="margin-left: -1rem; margin-right: -1rem; padding-right: 1rem;">
                    <button style="pointer-events: auto;" type="button" id="btn-cancel-edit" onclick="cancelEdit()" class="hidden btn bg-stone-200 hover:bg-stone-300 text-stone-700 dark:bg-stone-700 dark:hover:bg-stone-600 dark:text-stone-200 py-2 px-4 text-sm whitespace-nowrap shadow-md border border-stone-300 dark:border-stone-600 rounded-md transition-colors" data-i18n="btn_cancel_edit">Annulla</button>
                    <button style="pointer-events: auto;" type="submit" form="manoscritto-form" id="btn-submit-form" data-shortcut="Ctrl+S" data-i18n-title="tooltip_save_record" title="Salva la scheda" class="btn btn-primary py-2 px-6 text-sm whitespace-nowrap shadow-md rounded-md">
                        <i data-lucide="save" class="w-4 h-4 mr-1 hidden sm:inline-block"></i>
                        <span id="testo-btn-submit" data-i18n="btn_save_record">Salva Scheda</span>
                    </button>
                </div>
                
                <form id="manoscritto-form" class="space-y-5 panel-solid p-6 shadow-inner" style="background-color: var(--color-bg-base);">
                    <input type="hidden" id="form-id">
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                        <div class="p-3 panel-solid" style="background-color: var(--color-primary-light); border-color: var(--color-primary-border);">
                            <label class="form-label text-amber-900">
                                <i data-lucide="folder" class="w-4 h-4"></i> <span data-i18n="label_folder">Cartella:</span>
                            </label>
                            <select id="form-cartella" class="form-input" style="border-color: var(--color-primary-border);">
                            </select>
                        </div>
                        
                        <div class="p-3 panel-solid">
                            <label class="form-label">
                                <i data-lucide="file-type" class="w-4 h-4"></i> <span data-i18n="label_doc_type">Tipo Documento:</span>
                            </label>
                            <select id="form-tipo-documento" onchange="renderDynamicFields()" class="form-input"></select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" data-i18n="label_identifier">Identificativo / Segnatura *</label>
                        <input required id="form-segnatura" data-i18n-placeholder="placeholder_identifier" class="form-input">
                    </div>

                    <div id="form-dynamic-fields" class="space-y-5">
                    </div>

                    <!-- Fase 3.7 — il modello e' una BASE: qui si aggiunge un campo che vive
                         su QUESTA scheda sola. Il campo nascosto porta le definizioni finche'
                         non si salva, come gli allegati e i collegamenti: una scheda nuova non
                         ha ancora un id su cui scriverle. -->
                    <input type="hidden" id="form-campi-propri" value="[]">

                    <!-- Fase 3.8 — l'ordine dei campi di QUESTA scheda. Si trascina un elenco
                         di nomi e non i campi veri: trascinare un input combatte con la
                         selezione del testo. I campi restano nel DOM, solo nascosti, cosi' un
                         salvataggio fatto a elenco aperto scrive comunque i valori compilati. -->
                    <input type="hidden" id="form-ordine-campi" value="[]">
                    <div id="form-riordino" class="hidden-tab panel-solid p-3">
                        <div class="flex items-center justify-between gap-2 mb-2">
                            <p class="text-xs text-stone-500" data-i18n="reorder_hint">Trascina per cambiare l'ordine dei campi. Vale solo per questa scheda.</p>
                            <button type="button" onclick="azzeraRiordinoCampi()" class="btn btn-ghost text-xs" data-i18n="reorder_reset">Ordine del modello</button>
                        </div>
                        <ul id="form-riordino-lista" class="space-y-1"></ul>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <button type="button" id="btn-campo-proprio" onclick="apriCampoProprioModal()" class="btn btn-ghost text-sm">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                            <span data-i18n="own_field_add">Aggiungi un campo a questa scheda</span>
                        </button>
                        <button type="button" id="btn-riordina-campi" onclick="alternaRiordinoCampi()" aria-pressed="false" class="btn btn-ghost text-sm">
                            <i data-lucide="arrow-up-down" class="w-4 h-4"></i>
                            <span data-i18n="reorder_fields">Riordina i campi</span>
                        </button>
                    </div>

                    <div class="space-y-1 border-t border-b border-stone-200 py-4 my-2 bg-stone-100/50 px-3 rounded-sm">
                        <label class="form-label" data-i18n="label_attachments">Allega Documenti (Foto o PDF)</label>
                        <input type="file" id="form-allegato" accept="image/*,.pdf" multiple class="form-input file:mr-4 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 cursor-pointer p-1">
                        <input type="hidden" id="form-allegati" value="[]">
                        
                        <div id="form-allegati-list" class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2"></div>
                        <div id="form-allegati-new-preview" class="text-xs text-amber-700 mt-2 font-medium hidden"></div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" data-i18n="label_tags">Tags (separati da virgola)</label>
                        <input id="form-tags" data-i18n-placeholder="placeholder_tags_input" class="form-input">
                    </div>

                    <!-- Fase 3.5 — I rimandi si scrivono su UNA scheda sola: il verso opposto
                         viene calcolato, non salvato (vedi shared/model.ts). Il campo nascosto
                         serve perché una scheda nuova non ha ancora un id quando l'utente
                         aggiunge il primo collegamento. -->
                    <div class="form-group">
                        <label class="form-label" data-i18n="label_links">Collegamenti ad altre schede</label>
                        <input type="hidden" id="form-relazioni" value="[]">
                        <div id="form-relazioni-list" class="space-y-1 mb-2"></div>
                        <div id="form-backlink" class="hidden mb-2">
                            <p class="text-xs uppercase tracking-wider text-stone-500 mb-1" data-i18n="link_incoming">È richiamata da</p>
                            <div id="form-backlink-list" class="space-y-1"></div>
                        </div>
                        <div class="flex gap-2">
                            <select id="form-relazione-tipo" class="form-input shrink-0" style="max-width: 12rem;"></select>
                            <select id="form-relazione-target" class="form-input"></select>
                            <button type="button" onclick="aggiungiRelazioneForm()" class="btn btn-secondary shrink-0" data-i18n-title="link_add" data-i18n-aria-label="link_add" title="Aggiungi il collegamento" aria-label="Aggiungi il collegamento">
                                <i data-lucide="link" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>

                </form>
            </div>
            `;
            mainElement.insertAdjacentHTML('beforeend', html);
        }
    });
})();
