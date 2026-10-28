window.apriPdfInterno = async function(fileName) {
    if (typeof fileName !== 'string' || !/\.pdf$/i.test(fileName)) {
        console.warn('[Allegati] Non è un PDF, non si apre nel visualizzatore:', fileName);
        return;
    }
    if (window.apiBrowser) {
        apriModal(window.srcAllegato(fileName, { frammento: '#pagemode=none' }), 'pdf');
    }
}


function apriModal(sorgente, tipo = 'img') {
    const modalImg = document.getElementById('modal-img') as HTMLImageElement;
    const modalPdf = document.getElementById('modal-pdf');
    const viewport = document.getElementById('modal-img-viewport') as HTMLElement & { _imageViewer?: any };
    if (viewport) viewport.classList.add('hidden-tab');
    modalPdf.classList.add('hidden');

    if (tipo === 'pdf') {
        modalPdf.src = sorgente;
        modalPdf.classList.remove('hidden');
        document.getElementById('image-modal').classList.remove('hidden-tab');
    } else {
        document.getElementById('image-modal').classList.remove('hidden-tab');
        if (viewport) {
            viewport.classList.remove('hidden-tab');
            if (window.attivaVisualizzatoreImmagini) {
                const viewer = window.attivaVisualizzatoreImmagini(viewport, modalImg);
                if (viewer) viewer.reimposta();
            }
        }
        modalImg.alt = window.t('attachment_image', 'Immagine');
        modalImg.src = sorgente;
        if (viewport) viewport.focus({ preventScroll: true });
    }
}

function chiudiModal() {
    document.getElementById('image-modal').classList.add('hidden-tab');
    document.getElementById('modal-pdf').src = '';
    const viewport = document.getElementById('modal-img-viewport') as HTMLElement & { _imageViewer?: any };
    if (viewport && viewport._imageViewer) viewport._imageViewer.reimposta();
}

window.apriRenameModal = function(nomeAttuale, callback) {
    const input = document.getElementById('rename-input');
    input.value = nomeAttuale;
    window._renameCallback = callback;
    document.getElementById('rename-modal').classList.remove('hidden-tab');
    setTimeout(() => input.focus(), 100);
}

window.chiudiRenameModal = function() {
    document.getElementById('rename-modal').classList.add('hidden-tab');
    window._renameCallback = null;
}

window.confermaRinomina = function() {
    const input = document.getElementById('rename-input');
    const nuovoNome = input.value.trim();
    if (nuovoNome && window._renameCallback) {
        window._renameCallback(nuovoNome);
    }
    window.chiudiRenameModal();
}

