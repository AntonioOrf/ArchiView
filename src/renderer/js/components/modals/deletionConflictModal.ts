(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('deletion-conflict-modal')) {
            const html = `
    <div id="deletion-conflict-modal" class="modal-overlay hidden-tab z-modal-critical">
        <div class="modal-window max-w-3xl max-h-[85vh]">
            <div class="modal-header">
                <div>
                    <h3 class="modal-title" data-i18n="deletion_modal_title">Schede eliminate sul server</h3>
                    <p class="modal-sottotitolo" data-i18n="deletion_modal_desc">Sul server non ci sono più, sul tuo computer sì. Decidi per ciascuna se tenerla o eliminarla anche qui.</p>
                </div>
            </div>
            <div class="modal-body flex-1" id="deletion-list"></div>
            <div class="modal-footer modal-footer-bar items-center">
                <span class="conflitto-contatore" id="deletion-counter"></span>
                <span class="flex-1"></span>
                <button type="button" data-on-click="annullaSincronizzazioneDeletions" class="btn btn-secondary"><span data-i18n="btn_cancel_receive">Annulla la ricezione</span></button>
                <button type="button" id="btn-resolve-deletions" class="btn btn-primary" disabled data-on-click="concludiRisoluzioneDeletions"><span data-i18n="btn_confirm_choices">Conferma</span></button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });

    let activeDeletions = [];
    let deletionResolutions = {};
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

            const div = document.createElement('div');
            div.className = 'eliminazione-riga';

            const scelta = (azione: string, testo: string) =>
                `<button type="button" data-deletion-id="${escapeHTML(card.id)}" data-deletion-action="${azione}" aria-pressed="${chosenAction === azione ? 'true' : 'false'}" class="eliminazione-scelta">${escapeHTML(testo)}</button>`;

            const descrizione = [card.titolo, card.oggetto].find(v => typeof v === 'string' && v.trim());
            div.innerHTML = window.sanitizeHTML(`
                <div class="flex-1 min-w-0">
                    <div class="eliminazione-segnatura" translate="no" title="${escapeHTML(card.segnatura)}">${escapeHTML(card.segnatura)}</div>
                    <div class="modello-suggerimento truncate">${descrizione ? escapeHTML(descrizione) : `ID ${escapeHTML(String(card.id).substring(0, 8))}…`}</div>
                </div>
                <div class="eliminazione-scelte" role="group" aria-label="${escapeHTML(card.segnatura)}">
                    ${scelta('keep', window.t('btn_keep', 'Tieni'))}
                    ${scelta('delete', window.t('btn_delete', 'Elimina'))}
                </div>
            `);

            div.querySelectorAll('button[data-deletion-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-deletion-id');
                    const action = btn.getAttribute('data-deletion-action');
                    window.risolviDeletion(id, action);
                });
            });

            container.appendChild(div);
        });
    }

    window.risolviDeletion = function(id, action) {
        deletionResolutions[id] = action;
        renderDeletionList();
        aggiornaStatoFooterDeletions();
        const btn = document.querySelector(`#deletion-list button[data-deletion-id="${CSS.escape(String(id))}"][data-deletion-action="${CSS.escape(String(action))}"]`) as HTMLElement;
        if (btn) btn.focus();
    };

    function aggiornaStatoFooterDeletions() {
        const total = activeDeletions.length;
        const resolved = Object.keys(deletionResolutions).length;
        const pending = total - resolved;

        document.getElementById('deletion-counter').innerHTML = window.sanitizeHTML(pending === 0
            ? `<span class="pallino-scelta is-fatto" aria-hidden="true"></span>${escapeHTML(window.t('deletion_all_checked', 'Tutte le schede decise.'))}`
            : `<span class="pallino-scelta" aria-hidden="true"></span>${escapeHTML(window.t('deletion_to_check', '{var0} da decidere').replace('{var0}', String(pending)))}`);

        const btnApply = document.getElementById('btn-resolve-deletions') as HTMLButtonElement;
        btnApply.disabled = pending > 0;
    }

    window.concludiRisoluzioneDeletions = function() {
        document.getElementById('deletion-conflict-modal').classList.add('hidden-tab');

        if (onResolvedDeletionsCallback) {
            onResolvedDeletionsCallback(deletionResolutions);
        }
    };
})();
