// Stato globale per le cartelle espansive
window.cartelleEspanse = window.cartelleEspanse || new Set(['Generale']);

const CONFIG_CAMPI = {
    dataCronica: { label: 'Data Cronica', placeholder: 'Es. 12 Maggio 1340', type: 'text' },
    dataTopica: { label: 'Data Topica', placeholder: 'Es. Firenze', type: 'text' },
    autore: { label: 'Autore/i', placeholder: 'Es. Anonimo / Notaio', type: 'text' },
    titolo: { label: 'Titolo / Contenuto', placeholder: 'Titolo o descrizione sintetica', type: 'text' },
    note: { label: 'Note', placeholder: 'Note testuali o codicologiche', type: 'textarea' },
    prezzo: { label: 'Prezzo', placeholder: 'Es. 12 fiorini', type: 'text' },
    Marginalia: { label: 'Marginalia', placeholder: 'Note marginali...', type: 'textarea' },
    Notaio: { label: 'Notaio', placeholder: 'Nome del notaio', type: 'text' },
    tipo_di_atto: { label: 'Tipo di Atto', placeholder: 'Es. matrimonio, vendita, testamento...', type: 'text' },
    oggetto: { label: 'Oggetto', placeholder: 'Oggetto del documento', type: 'textarea' },
    elementi_economici: { label: 'Elementi Economici', placeholder: 'Dettagli economici...', type: 'textarea' },
    magistratura: { label: 'Magistratura', placeholder: 'Es. Podestà, Capitano del Popolo...', type: 'text' },
    tipo_di_atto_giur: { label: 'Tipo di Atto', placeholder: 'Es. accusa, inquisitione, testimoni, altro', type: 'text' },
    motivazione_processo: { label: 'Motivazione del Processo', placeholder: 'Causa e ragioni del processo...', type: 'textarea' },
    condanne: { label: 'Condanne', placeholder: 'Eventuali condanne, assoluzioni o pene...', type: 'textarea' },
    attori_dinamici: { label: 'Persone / Attori', type: 'dynamic_list', keyPlaceholder: 'Ruolo (es. Venditore)', valPlaceholder: 'Nome della persona' },
    dichiarante: { label: 'Dichiarante', placeholder: 'Es. famiglia, istituzione...', type: 'text' },
    beni_dinamici: { label: 'Beni (Proprietà)', type: 'dynamic_list', keyPlaceholder: 'Bene (es. Casa, Terreno)', valPlaceholder: 'Valore (es. 10 fiorini)' },
    debiti_dinamici: { label: 'Debiti', type: 'dynamic_list', keyPlaceholder: 'Creditore / Motivo', valPlaceholder: 'Ammontare' },
    crediti_dinamici: { label: 'Crediti', type: 'dynamic_list', keyPlaceholder: 'Debitore / Motivo', valPlaceholder: 'Ammontare' },
    famiglia_dinamici: { label: 'Familiari', type: 'dynamic_list', keyPlaceholder: 'Parentela (es. Figlio, Moglie)', valPlaceholder: 'Nome' }
};

// --- UTILITY CONDIVISE ---

/**
 * Normalizza la lista allegati di un manoscritto nel formato array unificato.
 * Elimina la duplicazione di questo pattern in actions.js e ui.js.
 */
function normalizzaAllegati(m) {
    if (!m.allegati) m.allegati = [];
    if (m.allegati.length === 0 && m.allegato) {
        m.allegati.push({ nome: m.allegato, tipo: m.allegatoTipo, originalName: 'Allegato' });
    }
    return m.allegati;
}

/**
 * Normalizza le cartelle intermedie mancanti in appData.cartelle.
 * SEPARATO da renderSidebar per evitare side-effects nel render.
 */
