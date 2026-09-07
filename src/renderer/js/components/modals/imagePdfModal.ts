// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('image-modal')) {
            const html = `
    <div id="image-modal" class="modal-overlay z-modal-nested hidden-tab" style="background-color: rgba(0,0,0,0.9);">
        <button onclick="chiudiModal()" class="btn btn-ghost btn-icon absolute top-6 right-6 z-10" data-i18n-aria-label="btn_close" aria-label="Chiudi" style="background-color: rgba(0,0,0,0.5); color: #ccc;">
            <i data-lucide="x" class="w-8 h-8"></i>
        </button>
        <!-- Fase 1.2 — l'immagine vive dentro un viewport (zoom/pan/rotazione/filtri),
             non più nuda nell'overlay. La visibilità del viewport si commuta con
             hidden-tab e non con la utility hidden: .iv-viewport imposta display:flex ed è
             definita in style.css, caricato DOPO tailwind.css, quindi vincerebbe. -->
        <div id="modal-img-viewport" class="iv-viewport hidden-tab w-full h-[90vh] max-w-6xl" tabindex="0">
            <img id="modal-img" alt="" class="max-w-full max-h-full rounded-sm object-contain" style="border: 1px solid #444;">
        </div>
        <iframe id="modal-pdf" class="w-full h-[90vh] max-w-6xl bg-white rounded-sm shadow-xl hidden" src=""></iframe>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