window.apriModalDocumenti = async function(id) {
    const m = appData.manoscritti.find(x => x.id === id);
    if (!m) return;

    document.getElementById('docs-modal-title').textContent = m.segnatura;
    document.getElementById('docs-modal-title').translate = false;
    const container = document.getElementById('docs-modal-content');
    container.innerHTML = `<div class="col-span-full text-center modello-suggerimento py-10">${escapeHTML(window.t('label_loading', 'Caricamento...'))}</div>`;
    document.getElementById('docs-modal').classList.remove('hidden-tab');

    const allegatiRender = carteDi(m);

    container.innerHTML = '';

    if (allegatiRender.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center modello-suggerimento py-10">${escapeHTML(window.t('no_attached_docs'))}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < allegatiRender.length; i++) {
        const al = allegatiRender[i];
        const div = document.createElement('div');
        div.className = "doc-carta group";

        div.draggable = true;
        div.ondragstart = (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', i.toString());
            setTimeout(() => div.classList.add('opacity-40'), 0);
            window._draggedDocModalIndex = i;
        };
        div.ondragend = () => {
            div.classList.remove('opacity-40');
            window._draggedDocModalIndex = null;
            container.querySelectorAll(':scope > div').forEach(p => p.style.transform = '');
        };
        div.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = div.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            container.querySelectorAll(':scope > div').forEach(p => {
                if (p !== div && window._draggedDocModalIndex !== i) p.style.transform = '';
            });
            if (window._draggedDocModalIndex !== null && window._draggedDocModalIndex !== i) {
                div.style.transform = e.clientX < mid ? 'translateX(10px)' : 'translateX(-10px)';
            }
        };
        div.ondragleave = () => div.style.transform = '';
        div.ondrop = async (e) => {
            e.preventDefault();
            div.style.transform = '';
            const dragIndex = window._draggedDocModalIndex;
            if (dragIndex !== null && dragIndex !== i) {
                const prima = JSON.parse(JSON.stringify(normalizzaAllegati(m)));
                const item = normalizzaAllegati(m).splice(dragIndex, 1)[0];
                const rect = div.getBoundingClientRect();
                const mid = rect.left + rect.width / 2;
                let targetIndex = i;
                if (e.clientX > mid) targetIndex++;
                if (dragIndex < targetIndex) targetIndex--;
                m.allegati.splice(targetIndex, 0, item);
                m.lastModified = Date.now();
                _mdRegistraUndoAllegati(id, window.t('undo_reorder_attachments', 'Riordino degli allegati'), prima, JSON.parse(JSON.stringify(m.allegati)));

                m.modificatoDa = await _mdAutore();
                await salvaTutto();
                if (typeof renderMain === 'function') renderMain();
                window.apriModalDocumenti(id);
            }
        };

        let previewHtml = '';
        if (al.tipo === 'pdf') {
            previewHtml = `
                <div ${window.azione('click', 'apriPdfInterno', String((al.nome) ?? ''))} class="doc-carta-anteprima">
                    <i data-lucide="file-text" class="w-10 h-10"></i>
                </div>
            `;
        } else {
            let src = '', srcPieno = '';
            if (window.apiBrowser) {
                src = window.srcAllegato(al, { lato: 320 });
                srcPieno = window.srcAllegato(al, { lato: 2000 });
            }
            previewHtml = `
                <div ${window.azione('click', 'apriModal', String((srcPieno) ?? ''), "img")} class="doc-carta-anteprima relative">
                     <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex justify-center items-center text-white transition-opacity"><i data-lucide="zoom-in"></i></div>
                     <img src="${escapeHTML(src)}" alt="${escapeHTML(al.originalName || `${window.t('attachment_image', 'Immagine')} ${i+1}`)}" class="w-full h-full object-cover">
                </div>
            `;
        }

        const defaultName = al.originalName || (al.tipo === 'pdf' ? `PDF ${i+1}` : `${window.t('attachment_image', 'Immagine')} ${i+1}`);

        div.innerHTML = `
            ${previewHtml}
            <div class="doc-carta-piede">
                <i data-lucide="grip-vertical" class="w-4 h-4 shrink-0 doc-carta-maniglia"></i>
                <span class="doc-carta-nome" title="${escapeHTML(defaultName)}">${escapeHTML(defaultName)}</span>
                <button type="button" ${window.azione('click', 'spostaAllegatoDaModal', String((id) ?? ''), i, -1)} ${i === 0 ? 'disabled' : ''} class="btn btn-ghost btn-icon shrink-0" aria-label="${escapeHTML(window.t('tooltip_move_up', 'Sposta su'))}" title="${escapeHTML(window.t('tooltip_move_up', 'Sposta su'))}">
                    <i data-lucide="chevron-up" class="w-4 h-4"></i>
                </button>
                <button type="button" ${window.azione('click', 'spostaAllegatoDaModal', String((id) ?? ''), i, 1)} ${i === allegatiRender.length - 1 ? 'disabled' : ''} class="btn btn-ghost btn-icon shrink-0" aria-label="${escapeHTML(window.t('tooltip_move_down', 'Sposta giù'))}" title="${escapeHTML(window.t('tooltip_move_down', 'Sposta giù'))}">
                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                </button>
                <button type="button" ${window.azione('click', 'rinominaAllegatoDaModal', String((id) ?? ''), i)} class="btn btn-ghost btn-icon shrink-0" aria-label="${escapeHTML(window.t('tooltip_rename', 'Rinomina'))}" title="${escapeHTML(window.t('tooltip_rename', 'Rinomina'))}">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        fragment.appendChild(div);
    }
    container.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

window.chiudiModalDocumenti = function() {
    document.getElementById('docs-modal').classList.add('hidden-tab');
}

async function _mdAutore() {
    try {
        return (await window.apiSettings.get()).username || 'Anonimo';
    } catch (err) {
        console.error('Impostazioni non leggibili, autore anonimo:', err);
        return 'Anonimo';
    }
}

function _mdRegistraUndoAllegati(id, descrizione, prima, dopo) {
    if (!window.gestoreAnnullamento) return;
    const applica = async (stato) => {
        const m = appData.manoscritti.find(x => String(x.id) === String(id));
        if (!m) return;
        m.allegati = JSON.parse(JSON.stringify(stato));
        m.lastModified = Date.now();
        await salvaTutto();
        if (typeof renderMain === 'function') renderMain();
        const aperto = document.getElementById('docs-modal');
        if (aperto && !aperto.classList.contains('hidden-tab')) window.apriModalDocumenti(id);
    };
    window.gestoreAnnullamento.registraAzione(descrizione,
        () => applica(prima), () => applica(dopo));
}

window.rinominaAllegatoDaModal = function(id, index) {
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (!m) return;
    const allegatiRender = normalizzaAllegati(m);
    const nomeAttuale = allegatiRender[index].originalName || '';
    const prima = JSON.parse(JSON.stringify(allegatiRender));

    window.apriRenameModal(nomeAttuale, async (nuovoNome) => {
        allegatiRender[index].originalName = nuovoNome;
        m.allegati = allegatiRender;
        m.lastModified = Date.now();
        _mdRegistraUndoAllegati(id, window.t('undo_rename_attachment', 'Rinomina di un allegato'),
            prima, JSON.parse(JSON.stringify(m.allegati)));

        m.modificatoDa = await _mdAutore();
        await salvaTutto();
        if (typeof renderMain === 'function') renderMain();
        window.apriModalDocumenti(id);
    });
}

window.spostaAllegatoDaModal = async function(id, index, direction) {
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (!m || !Array.isArray(m.allegati)) return;
    const target = index + direction;
    if (target < 0 || target >= m.allegati.length) return;
    const prima = JSON.parse(JSON.stringify(m.allegati));
    [m.allegati[index], m.allegati[target]] = [m.allegati[target], m.allegati[index]];
    m.lastModified = Date.now();
    _mdRegistraUndoAllegati(id, window.t('undo_reorder_attachments', 'Riordino degli allegati'),
        prima, JSON.parse(JSON.stringify(m.allegati)));

    m.modificatoDa = await _mdAutore();
    await salvaTutto();
    if (typeof renderMain === 'function') renderMain();
    await window.apriModalDocumenti(id);

    const container = document.getElementById('docs-modal-content');
    const rows = container ? container.querySelectorAll(':scope > div') : [];
    const moved = rows[target];
    if (moved) {
        const btn = moved.querySelector(`button[data-on-click="spostaAllegatoDaModal"][data-args-click$="${direction > 0 ? ',1]' : ',-1]'}"]`);
        if (btn) btn.focus();
    }
}

let _annullaBarraAperta = null;

window.mostraBottomConfirm = function(testo, onConfirmCallback, actionId = null, onCancelCallback = null) {
    if (actionId && window.prefLocale('confermaSaltata:' + actionId) === '1') {
        if (onConfirmCallback) onConfirmCallback();
        return;
    }
    if (_annullaBarraAperta) {
        const precedente = _annullaBarraAperta;
        _annullaBarraAperta = null;
        precedente();
    }
    _annullaBarraAperta = onCancelCallback || (() => {});

    const banner = document.getElementById('bottom-confirm-banner');
    document.getElementById('bottom-confirm-text').textContent = testo;
    const btnYes = document.getElementById('btn-bottom-confirm-yes');
    const btnCancel = banner.querySelector('.btn-ghost');
    
    const checkboxContainer = document.getElementById('bottom-confirm-checkbox-container');
    const checkbox = document.getElementById('bottom-confirm-skip');
    
    if (actionId) {
        checkboxContainer.classList.remove('hidden-tab');
        checkbox.checked = false;
    } else {
        checkboxContainer.classList.add('hidden-tab');
    }
    
    const newBtn = btnYes.cloneNode(true) as HTMLElement;
    btnYes.parentNode.replaceChild(newBtn, btnYes);
    
    const newBtnCancel = btnCancel.cloneNode(true) as HTMLElement;
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    
    newBtn.onclick = async () => {
        _annullaBarraAperta = null;
        window.chiudiBottomConfirm();
        if (actionId && checkbox.checked) window.prefLocale('confermaSaltata:' + actionId, '1');
        if (onConfirmCallback) onConfirmCallback();
    };

    newBtnCancel.onclick = () => {
        _annullaBarraAperta = null;
        window.chiudiBottomConfirm();
        if (onCancelCallback) onCancelCallback();
    };

    banner.classList.remove('hidden-tab');
}

window.chiediConfermaBloccante = function(testo: string, etichettaConferma: string, titolo?: string, classeConferma = 'btn-danger'): Promise<boolean> {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay z-modal-critical';
        overlay.innerHTML = window.sanitizeHTML(`
            <div class="modal-window max-w-md" role="dialog" aria-modal="true">
                <div class="modal-body space-y-3">${titolo ? '<h3 class="font-semibold text-base"></h3>' : ''}</div>
                <div class="modal-footer modal-footer-bar">
                    <button type="button" class="btn btn-secondary" data-modal-cancel>${escapeHTML(window.t('btn_cancel', 'Annulla'))}</button>
                    <button type="button" class="btn ${escapeHTML(classeConferma)}" data-modal-ok>${escapeHTML(etichettaConferma)}</button>
                </div>
            </div>`);
        const corpo = overlay.querySelector('.modal-body');
        if (titolo) corpo.querySelector('h3').textContent = titolo;
        for (const paragrafo of testo.split('\n\n')) {
            const p = document.createElement('p');
            p.className = 'text-stone-700 leading-relaxed';
            p.textContent = paragrafo;
            corpo.appendChild(p);
        }
        const chiudi = (ok: boolean) => { overlay.remove(); resolve(ok); };
        overlay.querySelector('[data-modal-cancel]').addEventListener('click', () => chiudi(false));
        overlay.querySelector('[data-modal-ok]').addEventListener('click', () => chiudi(true));
        document.body.appendChild(overlay);
        (overlay.querySelector('[data-modal-ok]') as HTMLElement).focus();
    });
};

window.chiudiBottomConfirm = function() {
    const banner = document.getElementById('bottom-confirm-banner');
    if (banner) banner.classList.add('hidden-tab');
}


