// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const mainElement = document.querySelector('main');
        if (mainElement && !document.getElementById('view-add')) {
            const html = `
            <div id="view-add" class="hidden-tab fade-in max-w-2xl mx-auto pb-10">
                <div class="flex justify-between items-center border-b border-stone-200 pb-2 mb-6">
                    <div class="flex items-center gap-3">
                        <button onclick="if(typeof switchTab === 'function') switchTab('list');" class="text-stone-500 hover:text-amber-700 p-1.5 bg-stone-100 hover:bg-amber-100 rounded-sm transition-colors" title="Torna alla lista">
                            <i data-lucide="arrow-left" class="w-5 h-5"></i>
                        </button>
                        <h2 id="form-title" class="text-2xl font-semibold text-amber-800" data-i18n="title_new_record">Compila Nuova Scheda</h2>
                    </div>
                    <div class="flex items-center gap-4">
                        <button type="button" id="btn-cancel-edit" onclick="cancelEdit()" class="hidden text-sm text-stone-500 hover:text-amber-700 underline" data-i18n="btn_cancel_edit">Annulla modifica</button>
                        <button type="submit" form="manoscritto-form" id="btn-submit-form" class="btn btn-primary py-2 px-4 text-sm whitespace-nowrap shadow-sm">
                            <i data-lucide="save" class="w-4 h-4 mr-1 hidden sm:inline-block"></i>
                            <span id="testo-btn-submit" data-i18n="btn_save_record">Salva Scheda</span>
                        </button>
                    </div>
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

                </form>
            </div>
            `;
            mainElement.insertAdjacentHTML('beforeend', html);
        }
    });
})();
