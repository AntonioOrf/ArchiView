(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('image-modal')) {
            const html = `
    <div id="image-modal" class="modal-overlay visore-overlay z-modal-nested hidden-tab" role="dialog" aria-modal="true" data-i18n-aria-label="attachment_image" aria-label="Immagine">
        <button data-on-click="chiudiModal" class="iv-btn visore-chiudi" data-i18n-aria-label="btn_close" aria-label="Chiudi">
            <i data-lucide="x"></i>
        </button>
        <div id="modal-img-viewport" class="iv-viewport hidden-tab w-full h-[90vh] max-w-6xl" tabindex="0">
            <img id="modal-img" alt="" class="max-w-full max-h-full object-contain">
        </div>
        <iframe id="modal-pdf" class="w-full h-[90vh] max-w-6xl bg-white hidden" src=""></iframe>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
