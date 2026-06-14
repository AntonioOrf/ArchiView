// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('unsaved-modal')) {
            const html = `
    <div id="unsaved-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header" style="background-color: var(--color-danger-light); border-color: #fca5a5;">
                <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600"></i>
                <h3 class="modal-title" style="color: var(--color-danger-hover); width: 100%;" data-i18n="modal_unsaved_changes"><span data-i18n="modal_unsaved_title">Modifiche non salvate</span></h3>
            </div>
            <div class="modal-body">
                <p class="font-medium mb-2" data-i18n="unsaved_prompt">Ci sono modifiche non salvate in questa trascrizione.</p>
                <p class="text-sm text-stone-500 mb-4" data-i18n="unsaved_hint">Sei sicuro di voler uscire e perdere le modifiche?</p>
                <div class="modal-footer">
                    <button onclick="chiudiUnsavedModal()" class="btn btn-primary" data-i18n="btn_continue_writing">Continua a scrivere</button>
                    <button onclick="confermaUscitaTrascrizione()" class="btn btn-ghost text-red-600 hover:bg-red-50" data-i18n="btn_exit_without_saving"><span data-i18n="btn_exit_nosave">Esci senza salvare</span></button>
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
