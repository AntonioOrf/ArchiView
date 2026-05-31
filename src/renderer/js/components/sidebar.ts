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
        const filesInFolder = appData.manoscritti.filter(m => m.cartella === fullPath);
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

            // Render dei file
            filesInFolder.forEach(m => {
                const fileRow = document.createElement('div');
                fileRow.className = `group flex items-center gap-1.5 p-1 rounded-sm cursor-pointer transition-colors text-xs text-stone-600 hover:bg-stone-100 hover:text-stone-900`;
                fileRow.style.paddingLeft = `${(profondita + 1) * 1.25 + 1.25}rem`;
                
                fileRow.onclick = (e) => {
                    e.stopPropagation();
                    if (window.cartellaAttuale !== fullPath) {
                        window.cartellaAttuale = fullPath;
                    }
                    if (typeof switchTab === 'function') switchTab('list');
                    renderSidebar();
                    if (typeof renderMain === 'function') renderMain();
                    
                    setTimeout(() => {
                        const targetCard = document.getElementById('card-' + m.id);
                        if (targetCard) {
                            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            targetCard.style.transition = "box-shadow 0.3s ease, border-color 0.3s ease";
                            const oldShadow = targetCard.style.boxShadow;
                            const oldBorder = targetCard.style.borderColor;
                            targetCard.style.boxShadow = "0 0 0 4px rgba(251, 191, 36, 0.4)";
                            targetCard.style.borderColor = "#f59e0b";
                            setTimeout(() => {
                                targetCard.style.boxShadow = oldShadow;
                                targetCard.style.borderColor = oldBorder;
                            }, 1500);
                        }
                    }, 50);
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

                fileRow.innerHTML = `<i data-lucide="${iconaFile}" class="w-3.5 h-3.5 shrink-0 opacity-60"></i><span class="truncate">${titoloFile}</span>`;
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

    requestAnimationFrame(() => {
        if (window.lucide) lucide.createIcons({ nodes: [container] });
    });
    if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
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

    document.getElementById('sidebar-folders').classList.add('hidden-tab');
    document.getElementById('sidebar-search').classList.add('hidden-tab');
    document.getElementById('sidebar-tags').classList.add('hidden-tab');
    const sourceControl = document.getElementById('sidebar-source-control');
    if (sourceControl) sourceControl.classList.add('hidden-tab');

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
}

window.renderSourceControl = function() {
    const list = document.getElementById('source-control-list');
    const countLabel = document.getElementById('source-control-count');
    if (!list || !countLabel) return;

    list.innerHTML = '';
    
    const loadedAt = window.ultimoCaricamento || 0;
    const modificati = appData.manoscritti.filter(m => (m.lastModified || 0) > loadedAt);
    const incoming = window.incomingChanges || [];

    countLabel.textContent = (modificati.length + incoming.length).toString();

    if (modificati.length === 0 && incoming.length === 0) {
        list.innerHTML = `<div class="p-4 text-xs text-stone-400 italic text-center">Nessuna modifica pendente</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();

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
        if (!isIncoming) {
            li.onclick = () => {
                if (typeof apriForm === 'function') apriForm(m.id);
            };
        } else {
            li.title = "Modifica dal Cloud. Fai un Fetch/Scarica per vederla nel dettaglio.";
            li.classList.add('opacity-80');
        }

        const leftDiv = document.createElement('div');
        leftDiv.className = "flex items-center gap-2 overflow-hidden";
        
        const badge = document.createElement('span');
        badge.className = `shrink-0 flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold ${colorClass}`;
        badge.textContent = iconLetter;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = "truncate text-stone-700 dark:text-stone-300";
        titleSpan.textContent = m.titolo || m.segnatura || 'Senza Titolo';

        leftDiv.appendChild(badge);
        leftDiv.appendChild(titleSpan);

        li.appendChild(leftDiv);
        fragment.appendChild(li);
    };

    if (incoming.length > 0) {
        const header = document.createElement('div');
        header.className = "px-3 py-1.5 bg-blue-50/50 dark:bg-blue-900/10 text-[10px] font-bold text-blue-600 dark:text-blue-400 border-b border-blue-100 dark:border-blue-800";
        header.textContent = "IN ENTRATA (CLOUD)";
        fragment.appendChild(header);
        
        incoming.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        incoming.forEach(m => renderItem(m, true));
    }

    if (modificati.length > 0) {
        if (incoming.length > 0) {
            const header = document.createElement('div');
            header.className = "px-3 py-1.5 bg-stone-50 dark:bg-stone-800/50 text-[10px] font-bold text-stone-500 border-b border-stone-200 dark:border-stone-700 mt-2";
            header.textContent = "LOCALE";
            fragment.appendChild(header);
        }
        modificati.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        modificati.forEach(m => renderItem(m, false));
    }
    
    list.appendChild(fragment);
};

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
        <div id="vault-delete-modal" class="modal-overlay z-[150] flex" style="background: rgba(0,0,0,0.5); align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
            <div class="modal-window p-6 text-center max-w-sm bg-white rounded-lg shadow-xl">
                <i data-lucide="alert-triangle" class="w-12 h-12 text-amber-500 mx-auto mb-4"></i>
                <h3 class="text-xl font-bold mb-2">Rimuovi Vault</h3>
                <p class="text-sm text-stone-600 mb-6">
                    Vuoi solo rimuovere il Vault <strong>${vaultName}</strong> dall'elenco o eliminare definitivamente tutti i suoi file dal computer?
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
            list.innerHTML = '';
            if (recents && recents.length > 0) {
                recents.forEach(item => {
                    const path = item.path || item;
                    const isShared = item.isShared || false;
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
                        nameSpan.innerHTML = `<i data-lucide="cloud" class="w-4 h-4 text-blue-600 shrink-0" title="Vault Condiviso"></i> <span>${name}</span>`;
                    } else {
                        nameSpan.textContent = name;
                    }
                    
                    divContainer.appendChild(nameSpan);

                    if (isCurrent) {
                        const checkIcon = document.createElement('div');
                        checkIcon.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-amber-600 shrink-0"></i>';
                        divContainer.appendChild(checkIcon.firstChild);
                    } else {
                        const delBtn = document.createElement('button');
                        delBtn.className = 'p-1 rounded hover:bg-red-100 text-stone-400 hover:text-red-600 transition-colors shrink-0 opacity-50 hover:opacity-100';
                        delBtn.innerHTML = '<i data-lucide="x" class="w-3.5 h-3.5"></i>';
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
            
            if (isCurrentShared) {
                nameEl.innerHTML = `<div class="flex items-center gap-1.5"><i data-lucide="cloud" class="w-4 h-4 text-blue-600 shrink-0"></i> <span>${vaultName}</span></div>`;
                if (window.lucide) lucide.createIcons({ nodes: [nameEl] });
            } else {
                nameEl.textContent = vaultName;
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
