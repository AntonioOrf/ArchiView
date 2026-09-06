// @ts-nocheck

(function() {
    // Il contenuto NON è più scritto a mano qui: arriva da window.changelogData, generato
    // in build da RELEASE_NOTES.md (scripts/build-changelog.js). Il modal scritto a mano
    // era rimasto fermo alla 2.4.3 su un'app 2.4.5, cioè mostrava novità sbagliate.
    const dati = (window as any).changelogData || { versione: '', titolo: '', html: '', disponibile: false };

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('changelog-modal')) {
            const titolo = dati.versione
                ? `Novità della Versione ${dati.versione}`
                : 'Novità';
            const html = `
                <div id="changelog-modal" class="modal-overlay hidden-tab z-modal-nested">
                    <div class="modal-window max-w-2xl bg-white dark:bg-stone-900 overflow-hidden flex flex-col h-[80vh]">
                        <div class="modal-header shrink-0 border-b border-stone-200 dark:border-stone-800">
                            <h3 class="modal-title">
                                <i data-lucide="sparkles" class="w-5 h-5 text-amber-500"></i>
                                <span>${window.escapeHTML(titolo)}</span>
                            </h3>
                            <button type="button" onclick="chiudiChangelogModal()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <div class="modal-body overflow-y-auto p-6 space-y-6 text-stone-800 dark:text-stone-300">

                            ${dati.titolo ? `
                            <div class="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                <i data-lucide="sparkles" class="w-10 h-10 text-blue-600 dark:text-blue-500 shrink-0"></i>
                                <div>
                                    <h4 class="font-bold text-lg text-blue-900 dark:text-blue-400">${window.escapeHTML(dati.titolo)}</h4>
                                </div>
                            </div>` : ''}

                            <div id="changelog-content" class="space-y-6"></div>

                        </div>
                        <div class="modal-footer border-t border-stone-200 dark:border-stone-800 p-4 flex justify-end shrink-0">
                            <button type="button" onclick="chiudiChangelogModal()" class="btn btn-primary px-6">Continua</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            // Il corpo passa da sanitizeHTML: è generato da un file di progetto, non da
            // input utente, ma resta la regola della casa per ogni innerHTML dinamico.
            const contenuto = document.getElementById('changelog-content');
            if (contenuto) contenuto.innerHTML = window.sanitizeHTML(dati.html || '');
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });

    window.apriChangelogModal = function() {
        // Nessuna nota per questa versione (RELEASE_NOTES.md non aggiornato): meglio non
        // aprire nulla che presentare un riquadro "Novità" vuoto.
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
