// @ts-nocheck
function aggiornaSelectTipiDocumento() {
    const select = document.getElementById('form-tipo-documento');
    if (!select) return;
    select.innerHTML = '';
    appData.tipiDocumento.forEach(tipo => {
        const opt = document.createElement('option');
        opt.value = tipo.id;
        const tNome = window.t('model_' + tipo.id);
        opt.textContent = tNome !== 'model_' + tipo.id ? tNome : tipo.nome;
        select.appendChild(opt);
    });
    if (appData.tipiDocumento.length > 0) {
        renderDynamicFields();
    }
}

function renderDynamicFields() {
    const tipoId = document.getElementById('form-tipo-documento').value;
    const tipo = appData.tipiDocumento.find(t => t.id === tipoId) || appData.tipiDocumento[0];
    const container = document.getElementById('form-dynamic-fields');
    if (!container) return;
    container.innerHTML = '';

    tipo.campi.forEach(campoId => {
        let conf = CONFIG_CAMPI[campoId];
        if (!conf) {
            conf = { label: campoId, placeholder: '', type: 'text' };
        }

        const div = document.createElement('div');
        div.className = 'form-group';
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = window.t('field_' + campoId) !== 'field_' + campoId ? window.t('field_' + campoId) : conf.label;
        
        if (conf.type === 'dynamic_list') {
            div.appendChild(label);
            const listContainer = document.createElement('div');
            listContainer.id = 'container-' + campoId;
            listContainer.className = 'space-y-2 mb-2 dynamic-list-container';
            div.appendChild(listContainer);
            
            const btnAdd = document.createElement('button');
            btnAdd.type = 'button';
            btnAdd.className = 'btn btn-secondary text-sm';
            const labelStr = window.t('field_' + campoId) !== 'field_' + campoId ? window.t('field_' + campoId) : conf.label;
            btnAdd.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i> ' + window.t('btn_add_dynamic') + ' ' + escapeHTML(labelStr);
            btnAdd.onclick = () => window.aggiungiElementoDinamico(campoId, conf.keyPlaceholder, conf.valPlaceholder, '', '');
            div.appendChild(btnAdd);
            
        } else {
            div.appendChild(label);
            const el = document.createElement(conf.type === 'textarea' ? 'textarea' : 'input');
            el.id = 'dyn-' + campoId.replace(/\s+/g, '_');
            if (conf.type === 'textarea') el.rows = 3;
            else el.type = 'text';
            el.className = 'form-input';
            const pStr = window.t('placeholder_' + campoId) !== 'placeholder_' + campoId ? window.t('placeholder_' + campoId) : conf.placeholder;
            el.placeholder = pStr || '';
            div.appendChild(el);
        }
        
        container.appendChild(div);
    });

    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

window.aggiungiElementoDinamico = function(campoId, placeholderKey, placeholderVal, valKey = '', valVal = '') {
    const listContainer = document.getElementById('container-' + campoId);
    if (!listContainer) return;
    
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center dynamic-list-row';
    
    const inputKey = document.createElement('input');
    inputKey.type = 'text';
    inputKey.className = 'form-input w-1/3 list-key';
    let pKey = window.t('placeholder_key_' + campoId);
    pKey = pKey !== 'placeholder_key_' + campoId ? pKey : placeholderKey;
    inputKey.placeholder = pKey || window.t("placeholder_key", "Key");
    inputKey.value = valKey;
    inputKey.style.width = '33.33%'; // Fix flexbox

    const inputVal = document.createElement('input');
    inputVal.type = 'text';
    inputVal.className = 'form-input flex-1 list-val';
    let pVal = window.t('placeholder_val_' + campoId);
    pVal = pVal !== 'placeholder_val_' + campoId ? pVal : placeholderVal;
    inputVal.placeholder = pVal || window.t("placeholder_value", "Value");
    inputVal.value = valVal;
    inputVal.style.width = 'auto'; // Fix flexbox crush
    
    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn btn-ghost btn-icon text-red-500 hover:bg-red-50 hover:text-red-700';
    btnRemove.setAttribute('aria-label', window.t('tooltip_remove', 'Rimuovi'));
    btnRemove.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    btnRemove.onclick = () => row.remove();
    
    row.appendChild(inputKey);
    row.appendChild(inputVal);
    row.appendChild(btnRemove);
    
    listContainer.appendChild(row);
    if (window.lucide) lucide.createIcons({ nodes: [row] });
};

// Retrocompatibilità per appData (se qualche vecchio file chiama aggiungiAttoreDinamico, dirotta qua)
window.aggiungiAttoreDinamico = function(ruoloVal = 'Attore', nomeVal = '') {
    window.aggiungiElementoDinamico('attori_dinamici', 'Ruolo', 'Nome', ruoloVal, nomeVal);
};

function resetForm() {
    window.isFormDirty = false;
    document.getElementById('form-segnatura').value = '';
    document.getElementById('form-tags').value = '';
    document.getElementById('form-allegato').value = '';
    document.getElementById('form-id').value = '';

    const allegatiInput = document.getElementById('form-allegati');
    if (allegatiInput) allegatiInput.value = '[]';

    const allegatiList = document.getElementById('form-allegati-list');
    if (allegatiList) allegatiList.innerHTML = '';

    const newPreview = document.getElementById('form-allegati-new-preview');
    if (newPreview) newPreview.classList.add('hidden');
    window.pendingFilesToUpload = [];
    if (window.renderPendingFiles) window.renderPendingFiles();

    const dynContainer = document.getElementById('form-dynamic-fields');
    if (dynContainer) dynContainer.querySelectorAll('input, textarea').forEach(el => el.value = '');

    // Reimposta la select sulla cartella in cui si stava navigando
    document.getElementById('form-cartella').value = window.cartellaAttuale;
    document.getElementById('form-title').textContent = window.t('title_new_record', 'Compila Nuova Scheda');
    
    // Aggiorna le icone (es. arrow-left) in caso siano state resettate
    if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('btn-cancel-edit')] });
}

