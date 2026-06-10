// @ts-nocheck
window.apriPdfInterno = async function(fileName) {
    if (window.apiBrowser) {
        apriModal('local-asset://' + encodeURIComponent(fileName) + '#pagemode=none', 'pdf');
    }
}


function apriModal(sorgente, tipo = 'img') {
    const modalImg = document.getElementById('modal-img');
    const modalPdf = document.getElementById('modal-pdf');
    modalImg.classList.add('hidden');
    modalPdf.classList.add('hidden');

    if (tipo === 'pdf') {
        modalPdf.src = sorgente;
        modalPdf.classList.remove('hidden');
    } else {
        modalImg.src = sorgente;
        modalImg.classList.remove('hidden');
    }
    document.getElementById('image-modal').classList.remove('hidden-tab');
}

function chiudiModal() {
    document.getElementById('image-modal').classList.add('hidden-tab');
    document.getElementById('modal-pdf').src = '';
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
    const container = document.getElementById('docs-modal-content');
    container.innerHTML = '<div class="col-span-full text-center text-stone-500 py-10">Caricamento...</div>';
    document.getElementById('docs-modal').classList.remove('hidden-tab');

    // Usa helper condiviso invece di duplicare il pattern
    const allegatiRender = normalizzaAllegati(m);

    container.innerHTML = '';

    if (allegatiRender.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-stone-500 py-10">${window.t('no_attached_docs')}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < allegatiRender.length; i++) {
        const al = allegatiRender[i];
        const div = document.createElement('div');
        div.className = "bg-white p-3 rounded-sm border border-stone-200 shadow-sm flex flex-col items-center text-center group cursor-grab active:cursor-grabbing transition-transform";

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
                const item = m.allegati.splice(dragIndex, 1)[0];
                const rect = div.getBoundingClientRect();
                const mid = rect.left + rect.width / 2;
                let targetIndex = i;
                if (e.clientX > mid) targetIndex++;
                if (dragIndex < targetIndex) targetIndex--;
                m.allegati.splice(targetIndex, 0, item);
                
                const settings = await window.apiSettings.get();
                const username = settings.username || 'Anonimo';
                m.lastModified = Date.now();
                m.modificatoDa = username;

                await salvaTutto();
                if (typeof renderMain === 'function') renderMain();
                window.apriModalDocumenti(id);
            }
        };

        let previewHtml = '';
        if (al.tipo === 'pdf') {
            previewHtml = `
                <div onclick="apriPdfInterno('${al.nome}')" class="w-full h-32 bg-stone-100 flex justify-center items-center rounded-sm cursor-pointer hover:bg-stone-200 transition-colors mb-3 border border-stone-200">
                    <i data-lucide="file-text" class="w-12 h-12 text-red-500"></i>
                </div>
            `;
        } else {
            let src = '';
            if (window.apiBrowser) src = 'local-asset://' + encodeURIComponent(al.nome);
            previewHtml = `
                <div onclick="apriModal('${src}', 'img')" class="w-full h-32 bg-stone-100 flex justify-center items-center rounded-sm cursor-pointer hover:opacity-80 transition-opacity mb-3 border border-stone-200 overflow-hidden relative">
                     <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex justify-center items-center text-white transition-opacity"><i data-lucide="zoom-in"></i></div>
                     <img src="${src}" class="w-full h-full object-cover">
                </div>
            `;
        }

        const defaultName = al.originalName || (al.tipo === 'pdf' ? `PDF ${i+1}` : `Immagine ${i+1}`);

        div.innerHTML = `
            ${previewHtml}
            <div class="w-full flex items-center justify-between gap-1 mt-auto pt-2">
                <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-300 shrink-0"></i>
                <span class="text-sm font-semibold text-stone-700 truncate flex-1 text-left" title="${escapeHTML(defaultName)}">${escapeHTML(defaultName)}</span>
                <button type="button" onclick="rinominaAllegatoDaModal('${id}', ${i})" class="text-stone-400 hover:text-amber-600 p-1.5 rounded hover:bg-amber-50 shrink-0" title="Rinomina">
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

window.rinominaAllegatoDaModal = function(id, index) {
    const m = appData.manoscritti.find(x => x.id === id);
    if (!m) return;
    // Usa helper condiviso
    const allegatiRender = normalizzaAllegati(m);
    const nomeAttuale = allegatiRender[index].originalName || '';

    window.apriRenameModal(nomeAttuale, async (nuovoNome) => {
        allegatiRender[index].originalName = nuovoNome;
        m.allegati = allegatiRender;
        
        const settings = await window.apiSettings.get();
        const username = settings.username || 'Anonimo';
        m.lastModified = Date.now();
        m.modificatoDa = username;

        await salvaTutto();
        if (typeof renderMain === 'function') renderMain();
        window.apriModalDocumenti(id);
    });
}

window.mostraBottomConfirm = function(testo, onConfirmCallback, actionId = null, onCancelCallback = null) {
    if (actionId && appData.skipConfirmations && appData.skipConfirmations[actionId]) {
        if (onConfirmCallback) onConfirmCallback();
        return;
    }

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
    
    // Rimuovi vecchi listener clonando i pulsanti
    const newBtn = btnYes.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtn, btnYes);
    
    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    
    newBtn.onclick = async () => {
        window.chiudiBottomConfirm();
        if (actionId && checkbox.checked) {
            appData.skipConfirmations = appData.skipConfirmations || {};
            appData.skipConfirmations[actionId] = true;
            await salvaTutto();
        }
        if (onConfirmCallback) onConfirmCallback();
    };
    
    newBtnCancel.onclick = () => {
        window.chiudiBottomConfirm();
        if (onCancelCallback) onCancelCallback();
    };
    
    banner.classList.remove('hidden-tab');
}

window.chiudiBottomConfirm = function() {
    const banner = document.getElementById('bottom-confirm-banner');
    if (banner) banner.classList.add('hidden-tab');
}

