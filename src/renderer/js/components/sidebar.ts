// @ts-nocheck
// --- SIDEBAR ---

function renderSidebar() {
    const container = document.getElementById('folder-list');
    container.innerHTML = window.sanitizeHTML('');

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

    // Index pre-computato: path → manoscritti[], evita filter O(n) per ogni nodo
    const folderIndex = new Map<string, any[]>();
    for (const m of appData.manoscritti) {
        const key = m.cartella || '';
        if (!folderIndex.has(key)) folderIndex.set(key, []);
        folderIndex.get(key)!.push(m);
    }

    // Funzione ricorsiva per renderizzare
    function renderNode(nodeName, nodeObj, parentEl, profondita) {
        const fullPath = nodeObj.path;
        const filesInFolder = folderIndex.get(fullPath) || [];
        filesInFolder.sort((a, b) => {
            const valA = a.segnatura || a.titolo || '';
            const valB = b.segnatura || b.titolo || '';
            return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        });
        const hasChildren = Object.keys(nodeObj.children).length > 0 || filesInFolder.length > 0;
        const isAttuale = fullPath === window.cartellaAttuale;

        // Rimosso il force-expand per permettere di collassare la cartella attuale

        const div = document.createElement('div');
        div.className = "flex flex-col";

        const riga = document.createElement('div');
        riga.className = `group flex items-center gap-1 p-1.5 rounded-sm cursor-pointer transition-colors text-sm sidebar-row ${isAttuale ? 'active' : ''}`;
        riga.style.paddingLeft = `${profondita * 1.25 + 0.25}rem`;

        // Context Menu for Pasting
        riga.oncontextmenu = (e) => {
            if (typeof window.showSidebarFolderContextMenu === 'function') {
                window.showSidebarFolderContextMenu(e, fullPath);
            }
        };

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
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            riga.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50');
        };
        riga.ondragleave = (e) => {
            e.stopPropagation();
            riga.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50');
        };
        riga.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
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
            spanToggle.innerHTML = window.sanitizeHTML(`<i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 sidebar-chevron transition-colors"></i>`);
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
        testo.innerHTML = window.sanitizeHTML(`<i data-lucide="${icona}" class="w-4 h-4 shrink-0 sidebar-icon"></i> ${escapeHTML(nodeName)}`);

        riga.appendChild(spanToggle);
        riga.appendChild(testo);
        
        const actionContainer = document.createElement('div');
        actionContainer.className = "opacity-0 group-hover:opacity-100 flex items-center transition-all";
        
        const btnRename = document.createElement('button');
        btnRename.className = "p-1 rounded mr-1 sidebar-action-btn rename";
        btnRename.innerHTML = window.sanitizeHTML(`<i data-lucide="pencil" class="w-3.5 h-3.5"></i>`);
        btnRename.onclick = (e) => {
            e.stopPropagation();
            if (typeof window.rinominaCartellaDaSidebar === 'function') {
                window.rinominaCartellaDaSidebar(fullPath);
            }
        };
        actionContainer.appendChild(btnRename);

        const btnDelete = document.createElement('button');
        btnDelete.className = "p-1 rounded sidebar-action-btn delete";
        btnDelete.innerHTML = window.sanitizeHTML(`<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>`);
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

            // Render dei file
            filesInFolder.forEach(m => {
                const fileRow = document.createElement('div');
                const isSelected = window.selectedRecords && window.selectedRecords.includes(m.id);
                
                fileRow.className = `group flex items-center gap-1.5 p-1 rounded-sm cursor-pointer transition-colors text-xs ${isSelected ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}`;
                fileRow.style.paddingLeft = `${(profondita + 1) * 1.25 + 1.25}rem`;
                
                fileRow.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!window.selectedRecords.includes(m.id)) {
                        window.selectItem(m.id, e);
                    }
                    if (typeof showRecordContextMenu === 'function') {
                        showRecordContextMenu(e, m.id);
                    }
                };

                fileRow.onclick = (e) => {
                    e.stopPropagation();
                    if (window.cartellaAttuale !== fullPath) {
                        window.cartellaAttuale = fullPath;
                        if (typeof switchTab === 'function') switchTab('list');
                    }
                    if (typeof window.selectItem === 'function') {
                        window.selectItem(m.id, e);
                    }
                };
                


                const iconaFile = 'file-text';
                const titoloFile = escapeHTML(m.segnatura || m.titolo || 'Senza Titolo');
                
                fileRow.draggable = true;
                fileRow.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'manoscritto', id: m.id }));
                    e.dataTransfer.effectAllowed = 'move';
                    fileRow.classList.add('opacity-50');
                };
                fileRow.ondragend = () => fileRow.classList.remove('opacity-50');

                fileRow.innerHTML = window.sanitizeHTML(`<i data-lucide="${iconaFile}" class="w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-600' : 'opacity-60'}"></i><span class="truncate">${titoloFile}</span>`);
                childContainer.appendChild(fileRow);
            });

            div.appendChild(childContainer);
        }

        parentEl.appendChild(div);
    }

    const fragment = document.createDocumentFragment();
    Object.keys(root).sort((a, b) => {
        if (a === 'Generale') return -1;
        if (b === 'Generale') return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }).forEach(k => renderNode(k, root[k], fragment, 0));
    
    container.appendChild(fragment);

    // Imposta l'intera zona del container come drop per il root
    container.ondragover = (e) => { e.preventDefault(); container.classList.add('bg-stone-100'); };
    container.ondragleave = () => { container.classList.remove('bg-stone-100'); };
    container.ondrop = (e) => {
        e.preventDefault();
        container.classList.remove('bg-stone-100');
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'folder' && typeof spostaCartella !== 'undefined') spostaCartella(data.path, 'ROOT');
        } catch(err) {}
    };

    const sidebarFoldersContainer = document.getElementById('sidebar-folders');
    if (sidebarFoldersContainer) {
        sidebarFoldersContainer.oncontextmenu = (e) => {
            // Seleziona il click solo se non è all'interno di una sidebar-row
            const closestRow = e.target.closest('.sidebar-row');
            if (!closestRow) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.showSidebarFolderContextMenu === 'function') {
                    window.showSidebarFolderContextMenu(e, 'ROOT');
                }
            }
        };
    }

    if (window.lucide) lucide.createIcons({ nodes: [container] });
    if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
}

