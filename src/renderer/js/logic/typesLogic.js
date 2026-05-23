
let editingTypeId = null;

function apriNewTypeModal() {
    editingTypeId = null;
    document.getElementById('new-type-select').value = 'custom';
    document.getElementById('new-type-select').disabled = false;
    document.getElementById('btn-salva-tipo').textContent = 'Crea';
    document.querySelector('#new-type-modal .modal-title').textContent = 'Crea Tipo Documento';
    applicaModello();
    document.getElementById('new-type-modal').classList.remove('hidden-tab');
}

function chiudiNewTypeModal() {
    document.getElementById('new-type-modal').classList.add('hidden-tab');
    editingTypeId = null;
}

const MODELLI_PREDEFINITI = {
    imbreviature: { nome: 'Imbreviature Notarili', campi: ['Marginalia', 'Notaio', 'dataCronica', 'dataTopica', 'attori_dinamici', 'tipo_di_atto', 'oggetto', 'elementi_economici'] },
    atti: { nome: 'Atti Giudiziari', campi: ['dataCronica', 'magistratura', 'attori_dinamici', 'tipo_di_atto_giur', 'motivazione_processo', 'condanne', 'note'] },
    fiscali: { nome: 'Documenti Fiscali', campi: ['dichiarante', 'beni_dinamici', 'debiti_dinamici', 'crediti_dinamici', 'famiglia_dinamici', 'note'] }
};

function applicaModello() {
    const sel = document.getElementById('new-type-select').value;
    const nameInput = document.getElementById('custom-type-name');
    const extraInput = document.getElementById('custom-type-extra-input');
    const placeholder = document.getElementById('empty-fields-placeholder');
    
    // Pulisce il form
    nameInput.value = '';
    if (extraInput) extraInput.value = '';
    
    // Rimuove pillole
    document.querySelectorAll('.custom-field-item').forEach(el => el.remove());
    if (placeholder) placeholder.classList.remove('hidden');

    document.querySelectorAll('.custom-type-field').forEach(cb => cb.checked = false);

    // Seleziona campi in base al modello
    if (sel !== 'custom') {
        const modello = MODELLI_PREDEFINITI[sel];
        nameInput.value = modello.nome;
        modello.campi.forEach(campoId => {
            const cb = document.querySelector(`.custom-type-field[value="${campoId}"]`);
            if (cb) {
                cb.checked = true;
                aggiungiPill(campoId, cb.dataset.label || campoId, true);
            } else {
                aggiungiPill(campoId, campoId, false);
            }
        });
    }
}

function toggleCampoBase(cb) {
    if (cb.checked) {
        aggiungiPill(cb.value, cb.dataset.label || cb.value, true);
    } else {
        rimuoviPill(cb.value);
    }
}

function aggiungiCampoCustom() {
    const input = document.getElementById('custom-type-extra-input');
    const val = input.value.trim();
    if (val) {
        aggiungiPill(val, val, false);
        input.value = '';
    }
}

