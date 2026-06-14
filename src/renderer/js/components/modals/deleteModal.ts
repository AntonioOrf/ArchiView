// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('delete-modal')) {
            const html = `
    <div id="delete-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header" style="background-color: var(--color-danger-light); border-color: #fca5a5;">
                <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600"></i>
                <h3 class="modal-title" style="color: var(--color-danger-hover); width: 100%;" data-i18n="modal_confirm_delete"><span data-i18n="modal_delete_title">Conferma Eliminazione</span></h3>
            </div>
            <div class="modal-body">
                <p class="font-medium mb-2" data-i18n="delete_item_prompt"><span data-i18n="modal_delete_desc">Sei sicuro di voler eliminare</span> questa scheda?</p>
                <p class="text-sm text-stone-500 mb-4" data-i18n="delete_item_hint">L'eventuale allegato (immagine o PDF) non verrà rimosso dall'archivio.</p>
                <input type="hidden" id="delete-item-id">
                <div class="modal-footer">
                    <button onclick="chiudiDeleteModal()" class="btn btn-ghost"><span data-i18n="btn_cancel">Annulla</span></button>
                    <button onclick="confermaEliminazione()" class="btn btn-danger"><i data-lucide="trash-2" class="w-4 h-4"></i> <span data-i18n="btn_delete"><span data-i18n="btn_delete">Elimina</span></span></button>
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