function normalizzaCartelle() {
    const cartelleSet = new Set(appData.cartelle);
    appData.cartelle.forEach(percorso => {
        let pathCorrente = '';
        percorso.split('/').forEach(part => {
            pathCorrente = pathCorrente ? pathCorrente + '/' + part : part;
            cartelleSet.add(pathCorrente);
        });
    });
    appData.cartelle = Array.from(cartelleSet).sort();
}

/**
 * Debounce: esegue fn solo dopo `wait` ms dall'ultimo invocazione.
 */
function debounce(fn, wait) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

// --- SIDEBAR ---

function renderSidebar() {
    const container = document.getElementById('folder-list');
    container.innerHTML = '';

    // Normalizza cartelle PRIMA del render (non come side-effect nel mezzo)
    normalizzaCartelle();

    // Costruisci l'albero
    const root = {};
    appData.cartelle.forEach(percorso => {
        const parti = percorso.split('/');
        let current = root;
        parti.forEach((part, i) => {
            const pathCompleto = parti.slice(0, i + 1).join('/');
            if (!current[part]) current[part] = { path: pathCompleto, children: {} };
            current = current[part].children;
        });
    });

    // Funzione ricorsiva per renderizzare
    function renderNode(nodeName, nodeObj, parentEl, profondita) {
        const fullPath = nodeObj.path;
        const hasChildren = Object.keys(nodeObj.children).length > 0;
        const isAttuale = fullPath === cartellaAttuale;

        // Mantieni espanso se è attuale o genitore dell'attuale
        if (cartellaAttuale.startsWith(fullPath)) {
            window.cartelleEspanse.add(fullPath);
        }

        const div = document.createElement('div');
        div.className = "flex flex-col";

        const riga = document.createElement('div');
        riga.className = `flex items-center gap-1 p-1.5 rounded-sm cursor-pointer transition-colors text-sm ${isAttuale ? 'bg-amber-100/80 text-amber-900 font-bold border border-amber-200 shadow-sm' : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'}`;
        riga.style.paddingLeft = `${profondita * 1.25 + 0.25}rem`;

        // Drag and Drop Logic
        riga.draggable = true;
        riga.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', path: fullPath }));
            e.dataTransfer.effectAllowed = 'move';
            riga.classList.add('opacity-50');
        };
        riga.ondragend = () => riga.classList.remove('opacity-50');

        riga.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            riga.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50');
        };
        riga.ondragleave = () => riga.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50');
        riga.ondrop = (e) => {
            e.preventDefault();
            riga.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50');
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.type === 'folder' && typeof spostaCartella !== 'undefined') {
                    if (data.path !== fullPath) spostaCartella(data.path, fullPath);
                } else if (data.type === 'manoscritto' && typeof spostaManoscritto !== 'undefined') {
                    spostaManoscritto(data.id, fullPath);
                }
            } catch(err) { console.error(err); }
        };

        // Icona espansione (Chevron)
        const spanToggle = document.createElement('span');
        spanToggle.className = "w-5 h-5 flex items-center justify-center shrink-0";
        if (hasChildren) {
            const isExpanded = window.cartelleEspanse.has(fullPath);
            spanToggle.innerHTML = `<i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 text-stone-500 hover:text-amber-700 transition-colors"></i>`;
            spanToggle.onclick = (e) => {
                e.stopPropagation();
                if (isExpanded) window.cartelleEspanse.delete(fullPath);
                else window.cartelleEspanse.add(fullPath);
                renderSidebar();
            };
        }

        // Icona Cartella
        const icona = isAttuale ? 'folder-open' : 'folder';
        const testo = document.createElement('span');
        testo.className = "truncate flex items-center gap-1.5 flex-1 select-none";
        testo.innerHTML = `<i data-lucide="${icona}" class="w-4 h-4 shrink-0 ${isAttuale ? 'text-amber-600' : 'text-stone-400'}"></i> ${nodeName}`;

        riga.appendChild(spanToggle);
        riga.appendChild(testo);

        riga.onclick = () => {
            cartellaAttuale = fullPath;
            window.cartelleEspanse.add(fullPath);
            document.getElementById('search-input').value = '';
            switchTab('list');
            renderSidebar();
            renderMain();
        };

        div.appendChild(riga);

        // Nodi Figli
        if (hasChildren && window.cartelleEspanse.has(fullPath)) {
            const childContainer = document.createElement('div');
            Object.keys(nodeObj.children).forEach(childName => {
                renderNode(childName, nodeObj.children[childName], childContainer, profondita + 1);
            });
            div.appendChild(childContainer);
        }

        parentEl.appendChild(div);
    }

    Object.keys(root).forEach(k => renderNode(k, root[k], container, 0));

    // Area di drop speciale per spostare alla root (Generale)
    const dropRoot = document.createElement('div');
    dropRoot.className = "p-4 text-center text-xs text-stone-400 border-2 border-dashed border-transparent hover:border-stone-300 rounded mt-4 transition-colors select-none";
    dropRoot.textContent = "Trascina qui per spostare in radice";
    dropRoot.ondragover = (e) => { e.preventDefault(); dropRoot.classList.add('border-amber-400', 'bg-amber-50'); };
    dropRoot.ondragleave = () => { dropRoot.classList.remove('border-amber-400', 'bg-amber-50'); };
    dropRoot.ondrop = (e) => {
        e.preventDefault();
        dropRoot.classList.remove('border-amber-400', 'bg-amber-50');
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'folder' && typeof spostaCartella !== 'undefined') spostaCartella(data.path, 'ROOT');
        } catch(err) {}
    };
    container.appendChild(dropRoot);

    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