// Accetta sia un indice numerico (retrocompat) sia l'elemento bottone, da cui
// ricava l'indice corrente leggendo data-idx della riga (sempre allineato al DOM).
function _idxAllegatoForm(arg) {
    if (typeof arg === 'number') return arg;
    const row = arg && arg.closest ? arg.closest('.allegato-row') : null;
    return row ? parseInt(row.dataset.idx, 10) : -1;
}

window.rimuoviAllegatoForm = function(arg) {
    const index = _idxAllegatoForm(arg);
    if (index < 0) return;
    window.isFormDirty = true;
    let allegatiList = JSON.parse(document.getElementById('form-allegati').value || '[]');
    allegatiList.splice(index, 1);
    document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
    window.renderAllegatiForm(allegatiList);
}

// P2.4 — alternativa accessibile (da tastiera) al riordino drag&drop.
window.spostaAllegatoForm = function(arg, direction) {
    const index = _idxAllegatoForm(arg);
    if (index < 0) return;
    let allegatiList = JSON.parse(document.getElementById('form-allegati').value || '[]');
    const target = index + direction;
    if (target < 0 || target >= allegatiList.length) return;
    [allegatiList[index], allegatiList[target]] = [allegatiList[target], allegatiList[index]];
    window.isFormDirty = true;
    document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
    window.renderAllegatiForm(allegatiList).then(() => {
        // Mantieni il focus sulla riga spostata per una navigazione fluida da tastiera.
        const container = document.getElementById('form-allegati-list');
        const rows = container ? container.querySelectorAll(':scope > div') : [];
        const moved = rows[target];
        if (moved) {
            const btn = moved.querySelector(`button[data-move="${direction > 0 ? 'down' : 'up'}"]`)
                || moved.querySelector('button[data-move]');
            if (btn) btn.focus();
        }
    });
}

window.rinominaAllegatoForm = function(arg) {
    const index = _idxAllegatoForm(arg);
    if (index < 0) return;
    let allegatiList = JSON.parse(document.getElementById('form-allegati').value || '[]');
    let nomeAttuale = allegatiList[index].originalName || '';

    window.apriRenameModal(nomeAttuale, (nuovoNome) => {
        window.isFormDirty = true;
        allegatiList[index].originalName = nuovoNome;
        document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
        window.renderAllegatiForm(allegatiList);
    });
}