function aggiornaSelectCartelle() {
    const select = document.getElementById('form-cartella');
    select.innerHTML = window.sanitizeHTML('');
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

let _currentSidebarTab = 'folders';

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('hidden-tab');
}

function switchSidebarTab(tabName) {
    const sidebar = document.getElementById('sidebar');
    const isCurrentlyHidden = sidebar.classList.contains('hidden-tab');

    // Se clicco la stessa tab e la sidebar è aperta, la chiudo
    if (tabName === _currentSidebarTab && !isCurrentlyHidden) {
        sidebar.classList.add('hidden-tab');
        return;
    }

    // Altrimenti apro la sidebar e cambio tab
    sidebar.classList.remove('hidden-tab');
    _currentSidebarTab = tabName;

    // Active state visivo sul bottone tab corrispondente
    document.querySelectorAll('[data-tab]').forEach(btn => btn.classList.remove('tab-active'));
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('tab-active');

    document.getElementById('sidebar-folders').classList.add('hidden-tab');
    document.getElementById('sidebar-search').classList.add('hidden-tab');
    document.getElementById('sidebar-tags').classList.add('hidden-tab');
    const sourceControl = document.getElementById('sidebar-source-control');
    if (sourceControl) sourceControl.classList.add('hidden-tab');
    const historyPanel = document.getElementById('sidebar-history');
    if (historyPanel) historyPanel.classList.add('hidden-tab');

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
    if (tabName === 'source-control') {
        if (sourceControl) {
            sourceControl.classList.remove('hidden-tab');
            if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
        }
    }
    if (tabName === 'history') {
        if (historyPanel) {
            historyPanel.classList.remove('hidden-tab');
            if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
        }
    }
}