function aggiungiPill(val, label, isBase) {
    const existing = Array.from(document.querySelectorAll('.custom-field-item')).map(el => el.dataset.val.toLowerCase());
    if (existing.includes(val.toLowerCase())) return;
    
    const list = document.getElementById('custom-fields-list');
    const placeholder = document.getElementById('empty-fields-placeholder');
    if (placeholder) placeholder.classList.add('hidden');

    const pill = document.createElement('div');
    pill.className = "custom-field-item flex items-center gap-1 px-2 py-1.5 bg-white border border-stone-300 text-stone-800 rounded-sm text-sm font-medium shadow-sm cursor-grab active:cursor-grabbing transition-transform";
    pill.dataset.val = val;
    pill.draggable = true;

    pill.ondragstart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', val);
        setTimeout(() => pill.classList.add('opacity-40'), 0);
        window._draggedPill = pill;
    };
    
    pill.ondragend = (e) => {
        pill.classList.remove('opacity-40');
        window._draggedPill = null;
        document.querySelectorAll('.custom-field-item').forEach(p => p.style.transform = '');
    };
    
    pill.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = pill.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        
        document.querySelectorAll('.custom-field-item').forEach(p => {
            if (p !== pill && p !== window._draggedPill) p.style.transform = '';
        });
        
        if (window._draggedPill && window._draggedPill !== pill) {
            pill.style.transform = e.clientX < mid ? 'translateX(10px)' : 'translateX(-10px)';
        }
    };
    
    pill.ondragleave = (e) => pill.style.transform = '';
    
    pill.ondrop = (e) => {
        e.preventDefault();
        pill.style.transform = '';
        if (window._draggedPill && window._draggedPill !== pill) {
            const rect = pill.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            if (e.clientX < mid) list.insertBefore(window._draggedPill, pill);
            else list.insertBefore(window._draggedPill, pill.nextSibling);
        }
    };

    pill.innerHTML = `
        <i data-lucide="grip-horizontal" class="w-3 h-3 text-stone-400 mr-1"></i>
        <span>${label}</span>
        <button type="button" onclick="rimuoviPillDalPulsante(this, '${val.replace(/'/g, "\\'")}')" class="text-stone-400 hover:text-red-600 focus:outline-none ml-1 transition-colors"><i data-lucide="x" class="w-3 h-3"></i></button>
    `;
    list.appendChild(pill);
    if (window.lucide) lucide.createIcons({ nodes: [pill] });
    
    if (isBase) {
        const cb = document.querySelector(`.custom-type-field[value="${val}"]`);
        if (cb) cb.checked = true;
    }
}

