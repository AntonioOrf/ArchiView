// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('update-banner')) {
            const html = `
    <div id="update-banner" class="hidden-tab w-full bg-sky-600 text-white px-4 py-3 flex items-center justify-between shadow-md z-50 shrink-0 mb-6 rounded-sm border border-sky-700">
        <div class="flex items-center gap-2 text-sm font-medium">
            <i data-lucide="download-cloud" class="w-5 h-5"></i>
            <span id="update-banner-text" data-i18n="update_available">È disponibile un nuovo aggiornamento!</span>
        </div>
        <div class="flex gap-2 shrink-0">
            <button id="btn-scarica-aggiornamento" class="bg-white text-sky-700 hover:bg-sky-50 px-3 py-1.5 rounded-sm text-xs font-bold transition-colors shadow-sm" data-i18n="btn_download_github">Scarica da GitHub</button>
            <button onclick="nascondiBannerAggiornamento()" class="text-sky-100 hover:text-white px-2 py-1.5 transition-colors rounded-sm hover:bg-sky-700"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
    </div>

    <div id="info-confirm-banner" class="modal-overlay hidden-tab z-110">
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

    <div id="bottom-confirm-banner" class="modal-overlay hidden-tab z-110">
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