window.renderSourceControl = function() {
    const list = document.getElementById('source-control-list');
    const countLabel = document.getElementById('source-control-count');
    if (!list || !countLabel) return;

    list.innerHTML = window.sanitizeHTML('');
    
    const loadedAt = window.ultimoCaricamento || 0;
    const modificati = appData.manoscritti.filter(m => (m.lastModified || 0) > loadedAt);
    const incoming = window.incomingChanges || [];

    const incomingIndicator = document.getElementById('incoming-updates-indicator');
    const hasIncomingUpdates = incomingIndicator && !incomingIndicator.classList.contains('hidden');

    let totalCount = modificati.length + incoming.length;
    if (hasIncomingUpdates && incoming.length === 0) totalCount += 1;

    countLabel.textContent = totalCount.toString();

    if (modificati.length === 0 && incoming.length === 0 && !hasIncomingUpdates) {
        list.innerHTML = window.sanitizeHTML(`<div class="p-4 text-xs text-stone-400 italic text-center">${window.t("sidebar_no_pending", "No pending changes")}</div>`);
        return;
    }

    const fragment = document.createDocumentFragment();
    const structural = window.incomingStructuralChanges || [];

    if (hasIncomingUpdates && incoming.length === 0 && structural.length === 0) {
        const li = document.createElement('li');
        li.className = "group flex items-center justify-between py-1.5 px-3 hover:bg-stone-100 dark:hover:bg-stone-800 border-b border-stone-100 dark:border-stone-800/50 last:border-0 opacity-80 cursor-default";
        li.title = window.t("sidebar_structural_hint", "There are structural changes (e.g. folders or removals). Click Download on the top right.");
        li.innerHTML = window.sanitizeHTML(`
            <div class="flex items-center gap-2 truncate">
                <span class="text-blue-500 bg-blue-50 dark:bg-blue-900/20 w-4 h-4 flex items-center justify-center rounded-sm text-[10px] font-bold shrink-0">↓</span>
                <span class="text-sm font-medium truncate text-stone-700 dark:text-stone-300 italic">${window.t("sidebar_structural_updates", "Structural updates")}</span>
            </div>
            <div class="text-[10px] text-blue-500 font-bold shrink-0">CLOUD</div>
        `);
        fragment.appendChild(li);
    } else if (hasIncomingUpdates && structural.length > 0) {
        const li = document.createElement('li');
        li.className = "group flex flex-col py-1.5 px-3 hover:bg-stone-100 dark:hover:bg-stone-800 border-b border-stone-100 dark:border-stone-800/50 last:border-0";
        
        let detailsHtml = structural.map(s => `
            <div class="text-xs text-stone-500 italic ml-6 mt-1.5 flex items-center gap-1.5">
                <i data-lucide="${s.icon || 'corner-down-right'}" class="w-3.5 h-3.5 text-stone-400"></i> ${s.label}
            </div>
        `).join('');
        
        li.innerHTML = window.sanitizeHTML(`
            <details class="w-full cursor-pointer group/details">
                <summary class="flex items-center justify-between outline-none list-none select-none">
                    <div class="flex items-center gap-2 truncate">
                        <span class="text-blue-500 bg-blue-50 dark:bg-blue-900/20 w-4 h-4 flex items-center justify-center rounded-sm text-[10px] font-bold shrink-0">↓</span>
                        <span class="text-sm font-medium truncate text-stone-700 dark:text-stone-300 italic">${window.t("sidebar_structural_updates", "Structural updates")}</span>
                    </div>
                    <div class="text-[10px] text-blue-500 font-bold shrink-0 flex items-center gap-1">CLOUD <i data-lucide="chevron-down" class="w-3 h-3 transition-transform group-open/details:rotate-180"></i></div>
                </summary>
                <div class="mt-1 pb-1">
                    ${detailsHtml}
                </div>
            </details>
        `);
        fragment.appendChild(li);
    }

    const renderItem = (m, isIncoming) => {
        const isNew = m.lastModified === m.createdAt || (!m.createdAt && m.lastModified > loadedAt);
        let iconLetter = isNew ? 'A' : 'M';
        let colorClass = isNew ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
        
        if (isIncoming) {
            iconLetter = '↓';
            colorClass = 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
        }

        const li = document.createElement('li');
        li.className = "group flex items-center justify-between py-1.5 px-3 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer border-b border-stone-100 dark:border-stone-800/50 last:border-0";
        
        li.title = "Clicca per mostrare le modifiche";
        li.onclick = (e) => {
            e.stopPropagation();
            if (isIncoming) {
                const localeObj = appData.manoscritti.find(x => x.id === m.id);
                if (typeof window.apriDiffModal === 'function') {
                    window.apriDiffModal(localeObj || {}, m, `Diff dal Cloud: ${m.titolo || m.segnatura || 'Senza Titolo'}`);
                }
            } else {
                const baseObj = appData.baseObjects && appData.baseObjects[m.id];
                if (typeof window.apriDiffModal === 'function') {
                    window.apriDiffModal(baseObj || {}, m, `Modifiche Locali: ${m.titolo || m.segnatura || 'Senza Titolo'}`);
                }
            }
        };

        if (isIncoming) {
            li.classList.add('opacity-80');
        }

        const leftDiv = document.createElement('div');
        leftDiv.className = "flex items-center gap-2 overflow-hidden";
        
        const badge = document.createElement('span');
        badge.className = `shrink-0 flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold ${colorClass}`;
        badge.textContent = iconLetter;
        
        const textContainer = document.createElement('div');
        textContainer.className = "flex flex-col overflow-hidden";

        const titleSpan = document.createElement('span');
        titleSpan.className = "truncate text-stone-700 dark:text-stone-300 group-hover:text-amber-700 transition-colors";
        titleSpan.textContent = m.titolo || m.segnatura || 'Senza Titolo';
        
        const titleRowContainer = document.createElement('div');
        titleRowContainer.className = "flex flex-col";
        titleRowContainer.appendChild(titleSpan);

        const actionHint = document.createElement('span');
        actionHint.className = "text-[9px] text-amber-600 uppercase font-bold tracking-wider";
        actionHint.textContent = window.t("sidebar_click_to_show", "Click to show changes");
        titleRowContainer.appendChild(actionHint);
        
        textContainer.appendChild(titleRowContainer);
        
        if (isIncoming && window.incomingAuthor) {
            const authorSpan = document.createElement('span');
            authorSpan.className = "text-[10px] text-stone-400 truncate";
            authorSpan.textContent = window.t("sidebar_from", "from ") + window.incomingAuthor;
            textContainer.appendChild(authorSpan);
            li.title = window.t("sidebar_from_cloud_title", "Cloud change sent by {var0}. Do a Fetch/Download to see it.").replace("{var0}", window.incomingAuthor);
        }

        const autore = m.modificatoDa || m.creatoDa;
        if (autore) {
            const authorSpan = document.createElement('span');
            authorSpan.className = "text-[10px] text-stone-500 truncate leading-tight";
            authorSpan.textContent = window.t("sidebar_from_colon", "from: ") + autore;
            textContainer.appendChild(authorSpan);
        }

        leftDiv.appendChild(badge);
        leftDiv.appendChild(textContainer);

        li.appendChild(leftDiv);
        fragment.appendChild(li);
    };

    if (incoming.length > 0) {
        const header = document.createElement('div');
        header.className = "px-3 py-1.5 bg-blue-50/50 dark:bg-blue-900/10 text-[10px] font-bold text-blue-600 dark:text-blue-400 border-b border-blue-100 dark:border-blue-800";
        header.textContent = window.t("sidebar_incoming_cloud", "INCOMING (CLOUD)");
        fragment.appendChild(header);
        
        incoming.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        incoming.forEach(m => renderItem(m, true));
    }

    if (modificati.length > 0) {
        if (incoming.length > 0) {
            const header = document.createElement('div');
            header.className = "px-3 py-1.5 bg-stone-50 dark:bg-stone-800/50 text-[10px] font-bold text-stone-500 border-b border-stone-200 dark:border-stone-700 mt-2";
            header.textContent = window.t("sidebar_local_label", "LOCAL");
            fragment.appendChild(header);
        }
        modificati.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        modificati.forEach(m => renderItem(m, false));
    }
    
    list.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [list] });
};

