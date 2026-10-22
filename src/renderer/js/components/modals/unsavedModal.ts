(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('unsaved-modal')) {
            const html = `
    <div id="unsaved-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md" role="alertdialog" aria-labelledby="unsaved-modal-titolo" aria-describedby="unsaved-modal-nota">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 id="unsaved-modal-titolo" class="modal-title" data-i18n="unsaved_trasc_title">La trascrizione ha modifiche non salvate</h3>
                    <p id="unsaved-modal-nota" class="modal-sottotitolo" data-i18n="unsaved_trasc_hint">Se esci adesso le modifiche vanno perse.</p>
                </div>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button data-on-click="confermaUscitaTrascrizione" class="btn btn-danger-ghost mr-auto"><span data-i18n="btn_exit_nosave">Esci senza salvare</span></button>
                <button data-on-click="chiudiUnsavedModal" class="btn btn-primary"><span data-i18n="btn_continue_writing">Continua a scrivere</span></button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
