// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('update-banner')) {
            const html = `
    <div id="update-banner" class="hidden-tab w-full bg-sky-600 text-white px-4 py-3 flex items-center justify-between shadow-md z-sticky shrink-0 mb-6 rounded-sm border border-sky-700">
        <div class="flex items-center gap-2 text-sm font-medium">
            <i data-lucide="download" class="w-5 h-5"></i>
            <span id="update-banner-text" data-i18n="update_available">È disponibile un nuovo aggiornamento!</span>
        </div>
        <div class="flex gap-2 shrink-0 items-center">
            <button id="btn-note-rilascio" onclick="mostraNoteRilascio()" class="hidden-tab text-sky-100 hover:text-white underline text-xs font-medium px-1" data-i18n="btn_release_notes">Novità di questa versione</button>
            <button id="btn-scarica-aggiornamento" class="bg-white text-sky-700 hover:bg-sky-50 px-3 py-1.5 rounded-sm text-xs font-bold transition-colors shadow-sm" data-i18n="btn_download_github">Scarica da GitHub</button>
            <button onclick="nascondiBannerAggiornamento()" class="text-sky-100 hover:text-white px-2 py-1.5 transition-colors rounded-sm hover:bg-sky-700"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
    </div>

    <!-- Invito al tutorial: NON modale. Prima era un modal-overlay a tutto schermo
         aperto 1500ms dopo l'avvio, che intercettava ogni click sull'app. -->
    <div id="tutorial-banner" class="hidden-tab w-full px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0 mt-4 rounded-sm" style="background-color: var(--color-primary-light); border: 1px solid var(--color-primary-border); color: var(--color-primary-hover);">
        <div class="flex items-center gap-2 text-sm font-medium min-w-0">
            <i data-lucide="help-circle" class="w-5 h-5 shrink-0"></i>
            <span data-i18n="tutorial_invite_text">Vuoi seguire una brevissima guida per scoprire le funzionalità principali dell'app?</span>
        </div>
        <div class="flex gap-2 shrink-0 items-center">
            <button onclick="avviaTutorialDaInvito()" class="btn btn-primary text-xs py-1.5 px-3" data-i18n="btn_tutorial_start">Sì, avvia</button>
            <button onclick="rifiutaInvitoTutorial()" class="btn btn-ghost text-xs py-1.5 px-3" data-i18n="btn_tutorial_dismiss">No, grazie</button>
        </div>
    </div>

    <!-- Modal Note di Rilascio -->
    <div id="release-notes-modal" class="modal-overlay hidden-tab z-modal-nested">
        <div class="modal-window max-w-lg bg-white dark:bg-stone-900 overflow-hidden flex flex-col max-h-[80vh]">
            <div class="modal-header shrink-0 border-b border-stone-200 dark:border-stone-800">
                <h3 class="modal-title">
                    <i data-lucide="sparkles" class="w-5 h-5 text-amber-500"></i>
                    <span data-i18n="modal_release_notes_title">Note di rilascio</span>
                </h3>
                <button type="button" onclick="chiudiNoteRilascio()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div id="release-notes-body" class="modal-body overflow-y-auto p-6 text-sm text-stone-800 dark:text-stone-300"></div>
        </div>
    </div>

    <div id="info-confirm-banner" class="modal-overlay hidden-tab z-modal-alert">
        <div class="modal-window max-w-sm">
            <div class="modal-header" style="background-color: var(--color-primary-light); border-color: var(--color-primary-border);">
                <i data-lucide="info" class="w-6 h-6" style="color: var(--color-primary);"></i>
                <h3 id="info-confirm-title" class="modal-title" style="color: var(--color-primary-hover); width: 100%;">Informazione</h3>
            </div>
            <div class="modal-body">
                <p id="info-confirm-text" class="font-medium mb-4 text-center">Testo</p>
                <div class="modal-footer justify-center mt-2">
                    <button id="btn-info-confirm-no" class="btn btn-ghost text-sm">No, grazie</button>
                    <button id="btn-info-confirm-yes" class="btn btn-primary text-sm shadow-md">Sì</button>
                </div>
            </div>
        </div>
    </div>

    <div id="bottom-confirm-banner" class="modal-overlay hidden-tab z-modal-alert">
        <div class="modal-window max-w-sm">
            <div class="modal-header" style="background-color: var(--color-danger-light); border-color: #fca5a5;">
                <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600"></i>
                <h3 class="modal-title" style="color: var(--color-danger-hover); width: 100%;" data-i18n="modal_confirm_action">Conferma Azione</h3>
            </div>
            <div class="modal-body">
                <p id="bottom-confirm-text" class="font-medium mb-4 text-center" data-i18n="confirm_prompt_default">Sei sicuro?</p>
                <div id="bottom-confirm-checkbox-container" class="mb-4 flex items-center justify-center gap-2 hidden-tab">
                    <input type="checkbox" id="bottom-confirm-skip" class="w-4 h-4 text-amber-600 border-stone-300 rounded focus:ring-amber-500">
                    <label for="bottom-confirm-skip" class="text-sm text-stone-600 cursor-pointer select-none" data-i18n="dont_ask_again">Non chiederlo più</label>
                </div>
                <div class="modal-footer justify-center mt-2">
                    <button onclick="window.chiudiBottomConfirm()" class="btn btn-ghost text-sm" data-i18n="btn_cancel">Annulla</button>
                    <button id="btn-bottom-confirm-yes" class="btn btn-danger text-sm shadow-md" data-i18n="btn_yes_proceed">Sì, procedi</button>
                </div>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    });
})();