function renderTagList() {
    const container = document.getElementById('tag-list');
    container.innerHTML = window.sanitizeHTML('');
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

    const allTags = Object.keys(tagCount).sort();

    if (allTags.length === 0) {
        container.innerHTML = window.sanitizeHTML(`<div class="p-4 text-xs text-stone-400 italic text-center">${window.t('no_tags_found')}</div>`);
        return;
    }

    window.activeTags = window.activeTags || new Set();

    document.getElementById('btn-clear-tag').classList.toggle('hidden', window.activeTags.size === 0);

    // Filtro live: mostra solo i tag che contengono il testo digitato (l'input non è più readonly)
    const filtro = (document.getElementById('global-tag-search')?.value || '').trim().toLowerCase();
    const sortedTags = filtro ? allTags.filter(t => t.includes(filtro)) : allTags;

    if (sortedTags.length === 0) {
        container.innerHTML = window.sanitizeHTML(`<div class="p-4 text-xs text-stone-400 italic text-center">${window.t('no_tags_found')}</div>`);
        return;
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
        btn.innerHTML = window.sanitizeHTML(`<span>#${escapeHTML(tag)}</span>`);
        fragment.appendChild(btn);
    });
    container.appendChild(fragment);
}

// --- VAULT SWITCHER ---

window.toggleVaultSwitcher = function(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const popover = document.getElementById('vault-switcher-popover');
    if (popover) {
        popover.classList.toggle('hidden-tab');
        if (!popover.classList.contains('hidden-tab')) {
            window.aggiornaListaVault();
        }
    }
};

