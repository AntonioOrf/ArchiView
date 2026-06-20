// @ts-nocheck
// Campi su cui viene eseguita la ricerca testuale (whitelist esplicita)
const SEARCH_FIELDS = ['segnatura', 'titolo', 'autore', 'datazione', 'supporto', 'incipit', 'explicit', 'note', 'tags', 'trascrizione', 'descrizione', 'provenienza', 'contenuto', 'lingua'];

function objectContainsString(m, str) {
    for (const k of SEARCH_FIELDS) {
        const v = m[k];
        if (!v) continue;
        if (typeof v === 'string' && v.toLowerCase().includes(str)) return true;
        if (typeof v === 'number' && v.toString().includes(str)) return true;
    }
    return false;
}

window.currentPage = 0;
const PAGE_SIZE = 50;

// renderMain è sincrona: non usa await, non deve essere async
function renderMain(resetPage = true) {
    if (resetPage) window.currentPage = 0;

    const grid = document.getElementById('manoscritti-grid');
    const search = document.getElementById('search-input').value.trim().toLowerCase();
    
    window.activeTags = window.activeTags || new Set();
    const isGlobalSearch = search !== '' || window.activeTags.size > 0;

    if (isGlobalSearch) {
        document.getElementById('titolo-cartella-attuale').textContent = window.t("search_results_title", "Global Search Results");
    } else {
        const partiTitolo = window.cartellaAttuale.split('/');
        document.getElementById('titolo-cartella-attuale').textContent = partiTitolo[partiTitolo.length - 1];
    }

    // Filtro per Cartella (se non globale) E per Ricerca Profonda E per (Multi) Tag
    const filtered = appData.manoscritti.filter(m => {
        const matchCartella = isGlobalSearch ? true : m.cartella === window.cartellaAttuale;

        // Ricerca veramente globale su ogni campo (testo, metadati, trascrizioni, allegati)
        const matchSearch = search === '' || objectContainsString(m, search);

        // Controllo tag (AND logico: il manoscritto deve avere TUTTI i tag selezionati)
        const mTags = (m.tags || '').toLowerCase();
        let matchTag = true;
        if (window.activeTags.size > 0) {
            for (const tag of window.activeTags) {
                if (!mTags.includes(tag)) {
                    matchTag = false;
                    break;
                }
            }
        }

        return matchCartella && matchSearch && matchTag;
    });

    document.getElementById('counter-results').textContent = `Documenti trovati: ${filtered.length}`;
    grid.innerHTML = '';

    const btnDeleteFolder = document.getElementById('btn-delete-folder');
    const paginationControls = document.getElementById('pagination-controls');

    if (filtered.length === 0) {
        grid.classList.add('hidden');
        if (paginationControls) {
            paginationControls.classList.add('hidden');
            paginationControls.classList.remove('flex');
        }
        document.getElementById('empty-state').classList.remove('hidden');

        const manoscrittiTotaliInCartella = appData.manoscritti.filter(m => m.cartella === window.cartellaAttuale).length;
        if (manoscrittiTotaliInCartella === 0 && window.cartellaAttuale !== 'Generale' && search === '') {
            btnDeleteFolder.classList.remove('hidden');
            btnDeleteFolder.classList.add('flex');
        } else {
            btnDeleteFolder.classList.add('hidden');
            btnDeleteFolder.classList.remove('flex');
        }
    } else {
        grid.classList.remove('hidden');
        document.getElementById('empty-state').classList.add('hidden');

        // Paginazione
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        if (window.currentPage >= totalPages) window.currentPage = Math.max(0, totalPages - 1);
        const paginated = filtered.slice(window.currentPage * PAGE_SIZE, (window.currentPage + 1) * PAGE_SIZE);

        if (paginationControls) {
            if (totalPages > 1) {
                paginationControls.classList.remove('hidden');
                paginationControls.classList.add('flex');
                document.getElementById('page-indicator').textContent = `Pagina ${window.currentPage + 1} di ${totalPages}`;
                const btnPrev = document.getElementById('btn-prev-page');
                const btnNext = document.getElementById('btn-next-page');
                if (btnPrev) btnPrev.disabled = window.currentPage === 0;
                if (btnNext) btnNext.disabled = window.currentPage === totalPages - 1;
            } else {
                paginationControls.classList.add('hidden');
                paginationControls.classList.remove('flex');
            }
        }

        // Creazione Card con DocumentFragment per un unico reflow DOM
        const fragment = document.createDocumentFragment();

        for (const m of paginated) {
            const isSelected = window.selectedRecords && window.selectedRecords.includes(m.id);
            const hasSelection = window.selectedRecords && window.selectedRecords.length > 0;
            const div = document.createElement('div');
            div.className = `card-scheda bg-white p-4 relative flex flex-col justify-between cursor-pointer group ${isSelected ? 'ring-2 ring-amber-500 bg-amber-50/20' : ''}`;
            div.id = 'card-' + m.id;
            
            div.onclick = (e) => {
                if (e.target.closest('button') || e.target.closest('a') || e.target.tagName.toLowerCase() === 'input') return;
                if (typeof window.selectItem === 'function') {
                    window.selectItem(m.id, e);
                }
            };



            // Logica Drag and Drop
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'manoscritto', id: m.id }));
                e.dataTransfer.effectAllowed = 'move';
                div.classList.add('opacity-50');
            };
            div.ondragend = () => div.classList.remove('opacity-50');
            
            // Context menu per Copia/Incolla
            div.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof showRecordContextMenu === 'function') {
                    showRecordContextMenu(e, m.id);
                }
            };

            const allegatiRender = normalizzaAllegati(m);

            let allegatoHTML = '';
            const btnTrascriviModifica = `
                <button onclick="editItem('${m.id}')" class="btn btn-secondary flex-1 text-xs uppercase tracking-wider tutorial-modifica-btn">
                    <span class="text-xs font-bold uppercase tracking-wider">${window.t('btn_edit') || 'Modifica'}</span>
                </button>
                <button onclick="apriTrascrizione('${m.id}')" class="btn flex-1 text-xs uppercase tracking-wider tutorial-trascrivi-btn" style="background-color: var(--color-primary-light); color: var(--color-primary-hover); border: 1px solid var(--color-primary-border);">
                    <span class="text-xs font-bold uppercase tracking-wider">${window.t('btn_transcribe') || 'Trascrivi'}</span>
                </button>
            `;

            let btnVediPdfPiccolo = '';

            if (allegatiRender.length > 0) {
                const textAllegati = allegatiRender.length === 1 ? '1 documento allegato' : `${allegatiRender.length} documenti allegati`;
                btnVediPdfPiccolo = `<span class="text-xs text-stone-500 font-medium my-auto mr-auto flex items-center gap-1"><i data-lucide="paperclip" class="w-3.5 h-3.5"></i> ${textAllegati}</span>`;
                allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
            } else {
                allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
            }

            let tagsHTML = '';
            if (m.tags) {
                const tagsList = m.tags.split(',').map(t => t.trim()).filter(t => t);
                if (tagsList.length > 0) {
                    tagsHTML = '<div class="flex flex-wrap gap-1 mt-2">' + tagsList.map(t => `<span class="card-tag">${escapeHTML(t)}</span>`).join('') + '</div>';
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
                            const labelStr = window.t('field_' + campo) !== 'field_' + campo ? window.t('field_' + campo) : (conf.label || campo);
                            infoHTML += `<div class="mt-3 mb-1"><span class="font-bold text-xs uppercase tracking-wider opacity-70 border-b border-stone-200/50 pb-1">${labelStr}</span></div>`;
                            m[campo].forEach(item => {
                                const k = item.k || item.ruolo || '';
                                const v = item.v || item.nome || '';
                                if (k || v) {
                                    infoHTML += `<p class="truncate pl-2 border-l-2 border-amber-200/50 mb-0.5"><b>${escapeHTML(k)}:</b> ${escapeHTML(v)}</p>`;
                                }
                            });
                        }
                    } else {
                        const label = window.t('field_' + campo) !== 'field_' + campo ? window.t('field_' + campo) : (conf.label || campo);
                        if (campo === 'note') infoHTML += `<p class="text-stone-500 mt-2 text-xs italic line-clamp-3 leading-relaxed border-l-2 border-amber-200 pl-2" title="${escapeHTML(m.note)}">${escapeHTML(m.note)}</p>`;
                        else if (campo === 'titolo') infoHTML += `<p class="truncate mt-1"><b>${escapeHTML(label)}:</b> <i>${escapeHTML(m.titolo)}</i></p>`;
                        else infoHTML += `<p class="truncate mt-1"><b>${escapeHTML(label)}:</b> ${escapeHTML(m[campo])}</p>`;
                    }
                }
            });

            let authorBadgeHTML = '';
            if (m.creatoDa || m.modificatoDa) {
                const autore = m.modificatoDa || m.creatoDa; // Mostriamo chi ha fatto l'ultima azione
                const titoloMeta = m.modificatoDa && m.creatoDa && m.modificatoDa !== m.creatoDa 
                    ? `Creato da ${escapeHTML(m.creatoDa)} - Modificato da ${escapeHTML(m.modificatoDa)}` 
                    : `Autore: ${escapeHTML(autore)}`;

                authorBadgeHTML = `<span title="${titoloMeta}" class="flex items-center gap-1 text-[10px] font-semibold text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded-sm">
                    <i data-lucide="user" class="w-3 h-3"></i> ${escapeHTML(autore)}
                </span>`;
            }

            let dateHTML = '';
            if (m.lastModified) {
                const dataFormat = new Date(m.lastModified).toLocaleDateString('it-IT', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                });
                dateHTML = `<div class="text-[9px] text-stone-400 font-mono mt-2.5 pt-2 border-t border-dashed border-stone-200/50 text-right">${dataFormat}</div>`;
            }

            // Checkbox di selezione (visibile quando c'è almeno un record selezionato)
            const checkboxHTML = hasSelection ? `
                <div class="absolute top-2 left-2 z-10" onclick="event.stopPropagation(); window.selectItem('${m.id}', event)">
                    <div class="flex items-center justify-center w-5 h-5 rounded border-2 shadow-sm cursor-pointer transition-all duration-150
                        ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white/90 border-stone-300 text-transparent hover:border-amber-400'}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                </div>
            ` : '';

            div.innerHTML = `
                ${checkboxHTML}
                <div class="px-1 ${hasSelection ? 'pl-7' : ''}">
                    <div class="flex justify-between items-start gap-2 mb-2">
                        <h3 class="card-title mb-0" title="${escapeHTML(m.segnatura)}">${escapeHTML(m.segnatura)}</h3>
                        <div class="flex items-center gap-1.5 shrink-0 mt-0">
                            ${authorBadgeHTML}
                            <span class="card-badge shrink-0">${escapeHTML(tipoDoc ? (window.t('model_' + tipoDoc.id) !== 'model_' + tipoDoc.id ? window.t('model_' + tipoDoc.id) : tipoDoc.nome) : 'Documento')}</span>
                        </div>
                    </div>
                    <div class="space-y-1 text-sm">
                        ${infoHTML}
                        ${tagsHTML}
                    </div>
                    ${allegatoHTML}
                    ${dateHTML}
                </div>
                <div class="mt-3 pt-3 border-t border-amber-100 flex justify-end gap-2">
                    ${btnVediPdfPiccolo}
                    <button onclick="esportaManoscritto('${m.id}')" class="btn btn-ghost btn-icon" title="Esporta"><i data-lucide="download" class="w-4 h-4"></i></button>
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

window.pendingTabSwitch = null;

function switchTab(tab) {
    const vAdd = document.getElementById('view-add');
    if (!vAdd.classList.contains('hidden-tab') && window.isFormDirty && tab !== 'add') {
        window.pendingTabSwitch = tab;
        if (window.mostraBottomConfirm) {
            window.mostraBottomConfirm(window.t('unsaved_prompt') || "Ci sono modifiche non salvate alla scheda. Sei sicuro di voler uscire perdendo le modifiche?", () => {
                window.isFormDirty = false;
                switchTab(window.pendingTabSwitch);
            });
            return;
        }
    }

    const vList = document.getElementById('view-list');
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
    
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
}

function extractSnippet(val, search) {
    if (!val) return null;
    const strVal = val.toString();
    
    const cleanText = strVal.replace(/<[^>]*>/g, '');
    
    const lowerStr = cleanText.toLowerCase();
    const idx = lowerStr.indexOf(search);
    
    if (idx !== -1) {
        // Estrai una frase più lunga
        const start = Math.max(0, idx - 60);
        const end = Math.min(cleanText.length, idx + search.length + 80);
        let snippet = cleanText.substring(start, end).trim();
        
        if (start > 0) snippet = '...' + snippet;
        if (end < cleanText.length) snippet = snippet + '...';

        snippet = escapeHTML(snippet);
        const escapedSearch = escapeHTML(search);

        // Evidenzia la parola trovata
        const regex = new RegExp(`(${escapedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        snippet = snippet.replace(regex, '<span class="bg-amber-200 text-amber-900 font-bold px-0.5 rounded">$1</span>');
        return snippet;
    }
    return null;
}

