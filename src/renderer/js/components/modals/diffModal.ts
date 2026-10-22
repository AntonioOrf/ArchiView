window.htmlDiffCampo = function(nome: string, prima: string, dopo: string, etichettaPrima: string, etichettaDopo: string) {
    const valore = (testo: string, tag: string, classe: string) => testo.trim() === ''
        ? `<span class="diff-vuoto">${escapeHTML(window.t('diff_empty', '(vuoto)'))}</span>`
        : `<${tag} class="${classe}">${escapeHTML(testo)}</${tag}>`;
    return `
        <div class="diff-campo">
            <span class="diff-campo-nome" translate="no">${escapeHTML(nome)}</span>
            <div class="diff-valori">
                <div><span class="modello-suggerimento">${escapeHTML(etichettaPrima)}</span>${valore(prima, 'del', 'diff-prima')}</div>
                <div><span class="modello-suggerimento">${escapeHTML(etichettaDopo)}</span>${valore(dopo, 'ins', 'diff-dopo')}</div>
            </div>
        </div>`;
};

window.apriDiffModal = function(vecchioObj, nuovoObj, titolo = window.t('diff_titolo_predefinito', "Dettaglio Modifiche")) {
    const chiaviIgnorate = ['lastModified', 'modificatoDa', 'creatoDa', 'id', 'allegato', 'allegatoTipo'];
    const cambiamenti = [];

    const allKeys = new Set([...Object.keys(vecchioObj || {}), ...Object.keys(nuovoObj || {})]);

    for (const key of allKeys) {
        if (chiaviIgnorate.includes(key)) continue;

        let valVecchio = (vecchioObj && vecchioObj[key] !== undefined) ? vecchioObj[key] : '';
        let valNuovo = (nuovoObj && nuovoObj[key] !== undefined) ? nuovoObj[key] : '';

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

        return window.htmlDiffCampo(c.chiave, textPrima, textDopo,
            window.t("diff_before", "prima"), window.t("diff_after", "dopo"));
    }).join('');

    const modalHtml = `
        <div id="diff-modal" class="modal-overlay z-modal-nested">
            <div class="modal-window max-w-3xl max-h-[90vh]">
                <div class="modal-header">
                    <h3 class="modal-title">${escapeHTML(titolo)}</h3>
                    <button id="btn-close-diff-top" type="button" class="btn btn-ghost btn-icon" aria-label="${escapeHTML(window.t('btn_close', 'Chiudi'))}">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="modal-body flex-1">${campiHtml}</div>
                <div class="modal-footer modal-footer-bar">
                    <button id="btn-close-diff" type="button" class="btn btn-primary">${escapeHTML(window.t("btn_close", "Close"))}</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', window.sanitizeHTML(modalHtml));
    if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('diff-modal')] });

    const closeModal = () => {
        const m = document.getElementById('diff-modal');
        if (m) m.remove();
    };
    window.chiudiDiffModal = closeModal;

    document.getElementById('btn-close-diff-top').onclick = closeModal;
    document.getElementById('btn-close-diff').onclick = closeModal;
};
