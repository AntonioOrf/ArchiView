(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('deletion-conflict-modal')) {
            const html = `
    <div id="deletion-conflict-modal" class="modal-overlay hidden-tab z-modal-critical bg-stone-900/80 backdrop-blur-sm flex justify-center items-center">
        <div class="modal-window w-full max-w-4xl p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[85vh] bg-stone-50">
            <div class="modal-header shrink-0 flex justify-between items-center pb-3 border-b border-stone-200">
                <h3 class="modal-title text-stone-800 font-serif flex items-center gap-2">
                    <i data-lucide="trash-2" class="w-5 h-5 text-red-500"></i> <span data-i18n="deletion_modal_title">Schede eliminate sul server</span>
                </h3>
            </div>
            <div class="flex-1 flex flex-col overflow-hidden py-4">
                <p class="text-sm text-stone-600 mb-4" data-i18n="deletion_modal_desc">Un altro utente ha eliminato queste schede dal server, ma sono ancora nel tuo archivio locale. Scegli se mantenere la tua copia locale o eliminarla anche dal tuo archivio.</p>
                <div class="overflow-y-auto custom-scroll border border-stone-200 bg-white flex-1" id="deletion-list">
                    <!-- Cards will be populated here -->
                </div>
            </div>
            <div class="modal-footer shrink-0 pt-3 border-t border-stone-200 flex justify-between items-center bg-stone-50">
                <span class="text-sm font-medium text-stone-600" id="deletion-counter"></span>
                <div class="flex gap-2">
                    <button data-on-click="annullaSincronizzazioneDeletions" class="btn btn-secondary"><span data-i18n="btn_cancel_receive">Annulla ricezione</span></button>
                    <button id="btn-resolve-deletions" class="btn btn-primary" disabled data-on-click="concludiRisoluzioneDeletions"><span data-i18n="btn_confirm_choices">Conferma scelte</span></button>
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
            const chosenAction = deletionResolutions[card.id];
            const stato = chosenAction === 'keep' ? ' is-mantenuta' : chosenAction === 'delete' ? ' is-eliminata' : '';

            const div = document.createElement('div');
            div.className = `eliminazione-riga p-4 flex items-center justify-between transition-colors${stato}`;

            let badgeHtml = '';
            if (chosenAction === 'keep') {
                badgeHtml = `<span class="text-xs font-bold testo-accento flex items-center justify-end gap-1"><i data-lucide="save" class="w-4 h-4"></i> ${escapeHTML(window.t('deletion_kept', 'Mantenuta'))}</span>`;
            } else if (chosenAction === 'delete') {
                badgeHtml = `<span class="text-xs font-bold testo-pericolo flex items-center justify-end gap-1"><i data-lucide="trash" class="w-4 h-4"></i> ${escapeHTML(window.t('deletion_to_delete', 'Da eliminare'))}</span>`;
            }

            // La scelta fatta si legge da aria-pressed (e dal badge), non solo dal colore (1.4.1).
            const scelta = (azione: string, testo: string) =>
                `<button type="button" data-deletion-id="${escapeHTML(card.id)}" data-deletion-action="${azione}" aria-pressed="${chosenAction === azione ? 'true' : 'false'}" class="eliminazione-scelta btn btn-secondary py-1 px-3 text-xs">${escapeHTML(testo)}</button>`;

            div.innerHTML = window.sanitizeHTML(`
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-stone-800 text-sm truncate" translate="no" title="${escapeHTML(card.segnatura)}">${escapeHTML(card.segnatura)}</div>
                    <div class="text-xs text-stone-500 mt-0.5">ID: ${escapeHTML(String(card.id).substring(0, 8))}…</div>
                </div>
                <div class="flex items-center gap-4 shrink-0">
                    <div class="w-28 text-right">${badgeHtml}</div>
                    <div class="flex gap-2">
                        ${scelta('keep', window.t('btn_keep', 'Mantieni'))}
                        ${scelta('delete', window.t('btn_delete', 'Elimina'))}
                    </div>
                </div>
            `);

            // I listener vengono aggiunti via addEventListener dopo sanitizeHTML per evitare la rimozione da parte di DOMPurify
            div.querySelectorAll('button[data-deletion-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-deletion-id');
                    const action = btn.getAttribute('data-deletion-action');
                    window.risolviDeletion(id, action);
                });
            });

            container.appendChild(div);
        });

        if (window.lucide) lucide.createIcons({ nodes: [container] });
    }

    window.risolviDeletion = function(id, action) {
        deletionResolutions[id] = action;
        renderDeletionList();
        aggiornaStatoFooterDeletions();
        // Il re-render sostituisce i pulsanti: senza, il fuoco da tastiera cadeva sul body.
        const btn = document.querySelector(`#deletion-list button[data-deletion-id="${CSS.escape(String(id))}"][data-deletion-action="${CSS.escape(String(action))}"]`) as HTMLElement;
        if (btn) btn.focus();
    };

    function aggiornaStatoFooterDeletions() {
        const total = activeDeletions.length;
        const resolved = Object.keys(deletionResolutions).length;
        const pending = total - resolved;

        document.getElementById('deletion-counter').innerHTML = window.sanitizeHTML(pending === 0
            ? `<span class="testo-successo font-bold flex items-center gap-1"><i data-lucide="check-circle-2" class="w-4 h-4"></i> ${escapeHTML(window.t('deletion_all_checked', 'Tutte le schede verificate!'))}</span>`
            : `${escapeHTML(window.t('deletion_to_check', 'Schede da verificare:'))} <b class="testo-pericolo">${pending}</b>`);

        const btnApply = document.getElementById('btn-resolve-deletions') as HTMLButtonElement;
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