window.renderAllegatiForm = async function(allegatiList) {
    const container = document.getElementById('form-allegati-list');
    if (!container) return;
    container.innerHTML = '';

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < allegatiList.length; i++) {
        const al = allegatiList[i];
        const div = document.createElement('div');
        div.className = "allegato-row flex items-center justify-between p-2 bg-white border border-stone-300 rounded-sm shadow-sm gap-2 cursor-grab active:cursor-grabbing transition-transform";
        div.dataset.idx = String(i);

        div.draggable = true;
        div.ondragstart = (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', div.dataset.idx);
            setTimeout(() => div.classList.add('opacity-40'), 0);
            window._draggedAttachmentRow = div;
        };
        div.ondragend = () => {
            div.classList.remove('opacity-40');
            window._draggedAttachmentRow = null;
            container.querySelectorAll(':scope > div').forEach(p => p.style.transform = '');
        };
        div.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const dragged = window._draggedAttachmentRow;
            if (!dragged || dragged === div) return;
            const rect = div.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            div.style.transform = e.clientX < mid ? 'translateX(10px)' : 'translateX(-10px)';
        };
        div.ondragleave = () => div.style.transform = '';
        div.ondrop = (e) => {
            e.preventDefault();
            div.style.transform = '';
            const dragged = window._draggedAttachmentRow;
            if (!dragged || dragged === div) return;

            // Sposta il nodo nel DOM in-place: niente re-render completo, niente flicker.
            const rect = div.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            if (e.clientX > mid) div.after(dragged); else div.before(dragged);

            // Riallinea l'array degli allegati al nuovo ordine del DOM usando i
            // data-idx ancora "vecchi", poi li rinumera in base alla posizione attuale.
            const rows = Array.prototype.slice.call(container.children);
            const currentList = JSON.parse(document.getElementById('form-allegati').value || '[]');
            const newList = rows.map(r => currentList[parseInt(r.dataset.idx, 10)]);
            rows.forEach((r, idx) => { r.dataset.idx = String(idx); });
            window.isFormDirty = true;
            document.getElementById('form-allegati').value = JSON.stringify(newList);
        };

        let content = '';
        if (al.tipo === 'pdf') {
            content = `
                <div class="flex items-center gap-2 truncate cursor-pointer hover:text-red-700 flex-1" onclick="apriPdfInterno('${escapeHTML(al.nome)}')">
                    <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-400 shrink-0"></i>
                    <i data-lucide="file-text" class="w-6 h-6 text-red-600 shrink-0"></i>
                    <span class="text-xs font-semibold truncate" title="${escapeHTML(al.originalName || al.nome)}">${escapeHTML(al.originalName || 'PDF')}</span>
                </div>
            `;
        } else {
            let src = '';
            if (window.apiBrowser) src = 'local-asset://' + encodeURIComponent(al.nome);
            content = `
                <div class="flex items-center gap-2 truncate cursor-pointer hover:opacity-80 flex-1" onclick="apriModal('${escapeHTML(src)}', 'img')">
                    <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-400 shrink-0"></i>
                    <img src="${escapeHTML(src)}" alt="${escapeHTML(al.originalName || window.t('attachment_image', 'Immagine'))}" class="w-8 h-8 object-cover rounded-sm border border-stone-200 shrink-0">
                    <span class="text-xs font-semibold truncate" title="${escapeHTML(al.originalName || al.nome)}">${escapeHTML(al.originalName || window.t('attachment_image', 'Immagine'))}</span>
                </div>
            `;
        }

        div.innerHTML = `
            ${content}
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-move="up" onclick="spostaAllegatoForm(this, -1)" ${i === 0 ? 'disabled' : ''} class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="${escapeHTML(window.t('tooltip_move_up', 'Sposta su'))}" title="${escapeHTML(window.t('tooltip_move_up', 'Sposta su'))}">
                    <i data-lucide="chevron-up" class="w-4 h-4"></i>
                </button>
                <button type="button" data-move="down" onclick="spostaAllegatoForm(this, 1)" ${i === allegatiList.length - 1 ? 'disabled' : ''} class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="${escapeHTML(window.t('tooltip_move_down', 'Sposta giù'))}" title="${escapeHTML(window.t('tooltip_move_down', 'Sposta giù'))}">
                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                </button>
                <button type="button" onclick="rinominaAllegatoForm(this)" class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50" aria-label="${escapeHTML(window.t('tooltip_rename', 'Rinomina'))}" title="${escapeHTML(window.t('tooltip_rename', 'Rinomina'))}">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button type="button" onclick="rimuoviAllegatoForm(this)" class="text-stone-400 hover:text-red-600 p-1 rounded hover:bg-red-50" aria-label="${escapeHTML(window.t('tooltip_remove', 'Rimuovi'))}" title="${escapeHTML(window.t('tooltip_remove', 'Rimuovi'))}">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        fragment.appendChild(div);
    }
    container.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

