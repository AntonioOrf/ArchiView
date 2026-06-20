// @ts-nocheck

window.apriDiffModal = function(vecchioObj, nuovoObj, titolo = "Dettaglio Modifiche") {
    const chiaviIgnorate = ['lastModified', 'modificatoDa', 'creatoDa', 'id', 'allegato', 'allegatoTipo'];
    const cambiamenti = [];

    const allKeys = new Set([...Object.keys(vecchioObj || {}), ...Object.keys(nuovoObj || {})]);

    for (const key of allKeys) {
        if (chiaviIgnorate.includes(key)) continue;
        
        let valVecchio = (vecchioObj && vecchioObj[key] !== undefined) ? vecchioObj[key] : '';
        let valNuovo = (nuovoObj && nuovoObj[key] !== undefined) ? nuovoObj[key] : '';

        // Normalizziamo per la comparazione
        const jsonVecchio = JSON.stringify(valVecchio);
        const jsonNuovo = JSON.stringify(valNuovo);

        if (jsonVecchio !== jsonNuovo) {
            cambiamenti.push({
                chiave: key,
                prima: valVecchio,
                dopo: valNuovo
            });
        }
    }

    if (cambiamenti.length === 0) {
        if (typeof window.mostraMessaggio === 'function') {
            window.mostraMessaggio(window.t("msg_nessuna_modifica_rilevata", "Nessuna modifica rilevata nei campi principali."), "info");
        }
        return;
    }

    let campiHtml = cambiamenti.map(c => {
        let textPrima = '';
        let textDopo = '';
        
        if (c.chiave === 'allegati') {
            const arrPrima = Array.isArray(c.prima) ? c.prima : [];
            const arrDopo = Array.isArray(c.dopo) ? c.dopo : [];
            const getNames = (arr) => arr.map(x => x.originalName || (x.nome ? x.nome.replace(/^[0-9a-fA-F-]{36}_/, '') : 'File')).join(', ');
            textPrima = getNames(arrPrima);
            textDopo = getNames(arrDopo);
        } else {
            textPrima = typeof c.prima === 'object' ? JSON.stringify(c.prima, null, 2) : String(c.prima);
            textDopo = typeof c.dopo === 'object' ? JSON.stringify(c.dopo, null, 2) : String(c.dopo);
        }
        
        const emptyLabel = `<i>${escapeHTML(window.t("diff_empty", "(Empty)"))}</i>`;
        if (textPrima.trim() === '') textPrima = emptyLabel;
        if (textDopo.trim() === '') textDopo = emptyLabel;

        return `
            <div class="mb-4 border border-stone-200 rounded-md overflow-hidden bg-white">
                <div class="bg-stone-100 px-3 py-1.5 border-b border-stone-200 font-bold text-sm text-stone-700">
                    ${escapeHTML(window.t("diff_field", "Field:"))} <span class="text-amber-700">${escapeHTML(c.chiave)}</span>
                </div>
                <div class="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-stone-200">
                    <div class="flex-1 p-3 bg-red-50/30">
                        <div class="text-[10px] font-bold text-red-600 mb-1">${escapeHTML(window.t("diff_before", "BEFORE"))}</div>
                        <div class="text-sm text-stone-600 whitespace-pre-wrap break-words">${textPrima === emptyLabel ? textPrima : escapeHTML(textPrima)}</div>
                    </div>
                    <div class="flex-1 p-3 bg-green-50/30">
                        <div class="text-[10px] font-bold text-green-600 mb-1">${escapeHTML(window.t("diff_after", "AFTER"))}</div>
                        <div class="text-sm text-stone-800 whitespace-pre-wrap break-words">${textDopo === emptyLabel ? textDopo : escapeHTML(textDopo)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const modalHtml = `
        <div id="diff-modal" class="modal-overlay z-150 flex" style="background: rgba(0,0,0,0.5); align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
            <div class="modal-window p-0 text-left max-w-2xl w-full mx-4 bg-stone-50 rounded-lg shadow-xl flex flex-col max-h-[90vh]">
                <div class="panel-header p-4 border-b border-stone-200 flex justify-between items-center shrink-0">
                    <h3 class="text-xl font-bold flex items-center gap-2">
                        <i data-lucide="git-compare" class="w-5 h-5 text-amber-600"></i> ${escapeHTML(titolo)}
                    </h3>
                    <button id="btn-close-diff-top" class="text-stone-400 hover:text-stone-600 transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="p-4 overflow-y-auto custom-scroll flex-1">
                    ${campiHtml}
                </div>
                <div class="p-4 border-t border-stone-200 bg-white rounded-b-lg flex justify-end shrink-0">
                    <button id="btn-close-diff" class="btn btn-primary px-6">${escapeHTML(window.t("btn_close", "Close"))}</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if (window.lucide) lucide.createIcons();

    const closeModal = () => {
        const m = document.getElementById('diff-modal');
        if (m) m.remove();
    };

    document.getElementById('btn-close-diff-top').onclick = closeModal;
    document.getElementById('btn-close-diff').onclick = closeModal;
};
