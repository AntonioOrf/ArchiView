(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('delete-modal')) {
            const html = `
    <div id="delete-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md" role="alertdialog" aria-labelledby="delete-modal-titolo" aria-describedby="delete-modal-nota">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 id="delete-modal-titolo" class="modal-title"></h3>
                    <p id="delete-modal-nota" class="modal-sottotitolo" data-i18n="delete_item_hint">Va nel cestino. Gli allegati restano nell'archivio.</p>
                </div>
            </div>
            <input type="hidden" id="delete-item-id">
            <div class="modal-footer modal-footer-bar">
                <button data-on-click="chiudiDeleteModal" class="btn btn-secondary"><span data-i18n="btn_cancel">Annulla</span></button>
                <button data-on-click="confermaEliminazione" class="btn btn-danger"><span data-i18n="btn_delete">Elimina</span></button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