window.rimuoviVaultDallaLista = async function(event, pathToRemove) {
    event.stopPropagation();
    event.preventDefault();
    
    const vaultName = pathToRemove.split(/[\\/\\\\]/).pop();
    
    const modalHtml = `
        <div id="vault-delete-modal" class="modal-overlay z-150 flex" style="background: rgba(0,0,0,0.5); align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
            <div class="modal-window p-6 text-center max-w-sm bg-white rounded-lg shadow-xl">
                <i data-lucide="alert-triangle" class="w-12 h-12 text-amber-500 mx-auto mb-4"></i>
                <h3 class="text-xl font-bold mb-2">Rimuovi Archivio</h3>
                <p class="text-sm text-stone-600 mb-6">
                    Vuoi solo rimuovere l'Archivio <strong>${vaultName}</strong> dall'elenco o eliminare definitivamente tutti i suoi file dal computer?
                </p>
                <div class="flex flex-col gap-2">
                    <button id="btn-delete-files" class="btn btn-danger w-full justify-center">Sì, elimina anche i file</button>
                    <button id="btn-remove-list" class="btn btn-secondary w-full justify-center">Rimuovi solo dall'elenco</button>
                    <button id="btn-cancel-delete" class="btn btn-ghost w-full justify-center mt-2">Annulla</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if (window.lucide) lucide.createIcons();
    
    const modal = document.getElementById('vault-delete-modal');
    
    return new Promise((resolve) => {
        const finishRemoval = async () => {
            const settings = await window.apiSettings.get();
            if (settings.recentWorkspaces) {
                settings.recentWorkspaces = settings.recentWorkspaces.filter(p => p !== pathToRemove);
                await window.apiSettings.save(settings);
                window.aggiornaListaVault();
            }
        };

        document.getElementById('btn-delete-files').onclick = async () => {
            modal.remove();
            if (window.apiBrowser && window.apiBrowser.deleteVaultLocal) {
                await window.apiBrowser.deleteVaultLocal(pathToRemove);
            }
            await finishRemoval();
            resolve();
        };
        
        document.getElementById('btn-remove-list').onclick = async () => {
            modal.remove();
            await finishRemoval();
            resolve();
        };
        
        document.getElementById('btn-cancel-delete').onclick = () => {
            modal.remove();
            resolve();
        };
    });
};

window.aggiornaListaVault = async function() {
    if (window.apiBrowser && window.apiBrowser.getRecentWorkspaces) {
        const recents = await window.apiBrowser.getRecentWorkspaces();
        const currentPath = await window.apiBrowser.getWorkspacePath();
        const list = document.getElementById('vault-switcher-list');
        if (list) {
            list.innerHTML = window.sanitizeHTML('');
            if (recents && recents.length > 0) {
                recents.forEach(item => {
                    const path = item.path || item;
                    const isShared = item.isShared || false;
                    const isPersonal = item.isPersonal || false;
                    const name = path.split(/[\/\\]/).pop();
                    const isCurrent = path === currentPath;
                    
                    const divContainer = document.createElement('div');
                    divContainer.className = `w-full text-left px-2 py-1.5 text-sm rounded flex items-center justify-between transition-colors ${isCurrent ? 'bg-amber-50 text-amber-900 font-semibold cursor-default' : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900 cursor-pointer'}`;
                    
                    if (!isCurrent) {
                        divContainer.onclick = () => {
                            window.apiBrowser.openRecentWorkspace(path);
                        };
                    } else {
                        divContainer.onclick = (e) => { e.stopPropagation(); }; // Non fa nulla
                    }
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'truncate pr-2 flex-1 flex items-center gap-1.5';
                    nameSpan.title = path;
                    
                    if (isShared) {
                        nameSpan.innerHTML = window.sanitizeHTML(`<i data-lucide="cloud" class="w-4 h-4 text-blue-600 shrink-0" title="${escapeHTML(window.t('vault_type_shared', 'Archivio Condiviso'))}"></i> <span>${name}</span>`);
                    } else if (isPersonal) {
                        nameSpan.innerHTML = window.sanitizeHTML(`<i data-lucide="cloud" class="w-4 h-4 text-emerald-600 shrink-0" title="${escapeHTML(window.t('vault_type_backup', 'Backup Personale'))}"></i> <span>${name}</span>`);
                    } else {
                        nameSpan.innerHTML = window.sanitizeHTML(`<i data-lucide="folder" class="w-4 h-4 text-stone-500 shrink-0" title="${escapeHTML(window.t('vault_type_local', 'Solo Locale'))}"></i> <span>${name}</span>`);
                    }
                    
                    divContainer.appendChild(nameSpan);

                    if (isCurrent) {
                        const checkIcon = document.createElement('div');
                        checkIcon.innerHTML = window.sanitizeHTML('<i data-lucide="check" class="w-4 h-4 text-amber-600 shrink-0"></i>');
                        divContainer.appendChild(checkIcon.firstChild);
                    } else {
                        const delBtn = document.createElement('button');
                        delBtn.className = 'p-1 rounded hover:bg-red-100 text-stone-400 hover:text-red-600 transition-colors shrink-0 opacity-50 hover:opacity-100';
                        delBtn.innerHTML = window.sanitizeHTML('<i data-lucide="x" class="w-3.5 h-3.5"></i>');
                        delBtn.onclick = (e) => window.rimuoviVaultDallaLista(e, path);
                        delBtn.title = "Rimuovi dalla lista";
                        divContainer.appendChild(delBtn);
                    }
                    
                    list.appendChild(divContainer);
                });
                if (window.lucide) lucide.createIcons({ nodes: [list] });
            }
        }
        
        // Aggiorna anche il nome nel pulsante
        const nameEl = document.getElementById('current-vault-name');
        if (nameEl && currentPath) {
            const vaultName = currentPath.split(/[\\/\\\\]/).pop();
            const currentVaultInfo = recents ? recents.find(r => r.path === currentPath || r === currentPath) : null;
            const isCurrentShared = currentVaultInfo && currentVaultInfo.isShared;
            const isCurrentPersonal = currentVaultInfo && currentVaultInfo.isPersonal;
            
            if (isCurrentShared) {
                nameEl.innerHTML = window.sanitizeHTML(`<div class="flex items-center gap-1.5"><i data-lucide="cloud" class="w-4 h-4 text-blue-600 shrink-0"></i> <span>${vaultName}</span></div>`);
                if (window.lucide) lucide.createIcons({ nodes: [nameEl] });
            } else if (isCurrentPersonal) {
                nameEl.innerHTML = window.sanitizeHTML(`<div class="flex items-center gap-1.5"><i data-lucide="cloud" class="w-4 h-4 text-emerald-600 shrink-0"></i> <span>${vaultName}</span></div>`);
                if (window.lucide) lucide.createIcons({ nodes: [nameEl] });
            } else {
                nameEl.innerHTML = window.sanitizeHTML(`<div class="flex items-center gap-1.5"><i data-lucide="folder" class="w-4 h-4 text-stone-500 shrink-0"></i> <span>${vaultName}</span></div>`);
                if (window.lucide) lucide.createIcons({ nodes: [nameEl] });
            }
            nameEl.title = currentPath;
        }
    }
};

document.addEventListener('click', function(e) {
    const popover = document.getElementById('vault-switcher-popover');
    if (popover && !popover.classList.contains('hidden-tab')) {
        // Chiudi se clicchi fuori
        if (!e.target.closest('#vault-switcher-popover') && !e.target.closest('.btn-ghost.w-full.justify-between')) {
            popover.classList.add('hidden-tab');
        }
    }
});
