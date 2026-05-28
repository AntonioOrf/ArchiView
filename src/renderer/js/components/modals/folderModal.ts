// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('folder-modal')) {
            const html = `
    <div id="folder-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header shrink-0 flex justify-between items-center">
                <h3 class="modal-title text-stone-800 flex items-center gap-2">
                    <i data-lucide="folder-plus" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="modal_new_folder">Nuova Cartella</span>
                </h3>
                <button type="button" onclick="chiudiFolderModal()" class="btn btn-ghost btn-icon hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="modal-body">
                <label class="form-label font-medium mb-1 block" data-i18n="label_folder_name">Nome della cartella o percorso</label>
                <input type="text" id="folder-name-input" data-i18n-placeholder="label_folder_name" class="form-input w-full focus:ring-2 focus:ring-amber-500/20 transition-all">
                <p class="text-xs text-stone-500 mt-2 flex items-center gap-1" data-i18n="hint_folder_name">
                    <i data-lucide="info" class="w-3 h-3"></i> Consiglio: usa la barra ( / ) per creare automaticamente sottocartelle.
                </p>
                <div class="modal-footer mt-6 pt-4 border-t border-stone-100 flex justify-end gap-2">
                    <button onclick="chiudiFolderModal()" class="btn btn-ghost" data-i18n="btn_cancel">Annulla</button>
                    <button onclick="confermaAggiungiCartella()" class="btn btn-primary shadow-sm" data-i18n="btn_create_folder">Crea Cartella</button>
                </div>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    });
})();
