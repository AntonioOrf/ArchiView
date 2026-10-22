(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('docs-modal')) {
            const html = `
    <div id="docs-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-4xl max-h-[90vh]">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 class="modal-title" data-i18n="docs_modal_title">Allegati</h3>
                    <p id="docs-modal-title" class="modal-sottotitolo font-mono"></p>
                </div>
                <button type="button" data-on-click="chiudiModalDocumenti" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div id="docs-modal-content" class="modal-body flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
