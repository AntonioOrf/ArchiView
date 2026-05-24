// @ts-nocheck
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
        const isAttuale = fullPath === window.cartellaAttuale;

        // Mantieni espanso se è attuale o genitore dell'attuale
        if (window.cartellaAttuale.startsWith(fullPath)) {
            window.cartelleEspanse.add(fullPath);
        }

        const div = document.createElement('div');
        div.className = "flex flex-col";

        const riga = document.createElement('div');
        riga.className = `group flex items-center gap-1 p-1.5 rounded-sm cursor-pointer transition-colors text-sm sidebar-row ${isAttuale ? 'active' : ''}`;
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
            spanToggle.innerHTML = `<i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 sidebar-chevron transition-colors"></i>`;
            spanToggle.onclick = (e) => {
                e.stopPropagation();
                if (isExpanded) window.cartelleEspanse.delete(fullPath);
                else window.cartelleEspanse.add(fullPath);
                renderSidebar();
                if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
            };
        }

        // Icona Cartella
        const icona = isAttuale ? 'folder-open' : 'folder';
        const testo = document.createElement('span');
        testo.className = "truncate flex items-center gap-1.5 flex-1 select-none";
        testo.innerHTML = `<i data-lucide="${icona}" class="w-4 h-4 shrink-0 sidebar-icon"></i> ${escapeHTML(nodeName)}`;

        riga.appendChild(spanToggle);
        riga.appendChild(testo);
        
        const actionContainer = document.createElement('div');
        actionContainer.className = "opacity-0 group-hover:opacity-100 flex items-center transition-all";
        
        const btnRename = document.createElement('button');
        btnRename.className = "p-1 rounded mr-1 sidebar-action-btn rename";
        btnRename.innerHTML = `<i data-lucide="pencil" class="w-3.5 h-3.5"></i>`;
        btnRename.onclick = (e) => {
            e.stopPropagation();
            if (typeof window.rinominaCartellaDaSidebar === 'function') {
                window.rinominaCartellaDaSidebar(fullPath);
            }
        };
        actionContainer.appendChild(btnRename);

        const btnDelete = document.createElement('button');
        btnDelete.className = "p-1 rounded sidebar-action-btn delete";
        btnDelete.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>`;
        btnDelete.onclick = (e) => {
            e.stopPropagation();
            if (typeof window.eliminaCartellaDaSidebar === 'function') {
                window.eliminaCartellaDaSidebar(fullPath);
            }
        };
        actionContainer.appendChild(btnDelete);
        
        riga.appendChild(actionContainer);

        riga.onclick = () => {
            window.cartellaAttuale = fullPath;
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
            Object.keys(nodeObj.children).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(childName => {
                renderNode(childName, nodeObj.children[childName], childContainer, profondita + 1);
            });
            div.appendChild(childContainer);
        }

        parentEl.appendChild(div);
    }

    Object.keys(root).sort((a, b) => {
        if (a === 'Generale') return -1;
        if (b === 'Generale') return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }).forEach(k => renderNode(k, root[k], container, 0));

    // Area di drop speciale per spostare alla root (Generale)
    const dropRoot = document.createElement('div');
    dropRoot.className = "p-4 text-center text-xs text-stone-400 border-2 border-dashed border-transparent hover:border-stone-300 rounded mt-4 transition-colors select-none";
    dropRoot.textContent = window.t('drag_to_root');
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
    [...appData.cartelle].sort((a, b) => {
        if (a === 'Generale') return -1;
        if (b === 'Generale') return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        // Sostituisce la barra con una freccia per estetica nel menu a tendina
        opt.textContent = c.replace(/\//g, ' ⮞ ');
        if (c === window.cartellaAttuale) opt.selected = true;
        select.appendChild(opt);
    });
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
        container.innerHTML = `<div class="p-4 text-xs text-stone-400 italic text-center">${window.t('no_tags_found')}</div>`;
        return;
    }

    window.activeTags = window.activeTags || new Set();

    if (window.activeTags.size > 0) {
        document.getElementById('btn-clear-tag').classList.remove('hidden');
        document.getElementById('global-tag-search').value = Array.from(window.activeTags).join(', ');
    } else {
        document.getElementById('btn-clear-tag').classList.add('hidden');
        document.getElementById('global-tag-search').value = '';
    }

    const fragment = document.createDocumentFragment();
    sortedTags.forEach(tag => {
        const btn = document.createElement('button');
        const isActive = window.activeTags.has(tag);
        btn.className = `w-full text-left px-3 py-2 rounded-sm text-sm font-medium transition-colors flex justify-between items-center ${isActive ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-stone-50 text-stone-700 hover:bg-stone-200 border border-transparent'}`;
        btn.onclick = () => {
            if (isActive) {
                window.activeTags.delete(tag);
            } else {
                window.activeTags.add(tag);
            }
            renderMain();
            renderTagList();
        };
        btn.innerHTML = `<span>#${escapeHTML(tag)}</span>`;
        fragment.appendChild(btn);
    });
    container.appendChild(fragment);
}
