// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('image-modal')) {
            const html = `
    <div id="image-modal" class="modal-overlay z-60 hidden-tab" style="background-color: rgba(0,0,0,0.9);">
        <button onclick="chiudiModal()" class="btn btn-ghost btn-icon absolute top-6 right-6 z-10" style="background-color: rgba(0,0,0,0.5); color: #ccc;">
            <i data-lucide="x" class="w-8 h-8"></i>
        </button>
        <img id="modal-img" class="max-w-full max-h-[90vh] rounded-sm object-contain hidden" style="border: 1px solid #444;">
        <iframe id="modal-pdf" class="w-full h-[90vh] max-w-6xl bg-white rounded-sm shadow-xl hidden" src=""></iframe>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
