function aggiornaSelectTipiDocumento() {
    const select = document.getElementById('form-tipo-documento');
    if (!select) return;
    select.innerHTML = '';
    appData.tipiDocumento.forEach(tipo => {
        const opt = document.createElement('option');
        opt.value = tipo.id;
        opt.textContent = tipo.nome;
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
        label.textContent = conf.label;
        
        if (conf.type === 'dynamic_list') {
            div.appendChild(label);
            const listContainer = document.createElement('div');
            listContainer.id = 'container-' + campoId;
            listContainer.className = 'space-y-2 mb-2 dynamic-list-container';
            div.appendChild(listContainer);
            
            const btnAdd = document.createElement('button');
            btnAdd.type = 'button';
            btnAdd.className = 'btn btn-secondary text-sm';
            btnAdd.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i> Aggiungi ' + conf.label;
            btnAdd.onclick = () => window.aggiungiElementoDinamico(campoId, conf.keyPlaceholder, conf.valPlaceholder, '', '');
            div.appendChild(btnAdd);
            
        } else {
            div.appendChild(label);
            const el = document.createElement(conf.type === 'textarea' ? 'textarea' : 'input');
            el.id = 'dyn-' + campoId.replace(/\s+/g, '_');
            if (conf.type === 'textarea') el.rows = 3;
            else el.type = 'text';
            el.className = 'form-input';
            el.placeholder = conf.placeholder || '';
            div.appendChild(el);
        }
        
        container.appendChild(div);
    });
}

window.aggiungiElementoDinamico = function(campoId, placeholderKey, placeholderVal, valKey = '', valVal = '') {
    const listContainer = document.getElementById('container-' + campoId);
    if (!listContainer) return;
    
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center dynamic-list-row';
    
    const inputKey = document.createElement('input');
    inputKey.type = 'text';
    inputKey.className = 'form-input w-1/3 list-key';
    inputKey.placeholder = placeholderKey || 'Chiave';
    inputKey.value = valKey;
    inputKey.style.width = '33.33%'; // Fix flexbox

    const inputVal = document.createElement('input');
    inputVal.type = 'text';
    inputVal.className = 'form-input flex-1 list-val';
    inputVal.placeholder = placeholderVal || 'Valore';
    inputVal.value = valVal;
    inputVal.style.width = 'auto'; // Fix flexbox crush
    
    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn btn-ghost btn-icon text-red-500 hover:bg-red-50 hover:text-red-700';
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

    const dynContainer = document.getElementById('form-dynamic-fields');
    if (dynContainer) dynContainer.querySelectorAll('input, textarea').forEach(el => el.value = '');

    // Reimposta la select sulla cartella in cui si stava navigando
    document.getElementById('form-cartella').value = window.cartellaAttuale;
    document.getElementById('form-title').textContent = "Compila Nuova Scheda";
    document.getElementById('btn-cancel-edit').classList.add('hidden');
}

window.rimuoviAllegatoForm = function(index) {
    let allegatiList = JSON.parse(document.getElementById('form-allegati').value || '[]');
    allegatiList.splice(index, 1);
    document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
    window.renderAllegatiForm(allegatiList);
}

window.rinominaAllegatoForm = function(index) {
    let allegatiList = JSON.parse(document.getElementById('form-allegati').value || '[]');
    let nomeAttuale = allegatiList[index].originalName || '';

    window.apriRenameModal(nomeAttuale, (nuovoNome) => {
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
        div.className = "flex items-center justify-between p-2 bg-white border border-stone-300 rounded-sm shadow-sm gap-2 cursor-grab active:cursor-grabbing transition-transform";

        div.draggable = true;
        div.ondragstart = (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', i.toString());
            setTimeout(() => div.classList.add('opacity-40'), 0);
            window._draggedAttachmentIndex = i;
        };
        div.ondragend = () => {
            div.classList.remove('opacity-40');
            window._draggedAttachmentIndex = null;
            container.querySelectorAll(':scope > div').forEach(p => p.style.transform = '');
        };
        div.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = div.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            container.querySelectorAll(':scope > div').forEach(p => {
                if (p !== div && window._draggedAttachmentIndex !== i) p.style.transform = '';
            });
            if (window._draggedAttachmentIndex !== null && window._draggedAttachmentIndex !== i) {
                div.style.transform = e.clientX < mid ? 'translateX(10px)' : 'translateX(-10px)';
            }
        };
        div.ondragleave = () => div.style.transform = '';
        div.ondrop = (e) => {
            e.preventDefault();
            div.style.transform = '';
            const dragIndex = window._draggedAttachmentIndex;
            if (dragIndex !== null && dragIndex !== i) {
                let currentList = JSON.parse(document.getElementById('form-allegati').value || '[]');
                const item = currentList.splice(dragIndex, 1)[0];

                const rect = div.getBoundingClientRect();
                const mid = rect.left + rect.width / 2;
                let targetIndex = i;
                if (e.clientX > mid) targetIndex++;
                if (dragIndex < targetIndex) targetIndex--;

                currentList.splice(targetIndex, 0, item);
                document.getElementById('form-allegati').value = JSON.stringify(currentList);
                window.renderAllegatiForm(currentList);
            }
        };

        let content = '';
        if (al.tipo === 'pdf') {
            content = `
                <div class="flex items-center gap-2 truncate cursor-pointer hover:text-red-700 flex-1" onclick="apriPdfInterno('${al.nome}')">
                    <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-400 shrink-0"></i>
                    <i data-lucide="file-text" class="w-6 h-6 text-red-600 shrink-0"></i>
                    <span class="text-xs font-semibold truncate" title="${al.originalName || al.nome}">${al.originalName || 'PDF'}</span>
                </div>
            `;
        } else {
            let src = '';
            if (window.apiBrowser) src = 'local-asset://' + encodeURIComponent(al.nome);
            content = `
                <div class="flex items-center gap-2 truncate cursor-pointer hover:opacity-80 flex-1" onclick="apriModal('${src}', 'img')">
                    <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-400 shrink-0"></i>
                    <img src="${src}" class="w-8 h-8 object-cover rounded-sm border border-stone-200 shrink-0">
                    <span class="text-xs font-semibold truncate" title="${al.originalName || al.nome}">${al.originalName || 'Immagine'}</span>
                </div>
            `;
        }

        div.innerHTML = `
            ${content}
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" onclick="rinominaAllegatoForm(${i})" class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50" title="Rinomina">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button type="button" onclick="rimuoviAllegatoForm(${i})" class="text-stone-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Rimuovi">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        fragment.appendChild(div);
    }
    container.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