function rimuoviPillDalPulsante(btn, val) {
    btn.parentElement.remove();
    const cb = document.querySelector(`.custom-type-field[value="${val}"]`);
    if (cb) cb.checked = false;
    
    if (document.querySelectorAll('.custom-field-item').length === 0) {
        const placeholder = document.getElementById('empty-fields-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
    }
}

function rimuoviPill(val) {
    const pill = document.querySelector(`.custom-field-item[data-val="${val}"]`);
    if (pill) pill.remove();
    
    if (document.querySelectorAll('.custom-field-item').length === 0) {
        const placeholder = document.getElementById('empty-fields-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
    }
}

function confermaCreaTipo() {
    const nome = document.getElementById('custom-type-name').value.trim();
    if (!nome) { 
        mostraMessaggio("Inserisci un nome per il tipo di documento.", "error"); 
        return; 
    }
    
    const campi = [];
    document.querySelectorAll('.custom-field-item').forEach(pill => {
        campi.push(pill.dataset.val);
    });
    
    if (campi.length === 0) {
        mostraMessaggio("Aggiungi almeno un campo alla scheda.", "error");
        return;
    }

    if (editingTypeId) {
        // Aggiorna tipo esistente
        const index = appData.tipiDocumento.findIndex(t => t.id === editingTypeId);
        if (index !== -1) {
            appData.tipiDocumento[index].nome = nome;
            appData.tipiDocumento[index].campi = campi;
            salvaTutto();
            aggiornaSelectTipiDocumento();
            chiudiNewTypeModal();
            mostraMessaggio("Tipo di documento aggiornato con successo.", "success");
        }
    } else {
        // Crea nuovo tipo
        const sel = document.getElementById('new-type-select').value;
        const prefissoId = sel !== 'custom' ? sel : 'custom';
        const id = prefissoId + '_' + Date.now();
        
        appData.tipiDocumento.push({ id, nome, campi });
        salvaTutto();
        aggiornaSelectTipiDocumento();
        chiudiNewTypeModal();
        mostraMessaggio("Nuovo tipo di documento creato con successo.", "success");
    }
}

function apriManageTypesModal() {
    const listContainer = document.getElementById('manage-types-list');
    listContainer.innerHTML = '';
    
    const defaultIds = ['imbreviature', 'atti', 'fiscali'];
    
    appData.tipiDocumento.forEach(tipo => {
        const isDefault = defaultIds.includes(tipo.id);
        const inUso = appData.manoscritti.some(m => m.tipoDocumento === tipo.id);
        
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center p-3 bg-stone-50 border border-stone-200 rounded-sm';
        
        let inUsoBadge = inUso ? '<span class="text-[10px] uppercase font-bold tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-2">In uso</span>' : '';
        let defaultBadge = isDefault ? '<span class="text-[10px] uppercase font-bold tracking-wider text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full ml-2">Predefinito</span>' : '';
        
        let buttonsHTML = '';
        if (isDefault) {
            buttonsHTML = '<span class="text-xs text-stone-400 italic">Non modificabile</span>';
        } else {
            buttonsHTML = `
                <button type="button" onclick="modificaTipoDocumento('${tipo.id}')" class="btn btn-ghost btn-icon text-stone-600 hover:text-amber-700 hover:bg-amber-50" title="Modifica"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                <button type="button" onclick="eliminaTipoDocumento('${tipo.id}')" class="btn btn-ghost btn-icon text-red-500 hover:text-red-700 hover:bg-red-50" title="Elimina"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            `;
        }

        div.innerHTML = `
            <div class="flex items-center">
                <span class="font-medium text-stone-800">${tipo.nome}</span>
                ${defaultBadge}
                ${inUsoBadge}
            </div>
            <div class="flex gap-1">
                ${buttonsHTML}
            </div>
        `;
        listContainer.appendChild(div);
    });
    
    if (window.lucide) lucide.createIcons({ nodes: [listContainer] });
    document.getElementById('manage-types-modal').classList.remove('hidden-tab');
}

function chiudiManageTypesModal() {
    document.getElementById('manage-types-modal').classList.add('hidden-tab');
}

window.eliminaTipoDocumento = function(id) {
    const inUso = appData.manoscritti.some(m => m.tipoDocumento === id);
    if (inUso) {
        mostraMessaggio("Non puoi eliminare questo modello perché ci sono schede che lo utilizzano.", "error");
        return;
    }
    
    if (confirm("Sei sicuro di voler eliminare questo modello?")) {
        appData.tipiDocumento = appData.tipiDocumento.filter(t => t.id !== id);
        salvaTutto();
        aggiornaSelectTipiDocumento();
        apriManageTypesModal(); // Ricarica la lista
        mostraMessaggio("Modello eliminato con successo.", "success");
    }
};

window.modificaTipoDocumento = function(id) {
    const tipo = appData.tipiDocumento.find(t => t.id === id);
    if (!tipo) return;
    
    chiudiManageTypesModal();
    
    // Configura UI per modifica
    editingTypeId = id;
    document.getElementById('new-type-select').value = 'custom';
    document.getElementById('new-type-select').disabled = true; // Impedisce di cambiare base durante modifica
    document.getElementById('btn-salva-tipo').textContent = 'Salva Modifiche';
    document.querySelector('#new-type-modal .modal-title').textContent = 'Modifica Tipo Documento';
    
    // Resetta UI
    document.getElementById('custom-type-name').value = tipo.nome;
    document.getElementById('custom-type-extra-input').value = '';
    document.querySelectorAll('.custom-field-item').forEach(el => el.remove());
    document.querySelectorAll('.custom-type-field').forEach(cb => cb.checked = false);
    
    // Popola campi
    tipo.campi.forEach(campoId => {
        const checkbox = document.querySelector(`.custom-type-field[value="${campoId}"]`);
        if (checkbox) {
            checkbox.checked = true;
            aggiungiPill(campoId, checkbox.dataset.label);
        } else {
            // Campo custom
            let label = campoId;
            if (CONFIG_CAMPI[campoId]) label = CONFIG_CAMPI[campoId].label;
            aggiungiPill(campoId, label);
        }
    });
    
    document.getElementById('new-type-modal').classList.remove('hidden-tab');
};