function renderSearchSuggestions() {
    const search = document.getElementById('search-input').value.trim().toLowerCase();
    const container = document.getElementById('search-suggestions');
    container.innerHTML = '';

    if (!search) {
        container.innerHTML = '<div class="p-4 text-xs text-stone-400 italic text-center">Digita per vedere i risultati...</div>';
        return;
    }

    const matches = [];
    for (const m of appData.manoscritti) {
        let matchFound = null;
        const keys = Object.keys(m);
        
        // Ordiniamo le chiavi per dare priorità a segnatura e titolo
        keys.sort((a, b) => {
            if (a === 'segnatura') return -1;
            if (b === 'segnatura') return 1;
            if (a === 'titolo') return -1;
            if (b === 'titolo') return 1;
            return 0;
        });

        for (const key of keys) {
            if (key === 'id' || key === 'cartella' || key === 'allegati' || key === 'tipoDocumento') continue;
            const snippet = extractSnippet(m[key], search);
            if (snippet) {
                let readableKey = key.charAt(0).toUpperCase() + key.slice(1);
                matchFound = { item: m, key: readableKey, snippet: snippet };
                break; // Mostriamo solo il primo campo in cui matcha per questo documento
            }
        }
        if (matchFound) {
            matches.push(matchFound);
        }
        if (matches.length >= 15) break; // Massimo 15 suggerimenti
    }

    if (matches.length === 0) {
        container.innerHTML = `<div class="p-4 text-xs text-stone-400 italic text-center">${window.t('no_search_match')}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    matches.forEach(match => {
        const div = document.createElement('div');
        div.className = "p-2 border-b border-stone-200 hover:bg-amber-50 cursor-pointer transition-colors";
        div.onclick = () => {
            // Scorriamo fino alla scheda nella griglia a destra
            const cardId = 'card-' + match.item.id;
            const targetCard = document.getElementById(cardId);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Evidenziazione temporanea per indicare quale scheda è stata trovata
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
        };
        div.innerHTML = `
            <div class="text-xs font-bold text-stone-800 truncate mb-1">${escapeHTML(match.item.segnatura || match.item.titolo || 'Senza Titolo')}</div>
            <div class="text-[10px] text-stone-600 leading-tight">
                <span class="font-semibold text-amber-700 capitalize">${escapeHTML(match.key)}:</span> ${match.snippet}
            </div>
        `;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
}

window.cambiaPagina = function(dir) {
    window.currentPage += dir;
    renderMain(false);
    // Scrolla la vista all'inizio
    const viewList = document.getElementById('view-list');
    if (viewList) viewList.scrollTo({ top: 0, behavior: 'smooth' });
};
