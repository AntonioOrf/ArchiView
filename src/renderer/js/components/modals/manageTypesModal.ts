(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('manage-types-modal')) {
            const html = `
    <div id="manage-types-modal" class="modal-overlay hidden-tab z-modal-nested">
        <div class="modal-window max-w-xl">
            <div class="modal-header">
                <div>
                    <h3 class="modal-title" data-i18n="modal_manage_models">Modelli dell'archivio</h3>
                    <p class="modal-sottotitolo" data-i18n="types_manage_sub">Un modello decide quali campi ha una scheda. I predefiniti non si eliminano.</p>
                </div>
                <button type="button" data-on-click="chiudiManageTypesModal" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body">
                <div id="manage-types-list" class="max-h-80 overflow-y-auto"></div>
                <p class="modello-suggerimento mt-3" data-i18n="types_manage_hint">Un modello in uso si può eliminare solo dopo aver spostato le sue schede su un altro modello.</p>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button type="button" data-on-click="nuovoModelloDaGestione" class="btn btn-secondary" data-i18n="btn_new_model">Nuovo modello</button>
                <span class="flex-1"></span>
                <button type="button" data-on-click="chiudiManageTypesModal" class="btn btn-primary" data-i18n="btn_close">Chiudi</button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