function aggiornaSelectCartelle() {
    const select = document.getElementById('form-cartella');
    select.innerHTML = '';
    [...appData.cartelle].sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        // Sostituisce la barra con una freccia per estetica nel menu a tendina
        opt.textContent = c.replace(/\//g, ' ⮞ ');
        if (c === cartellaAttuale) opt.selected = true;
        select.appendChild(opt);
    });
}

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
    
    const inputVal = document.createElement('input');
    inputVal.type = 'text';
    inputVal.className = 'form-input flex-1 list-val';
    inputVal.placeholder = placeholderVal || 'Valore';
    inputVal.value = valVal;
    
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

// renderMain è sincrona: non usa await, non deve essere async
function renderMain() {
    const grid = document.getElementById('manoscritti-grid');
    const search = document.getElementById('search-input').value.toLowerCase();
    const tagSearch = (document.getElementById('global-tag-search').value || '').toLowerCase();

    const isGlobalSearch = search !== '' || tagSearch !== '';

    if (isGlobalSearch) {
        document.getElementById('titolo-cartella-attuale').textContent = "Risultati Ricerca Globale";
    } else {
        const partiTitolo = cartellaAttuale.split('/');
        document.getElementById('titolo-cartella-attuale').textContent = partiTitolo[partiTitolo.length - 1];
    }

    // Filtro per Cartella (se non globale) E per Ricerca E per Tag
    const filtered = appData.manoscritti.filter(m => {
        const matchCartella = isGlobalSearch ? true : m.cartella === cartellaAttuale;

        const tipoDoc = appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'));
        const campiPossibili = tipoDoc ? tipoDoc.campi : ['titolo', 'autore', 'note'];
        const matchSearch = search === '' || (m.segnatura||'').toLowerCase().includes(search) || campiPossibili.some(campo => (m[campo] || '').toString().toLowerCase().includes(search));

        const mTags = (m.tags || '').toLowerCase();
        const matchTag = tagSearch === '' || mTags.includes(tagSearch);

        return matchCartella && matchSearch && matchTag;
    });

    document.getElementById('counter-results').textContent = `Documenti trovati: ${filtered.length}`;
    grid.innerHTML = '';

    const btnDeleteFolder = document.getElementById('btn-delete-folder');

    if (filtered.length === 0) {
        grid.classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');

        const manoscrittiTotaliInCartella = appData.manoscritti.filter(m => m.cartella === cartellaAttuale).length;
        if (manoscrittiTotaliInCartella === 0 && cartellaAttuale !== 'Generale' && search === '') {
            btnDeleteFolder.classList.remove('hidden');
            btnDeleteFolder.classList.add('flex');
        } else {
            btnDeleteFolder.classList.add('hidden');
            btnDeleteFolder.classList.remove('flex');
        }
    } else {
        grid.classList.remove('hidden');
        document.getElementById('empty-state').classList.add('hidden');

        // Creazione Card con DocumentFragment per un unico reflow DOM
        const fragment = document.createDocumentFragment();

        for (const m of filtered) {
            const div = document.createElement('div');
            div.className = "card-scheda";

            // Logica Drag and Drop
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'manoscritto', id: m.id }));
                e.dataTransfer.effectAllowed = 'move';
                div.classList.add('opacity-50');
            };
            div.ondragend = () => div.classList.remove('opacity-50');

            const allegatiRender = normalizzaAllegati(m);

            let allegatoHTML = '';
            const btnTrascriviModifica = `
                <button onclick="editItem('${m.id}')" class="btn btn-secondary flex-1 text-xs uppercase tracking-wider">
                    <span class="text-xs font-bold uppercase tracking-wider">Modifica</span>
                </button>
                <button onclick="apriTrascrizione('${m.id}')" class="btn flex-1 text-xs uppercase tracking-wider" style="background-color: var(--color-primary-light); color: var(--color-primary-hover); border: 1px solid var(--color-primary-border);">
                    <span class="text-xs font-bold uppercase tracking-wider">Trascrivi</span>
                </button>
            `;

            let btnVediPdfPiccolo = '';

            if (allegatiRender.length > 0 && window.apiBrowser) {
                btnVediPdfPiccolo = `<button onclick="apriModalDocumenti('${m.id}')" class="btn btn-ghost text-xs uppercase tracking-wider"> Mostra Documenti (${allegatiRender.length})</button>`;
                allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
            } else {
                allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
            }

            let tagsHTML = '';
            if (m.tags) {
                const tagsList = m.tags.split(',').map(t => t.trim()).filter(t => t);
                if (tagsList.length > 0) {
                    tagsHTML = '<div class="flex flex-wrap gap-1 mt-2">' + tagsList.map(t => `<span class="card-tag">${t}</span>`).join('') + '</div>';
                }
            }

            let infoHTML = '';
            const tipoDoc = appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'));
            const campiPossibili = tipoDoc ? tipoDoc.campi : ['titolo', 'autore', 'note'];
            campiPossibili.forEach(campo => {
                if (m[campo]) {
                    let conf = CONFIG_CAMPI[campo] || { type: 'text' };
                    if (conf.type === 'dynamic_list' && Array.isArray(m[campo])) {
                        if (m[campo].length > 0) {
                            const labelStr = conf.label || campo;
                            infoHTML += `<div class="mt-3 mb-1"><span class="font-bold text-xs uppercase tracking-wider opacity-70 border-b border-stone-200/50 pb-1">${labelStr}</span></div>`;
                            m[campo].forEach(item => {
                                const k = item.k || item.ruolo || '';
                                const v = item.v || item.nome || '';
                                if (k || v) {
                                    infoHTML += `<p class="truncate pl-2 border-l-2 border-amber-200/50 mb-0.5"><b>${k}:</b> ${v}</p>`;
                                }
                            });
                        }
                    } else {
                        const label = conf.label || campo;
                        if (campo === 'note') infoHTML += `<p class="text-stone-500 mt-2 text-xs italic line-clamp-3 leading-relaxed border-l-2 border-amber-200 pl-2" title="${m.note.replace(/"/g, '&quot;')}">${m.note}</p>`;
                        else if (campo === 'titolo') infoHTML += `<p class="truncate mt-1"><b>${label}:</b> <i>${m.titolo}</i></p>`;
                        else infoHTML += `<p class="truncate mt-1"><b>${label}:</b> ${m[campo]}</p>`;
                    }
                }
            });

            div.innerHTML = `
                <div>
                    <div class="flex justify-between items-start gap-2 mb-2">
                        <h3 class="card-title mb-0" title="${m.segnatura}">${m.segnatura}</h3>
                        <span class="card-badge shrink-0 mt-0">${tipoDoc ? tipoDoc.nome : 'Documento'}</span>
                    </div>
                    <div class="space-y-1 text-sm">
                        ${infoHTML}
                        ${tagsHTML}
                    </div>
                    ${allegatoHTML}
                </div>
                <div class="mt-3 pt-3 border-t border-amber-100 flex justify-end gap-2">
                    ${btnVediPdfPiccolo}
                    <button onclick="deleteItem('${m.id}')" class="btn btn-ghost btn-icon" style="color: var(--color-danger);"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            `;
            fragment.appendChild(div);
        }

        grid.appendChild(fragment);
    }
    // createIcons scoped solo alla grid, non all'intero documento
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
}

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
    document.getElementById('form-cartella').value = cartellaAttuale;
    document.getElementById('form-title').textContent = "Compila Nuova Scheda";
    document.getElementById('btn-cancel-edit').classList.add('hidden');
}

