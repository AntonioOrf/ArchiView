// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('docs-modal')) {
            const html = `
    <div id="docs-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-4xl max-h-[90vh]">
            <div class="modal-header shrink-0">
                <h3 class="modal-title">
                    <i data-lucide="layers" class="w-5 h-5 text-amber-700"></i> Documenti: <span id="docs-modal-title"></span>
                </h3>
                <button type="button" onclick="chiudiModalDocumenti()" class="btn btn-ghost btn-icon"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div id="docs-modal-content" class="modal-body flex-1 bg-stone-50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
