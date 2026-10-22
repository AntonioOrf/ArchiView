(function() {
    const dati = (window as any).changelogData || { versione: '', titolo: '', html: '', disponibile: false };

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('changelog-modal')) {
            const html = `
                <div id="changelog-modal" class="modal-overlay hidden-tab z-modal-nested">
                    <div class="modal-window max-w-2xl h-[80vh]" role="dialog" aria-modal="true" aria-labelledby="changelog-titolo">
                        <div class="modal-header">
                            <h3 class="modal-title changelog-testata" id="changelog-titolo">
                                <span class="changelog-versione"><span data-i18n="changelog_title">Novità della versione</span> <span translate="no">${window.escapeHTML(dati.versione || '')}</span></span>
                                ${dati.titolo ? `<span class="changelog-nome">${window.escapeHTML(dati.titolo)}</span>` : ''}
                            </h3>
                            <button type="button" data-on-click="chiudiChangelogModal" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <div id="changelog-content" class="modal-body changelog-corpo flex-1"></div>
                        <div class="modal-footer modal-footer-bar">
                            <button type="button" data-on-click="chiudiChangelogModal" class="btn btn-primary" data-i18n="btn_continue">Continua</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            const contenuto = document.getElementById('changelog-content');
            if (contenuto) contenuto.innerHTML = window.sanitizeHTML(dati.html || '');
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });

    window.apriChangelogModal = function() {
        if (!dati.disponibile) return;
        const modal = document.getElementById('changelog-modal');
        if (modal) {
            modal.classList.remove('hidden-tab');
            if (window.lucide) {
                lucide.createIcons({ nodes: [modal] });
            }
        }
    };

    window.chiudiChangelogModal = function() {
        const modal = document.getElementById('changelog-modal');
        if (modal) {
            modal.classList.add('hidden-tab');
        }
    };
})();