function switchTab(tab) {
    const vList = document.getElementById('view-list');
    const vAdd = document.getElementById('view-add');
    const vTrascrizione = document.getElementById('view-trascrizione');

    vList.classList.add('hidden-tab');
    vAdd.classList.add('hidden-tab');
    if (vTrascrizione) vTrascrizione.classList.add('hidden-tab');

    if (tab === 'list') {
        vList.classList.remove('hidden-tab');
        resetForm(); renderMain();
    } else if (tab === 'add') {
        vAdd.classList.remove('hidden-tab');
        aggiornaSelectCartelle();
        aggiornaSelectTipiDocumento();
    } else if (tab === 'trascrizione') {
        if (vTrascrizione) vTrascrizione.classList.remove('hidden-tab');
    }
}

window.apriPdfInterno = async function(fileName) {
    if (window.apiBrowser) {
        apriModal('local-asset://' + encodeURIComponent(fileName), 'pdf');
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

function toggleSidebar() {
    // classList.toggle elimina il check ridondante contains+add/remove
    document.getElementById('sidebar').classList.toggle('hidden-tab');
}

function switchSidebarTab(tabName) {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('hidden-tab');

    document.getElementById('sidebar-folders').classList.add('hidden-tab');
    document.getElementById('sidebar-search').classList.add('hidden-tab');
    document.getElementById('sidebar-tags').classList.add('hidden-tab');

    if (tabName === 'folders') document.getElementById('sidebar-folders').classList.remove('hidden-tab');
    if (tabName === 'search') {
        document.getElementById('sidebar-search').classList.remove('hidden-tab');
        document.getElementById('search-input').focus();
        renderSearchSuggestions();
    }
    if (tabName === 'tags') {
        document.getElementById('sidebar-tags').classList.remove('hidden-tab');
        renderTagList();
    }
}

function renderSearchSuggestions() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const container = document.getElementById('search-suggestions');
    container.innerHTML = '';

    if (!search) {
        container.innerHTML = '<div class="p-4 text-xs text-stone-400 italic text-center">Digita per vedere i risultati...</div>';
        return;
    }

    const matches = appData.manoscritti.filter(m =>
        (m.segnatura||'').toLowerCase().includes(search) ||
        (m.titolo||'').toLowerCase().includes(search) ||
        (m.autore||'').toLowerCase().includes(search)
    ).slice(0, 10); // Massimo 10 suggerimenti

    if (matches.length === 0) {
        container.innerHTML = '<div class="p-4 text-xs text-stone-400 italic text-center">Nessun match esatto nei titoli/autori.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    matches.forEach(m => {
        const div = document.createElement('div');
        div.className = "p-2 border-b border-stone-200 hover:bg-amber-50 cursor-pointer transition-colors";
        div.onclick = () => {
            document.getElementById('search-input').value = m.segnatura;
            renderMain();
            renderSearchSuggestions();
        };
        div.innerHTML = `
            <div class="text-xs font-bold text-stone-700 truncate">${m.segnatura}</div>
            ${m.titolo ? `<div class="text-[10px] text-stone-500 truncate mt-0.5"><i>${m.titolo}</i></div>` : ''}
            ${m.autore ? `<div class="text-[10px] text-stone-500 truncate mt-0.5"><b>Autore:</b> ${m.autore}</div>` : ''}
        `;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
}

function renderTagList() {
    const container = document.getElementById('tag-list');
    container.innerHTML = '';
    const tagCount = {};

    // Calcola le occorrenze dei tag
    appData.manoscritti.forEach(m => {
        if (m.tags) {
            m.tags.split(',').forEach(tag => {
                const t = tag.trim().toLowerCase();
                if (t) tagCount[t] = (tagCount[t] || 0) + 1;
            });
        }
    });

    const sortedTags = Object.keys(tagCount).sort();

    if (sortedTags.length === 0) {
        container.innerHTML = '<div class="p-4 text-xs text-stone-400 italic text-center">Nessun tag utilizzato nel database.</div>';
        return;
    }

    const activeTag = document.getElementById('global-tag-search').value.toLowerCase();

    if (activeTag) {
        document.getElementById('btn-clear-tag').classList.remove('hidden');
    } else {
        document.getElementById('btn-clear-tag').classList.add('hidden');
    }

    const fragment = document.createDocumentFragment();
    sortedTags.forEach(tag => {
        const btn = document.createElement('button');
        const isActive = tag === activeTag;
        btn.className = `w-full text-left px-3 py-2 rounded-sm text-sm font-medium transition-colors flex justify-between items-center ${isActive ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-stone-50 text-stone-700 hover:bg-stone-200 border border-transparent'}`;
        btn.onclick = () => {
            document.getElementById('global-tag-search').value = isActive ? '' : tag;
            renderMain();
            renderTagList();
        };
        btn.innerHTML = `<span>#${tag}</span><span class="text-[10px] bg-white/50 px-1.5 py-0.5 rounded text-stone-500">${tagCount[tag]}</span>`;
        fragment.appendChild(btn);
    });
    container.appendChild(fragment);
}

// Il container toast è già in HTML: niente check dinamico
window.mostraMessaggio = function(testo, tipo = 'info') {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    const bgClass = tipo === 'error' ? 'bg-red-600' : (tipo === 'success' ? 'bg-green-600' : 'bg-stone-800');
    toast.className = `${bgClass} text-white px-4 py-3 rounded-sm shadow-lg text-sm font-medium flex items-center gap-2 opacity-0 transition-opacity duration-300 pointer-events-auto`;

    let icon = 'info';
    if (tipo === 'success') icon = 'check-circle';
    if (tipo === 'error') icon = 'alert-triangle';

    toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 shrink-0"></i> <span>${testo}</span>`;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });

    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('opacity-0')));

    setTimeout(() => { toast.classList.add('opacity-0'); setTimeout(() => toast.remove(), 300); }, 3500);
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
        container.innerHTML = '<div class="col-span-full text-center text-stone-500 py-10">Nessun documento allegato.</div>';
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
                <span class="text-sm font-semibold text-stone-700 truncate flex-1 text-left" title="${defaultName}">${defaultName}</span>
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
        await salvaTutto();
        if (typeof renderMain === 'function') renderMain();
        window.apriModalDocumenti(id);
    });
}
