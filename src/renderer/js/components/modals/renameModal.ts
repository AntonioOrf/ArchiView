(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('rename-modal')) {
            const html = `
    <div id="rename-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-sm">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="modal_rename">Rinomina Allegato</h3>
            </div>
            <div class="modal-body">
                <label class="form-label" data-i18n="label_new_filename">Nuovo nome del file</label>
                <input type="text" id="rename-input" class="form-input" data-on-keydown="suInvio" data-args-keydown="[&quot;confermaRinomina&quot;,true]">
                <div class="modal-footer">
                    <button data-on-click="chiudiRenameModal" class="btn btn-ghost"><span data-i18n="btn_cancel">Annulla</span></button>
                    <button data-on-click="confermaRinomina" class="btn btn-primary" data-i18n="btn_save"><span data-i18n="btn_save">Salva</span></button>
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
