// @ts-nocheck

(function() {
    function initMergeConflictModal() {
        if (!document.getElementById('merge-conflict-modal')) {
            const html = `
    <div id="merge-conflict-modal" class="modal-overlay hidden-tab z-[9999] bg-stone-900/80 backdrop-blur-sm flex justify-center items-center">
        <div class="modal-window w-full max-w-5xl p-6 shadow-2xl border border-stone-200 flex flex-col h-[85vh] bg-stone-50">
            <div class="modal-header shrink-0 flex justify-between items-center pb-3 border-b border-stone-200">
                <h3 class="modal-title text-stone-800 font-serif flex items-center gap-2">
                    <i data-lucide="git-merge" class="w-5 h-5 text-red-500"></i> Conflitti di Sincronizzazione Rilevati
                </h3>
            </div>
            <div class="flex-1 flex gap-4 overflow-hidden py-4 min-h-0">
                <!-- Left panel: list of conflicts -->
                <div class="w-1/4 border-r border-stone-200 pr-3 flex flex-col gap-2 overflow-y-auto" id="conflict-list">
                    <!-- Cards will be populated here -->
                </div>
                <!-- Right panel: comparison of fields -->
                <div class="w-3/4 flex flex-col overflow-y-auto px-2 bg-white rounded border border-stone-200 p-4" id="conflict-detail">
                    <!-- Comparative details -->
                </div>
            </div>
            <div class="modal-footer shrink-0 pt-3 border-t border-stone-200 flex justify-between items-center bg-stone-50">
                <span class="text-sm font-medium text-stone-600" id="conflict-counter">Conflitti irrisolti: 0</span>
                <div class="flex gap-2">
                    <button onclick="window.annullaSincronizzazioneConflitto()" class="btn btn-secondary bg-white text-stone-700 hover:bg-stone-100 border border-stone-300">Annulla Sincronizzazione</button>
                    <button id="btn-resolve-all" class="btn btn-primary" disabled onclick="window.concludiRisoluzioneConflitti()">Applica Risoluzione</button>
                </div>
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
    let resolutions = {}; // id -> resolved card object
    let resolvedFields = {}; // id -> set of field names resolved
    let onResolvedCallback = null;

    window.apriMergeConflictModal = function(conflitti, onResolved) {
        activeConflicts = conflitti;
        currentConflictIndex = 0;
        resolutions = {};
        resolvedFields = {};
        onResolvedCallback = onResolved;

        // Inizializza gli oggetti risoluzione partendo dalla versione locale
        conflitti.forEach(c => {
            resolutions[c.id] = { ...c.localCard };
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
        if (onResolvedCallback) onResolvedCallback(null); // Segnala l'annullamento
    };

    function renderConflictList() {
        const container = document.getElementById('conflict-list');
        container.innerHTML = window.sanitizeHTML('');

        activeConflicts.forEach((c, index) => {
            const isSelected = index === currentConflictIndex;
            const isResolved = resolvedFields[c.id].size === c.campiConflitto.length;

            const div = document.createElement('div');
            div.className = `p-3 rounded border cursor-pointer transition-all flex flex-col gap-1 ${
                isSelected 
                    ? 'bg-amber-50 border-amber-500 shadow-sm' 
                    : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`;
            div.onclick = () => {
                currentConflictIndex = index;
                renderConflictList();
                renderConflictDetail();
            };

            let badgeHtml = isResolved 
                ? '<span class="text-[9px] uppercase tracking-wider font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full self-start">Risolto</span>'
                : `<span class="text-[9px] uppercase tracking-wider font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full self-start">${c.campiConflitto.length - resolvedFields[c.id].size} in sospeso</span>`;

            div.innerHTML = window.sanitizeHTML(`
                <div class="font-semibold text-sm text-stone-800 truncate" title="${escapeHTML(c.segnatura)}">${escapeHTML(c.segnatura)}</div>
                ${badgeHtml}
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

        const headerDiv = document.createElement('div');
        headerDiv.className = 'mb-4 pb-2 border-b border-stone-200';
        headerDiv.innerHTML = window.sanitizeHTML(`
            <h4 class="text-lg font-serif text-stone-800 mb-1">${escapeHTML(c.segnatura)}</h4>
            <p class="text-xs text-stone-500">Seleziona la versione corretta per ciascun campo modificato da entrambi gli utenti.</p>
        `);
        container.appendChild(headerDiv);

        c.campiConflitto.forEach(campo => {
            const conf = CONFIG_CAMPI[campo] || { label: campo };
            const localVal = local[campo];
            const externalVal = external[campo];
            
            const isResolved = resolvedFields[c.id].has(campo);
            const chosenVal = isResolved ? resolutions[c.id][campo] : null;

            const fieldDiv = document.createElement('div');
            fieldDiv.className = `p-4 rounded border mb-4 ${
                isResolved 
                    ? 'border-green-200 bg-green-50/20' 
                    : 'border-stone-200 bg-stone-50/40'
            }`;

            // Gestione dei diversi tipi di formati (liste dinamiche vs testo semplice)
            let localStr = renderValoreCampo(localVal, campo);
            let externalStr = renderValoreCampo(externalVal, campo);

            fieldDiv.innerHTML = window.sanitizeHTML(`
                <div class="font-bold text-xs uppercase tracking-wider text-amber-700 mb-3 flex items-center justify-between">
                    <span>${escapeHTML(conf.label || campo)}</span>
                    ${isResolved ? '<span class="text-green-700 text-[10px] flex items-center gap-0.5"><i data-lucide="check-circle" class="w-3 h-3"></i> Scelta registrata</span>' : ''}
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <!-- Versione Locale (Tu) -->
                    <div class="flex flex-col gap-2 p-3 bg-white border rounded relative transition-all ${
                        isResolved && JSON.stringify(chosenVal) === JSON.stringify(localVal)
                            ? 'border-amber-500 ring-2 ring-amber-500/10'
                            : 'border-stone-200'
                    }">
                        <span class="text-[9px] uppercase font-bold text-amber-700 absolute -top-2 left-2 bg-amber-50 px-1 border border-amber-200 rounded">Tua Modifica (Locale)</span>
                        <div class="text-sm text-stone-700 whitespace-pre-wrap select-text break-all mt-1 flex-1 leading-relaxed">${localStr}</div>
                        <button onclick="window.risolviCampoConflitto('${c.id}', '${campo}', 'local')" class="btn btn-secondary py-1 text-xs justify-center mt-2 ${
                            isResolved && JSON.stringify(chosenVal) === JSON.stringify(localVal)
                                ? 'bg-amber-500 border-transparent text-white hover:bg-amber-600'
                                : 'bg-stone-50 hover:bg-stone-100'
                        }">Tieni la mia</button>
                    </div>

                    <!-- Versione Esterna (Cloud) -->
                    <div class="flex flex-col gap-2 p-3 bg-white border rounded relative transition-all ${
                        isResolved && JSON.stringify(chosenVal) === JSON.stringify(externalVal)
                            ? 'border-amber-500 ring-2 ring-amber-500/10'
                            : 'border-stone-200'
                    }">
                        <span class="text-[9px] uppercase font-bold text-stone-500 absolute -top-2 left-2 bg-stone-50 px-1 border border-stone-200 rounded">Modifica Cloud (Server)</span>
                        <div class="text-sm text-stone-700 whitespace-pre-wrap select-text break-all mt-1 flex-1 leading-relaxed">${externalStr}</div>
                        <button onclick="window.risolviCampoConflitto('${c.id}', '${campo}', 'external')" class="btn btn-secondary py-1 text-xs justify-center mt-2 ${
                            isResolved && JSON.stringify(chosenVal) === JSON.stringify(externalVal)
                                ? 'bg-amber-500 border-transparent text-white hover:bg-amber-600'
                                : 'bg-stone-50 hover:bg-stone-100'
                        }">Usa questa</button>
                    </div>
                </div>
            `);
            container.appendChild(fieldDiv);
        });

        if (window.lucide) lucide.createIcons({ nodes: [container] });
    }

    function renderValoreCampo(valore, campo) {
        if (!valore) return '<span class="text-stone-400 italic">Vuoto</span>';
        
        if (campo === 'trascrizione') {
            // Rimuovi tag HTML per la visualizzazione testuale pulita o mostra in modo leggibile
            const doc = new DOMParser().parseFromString(valore, 'text/html');
            return doc.body.textContent || doc.body.innerText || "(Trascrizione ricca)";
        }
        
        if (Array.isArray(valore)) {
            return valore.map(item => `• <b>${escapeHTML(item.k || item.ruolo || '')}:</b> ${escapeHTML(item.v || item.nome || '')}`).join('<br>');
        }
        
        return escapeHTML(valore.toString());
    }

    window.risolviCampoConflitto = function(id, campo, scelta) {
        const c = activeConflicts.find(x => String(x.id) === String(id));
        if (!c) return;

        const valScelto = scelta === 'local' ? c.localCard[campo] : c.externalCard[campo];
        resolutions[id][campo] = valScelto;
        resolvedFields[id].add(campo);

        renderConflictList();
        renderConflictDetail();
        aggiornaStatoFooter();
    };

    function aggiornaStatoFooter() {
        let totali = 0;
        let risolti = 0;

        activeConflicts.forEach(c => {
            totali += c.campiConflitto.length;
            risolti += resolvedFields[c.id].size;
        });

        const irrisolti = totali - risolti;
        document.getElementById('conflict-counter').innerHTML = irrisolti === 0 
            ? '<span class="text-green-600 font-bold flex items-center gap-1"><i data-lucide="check-circle-2" class="w-4 h-4"></i> Tutti i conflitti sono stati risolti!</span>' 
            : `Conflitti da risolvere: <b class="text-red-500">${irrisolti}</b>`;

        const btnApply = document.getElementById('btn-resolve-all');
        btnApply.disabled = irrisolti > 0;

        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('conflict-counter')] });
    }

    window.concludiRisoluzioneConflitti = function() {
        document.getElementById('merge-conflict-modal').classList.add('hidden-tab');
        
        const resolvedCards = [];
        
        activeConflicts.forEach(c => {
            // Impostiamo il timestamp ad adesso e segnamo che è stato modificato da noi
            const resolvedCard = resolutions[c.id];
            resolvedCard.lastModified = Date.now();
            resolvedCards.push(resolvedCard);
        });

        if (onResolvedCallback) {
            onResolvedCallback(resolvedCards);
        }
    };
})();
