(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('folder-modal')) {
            const html = `
    <div id="folder-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="modal_new_folder">Nuova cartella</h3>
                <button type="button" data-on-click="chiudiFolderModal" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="modal-body">
                <label class="form-label" for="folder-name-input" data-i18n="label_folder_name">Nome della cartella o percorso</label>
                <input type="text" id="folder-name-input" data-i18n-placeholder="label_folder_name" class="form-input w-full" aria-describedby="folder-name-nota">
                <p id="folder-name-nota" class="modello-suggerimento mt-1.5" data-i18n="hint_folder_name">Con la barra / crei anche le sottocartelle.</p>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button data-on-click="chiudiFolderModal" class="btn btn-secondary"><span data-i18n="btn_cancel">Annulla</span></button>
                <button data-on-click="confermaAggiungiCartella" class="btn btn-primary"><span data-i18n="btn_create">Crea</span></button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
