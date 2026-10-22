(function() {
    function initMergeConflictModal() {
        if (!document.getElementById('merge-conflict-modal')) {
            const html = `
    <div id="merge-conflict-modal" class="modal-overlay hidden-tab z-modal-critical">
        <div class="modal-window max-w-6xl h-[85vh]">
            <div class="modal-header">
                <div>
                    <h3 class="modal-title" data-i18n="merge_conflict_modal_title">Le stesse schede sono cambiate da entrambe le parti</h3>
                    <p class="modal-sottotitolo" data-i18n="merge_select_version_desc">Per ogni campo scegli quale versione tenere. Niente viene scritto finché non applichi.</p>
                </div>
            </div>
            <div class="flex-1 flex min-h-0">
                <div id="conflict-list" class="conflitto-elenco"></div>
                <div id="conflict-detail" class="conflitto-dettaglio"></div>
            </div>
            <div class="modal-footer modal-footer-bar items-center">
                <span class="conflitto-contatore" id="conflict-counter"></span>
                <span class="flex-1"></span>
                <button type="button" data-on-click="annullaSincronizzazioneConflitto" class="btn btn-secondary"><span data-i18n="btn_cancel_sync">Annulla la sincronizzazione</span></button>
                <button type="button" id="btn-resolve-all" class="btn btn-primary" disabled data-on-click="concludiRisoluzioneConflitti"><span data-i18n="btn_apply_resolution">Applica le scelte</span></button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMergeConflictModal);
    } else {
        initMergeConflictModal();
    }

    let activeConflicts = [];
    let currentConflictIndex = 0;
    let resolutions = {};
    let resolvedFields = {};
    let onResolvedCallback = null;

    window.apriMergeConflictModal = function(conflitti, onResolved) {
        activeConflicts = conflitti;
        currentConflictIndex = 0;
        resolutions = {};
        resolvedFields = {};
        onResolvedCallback = onResolved;

        conflitti.forEach(c => {
            resolutions[c.id] = { ...(c.fusa || c.localCard) };
            resolvedFields[c.id] = new Set();
        });

        document.getElementById('merge-conflict-modal').classList.remove('hidden-tab');
        renderConflictList();
        renderConflictDetail();
        aggiornaStatoFooter();
    };

    window.annullaSincronizzazioneConflitto = function() {
        document.getElementById('merge-conflict-modal').classList.add('hidden-tab');
        mostraMessaggio(window.t("msg_sincronizzazione_annullat", "Sincronizzazione annullata. Ripristino versione locale."), "warning");
        if (onResolvedCallback) onResolvedCallback(null);
    };

    function renderConflictList() {
        const container = document.getElementById('conflict-list');
        container.innerHTML = window.sanitizeHTML('');

        activeConflicts.forEach((c, index) => {
            const isSelected = index === currentConflictIndex;
            const isResolved = resolvedFields[c.id].size === c.campiConflitto.length;

            const div = document.createElement('button');
            div.type = 'button';
            if (isSelected) div.setAttribute('aria-current', 'true');
            div.className = `conflitto-voce${isSelected ? ' is-attiva' : ''}`;
            div.onclick = () => {
                currentConflictIndex = index;
                renderConflictList();
                renderConflictDetail();
            };

            const stato = isResolved
                ? `<span class="conflitto-stato testo-successo">${escapeHTML(window.t("merge_badge_resolved", "risolta"))}</span>`
                : `<span class="conflitto-stato testo-avviso">${escapeHTML(window.t("merge_badge_pending", "{var0} da scegliere").replace('{var0}', String(c.campiConflitto.length - resolvedFields[c.id].size)))}</span>`;

            div.innerHTML = window.sanitizeHTML(`
                <span class="conflitto-voce-nome" translate="no" title="${escapeHTML(c.segnatura)}">${escapeHTML(c.segnatura)}</span>
                ${stato}
            `);
            container.appendChild(div);
        });
    }

    function renderConflictDetail() {
        const container = document.getElementById('conflict-detail');
        container.innerHTML = window.sanitizeHTML('');

        if (activeConflicts.length === 0) return;

        const c = activeConflicts[currentConflictIndex];
        const local = c.localCard;
        const external = c.externalCard;

        const n = c.campiConflitto.length;
        const headerDiv = document.createElement('div');
        headerDiv.className = 'conflitto-testa';
        headerDiv.innerHTML = window.sanitizeHTML(`
            <h4 class="conflitto-segnatura" translate="no">${escapeHTML(c.segnatura)}</h4>
            <span class="modello-suggerimento">${escapeHTML(n === 1
                ? window.t('merge_fields_one', '1 campo in conflitto')
                : window.t('merge_fields_count', '{var0} campi in conflitto').replace('{var0}', String(n)))}</span>
        `);
        container.appendChild(headerDiv);

        c.campiConflitto.forEach(campo => {
            const conf = CONFIG_CAMPI[campo] ||
                { label: campo === 'campiPropri' ? window.t('own_field_conflict', 'Campi propri della scheda') : campo };
            const localVal = local[campo];
            const externalVal = external[campo];

            const isResolved = resolvedFields[c.id].has(campo);
            const chosenVal = isResolved ? resolutions[c.id][campo] : null;

            const localChosen = isResolved && JSON.stringify(chosenVal) === JSON.stringify(localVal);
            const externalChosen = isResolved && JSON.stringify(chosenVal) === JSON.stringify(externalVal);

            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'conflitto-campo';

            const opzione = (scelta: string, scelto: boolean, etichetta: string, valore) => `
                    <button type="button" data-resolve-id="${escapeHTML(String(c.id))}" data-resolve-campo="${escapeHTML(campo)}" data-resolve-scelta="${scelta}"
                        aria-pressed="${scelto ? 'true' : 'false'}" class="conflitto-opzione${scelto ? ' is-scelta' : ''}">
                        <span class="modello-suggerimento">${escapeHTML(etichetta)}</span>
                        <span class="conflitto-valore">${renderValoreCampo(valore, campo)}</span>
                    </button>`;

            fieldDiv.innerHTML = window.sanitizeHTML(`
                <div class="conflitto-campo-testa">
                    <span class="conflitto-campo-nome">${escapeHTML(conf.label || campo)}</span>
                    ${isResolved
                        ? `<span class="conflitto-stato testo-successo">${escapeHTML(window.t("merge_choice_registered", "scelta registrata"))}</span>`
                        : `<span class="conflitto-stato testo-avviso">${escapeHTML(window.t("merge_field_pending", "da scegliere"))}</span>`}
                </div>
                <div class="conflitto-versioni">
                    ${opzione('local', localChosen, window.t("merge_local_label", "La tua versione"), localVal)}
                    ${opzione('external', externalChosen, window.t("merge_cloud_label", "Versione sul server"), externalVal)}
                </div>
            `);

            fieldDiv.querySelectorAll('button[data-resolve-id]').forEach((btn: Element) => {
                btn.addEventListener('click', () => {
                    window.risolviCampoConflitto(
                        btn.getAttribute('data-resolve-id'),
                        btn.getAttribute('data-resolve-campo'),
                        btn.getAttribute('data-resolve-scelta')
                    );
                });
            });

            container.appendChild(fieldDiv);
        });
    }

    function renderValoreCampo(valore, campo) {
        if (valore === true) return escapeHTML(window.t('label_yes', 'Sì'));
        if (valore === false) return escapeHTML(window.t('label_no', 'No'));
        if (valore === 0) return '0';
        if (!valore) return `<span class="text-stone-400 italic">${window.t("merge_field_empty", "Empty")}</span>`;

        if (campo === 'trascrizione') {
            const doc = new DOMParser().parseFromString(valore, 'text/html');
            return doc.body.textContent || doc.body.innerText || window.t("merge_rich_transcription", "(Rich Transcription)");
        }

        if (Array.isArray(valore)) {
            if (campo === 'campiPropri') {
                return valore.map(d => `• ${escapeHTML(String((d && (d.label || d.id)) || ''))}` +
                    ` <span class="text-stone-400">(${escapeHTML(window.t('field_type_' + (d && d.tipo), (d && d.tipo) || 'text'))})</span>`).join('<br>');
            }
            if (campo === 'allegati') {
                return valore.map(item => {
                    const raw = item.nome || item.v || item.k || String(item);
                    const nomeLeggibile = raw.replace(/^[a-f0-9\-]{36}_/i, '');
                    return `• ${escapeHTML(nomeLeggibile)}`;
                }).join('<br>') || `<span class="text-stone-400 italic">${window.t("merge_no_attachments", "No attachments")}</span>`;
            }
            return valore.map(item => `• <b>${escapeHTML(item.k || item.ruolo || '')}:</b> ${escapeHTML(item.v || item.nome || '')}`).join('<br>');
        }

        return escapeHTML(valore.toString());
    }

    window.risolviCampoConflitto = function(id, campo, scelta) {
        const c = activeConflicts.find(x => String(x.id) === String(id));
        if (!c) return;

        const srcCard = scelta === 'local' ? c.localCard : c.externalCard;
        const valScelto = srcCard[campo];
        resolutions[id][campo] = valScelto;
        if (campo === 'allegati') resolutions[id].allegatoTipo = srcCard.allegatoTipo ?? null;
        resolvedFields[id].add(campo);

        renderConflictList();
        renderConflictDetail();
        aggiornaStatoFooter();
        const btn = document.querySelector(`#conflict-detail button[data-resolve-campo="${CSS.escape(String(campo))}"][data-resolve-scelta="${CSS.escape(String(scelta))}"]`) as HTMLElement;
        if (btn) btn.focus();
    };

    function aggiornaStatoFooter() {
        let totali = 0;
        let risolti = 0;

        activeConflicts.forEach(c => {
            totali += c.campiConflitto.length;
            risolti += resolvedFields[c.id].size;
        });

        const irrisolti = totali - risolti;
        const schede = activeConflicts.filter(c => resolvedFields[c.id].size < c.campiConflitto.length).length;
        const restano = irrisolti === 1
            ? window.t('merge_one_left', 'Resta una scelta')
            : schede === 1
                ? window.t('merge_left_one_record', 'Restano {var0} scelte in una scheda').replace('{var0}', String(irrisolti))
                : window.t('merge_conflicts_to_resolve', 'Restano {var0} scelte in {var1} schede')
                    .replace('{var0}', String(irrisolti)).replace('{var1}', String(schede));
        document.getElementById('conflict-counter').innerHTML = window.sanitizeHTML(irrisolti === 0
            ? `<span class="pallino-scelta is-fatto" aria-hidden="true"></span>${escapeHTML(window.t("merge_all_resolved", 'Tutti i conflitti sono risolti.'))}`
            : `<span class="pallino-scelta" aria-hidden="true"></span>${escapeHTML(restano)}`);

        const btnApply = document.getElementById('btn-resolve-all') as HTMLButtonElement;
        btnApply.disabled = irrisolti > 0;
    }

    window.concludiRisoluzioneConflitti = function() {
        document.getElementById('merge-conflict-modal').classList.add('hidden-tab');
        
        const resolvedCards = [];
        
        activeConflicts.forEach(c => {
            const resolvedCard = window.ricomponiTrascrizioneFusa(resolutions[c.id]);
            resolvedCard.lastModified = Date.now();
            resolvedCards.push(resolvedCard);
        });

        if (onResolvedCallback) {
            onResolvedCallback(resolvedCards);
        }
    };
})();
