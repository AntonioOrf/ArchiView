(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('update-banner')) {
            const html = `
    <div id="update-banner" class="hidden-tab banner-info w-full px-4 py-3 flex items-center justify-between z-sticky shrink-0">
        <div class="flex items-center gap-2 text-sm font-medium">
            <i data-lucide="download" class="w-5 h-5"></i>
            <span id="update-banner-text" data-i18n="update_available">È disponibile una nuova versione.</span>
        </div>
        <div class="flex gap-2 shrink-0 items-center">
            <button id="btn-note-rilascio" data-on-click="mostraNoteRilascio" class="hidden-tab banner-info-link underline text-xs font-medium px-1" data-i18n="btn_release_notes">Novità di questa versione</button>
            <button id="btn-scarica-aggiornamento" class="banner-info-azione px-3 py-1.5 text-xs font-semibold transition-colors" data-i18n="btn_download_github">Scarica da GitHub</button>
            <button data-on-click="nascondiBannerAggiornamento" class="banner-info-link px-2 py-1.5 transition-colors" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
    </div>

    <div id="tutorial-banner" class="hidden-tab w-full px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 mt-4" style="background-color: var(--color-primary-light); border: 1px solid var(--color-primary-border); color: var(--color-primary-hover);">
        <div class="flex items-center gap-2 text-sm font-medium min-w-0">
            <i data-lucide="help-circle" class="w-5 h-5 shrink-0"></i>
            <span data-i18n="tutorial_invite_text">Vuoi una breve visita guidata alle funzioni principali?</span>
        </div>
        <div class="flex gap-2 shrink-0 items-center">
            <button data-on-click="avviaTutorialDaInvito" class="btn btn-primary text-xs py-1.5 px-3" data-i18n="btn_tutorial_start">Sì, avvia</button>
            <button data-on-click="rifiutaInvitoTutorial" class="btn btn-ghost text-xs py-1.5 px-3" data-i18n="btn_tutorial_dismiss">No, grazie</button>
        </div>
    </div>

    <div id="release-notes-modal" class="modal-overlay hidden-tab z-modal-nested">
        <div class="modal-window max-w-lg max-h-[80vh]">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="modal_release_notes_title">Note di rilascio</h3>
                <button type="button" data-on-click="chiudiNoteRilascio" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div id="release-notes-body" class="modal-body changelog-corpo"></div>
        </div>
    </div>

    <div id="bottom-confirm-banner" class="modal-overlay conferma-basso hidden-tab z-modal-alert">
        <div class="modal-window conferma-barra" role="alertdialog" aria-labelledby="bottom-confirm-text">
            <p id="bottom-confirm-text" class="conferma-testo" data-i18n="confirm_prompt_default">Sei sicuro?</p>
            <label id="bottom-confirm-checkbox-container" class="conferma-salta hidden-tab">
                <input type="checkbox" id="bottom-confirm-skip">
                <span data-i18n="dont_ask_again">Non chiedere più</span>
            </label>
            <button data-on-click="chiudiBottomConfirm" class="btn btn-ghost" data-i18n="btn_cancel">Annulla</button>
            <button id="btn-bottom-confirm-yes" class="btn btn-danger" data-i18n="btn_yes_proceed">Sì, procedi</button>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    });
})();
