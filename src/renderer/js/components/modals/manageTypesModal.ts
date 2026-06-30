// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('manage-types-modal')) {
            const html = `
    <div id="manage-types-modal" class="modal-overlay hidden-tab z-60">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="modal_manage_models">Gestisci Modelli</h3>
                <button type="button" onclick="chiudiManageTypesModal()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body">
                <div id="manage-types-list" class="space-y-2 max-h-64 overflow-y-auto">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" onclick="chiudiManageTypesModal()" class="btn btn-primary" data-i18n="btn_close">Chiudi</button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
