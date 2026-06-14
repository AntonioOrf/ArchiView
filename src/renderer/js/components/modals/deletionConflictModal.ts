// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('deletion-conflict-modal')) {
            const html = `
    <div id="deletion-conflict-modal" class="modal-overlay hidden-tab z-80 bg-stone-900/80 backdrop-blur-sm flex justify-center items-center">
        <div class="modal-window w-full max-w-4xl p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[85vh] bg-stone-50">
            <div class="modal-header shrink-0 flex justify-between items-center pb-3 border-b border-stone-200">
                <h3 class="modal-title text-stone-800 font-serif flex items-center gap-2">
                    <i data-lucide="trash-2" class="w-5 h-5 text-red-500"></i> File Eliminati sul Server
                </h3>
            </div>
            <div class="flex-1 flex flex-col overflow-hidden py-4">
                <p class="text-sm text-stone-600 mb-4">Le seguenti schede sono state eliminate dal server da un altro utente, ma sono ancora presenti nel tuo archivio locale. Seleziona se vuoi mantenere la tua copia locale o eliminarla anche dal tuo archivio.</p>
                <div class="overflow-y-auto custom-scroll border border-stone-200 rounded bg-white flex-1" id="deletion-list">
                    <!-- Cards will be populated here -->
                </div>
            </div>
            <div class="modal-footer shrink-0 pt-3 border-t border-stone-200 flex justify-between items-center bg-stone-50">
                <span class="text-sm font-medium text-stone-600" id="deletion-counter">File da verificare: 0</span>
                <div class="flex gap-2">
                    <button onclick="window.annullaSincronizzazioneDeletions()" class="btn btn-secondary bg-white text-stone-700 hover:bg-stone-100 border border-stone-300">Annulla Ricezione</button>
                    <button id="btn-resolve-deletions" class="btn btn-primary bg-red-600 hover:bg-red-700 border-red-700" disabled onclick="window.concludiRisoluzioneDeletions()">Conferma Scelte</button>
                </div>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });

    let activeDeletions = [];
    let deletionResolutions = {}; // id -> 'keep' o 'delete'
    let onResolvedDeletionsCallback = null;

    window.apriDeletionConflictModal = function(deletions, onResolved) {
        activeDeletions = deletions;
        deletionResolutions = {};
        onResolvedDeletionsCallback = onResolved;

        document.getElementById('deletion-conflict-modal').classList.remove('hidden-tab');
        renderDeletionList();
        aggiornaStatoFooterDeletions();
    };

    window.annullaSincronizzazioneDeletions = function() {
        document.getElementById('deletion-conflict-modal').classList.add('hidden-tab');
        mostraMessaggio(window.t("msg_sincronizzazione_annullat", "Sincronizzazione annullata."), "warning");
        if (onResolvedDeletionsCallback) onResolvedDeletionsCallback(null);
    };

    function renderDeletionList() {
        const container = document.getElementById('deletion-list');
        container.innerHTML = window.sanitizeHTML('');

        activeDeletions.forEach(card => {
            const isResolved = deletionResolutions[card.id] !== undefined;
            const chosenAction = deletionResolutions[card.id];

            const div = document.createElement('div');
            div.className = `p-4 border-b border-stone-100 flex items-center justify-between transition-colors ${
                isResolved 
                    ? (chosenAction === 'keep' ? 'bg-amber-50/50' : 'bg-red-50/50')
                    : 'bg-white hover:bg-stone-50'
            }`;

            let badgeHtml = '';
            if (isResolved) {
                if (chosenAction === 'keep') {
                    badgeHtml = '<span class="text-xs font-bold text-amber-700 flex items-center gap-1"><i data-lucide="save" class="w-4 h-4"></i> Mantenuto</span>';
                } else {
                    badgeHtml = '<span class="text-xs font-bold text-red-700 flex items-center gap-1"><i data-lucide="trash" class="w-4 h-4"></i> Da eliminare</span>';
                }
            }

            div.innerHTML = window.sanitizeHTML(`
                <div class="flex-1">
                    <div class="font-bold text-stone-800 text-sm truncate" title="${escapeHTML(card.segnatura)}">${escapeHTML(card.segnatura)}</div>
                    <div class="text-xs text-stone-500 mt-0.5">ID: ${card.id.substring(0, 8)}...</div>
                </div>
                <div class="flex items-center gap-4 shrink-0">
                    <div class="w-28 text-right">${badgeHtml}</div>
                    <div class="flex gap-2">
                        <button onclick="window.risolviDeletion('${card.id}', 'keep')" class="btn btn-secondary py-1 px-3 text-xs ${chosenAction === 'keep' ? 'bg-amber-500 text-white border-transparent hover:bg-amber-600' : 'bg-white'}">Mantieni</button>
                        <button onclick="window.risolviDeletion('${card.id}', 'delete')" class="btn btn-secondary py-1 px-3 text-xs ${chosenAction === 'delete' ? 'bg-red-600 text-white border-transparent hover:bg-red-700' : 'bg-white'}">Elimina</button>
                    </div>
                </div>
            `);
            container.appendChild(div);
        });

        if (window.lucide) lucide.createIcons({ nodes: [container] });
    }

    window.risolviDeletion = function(id, action) {
        deletionResolutions[id] = action;
        renderDeletionList();
        aggiornaStatoFooterDeletions();
    };

    function aggiornaStatoFooterDeletions() {
        const total = activeDeletions.length;
        const resolved = Object.keys(deletionResolutions).length;
        const pending = total - resolved;

        document.getElementById('deletion-counter').innerHTML = pending === 0 
            ? '<span class="text-green-600 font-bold flex items-center gap-1"><i data-lucide="check-circle-2" class="w-4 h-4"></i> Tutte le schede verificate!</span>' 
            : `File da verificare: <b class="text-red-500">${pending}</b>`;

        const btnApply = document.getElementById('btn-resolve-deletions');
        btnApply.disabled = pending > 0;

        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('deletion-counter')] });
    }

    window.concludiRisoluzioneDeletions = function() {
        document.getElementById('deletion-conflict-modal').classList.add('hidden-tab');
        
        if (onResolvedDeletionsCallback) {
            onResolvedDeletionsCallback(deletionResolutions);
        }
    };
})();
