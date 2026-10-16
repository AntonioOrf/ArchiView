(function() {
    const dati = (window as any).changelogData || { versione: '', titolo: '', html: '', disponibile: false };

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('changelog-modal')) {
            const html = `
                <div id="changelog-modal" class="modal-overlay hidden-tab z-modal-nested">
                    <div class="modal-window max-w-2xl overflow-hidden flex flex-col h-[80vh]">
                        <div class="modal-header shrink-0 border-b border-stone-200">
                            <h3 class="modal-title">
                                <i data-lucide="sparkles" class="w-5 h-5 text-amber-800"></i>
                                <span data-i18n="changelog_title">Novità della versione</span>
                                <span translate="no">${window.escapeHTML(dati.versione || '')}</span>
                            </h3>
                            <button type="button" data-on-click="chiudiChangelogModal" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <div class="modal-body overflow-y-auto p-6 space-y-6 text-stone-800">

                            ${dati.titolo ? `
                            <div class="changelog-titolo flex items-center gap-4 p-4">
                                <i data-lucide="sparkles" class="w-10 h-10 shrink-0"></i>
                                <h4 class="font-bold text-lg">${window.escapeHTML(dati.titolo)}</h4>
                            </div>` : ''}

                            <div id="changelog-content" class="space-y-6"></div>

                        </div>
                        <div class="modal-footer border-t border-stone-200 p-4 flex justify-end shrink-0">
                            <button type="button" data-on-click="chiudiChangelogModal" class="btn btn-primary px-6" data-i18n="btn_continue">Continua</button>
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
